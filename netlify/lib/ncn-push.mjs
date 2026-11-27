import {createHash,randomBytes,randomUUID,createSign,timingSafeEqual} from 'node:crypto';

export const PUSH_STORE='ncn-android-push-v1';
export const FIREBASE_PROJECT='nguyencongnghe-92793';
const sha=value=>createHash('sha256').update(value).digest('hex');
const devicePattern=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const codePattern=/^NCNAUD[A-F0-9]{16}$/;
const headers={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function pushCredentials(env=process.env){
 try{
  const value=JSON.parse(env.NCN_FIREBASE_SERVICE_ACCOUNT||'null');
  return value?.project_id===FIREBASE_PROJECT&&typeof value.client_email==='string'&&value.client_email.endsWith('@'+FIREBASE_PROJECT+'.iam.gserviceaccount.com')&&typeof value.private_key==='string'&&value.private_key.includes('BEGIN PRIVATE KEY')?value:null;
 }catch{return null;}
}
async function body(req){
 if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'Dữ liệu cần ở định dạng JSON.');
 if(Number(req.headers.get('content-length')||0)>7000)fail(413,'Dữ liệu quá lớn.');
 const text=await req.text();if(Buffer.byteLength(text)>7000)fail(413,'Dữ liệu quá lớn.');
 let value;try{value=JSON.parse(text);}catch{fail(400,'Dữ liệu không hợp lệ.');}
 if(!value||Array.isArray(value)||typeof value!=='object')fail(400,'Dữ liệu không hợp lệ.');
 return value;
}
export function createPushHandler(deps){return async req=>{
 try{
  const route=new URL(req.url).searchParams.get('route')||'status',now=deps.now?.()??Date.now();
  if(!deps.production())fail(503,'Chức năng chỉ hoạt động trên website chính thức.');
  if(!['GET','POST'].includes(req.method))fail(405,'Phương thức không hỗ trợ.');
  if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)fail(403,'Yêu cầu phải gửi từ chính website.');
  if(['revoke','rotate'].includes(route)&&req.method==='POST'){
   const data=await body(req);
   if(!devicePattern.test(data.deviceId||'')||typeof data.secret!=='string'||!/^[a-f0-9]{64}$/.test(data.secret))fail(400,'Thiết bị không hợp lệ.');
   const store=deps.store(),key='device-'+data.deviceId,old=await store.getWithMetadata(key,{type:'json'});
   const matches=old&&equal(old.data.revocationHash,sha(data.secret));
   if(route==='rotate'){
    if(!matches||!old.data.active||old.data.expiresAt<=now)fail(401,'Đăng nhập lại để nhận thông báo.');
    if(typeof data.token!=='string'||!/^[A-Za-z0-9_:-]{20,4096}$/.test(data.token))fail(400,'Thiết bị không hợp lệ.');
    const saved=await store.setJSON(key,{...old.data,token:data.token,updatedAt:now},{onlyIfMatch:old.etag});
    return reply({registered:saved.modified});
   }
   if(matches)await store.setJSON(key,{...old.data,active:false,token:'',updatedAt:now},{onlyIfMatch:old.etag});
   return reply({revoked:true});
  }
  const user=await deps.verify(req),ready=Boolean(deps.credentials());
  if(route==='status'&&req.method==='GET')return reply({admin:user?.admin===true,signedIn:Boolean(user),ready});
  if(!user)fail(401,'Đăng nhập để nhận thông báo.');
  if(!user.admin)fail(403,'Chỉ Admin được nhận thông báo đơn thu âm.');
  if(route!=='register'||req.method!=='POST')fail(404,'Không tìm thấy chức năng.');
  const data=await body(req);
  if(!devicePattern.test(data.deviceId||'')||typeof data.token!=='string'||!/^[A-Za-z0-9_:-]{20,4096}$/.test(data.token))fail(400,'Thiết bị không hợp lệ.');
  const store=deps.store(),key='device-'+data.deviceId,secret=randomBytes(32).toString('hex');
  for(let i=0;i<6;i++){
   const old=await store.getWithMetadata(key,{type:'json'});
   const saved=await store.setJSON(key,{deviceId:data.deviceId,owner:user.id,token:data.token,active:true,revocationHash:sha(secret),updatedAt:now,expiresAt:now+30*86400000},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
   if(saved.modified)return reply({registered:true,ready,secret});
  }
  fail(409,'Thiết bị vừa thay đổi. Vui lòng thử lại.');
 }catch(error){return reply({error:error.status?error.message:'Chưa kết nối được thông báo.'},error.status||503);}
};}

