import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAudioHandler} from '../netlify/lib/ncn-audio-api.mjs';
import {createSePayRouter} from '../netlify/lib/ncn-sepay-router.mjs';
import {verifyIdentity} from '../netlify/lib/ncn-event-api.mjs';
import {createLibraryPageHandler} from '../netlify/lib/ncn-library-page.mjs';
import {AUDIO_PRICE,AUDIO_ORIGINAL_PRICE,MAX_AUDIO_SAMPLE_BYTES} from '../public/assets/ncn-audio/shared.js';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const origin='https://audio.example.test',now=Date.parse('2026-11-13T09:04:23Z'),secret='test-audio-key-'.repeat(4);
const bankDetails={bank:'VietinBank',account:'0000000000',name:'Tai khoan thu nghiem'};
const member={id:'member',name:'Thành viên thử nghiệm',email:'member@example.test',vip:true};
const staff={...member,audio:true},admin={...member,admin:true};
const initial={name:'Khách thử nghiệm',phone:'0900 123 456',channel:'Zalo',date:'2026-11-15',script:'Kịch bản\nthu âm thử nghiệm.',urgent:true,confirm:true};
function request(route,data,headers={}){
 const raw=Buffer.isBuffer(data),method=data===undefined?'GET':'POST';
 return new Request(origin+'/.netlify/functions/ncn-audio?route='+route,{method,headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':raw?'audio/mpeg':'application/json'}),...headers},...(data===undefined?{}:{body:raw?data:JSON.stringify(data)})});
}
function fixture({user=null,ready=true,production=true,time=now}={}){
 const store=memoryStories(),ledger=memoryStories();
 const call=(route,data,headers)=>createAudioHandler({store:()=>store,bank:bankDetails,production:()=>production,now:()=>time,paymentReady:()=>ready,verify:async()=>user})(request(route,data,headers));
 const webhook=createSePayRouter({store:()=>ledger,audioStore:()=>store,bank:bankDetails,production:()=>production,now:()=>time,config:()=>({secret})});
 const bank=(data={},key=secret)=>{
  const transactionDate=new Date(time+7*3600000).toISOString().slice(0,19).replace('T',' ');
  const transaction={id:991,gateway:bankDetails.bank,accountNumber:bankDetails.account,transferType:'in',transferAmount:100000,content:'',transactionDate,referenceCode:'fixture-991',...data};
  const body=JSON.stringify(transaction),stamp=String(time/1000),sig=createHmac('sha256',key).update(stamp+'.'+body).digest('hex');
  return webhook(new Request(origin+'/.netlify/functions/ncn-sepay-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-sepay-timestamp':stamp,'x-sepay-signature':'sha256='+sig},body}));
 };
 return {store,ledger,call,bank};
}
const codeOf=async response=>(await response.json()).order.code;
const fakeMp3=Buffer.concat([Buffer.from([255,251,144,100]),Buffer.alloc(510)]);

