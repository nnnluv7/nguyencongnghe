import {randomBytes,randomUUID} from 'node:crypto';
import {signTicket,verifyRecord,playerKey,displayName,roomCode} from '../../server/arcade/protocol.mjs';
import {vietnamDate,SKINS} from '../../public/ran-luot/core.js';

const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function onlineConfig({url}={}){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')return {ready:false};u.protocol='wss:';u.pathname='/socket';return {ready:true,websocketURL:u.href};}catch{return {ready:false};}
}
async function change(store,key,fn){
 for(let i=0;i<6;i++){const old=await store.getWithMetadata(key,{type:'json'}),next=fn(structuredClone(old?.data??null));const result=await store.setJSON(key,next,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(result.modified)return next;}
 fail(409,'Có người vừa cập nhật. Vui lòng thử lại.');
}
async function requestBody(req){if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu cần ở dạng JSON.');if(Number(req.headers.get('content-length')||0)>8192)fail(413,'Dữ liệu quá lớn.');const raw=await req.text();if(Buffer.byteLength(raw)>8192)fail(413,'Dữ liệu quá lớn.');let data;try{data=JSON.parse(raw);}catch{fail(400,'Dữ liệu không hợp lệ.');}if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dữ liệu không hợp lệ.');return {raw,data};}
const publicRows=(rows,sub)=>({items:(rows||[]).slice(0,50).map((r,i)=>({rank:i+1,name:r.name,score:r.score,kills:r.kills,elapsed:r.elapsed,you:r.sub===sub})),you:(rows||[]).findIndex(x=>x.sub===sub)+1||null});
export function createArcadeHandler(deps){return async req=>{
 try{
  const route=new URL(req.url).searchParams.get('route')||'config',config=onlineConfig(deps.config());
  if(!['GET','POST'].includes(req.method))return json({error:'Phương thức không hỗ trợ.'},405);
  if(route==='config'&&req.method==='GET')return json(deps.production()?config:{ready:false});
  if(route==='keys'&&req.method==='GET'&&deps.production()){const k=await deps.keys();return json({kid:k.kid,publicKey:k.publicKey});}
  if(!deps.production())fail(503,'Online chỉ mở trên bản website chính thức.');
  if(!config.ready)fail(503,'Đấu trường online chưa mở. Bạn vẫn có thể chơi với AI.');
  if(route==='record'){
   if(req.method!=='POST')fail(405,'Phương thức không hỗ trợ.');
   const {raw,data}=await requestBody(req),now=deps.now?.()??Date.now();
   if(!verifyRecord(raw,await deps.serverKeys(),req.headers.get('x-ncn-time'),req.headers.get('x-ncn-signature'),req.headers.get('x-ncn-key'),now))fail(403,'Chữ ký máy chủ không hợp lệ.');
   const {sub,room,runId,score,kills,elapsed,endedAt,startedAt}=data;
   if(!/^[\da-f]{64}$/.test(sub||'')||!roomCode(room)||!/^[\da-f-]{36}$/.test(runId||'')||!Number.isInteger(score)||score<0||score>10000000||!Number.isInteger(kills)||kills<0||kills>1000||!Number.isFinite(elapsed)||elapsed<0||elapsed>181||!Number.isFinite(endedAt)||Math.abs(endedAt-now)>120000||!Number.isFinite(startedAt)||endedAt-startedAt<0||endedAt-startedAt>210000)fail(400,'Kết quả không hợp lệ.');
   const store=deps.store();
   if(room!=='public'){const group=await store.get('room-'+room,{type:'json'});if(!group?.members?.some(x=>x.sub===sub))fail(403,'Người chơi không thuộc phòng này.');}
   const entry={sub,name:displayName(data.name,sub),score,kills,elapsed:Math.floor(elapsed),endedAt,runId},date=vietnamDate(new Date(startedAt));
   for(const period of ['all',date])await change(store,'board-'+room+'-'+period,old=>{
    const rows=old?.items||[],existing=rows.find(x=>x.sub===sub);if(existing&&(existing.score>score||existing.score===score&&existing.endedAt<=endedAt))return old;
    return {items:[...rows.filter(x=>x.sub!==sub),entry].sort((a,b)=>b.score-a.score||a.endedAt-b.endedAt).slice(0,1000)};
   });
   return json({recorded:true});
  }
  if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)fail(403,'Yêu cầu phải gửi từ chính website.');
  const user=await deps.verify(req),publicBoard=route==='leaderboard'&&req.method==='GET'&&(!new URL(req.url).searchParams.get('room')||new URL(req.url).searchParams.get('room')==='public');if(!user&&!publicBoard)fail(401,'Đăng nhập tài khoản NCN để chơi online và lưu điểm.');
  const sub=user?playerKey(user.id):null,name=user?displayName(user.name,user.id):'',store=deps.store(),now=deps.now?.()??Date.now();
  if(route==='room'&&req.method==='POST'){
   await requestBody(req);const date=vietnamDate(new Date(now));
   await change(store,'quota-'+sub,old=>{const count=old?.date===date?old.count:0;if(count>=5)fail(429,'Mỗi tài khoản tạo tối đa 5 phòng mỗi ngày.');return {date,count:count+1};});
   const code=randomBytes(16).toString('base64url'),group={code,owner:sub,members:[{sub,name}],createdAt:now};await store.setJSON('room-'+code,group,{onlyIfNew:true});return json({room:code});
  }
  if(route==='ticket'&&req.method==='POST'){
   const {data}=await requestBody(req),room=data.room||'public';if(!roomCode(room))fail(400,'Mã phòng không hợp lệ.');
   await change(store,'join-'+sub,old=>{const count=now-(old?.at||0)<60000?old.count:0;if(count>=12)fail(429,'Bạn vào phòng quá nhanh. Chờ một phút rồi thử lại.');return {at:count?old.at:now,count:count+1};});
   if(room!=='public')await change(store,'room-'+room,group=>{if(!group)fail(404,'Không tìm thấy phòng.');if(!group.members.some(x=>x.sub===sub)){if(group.members.length>=128)fail(409,'Danh sách bạn bè của phòng đã đầy.');group.members.push({sub,name});}return group;});
   const skin=SKINS.some(s=>s.id===data.skin)?data.skin:'mint';
   return json({ticket:signTicket({sub,name,room,skin,jti:randomUUID()},await deps.keys(),now),websocketURL:config.websocketURL});
  }
  if(route==='leaderboard'&&req.method==='GET'){
   const room=new URL(req.url).searchParams.get('room')||'public';if(!roomCode(room))fail(400,'Mã phòng không hợp lệ.');
   if(room!=='public'){const group=await store.get('room-'+room,{type:'json'});if(!group?.members.some(x=>x.sub===sub))fail(404,'Bạn cần vào phòng bằng liên kết mời trước.');}
   const [daily,all]=await Promise.all([store.get('board-'+room+'-'+vietnamDate(new Date(now)),{type:'json'}),store.get('board-'+room+'-all',{type:'json'})]);
   return json({room,daily:publicRows(daily?.items,sub),all:publicRows(all?.items,sub)});
  }
  fail(404,'Không tìm thấy chức năng.');
 }catch(error){return json({error:error.status?error.message:'Chưa kết nối được đấu trường. Vui lòng thử lại.'},error.status||503);}
};}
