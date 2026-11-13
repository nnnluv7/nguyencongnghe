import {randomUUID} from 'node:crypto';
import {AUDIO_PRICE,AUDIO_ORIGINAL_PRICE,MAX_AUDIO_SAMPLE_BYTES} from '../../public/assets/ncn-audio/shared.js';
import {audioText,createAudioOrder,failAudio,listAudioOrders,readAudioOrder,updateAudioWork} from './ncn-audio-orders.mjs';

const samplesKey='published-samples';
const privateHeaders={
 'Cache-Control':'private, no-store, max-age=0','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
const allowed=user=>Boolean(user?.id&&(user.admin===true||user.audio===true));
const sampleId=/^[a-f0-9-]{36}$/;

export async function readBytes(req,limit){
 if(Number(req.headers.get('content-length')||0)>limit)failAudio(413,'Tệp hoặc nội dung vượt giới hạn.');
 const reader=req.body?.getReader();
 if(!reader)failAudio(400,'Thiếu nội dung gửi lên.');
 const chunks=[];let size=0;
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>limit){await reader.cancel();failAudio(413,'Tệp hoặc nội dung vượt giới hạn.');}
  chunks.push(value);
 }
 return Buffer.concat(chunks);
}
async function jsonBody(req){
 if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')failAudio(415,'Dữ liệu cần ở định dạng JSON.');
 const bytes=await readBytes(req,40000);
 let data;
 try{data=JSON.parse(bytes.toString('utf8'));}catch{failAudio(400,'Dữ liệu không hợp lệ.');}
 if(!data||typeof data!=='object'||Array.isArray(data))failAudio(400,'Dữ liệu không hợp lệ.');
 return data;
}
function orderView(order,bank,ready){
 const {code,amount,createdAt,payment,work}=order;
 const qr=new URL('https://vietqr.app/img');
 qr.search=new URLSearchParams({acc:bank.account,bank:bank.bank,amount:String(amount),des:code}).toString();
 return {code,amount,createdAt,payment:payment.state,work:work.state,qr:ready&&payment.state!=='paid'?qr.href:null,bank:ready?bank:null};
}
const audioKey=id=>'sample-'+id;
async function getSamples(store){return (await store.get(samplesKey,{type:'json'}))?.items||[];}
async function changeSamples(store,change){
 for(let attempt=0;attempt<8;attempt++){
  const previous=await store.getWithMetadata(samplesKey,{type:'json'});
  if(previous&&!previous.etag)failAudio(503,'Chưa đọc được danh sách audio mẫu.');
  const items=change(previous?.data.items||[]);
  const written=await store.setJSON(samplesKey,{items},previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true});
  if(written.modified)return items;
 }
 failAudio(409,'Danh sách audio mẫu vừa thay đổi. Vui lòng thử lại.');
}
function isMp3(bytes){
 let offset=0;
 if(bytes.length>=10&&bytes.subarray(0,3).toString()==='ID3'){
  const size=bytes.subarray(6,10);
  if(size.some(byte=>byte>127))return false;
  offset=10+size.reduce((total,byte)=>total*128+byte,0)+(bytes[3]===4&&(bytes[5]&16)?10:0);
 }
 if(bytes.length<offset+4)return false;
 const [sync,flags,format]=bytes.subarray(offset,offset+3);
 const bitrate=format>>4,sampleRate=(format>>2)&3;
 return sync===255&&(flags&224)===224&&(flags&24)!==8&&(flags&6)===2&&bitrate>0&&bitrate<15&&sampleRate!==3;
}
async function addSample(store,req,now){
 const title=audioText(new URL(req.url).searchParams.get('title'),90,'Nhập tên mẫu từ 1 đến 90 ký tự.');
 const bytes=await readBytes(req,MAX_AUDIO_SAMPLE_BYTES);
 if(!isMp3(bytes))failAudio(415,'Chọn tệp MP3 hợp lệ.');
 if((await getSamples(store)).length>=12)failAudio(409,'Đã có 12 mẫu. Gỡ một mẫu trước khi thêm.');
 const item={id:randomUUID(),title,createdAt:new Date(now).toISOString()};
 const written=await store.set(audioKey(item.id),new Uint8Array(bytes).buffer,{onlyIfNew:true});
 if(!written.modified)failAudio(409,'Chưa lưu được audio mẫu. Vui lòng thử lại.');
 try{return await changeSamples(store,items=>{
  if(items.length>=12)failAudio(409,'Đã có 12 mẫu. Gỡ một mẫu trước khi thêm.');
  return [item,...items];
 });}catch(error){
  // A failed response can follow a successful write. Keep published bytes intact.
  if(error.status===409)await store.delete(audioKey(item.id));
  throw error;
 }
}
async function removeSample(store,id){
 if(typeof id!=='string'||!sampleId.test(id))failAudio(400,'Mã mẫu không hợp lệ.');
 const items=await changeSamples(store,current=>current.filter(item=>item.id!==id));
 await store.delete(audioKey(id));
 return items;
}
async function serveSample(store,req,id){
 if(!id||!sampleId.test(id)||!(await getSamples(store)).some(item=>item.id===id))failAudio(404,'Không tìm thấy audio mẫu.');
 const bytes=await store.get(audioKey(id),{type:'arrayBuffer'});
 if(!bytes)failAudio(404,'Không tìm thấy audio mẫu.');
 const size=bytes.byteLength;
 const headers={...privateHeaders,'Content-Type':'audio/mpeg','Content-Disposition':'inline; filename="audio-mau.mp3"','Accept-Ranges':'bytes','Cross-Origin-Resource-Policy':'same-origin'};
 const range=req.headers.get('range');
 if(!range)return new Response(req.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Length':String(size)}});
 const parts=/^bytes=(\d*)-(\d*)$/.exec(range);
 const start=parts?.[1]?Number(parts[1]):Math.max(0,size-Number(parts?.[2]));
 const end=parts?.[1]&&parts[2]?Math.min(size-1,Number(parts[2])):size-1;
 if(!parts||(!parts[1]&&!parts[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+size}});
 return new Response(req.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':'bytes '+start+'-'+end+'/'+size}});
}

export function createAudioHandler(deps){return async req=>{
 try{
  const url=new URL(req.url),route=url.searchParams.get('route')||'setup',now=deps.now?.()??Date.now();
  const {method}=req;
  if(!['GET','HEAD','POST'].includes(method))failAudio(405,'Phương thức không hỗ trợ.');
  if(method==='POST'&&req.headers.get('origin')!==url.origin)failAudio(403,'Yêu cầu phải gửi từ chính website.');
  const production=deps.production(),ready=production&&deps.paymentReady();
  if(route==='setup'&&method==='GET')return json({ready,amount:AUDIO_PRICE,originalAmount:AUDIO_ORIGINAL_PRICE,samples:production?await getSamples(deps.store()):[]});
  if(!production)failAudio(503,'Đặt thu Audio chỉ hoạt động trên website chính thức.');
  if(route==='sample'&&(method==='GET'||method==='HEAD'))return await serveSample(deps.store(),req,url.searchParams.get('id'));
  if(route==='create'&&method==='POST'){
   if(!ready)failAudio(503,'Chưa sẵn sàng nhận chuyển khoản. Vui lòng thử lại sau.');
   return json({order:orderView(await createAudioOrder(deps.store(),await jsonBody(req),now),deps.bank,ready)},201);
  }
  if(route==='status'&&method==='POST'){
   const {token}=await jsonBody(req);
   return json({order:orderView(await readAudioOrder(deps.store(),token),deps.bank,ready)});
  }
  const user=await deps.verify(req);
  if(route==='access'&&method==='GET')return json({allowed:allowed(user),signedIn:Boolean(user)});
  if(!user)failAudio(401,'Đăng nhập để xem lịch sử đặt thu.');
  if(!allowed(user))failAudio(403,'Tài khoản cần quyền Audio hoặc Admin.');
  const store=deps.store();
  if(route==='history'&&method==='GET')return json(await listAudioOrders(store,url.searchParams.get('after')));
  if(route==='update'&&method==='POST')return json({order:await updateAudioWork(store,await jsonBody(req),user,now)});
  if(route==='add-sample'&&method==='POST')return json({samples:await addSample(store,req,now)},201);
  if(route==='remove-sample'&&method==='POST'){
   const {id}=await jsonBody(req);
   return json({samples:await removeSample(store,id)});
  }
  failAudio(404,'Không tìm thấy chức năng.');
 }catch(error){
  return json({error:error.status?error.message:'Chưa thực hiện được. Vui lòng thử lại.'},error.status||503);
 }
};}
