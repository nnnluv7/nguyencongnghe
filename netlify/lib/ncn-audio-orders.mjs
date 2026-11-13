import {createHash} from 'node:crypto';
import {AUDIO_PRICE,earliestAudioDate} from '../../public/assets/ncn-audio/shared.js';

export const AUDIO_STORE='ncn-audio-v1';
const codePattern='NCNAUD[A-F0-9]{16}';
const validCode=new RegExp('^'+codePattern+'$');
const tokenPattern=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const orderKey=code=>'order-'+code;
const historyPattern=new RegExp('^history-\\d{13}-'+codePattern+'$');
export const failAudio=(status,message)=>{throw Object.assign(new Error(message),{status});};
const iso=now=>new Date(now).toISOString();
export const audioCodes=content=>[...new Set(content.toUpperCase().match(new RegExp('\\b'+codePattern+'\\b','g'))||[])];

export function audioText(value,max,message){
 const text=typeof value==='string'?value.trim():'';
 if(!text||text.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))failAudio(400,message);
 return text;
}
function identify(token){
 if(typeof token!=='string'||!tokenPattern.test(token))failAudio(400,'Mã theo dõi đơn không hợp lệ.');
 const hash=createHash('sha256').update(token.toLowerCase()).digest('hex');
 return {hash,code:'NCNAUD'+hash.slice(0,16).toUpperCase()};
}
function booking(data,now){
 const name=audioText(data.name,100,'Nhập tên người đặt, tối đa 100 ký tự.');
 const phone=typeof data.phone==='string'?data.phone.trim().replace(/[ .()-]/g,''):'';
 if(!/^(?:\+84|0)[1-9]\d{8,9}$/.test(phone))failAudio(400,'Nhập số điện thoại liên hệ hợp lệ.');
 if(!['Zalo','LINE'].includes(data.channel))failAudio(400,'Chọn Zalo hoặc LINE.');
 const date=data.date;
 if(typeof date!=='string'||!/^20\d{2}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date))||iso(Date.parse(date)).slice(0,10)!==date)failAudio(400,'Chọn ngày nhận dự kiến hợp lệ.');
 if(date<earliestAudioDate(now))failAudio(400,'Ngày nhận dự kiến cần từ ngày mai trở đi.');
 if(data.confirm!==true)failAudio(400,'Xác nhận thông tin đặt thu trước khi gửi.');
 return {name,phone,channel:data.channel,date,urgent:data.urgent===true,script:audioText(data.script,8000,'Nhập nội dung cần thu, tối đa 8.000 ký tự.')};
}

export async function createAudioOrder(store,data,now){
 const {hash,code}=identify(data.token),key=orderKey(code);
 let order=await store.get(key,{type:'json'});
 if(!order){
  const draft={code,tokenHash:hash,amount:AUDIO_PRICE,booking:booking(data,now),createdAt:iso(now),updatedAt:iso(now),version:1,payment:{state:'pending'},work:{state:'new',note:'',events:[]}};
  const written=await store.setJSON(key,draft,{onlyIfNew:true});
  order=written.modified?draft:await store.get(key,{type:'json'});
 }
 if(!order||order.tokenHash!==hash)failAudio(409,'Chưa tạo được mã đơn. Vui lòng thử lại.');
 // Repair the history pointer on retry if its first write was interrupted.
 await store.setJSON('history-'+String(Date.parse(order.createdAt)).padStart(13,'0')+'-'+code,{code},{onlyIfNew:true});
 return order;
}
export async function readAudioOrder(store,token){
 const {hash,code}=identify(token),order=await store.get(orderKey(code),{type:'json'});
 if(!order||order.tokenHash!==hash)failAudio(404,'Không tìm thấy đơn đặt thu này.');
 return order;
}
export async function listAudioOrders(store,after){
 if(after&&!historyPattern.test(after))failAudio(400,'Mốc lịch sử không hợp lệ.');
 const keys=[];
 for await(const batch of store.list({prefix:'history-',paginate:true})){
  for(const {key} of batch.blobs)if(historyPattern.test(key)&&(!after||key<after))keys.push(key);
 }
 keys.sort().reverse();
 const page=keys.slice(0,20);
 const orders=await Promise.all(page.map(async key=>{
  const order=await store.get(orderKey(key.slice('history-'.length+14)),{type:'json'});
  if(!order)return null;
  const {tokenHash,...result}=order;
  return result;
 }));
 return {orders:orders.filter(Boolean),next:keys.length>page.length?page.at(-1):null};
}
async function updateOrder(store,code,now,change){
 for(let attempt=0;attempt<8;attempt++){
  const old=await store.getWithMetadata(orderKey(code),{type:'json'});
  if(!old)return null;
  if(!old.etag)failAudio(503,'Chưa đọc được phiên bản của đơn.');
  const order=old.data,outcome=change(order);
  if(outcome)return {order,outcome};
  order.version++;order.updatedAt=iso(now);
  const saved=await store.setJSON(orderKey(code),order,{onlyIfMatch:old.etag});
  if(saved.modified)return {order};
 }
 failAudio(409,'Đơn vừa thay đổi. Vui lòng thử lại.');
}
export async function updateAudioWork(store,data,user,now){
 if(typeof data.code!=='string'||!validCode.test(data.code)||!Number.isSafeInteger(data.version)||!['new','recording','done'].includes(data.state))failAudio(400,'Thông tin xử lý đơn không hợp lệ.');
 const note=typeof data.note==='string'&&data.note.trim()?audioText(data.note,600,'Ghi chú tối đa 600 ký tự.'):'';
 const result=await updateOrder(store,data.code,now,order=>{
  if(data.version!==order.version)failAudio(409,'Đơn vừa thay đổi. Tải lại lịch sử trước khi lưu.');
  if(order.payment.state!=='paid'&&order.work.state!==data.state)failAudio(409,'Đơn cần được xác nhận thanh toán trước khi xử lý.');
  if(order.work.state===data.state&&order.work.note===note)return 'unchanged';
  order.work.state=data.state;order.work.note=note;
  order.work.events=[...order.work.events,{state:data.state,note,at:iso(now),by:user.name||user.email}].slice(-30);
 });
 if(!result)failAudio(404,'Không tìm thấy đơn.');
 const {tokenHash,...order}=result.order;
 return order;
}

export async function settleAudioOrder(store,code,tx,now){
 const result=await updateOrder(store,code,now,order=>{
  if(order.payment.state==='paid')return order.payment.id===tx.id?'paid':'review';
  const paidAt=Date.parse(tx.occurredAt),opened=Date.parse(order.createdAt);
  const reason=tx.amount!==order.amount?'Số tiền nhận được không khớp với đơn.':
   paidAt<Math.floor(opened/1000)*1000||paidAt>now+300000?'Thời gian giao dịch không khớp với đơn.':'';
  if(reason&&order.payment.id===tx.id&&order.payment.reason===reason)return 'unchanged';
  order.payment=reason
   ?{state:'review',id:tx.id,amount:tx.amount,reference:tx.reference,reason}
   :{state:'paid',id:tx.id,amount:tx.amount,reference:tx.reference,paidAt:tx.occurredAt};
 });
 if(!result)return {state:'review',reason:'Không tìm thấy đơn đặt thu.'};
 if(result.outcome==='review')return {state:'review',reason:'Đơn đã thanh toán bằng giao dịch khác.'};
 return {state:result.order.payment.state,reason:result.order.payment.reason||null};
}
