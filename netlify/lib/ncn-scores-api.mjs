import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {GAMES,AVATARS,gameBoard,vietnamDate} from '../../public/assets/ncn-arcade/catalog.js';

const COOKIE='__Host-ncn_arcade',MAX_SCORE=999999999;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
const idOK=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function cookie(req){const matches=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));const value=matches.length===1?matches[0].slice(COOKIE.length+1):'';return /^[\w-]{43}$/.test(value)?value:null;}
export function cleanName(value,fallback=''){
 const name=typeof value==='string'?value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim():'';
 return name&&!name.includes('@')?Array.from(name).slice(0,30).join(''):fallback;
}
async function body(req,limit=240000){
 if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu cần ở dạng JSON.');
 if(Number(req.headers.get('content-length')||0)>limit)fail(413,'Ảnh quá lớn. Vui lòng chọn ảnh khác.');
 const raw=await req.text();if(Buffer.byteLength(raw)>limit)fail(413,'Ảnh quá lớn. Vui lòng chọn ảnh khác.');
 let value;try{value=JSON.parse(raw);}catch{fail(400,'Dữ liệu không hợp lệ.');}if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Dữ liệu không hợp lệ.');return value;
}
async function change(store,key,fn){
 for(let n=0;n<8;n++){const old=await store.getWithMetadata(key,{type:'json'}),next=fn(structuredClone(old?.data??null));if(next===undefined)return old?.data;const result=await store.setJSON(key,next,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(result.modified)return next;}
 fail(409,'Có cập nhật khác vừa được lưu. Bấm thử lại nhé.');
}
const rankPrefix=(game,board)=>'rank/'+game+'/'+board+'/';
const indexKey=(game,board,score,at,id)=>rankPrefix(game,board)+String(MAX_SCORE-score).padStart(9,'0')+'/'+String(at).padStart(13,'0')+'/'+id;
const publicProfile=p=>p?{id:p.id,name:p.name,avatar:p.avatar,member:p.member}:null;
async function refreshProfileEntries(store,profile){
 const listing=await store.list({prefix:'best/'+profile.id+'/'});
 await Promise.all(listing.blobs.map(async({key})=>{const best=await store.get(key,{type:'json'});if(!best?.key)return;const entry=await store.getWithMetadata(best.key,{type:'json'});if(entry?.data?.id===profile.id)await store.setJSON(best.key,{...entry.data,...publicProfile(profile)},{onlyIfMatch:entry.etag});}));
}
function rankKeys(keys,prefix){
 // The storage API does not promise score order. Sort ALL returned pages here;
 // immutable candidates allow concurrent personal bests without a shared board lock.
 const found=new Set();return keys.map(k=>k.key).filter(k=>k.startsWith(prefix)&&/^\d{9}\/\d{13}\/[a-f0-9]{64}$/.test(k.slice(prefix.length))).sort().filter(k=>{const id=k.split('/').at(-1);if(found.has(id))return false;found.add(id);return true;});
}
export function createScoresHandler(deps){return async req=>{
 try{
  const url=new URL(req.url),route=url.searchParams.get('route')||'profile',store=deps.store(),now=deps.now?.()??Date.now();
  if(!['GET','POST'].includes(req.method))fail(405,'Phương thức không hỗ trợ.');
  if(!deps.production())fail(503,'Bảng điểm chỉ mở trên website chính thức.');
  if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail(403,'Yêu cầu phải gửi từ chính website.');
  if(route==='avatar'&&req.method==='GET'){
   const id=url.searchParams.get('id');if(!idOK(id))fail(404,'Không tìm thấy ảnh.');const photo=await store.get('avatar/'+id,{type:'arrayBuffer'});if(!photo)fail(404,'Không tìm thấy ảnh.');
   return new Response(photo,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
  }
  // Only the Identity endpoint can establish a member. A guest cookie is an
  // opaque random bearer secret, never a browser-supplied account ID or name.
  const user=await deps.verify(req),token=cookie(req),id=user?hash('account:'+user.id):token?hash('guest:'+token):null;
  let profile=id?await store.get('profile/'+id,{type:'json'}):null;
  if(user){
   const name=cleanName(user.name,'Thành viên NCN'),avatar=typeof user.avatar==='string'&&/^https:\/\//.test(user.avatar)?user.avatar:profile?.avatar||'preset:'+AVATARS[parseInt(id.slice(0,2),16)%AVATARS.length];
   if(!profile||profile.name!==name||profile.avatar!==avatar){profile={id,name,avatar,member:true};await store.setJSON('profile/'+id,profile);await refreshProfileEntries(store,profile);}
  }
  if(route==='profile'){
   if(req.method==='GET'){
    const confirm=url.searchParams.get('confirm');if(confirm&&profile?.updateId===confirm)await refreshProfileEntries(store,profile);
    return json({profile:publicProfile(profile),needsProfile:!profile,...(profile?.updateId?{updateId:profile.updateId}:{})});
   }
   const data=await body(req,1200000);if(user)return json({profile:publicProfile(profile)});
   if(data.updateId!==undefined&&(typeof data.updateId!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(data.updateId)))fail(400,'Lần lưu hồ sơ chưa hợp lệ. Mở lại hồ sơ rồi thử nhé.');
   if(data.updateId&&profile?.updateId===data.updateId){await refreshProfileEntries(store,profile);return json({profile:publicProfile(profile),updateId:profile.updateId});}
   const name=cleanName(data.name);if(!name)fail(400,'Nhập tên hiển thị (tối đa 30 ký tự, không dùng email).');
   const secret=token||randomBytes(32).toString('base64url'),guestId=hash('guest:'+secret);
   let avatar=data.avatar;
   if(typeof avatar==='string'&&avatar.startsWith('data:')){
    const match=avatar.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)fail(400,'Chọn ảnh JPG, PNG hoặc WebP.');
    let bytes;try{bytes=await deps.photo(Buffer.from(match[1],'base64'));}catch{fail(400,'Ảnh chưa đọc được. Chọn ảnh khác nhé.');}
    const key=hash(bytes);await store.set('avatar/'+key,bytes,{onlyIfNew:true});avatar='/.netlify/functions/ncn-scores?route=avatar&id='+key;
   }else if(!AVATARS.some(x=>avatar==='preset:'+x)){
    // Keeping a previous upload is allowed only for its original profile.
    if(!profile||avatar!==profile.avatar)fail(400,'Chọn một ảnh đại diện.');
   }
   profile={id:guestId,name,avatar,member:false,...(data.updateId?{updateId:data.updateId}:{})};await store.setJSON('profile/'+guestId,profile);await refreshProfileEntries(store,profile);
   return json({profile:publicProfile(profile),...(profile.updateId?{updateId:profile.updateId}:{})},200,{'Set-Cookie':COOKIE+'='+secret+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000'});
  }
  if(route==='board'&&req.method==='GET'){
   const game=url.searchParams.get('game'),mode=url.searchParams.get('mode')||Object.keys(GAMES[game]?.modes||{})[0],board=gameBoard(game,mode,url.searchParams.get('date')||vietnamDate(new Date(now)));if(!board)fail(400,'Không tìm thấy bảng điểm.');
   const prefix=rankPrefix(game,board),listing=await store.list({prefix}),keys=rankKeys(listing.blobs,prefix);
   let after='';const encoded=url.searchParams.get('cursor');if(encoded){try{after=Buffer.from(encoded,'base64url').toString();}catch{fail(400,'Trang điểm không hợp lệ.');}if(!after.startsWith(prefix)||after.length>250)fail(400,'Trang điểm không hợp lệ.');}
   const limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||10)),first=after?keys.findIndex(k=>k>after):0,start=first<0?keys.length:first,page=keys.slice(start,start+limit);
   const items=(await Promise.all(page.map(async(key,i)=>{const entry=await store.get(key,{type:'json'});return entry?{id:entry.id,name:entry.name,avatar:entry.avatar,member:entry.member,score:entry.score,level:entry.level,at:entry.at,rank:start+i+1,you:entry.id===id}:null;}))).filter(Boolean);
   const own=keys.findIndex(k=>k.endsWith('/'+id));
   return json({game,mode,total:keys.length,items,you:own>=0?{rank:own+1,score:MAX_SCORE-Number(keys[own].slice(prefix.length).split('/')[0])}:null,nextCursor:start+page.length<keys.length&&page.length?Buffer.from(page.at(-1)).toString('base64url'):null});
  }
  if(!profile)fail(401,'Thêm tên và ảnh đại diện trước khi lưu điểm.');
  if(route==='start'&&req.method==='POST'){
   const data=await body(req),board=gameBoard(data.game,data.mode,data.date||vietnamDate(new Date(now)));if(!board)fail(400,'Chế độ chơi không hợp lệ.');
   await change(store,'start/'+id+'/'+data.game,old=>{if(old&&now-old.at<250)fail(429,'Chờ một nhịp rồi bắt đầu lại nhé.');return {at:now};});
   const run={id:randomUUID(),player:id,game:data.game,mode:data.mode,board,at:now,score:0};await store.setJSON('run/'+run.id,run,{onlyIfNew:true});return json({runId:run.id,owner:id});
  }
  if(route==='score'&&req.method==='POST'){
   const data=await body(req);if(!/^[\da-f-]{36}$/.test(data.runId||'')||!Number.isSafeInteger(data.score)||data.score<0||data.score>MAX_SCORE||!Number.isInteger(data.level)||data.level<0||data.level>100)fail(400,'Kết quả không hợp lệ.');
   const run=await store.get('run/'+data.runId,{type:'json'});if(!run||run.player!==id&&!(user&&token&&run.player===hash('guest:'+token)))fail(403,'Ván chơi không thuộc hồ sơ này.');if(now-run.at>30*86400000)fail(410,'Ván đã lưu quá lâu. Bắt đầu ván mới để lên bảng điểm nhé.');
   // Plausibility guard for client-side casual games, not an authoritative
   // anti-cheat claim: a server-issued run binds each result to this profile.
   const seconds=Math.max(0,(now-run.at)/1000),rate={snake:2500,flight:500,pikachu:2000,ocean:2500,blocks:5000,bubble:5000}[run.game];
   if(data.score>1000+rate*seconds)fail(400,'Điểm tăng quá nhanh so với thời gian ván chơi.');
   const bestKey='best/'+id+'/'+run.game+'/'+run.board,old=await store.get(bestKey,{type:'json'});
   if(data.score===0||old&&old.score>=data.score)return json({saved:true,improved:false,best:old?.score||0});
   const entry={...publicProfile(profile),score:data.score,level:data.level,at:now},key=indexKey(run.game,run.board,data.score,now,id);
   // Publish a complete immutable candidate first. If a later operation fails,
   // a retry is harmless and no valid score disappears from the public board.
   await store.setJSON(key,entry,{onlyIfNew:true});
   await change(store,bestKey,current=>current&&current.score>=entry.score?undefined:{score:entry.score,key});
   if(old?.key&&old.key!==key)await store.delete(old.key).catch(()=>{/* Optional cleanup; the new complete candidate is already public. */});
   return json({saved:true,improved:true,best:data.score});
  }
  fail(404,'Không tìm thấy chức năng.');
 }catch(error){return json({error:error.status?error.message:'Chưa kết nối được bảng điểm. Kết quả sẽ được thử lưu lại.'},error.status||503);}
};}
