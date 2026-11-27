import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,generateKeyPairSync,createVerify} from 'node:crypto';
import {createPushHandler,queueAudioPush,dispatchAudioPush,sendFCM,clearPushToken,pushCredentials,FIREBASE_PROJECT} from '../netlify/lib/ncn-push.mjs';
import {createAudioOrder,settleAudioOrder,readStaffAudioOrder} from '../netlify/lib/ncn-audio-orders.mjs';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const origin='https://ncn.test',now=Date.parse('2026-11-27T04:00:00Z'),code='NCNAUD0123456789ABCDEF';
const token='fixture-token-'.repeat(8),deviceId=randomUUID();
function fixture(){
 const store=memoryStories();let user=null;
 const call=(route,data,requestOrigin=origin)=>createPushHandler({production:()=>true,store:()=>store,verify:async()=>user,credentials:()=>null,now:()=>now})(new Request(origin+'/.netlify/functions/ncn-push?route='+route,{method:data?'POST':'GET',headers:{Origin:requestOrigin,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}));
 return {store,call,login(value){user=value;}};
}
test('only freshly verified Admins can register a device, and cross-origin requests are denied',async()=>{
 const f=fixture();assert.equal((await f.call('register',{deviceId,token})).status,401);
 f.login({id:'audio',audio:true,user_metadata:{admin:true}});assert.equal((await f.call('register',{deviceId,token})).status,403);
 f.login({id:'admin',admin:true});assert.equal((await f.call('register',{deviceId,token},'https://evil.test')).status,403);
 assert.equal((await f.call('register',{deviceId:'../index',token})).status,400);
 const result=await (await f.call('register',{deviceId,token})).json();assert.equal(result.registered,true);assert.equal(result.ready,false);assert.match(result.secret,/^[a-f0-9]{64}$/);
 const saved=await f.store.get('device-'+deviceId);assert.equal(saved.owner,'admin');assert.ok(!JSON.stringify(saved).includes(result.secret));
 const publicState=await (await f.call('status')).json();assert.deepEqual(publicState,{admin:true,signedIn:true,ready:false});
});
test('logout can revoke its own device after the cookie is cleared; old secrets cannot revoke a new binding',async()=>{
 const f=fixture();f.login({id:'admin',admin:true});
 const a=await (await f.call('register',{deviceId,token})).json();f.login(null);
 assert.equal((await f.call('rotate',{deviceId,token:token+'new',secret:'a'.repeat(64)})).status,401);
 assert.equal((await f.call('rotate',{deviceId,token:token+'new',secret:a.secret})).status,200);assert.equal((await f.store.get('device-'+deviceId)).token,token+'new');
 assert.equal((await f.call('revoke',{deviceId,secret:a.secret})).status,200);assert.equal((await f.store.get('device-'+deviceId)).active,false);
 f.login({id:'admin2',admin:true});const b=await (await f.call('register',{deviceId,token})).json();
 await f.call('revoke',{deviceId,secret:a.secret});assert.equal((await f.store.get('device-'+deviceId)).active,true);
 await f.call('revoke',{deviceId,secret:b.secret});assert.equal((await f.store.get('device-'+deviceId)).active,false);
});
test('booking and payment enqueue durable, deduplicated events without personal booking data',async()=>{
 const store=memoryStories(),data={token:randomUUID(),name:'Khách thử riêng tư',phone:'0900123456',channel:'Zalo',date:'2026-11-28',script:'Nội dung riêng tư',urgent:false,confirm:true};
 const order=await createAudioOrder(store,data,now);await createAudioOrder(store,data,now);
 const tx={id:22,amount:79000,reference:'fixture',occurredAt:new Date(now).toISOString()};
 await settleAudioOrder(store,order.code,tx,now);await settleAudioOrder(store,order.code,tx,now);
 const events=[...store.entries].filter(([key])=>key.startsWith('push-'));assert.equal(events.length,2);
 for(const [,value]of events){const json=JSON.stringify(value);assert.ok(!json.includes(data.name));assert.ok(!json.includes(data.phone));assert.ok(!json.includes(data.script));}
 const staff=await readStaffAudioOrder(store,order.code);assert.equal(staff.booking.name,data.name);assert.equal(staff.tokenHash,undefined);
 await assert.rejects(readStaffAudioOrder(store,'../x'),e=>e.status===400);
});
test('an outbox failure does not break checkout',async()=>{
 const store=memoryStories(),write=store.setJSON.bind(store);store.setJSON=(key,...args)=>key.startsWith('push-')?Promise.reject(Error('Outbox unavailable')):write(key,...args);
 const order=await createAudioOrder(store,{token:randomUUID(),name:'Thử',phone:'0900123456',channel:'LINE',date:'2026-11-28',script:'Thử thu',confirm:true},now);assert.equal(order.amount,79000);
});
test('dispatch claims prevent parallel duplicates, retry only failed devices and skip revoked or expired devices',async()=>{
 const audio=memoryStories(),devices=memoryStories();await queueAudioPush(audio,{code,createdAt:new Date(now).toISOString()},'new',now);
 for(const [deviceId,active,expiresAt]of [['one',true,now+3600000],['two',true,now+3600000],['off',false,now+3600000],['expired',true,now-1]])await devices.setJSON('device-'+deviceId,{deviceId,active,expiresAt,token:deviceId});
 const calls=[];let failTwo=true;const send=async(_credentials,token,event)=>{calls.push(token);assert.deepEqual(Object.keys(event).filter(k=>['name','phone','script'].includes(k)),[]);return {ok:token!=='two'||!failTwo};};
 await Promise.all([dispatchAudioPush({audio,devices,credentials:{},send,now}),dispatchAudioPush({audio,devices,credentials:{},send,now})]);
 assert.deepEqual(calls.sort(),['one','two']);failTwo=false;
 await dispatchAudioPush({audio,devices,credentials:{},send,now:now+120000});assert.deepEqual(calls,['one','two','two']);
 await dispatchAudioPush({audio,devices,credentials:{},send,now:now+240000});assert.equal(calls.length,3);
});
test('completed outbox entries cannot starve later orders',async()=>{
 const audio=memoryStories(),devices=memoryStories();for(let i=0;i<105;i++)await audio.setJSON('push-old-'+i,{state:'done'});
 await queueAudioPush(audio,{code,createdAt:new Date(now).toISOString()},'new',now);await devices.setJSON('device-one',{deviceId:'one',token,active:true,expiresAt:now+1000});
 assert.equal((await dispatchAudioPush({audio,devices,credentials:{},send:async()=>({ok:true}),now})).sent,1);
});
test('FCM uses a signed OAuth assertion and sends only a generic data event to the fixed project',async()=>{
 clearPushToken();const keys=generateKeyPairSync('rsa',{modulusLength:2048}),credentials={project_id:FIREBASE_PROJECT,client_email:'ncn-push@'+FIREBASE_PROJECT+'.iam.gserviceaccount.com',private_key:keys.privateKey.export({type:'pkcs8',format:'pem'})};
 assert.ok(pushCredentials({NCN_FIREBASE_SERVICE_ACCOUNT:JSON.stringify(credentials)}));assert.equal(pushCredentials({NCN_FIREBASE_SERVICE_ACCOUNT:JSON.stringify({...credentials,project_id:'another'})}),null);
 const urls=[],fetcher=async(url,options)=>{
  urls.push(url);
  if(url==='https://oauth2.googleapis.com/token'){
   const assertion=new URLSearchParams(options.body).get('assertion'),parts=assertion.split('.'),verify=createVerify('RSA-SHA256');verify.update(parts[0]+'.'+parts[1]);verify.end();assert.ok(verify.verify(keys.publicKey,parts[2],'base64url'));
   const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.aud,url);assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');return Response.json({access_token:'fixture-oauth',expires_in:3600});
  }
  assert.equal(url,'https://fcm.googleapis.com/v1/projects/'+FIREBASE_PROJECT+'/messages:send');const body=JSON.parse(options.body);assert.deepEqual(body.message.data,{eventId:'new-'+code,kind:'new',code});assert.equal(body.message.notification,undefined);assert.equal(body.message.android.priority,'high');return Response.json({name:'fixture-message'});
 };
 const event={id:'new-'+code,kind:'new',code};assert.equal((await sendFCM(credentials,token,event,{fetcher,now})).ok,true);await sendFCM(credentials,token,event,{fetcher,now});assert.equal(urls.filter(x=>x.includes('oauth2')).length,1);
});