test('prices are server controlled and opening the form or preview creates no payment',async()=>{
 const f=fixture({production:false});
 assert.deepEqual(await (await f.call('setup')).json(),{ready:false,amount:AUDIO_PRICE,originalAmount:AUDIO_ORIGINAL_PRICE,samples:[]});
 assert.equal((await f.call('create',{...initial,token:randomUUID()})).status,503);
 assert.equal(f.store.entries.size,0);
 assert.equal((await fixture({ready:false}).call('create',{...initial,token:randomUUID()})).status,503);
});
test('guest creates one persistent order with a token; public status omits private details',async()=>{
 const f=fixture(),token=randomUUID(),data={...initial,token,amount:1,state:'paid'};
 const [a,b]=await Promise.all([f.call('create',data),f.call('create',data)]);
 assert.equal(a.status,201);assert.equal(b.status,201);
 const {order}=await a.json();
 assert.equal(order.code,await codeOf(b));assert.match(order.code,/^NCNAUD[A-F0-9]{16}$/);
 assert.equal(order.amount,100000);assert.equal(order.payment,'pending');
 const qr=new URL(order.qr);assert.equal(qr.searchParams.get('des'),order.code);assert.equal(qr.searchParams.get('amount'),'100000');assert.equal(qr.searchParams.get('acc'),bankDetails.account);
 assert.equal([...f.store.entries.keys()].filter(k=>k.startsWith('history-')).length,1);
 const response=await f.call('status',{token}),payload=await response.text();
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 for(const secretValue of [initial.name,initial.script,initial.phone,token,'tokenHash'])assert.equal(payload.includes(secretValue),false);
 assert.equal((await f.call('status',{token:randomUUID()})).status,404);
 assert.equal((await f.call('status',{token:order.code})).status,400);
});
test('booking validates contact, date and confirmation and rejects cross-site submission',async()=>{
 const f=fixture();
 for(const change of [{name:''},{phone:'123'},{date:'2026-11-12'},{date:'2026-11-31'},{confirm:false},{channel:'Other'},{script:'x'.repeat(8001)}]){
  assert.equal((await f.call('create',{...initial,token:randomUUID(),...change})).status,400,JSON.stringify(change).slice(0,70));
 }
 assert.equal((await f.call('create',{...initial,token:randomUUID()},{Origin:'https://elsewhere.test'})).status,403);
 assert.equal(f.store.entries.size,0);
});
test('the earliest delivery date rolls over at midnight in Vietnam, including at year-end',async()=>{
 for(const [time,today,tomorrow] of [
  ['2026-12-31T16:59:59Z','2026-12-31','2027-01-01'],
  ['2026-12-31T17:00:00Z','2027-01-01','2027-01-02']
 ]){
  const f=fixture({time:Date.parse(time)}),data={...initial,token:randomUUID()};
  const response=await f.call('create',{...data,date:today});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/từ ngày mai/);
  assert.equal(f.store.entries.size,0);
  assert.equal((await f.call('create',{...data,date:tomorrow})).status,201);
 }
});
test('only verified Admin and Audio roles can view history or add or remove samples',async()=>{
 for(const [user,status] of [[null,401],[member,403],[staff,200],[admin,200]]){
  const f=fixture({user});
  assert.deepEqual(await (await f.call('access')).json(),{allowed:status===200,signedIn:!!user});
  assert.equal((await f.call('history')).status,status);
  assert.equal((await f.call('add-sample&title=Mau',fakeMp3)).status,status===200?201:status);
  assert.equal((await f.call('remove-sample',{id:randomUUID()})).status,status===200?200:status);
 }
 const req=new Request(origin,{headers:{Cookie:'nf_jwt=fixture'}});
 const verify=roles=>verifyIdentity(req,{url:origin},async()=>Response.json({id:'fixture',email:'fixture@example.test',confirmed_at:'2026-11-13',app_metadata:{roles},user_metadata:{audio:true,roles:['audio','admin']}}),{includeAudio:true});
 assert.equal((await verify(['vip'])).audio,false);
 assert.equal((await verify(['audio'])).audio,true);
});
test('signed incoming transfer settles the exact Audio amount, with replay-safe history and work updates',async()=>{
 const f=fixture({user:staff}),token=randomUUID(),code=await codeOf(await f.call('create',{...initial,token}));
 const load=async()=>{const r=await f.call('history');assert.equal(r.status,200);const {orders}=await r.json();assert.equal(orders.length,1);assert.ok(!('tokenHash' in orders[0]));return orders[0];};
 let order=await load();
 assert.equal(order.booking.script,initial.script);assert.equal(order.booking.phone,'0900123456');
 assert.equal((await f.call('update',{code,version:order.version,state:'recording',note:''})).status,409);
 assert.equal((await f.call('update',{code,version:order.version,state:'new',note:'Chờ chuyển khoản'})).status,200);
 assert.equal((await f.bank({content:code},'different-key')).status,401);
 assert.equal((await f.bank({content:code,transferType:'out'})).status,200);
 assert.equal((await f.bank({content:code,accountNumber:'00000'})).status,200);
 assert.equal((await f.bank({content:code,transferAmount:99999})).status,200);
 order=await load();assert.equal(order.payment.state,'review');
 assert.equal((await f.bank({content:'CHUYEN TIEN '+code,id:992,referenceCode:'fixture-992'})).status,200);
 order=await load();assert.equal(order.payment.state,'paid');assert.equal(order.payment.amount,100000);
 const version=order.version;
 assert.equal((await f.bank({content:'CHUYEN TIEN '+code,id:992,referenceCode:'fixture-992'})).status,200);
 assert.equal((await load()).version,version);
 assert.equal(f.store.entries.get('receipt-992').data.code,code);
 const update=await f.call('update',{code,version,state:'recording',note:'Đã liên hệ Zalo'});
 assert.equal(update.status,200);
 assert.equal((await f.call('update',{code,version,state:'done',note:''})).status,409);
 order=await load();assert.equal(order.work.state,'recording');assert.equal(order.work.events[0].note,'Chờ chuyển khoản');assert.equal(order.work.events[1].by,staff.name);
 assert.equal((await f.call('update',{code,version:order.version,state:'done',note:'Đã gửi bản thu'})).status,200);
 const state=(await (await f.call('status',{token})).json()).order;
 assert.equal(state.payment,'paid');assert.equal(state.work,'done');assert.equal(state.qr,null);
});
test('duplicate bank references and mixed order codes cannot settle a second order or grant VIP',async()=>{
 const f=fixture({user:staff});
 const a=await codeOf(await f.call('create',{...initial,token:randomUUID()})),b=await codeOf(await f.call('create',{...initial,token:randomUUID()}));
 await f.bank({content:a});
 assert.equal((await f.bank({content:b,id:991})).status,409);
 assert.equal((await (await f.bank({content:b,id:992})).json()).review,true);
 assert.equal((await (await f.bank({content:b+' '+a,id:993,referenceCode:'fixture-993'})).json()).review,true);
 assert.equal((await (await f.bank({content:b+' NCN'+'A'.repeat(20),id:994,referenceCode:'fixture-994'})).json()).review,true);
 assert.deepEqual(await (await f.bank({content:'SePay test probe',id:0})).json(),{success:true});
 const {orders}=await (await f.call('history')).json();
 assert.equal(orders.find(x=>x.code===b).payment.state,'pending');
 assert.ok([...f.ledger.entries.keys()].every(key=>key.startsWith('reference-')));
});
test('published MP3 samples are playable with byte ranges, and removal revokes access',async()=>{
 const f=fixture({user:staff});
 assert.equal((await f.call('add-sample&title=HTML',Buffer.from('<html><script>bad</script>'))).status,415);
 assert.equal((await f.call('add-sample&title=Too-large',fakeMp3,{'Content-Length':String(MAX_AUDIO_SAMPLE_BYTES+1)})).status,413);
 const add=await f.call('add-sample&title=Giong-mau',fakeMp3);assert.equal(add.status,201);
 const [{id,title}]=(await add.json()).samples;
 assert.equal(title,'Giong-mau');
 const response=await f.call('sample&id='+id,undefined,{Range:'bytes=0-3'});
 assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');
 assert.equal(response.headers.get('content-range'),'bytes 0-3/'+fakeMp3.length);
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),fakeMp3.subarray(0,4));
 assert.equal((await f.call('sample&id='+id,undefined,{Range:'bytes=9999-'})).status,416);
 assert.equal((await f.call('remove-sample',{id})).status,200);
 assert.equal((await f.call('sample&id='+id)).status,404);
});
test('the live homepage first-paint tool and menu both place Audio first with a NEW badge',async()=>{
 const handler=createLibraryPageHandler({seed:[],state:async()=>({catalog:[]}),homeShell:()=>readFile('public/index.html','utf8')});
 const html=await (await handler(new Request(origin+'/'))).text();
 assert.match(html,/<div id="ncn-tool-grid"[^>]*><article [^>]*data-ncn-tool="audio"[\s\S]*?<span class="ncn-tool-badge ncn-new-badge">NEW<\/span>/);
 assert.match(html,/<nav id="ncn-navigation"[^>]*><p class="ncn-nav-label">Mở nhanh<\/p><a [^>]*href="\/thu-audio\/"[^>]*>[\s\S]*?<b class="ncn-nav-pill ncn-new-badge">NEW<\/b>/);
});