// The outbox contains only order IDs. Booking text, names and phone numbers
// stay in the authenticated Audio API and are never sent to FCM.
export async function queueAudioPush(store,order,kind,now=Date.now()){
 if(order?.deleted||!codePattern.test(order?.code||'')||!['new','paid'].includes(kind))return;
 const at=Date.parse(kind==='paid'?order.payment.paidAt:order.createdAt);
 if(!Number.isFinite(at)||at<now-48*3600000)return;
 await store.setJSON('push-'+kind+'-'+order.code,{id:kind+'-'+order.code,kind,code:order.code,createdAt:now,state:'queued',attempts:0,nextAttempt:now,delivered:[]},{onlyIfNew:true});
}
let cachedToken=null;
export function clearPushToken(){cachedToken=null;}
export async function sendFCM(credentials,token,event,{fetcher=fetch,now=Date.now()}={}){
 const identity=sha(credentials.client_email+credentials.private_key);
 if(!cachedToken||cachedToken.identity!==identity||cachedToken.expiresAt<now+60000){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),issued=Math.floor(now/1000);
  const input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600});
  const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
  const assertion=input+'.'+signer.sign(credentials.private_key,'base64url');
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
  const value=await response.json();if(!response.ok||typeof value.access_token!=='string')throw Error('Push authentication unavailable');
  cachedToken={identity,value:value.access_token,expiresAt:now+Math.min(3600,Number(value.expires_in)||3600)*1000};
 }
 const response=await fetcher('https://fcm.googleapis.com/v1/projects/'+FIREBASE_PROJECT+'/messages:send',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+cachedToken.value,'Content-Type':'application/json'},body:JSON.stringify({message:{token,data:{eventId:event.id,kind:event.kind,code:event.code},android:{priority:'high',ttl:'86400s'}}}),signal:AbortSignal.timeout(10000)});
 const result=await response.json().catch(()=>({}));
 if(response.status===401)cachedToken=null;
 const invalid=result.error?.details?.some(detail=>detail.errorCode==='UNREGISTERED');
 return {ok:response.ok,invalid:Boolean(invalid)};
}
async function all(store,prefix){const entries=[];for await(const batch of store.list({prefix,paginate:true}))entries.push(...batch.blobs);return entries;}
export async function dispatchAudioPush({audio,devices,credentials,send=sendFCM,now=Date.now()}){
 if(!credentials)return {ready:false,sent:0};
 const active=(await Promise.all((await all(devices,'device-')).map(async({key})=>({key,...await devices.getWithMetadata(key,{type:'json'})})))).filter(x=>x.data?.active&&x.data.token&&x.data.expiresAt>now);
 let sent=0;
 let processed=0;const stopAt=Date.now()+45000;
 for(const {key} of await all(audio,'push-')){
  let old=await audio.getWithMetadata(key,{type:'json'}),event=old?.data;
  if(processed>=20||Date.now()>stopAt)break;
  if(!event||event.state==='done'||event.nextAttempt>now||event.leaseUntil>now)continue;
  if(event.createdAt<now-48*3600000){await audio.setJSON(key,{...event,state:'done',expired:true},{onlyIfMatch:old.etag});continue;}
  const order=await audio.get('order-'+event.code,{type:'json'});
  if(order?.deleted){await audio.setJSON(key,{...event,state:'done',cancelled:true},{onlyIfMatch:old.etag});continue;}
  const lease=randomUUID();event={...event,state:'sending',lease,leaseUntil:now+120000};
  if(!(await audio.setJSON(key,event,{onlyIfMatch:old.etag})).modified)continue;
  processed++;
  const delivered=new Set(event.delivered||[]);let retry=false;
  for(const device of active){
   if(delivered.has(device.data.deviceId))continue;
   if(Date.now()>stopAt){retry=true;break;}
   try{
    const outcome=await send(credentials,device.data.token,event,{now});
    if(outcome.ok){delivered.add(device.data.deviceId);sent++;}
    else if(outcome.invalid){await devices.setJSON(device.key,{...device.data,active:false,token:''},{onlyIfMatch:device.etag});delivered.add(device.data.deviceId);}
    else retry=true;
   }catch{retry=true;}
  }
  old=await audio.getWithMetadata(key,{type:'json'});if(old?.data.lease!==lease)continue;
  const attempts=event.attempts+1;
  await audio.setJSON(key,{...event,state:retry?'queued':'done',leaseUntil:0,delivered:[...delivered],attempts,nextAttempt:now+Math.min(900000,30000*2**Math.min(attempts,5))},{onlyIfMatch:old.etag});
 }
 return {ready:true,sent};
}
