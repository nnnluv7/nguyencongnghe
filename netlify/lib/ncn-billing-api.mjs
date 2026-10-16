import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {memberKey,emptyMember,withPaidVip} from './ncn-membership.mjs';

export const PLANS=Object.freeze([
  Object.freeze({id:'vip30',name:'VIP 30 ngày',days:30,amount:30000}),
  Object.freeze({id:'vip60',name:'VIP 60 ngày',days:60,amount:55000})
]);
export const BANK=Object.freeze({bank:'VietinBank',account:'105312456789',name:'NGUYEN NGHIA NGUYEN'});
const DAY=86400000,ORDER_TTL=30*60*1000;
const ORDER=/^NCN[A-F0-9]{20}$/;
const TX_ID=/^[1-9]\d{0,19}$/;
const HEADERS={'Cache-Control':'private, no-store, max-age=0','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const hash=s=>createHash('sha256').update(s).digest('hex');
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const iso=n=>new Date(n).toISOString();
const txKey=id=>'txn-'+String(id).padStart(20,'0');
const orderKey=id=>'order-'+id;
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...HEADERS,'Content-Type':'application/json; charset=utf-8'}});}
function errorReply(error,webhook=false){return reply(webhook?{success:false,error:error.status?error.message:'Chưa ghi nhận được giao dịch. Hệ thống sẽ thử lại.'}:{error:error.status?error.message:'Chưa thực hiện được thao tác. Vui lòng thử lại.'},error.status||503);}
function isReady(config){return config.enabled===true&&typeof config.secret==='string'&&config.secret.length>=32;}
function validateCode(value){if(typeof value!=='string'||!ORDER.test(value))fail(400,'Mã đơn không hợp lệ.');return value;}
function validateTxId(value){const id=String(value??'');if(!TX_ID.test(id)||(typeof value==='number'&&!Number.isSafeInteger(value)))fail(400,'Mã giao dịch không hợp lệ.');return id;}
async function rawBody(req,limit){
  if(Number(req.headers.get('content-length')||0)>limit)fail(413,'Dữ liệu quá lớn.');
  if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))fail(415,'Chỉ nhận dữ liệu JSON.');
  const reader=req.body?.getReader();if(!reader)fail(400,'Thiếu dữ liệu.');
  const chunks=[];let bytes=0;
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit){await reader.cancel();fail(413,'Dữ liệu quá lớn.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks);
}
function jsonBody(bytes){let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{fail(400,'Dữ liệu không hợp lệ.');}if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dữ liệu không hợp lệ.');return data;}

// SePay signs `${timestamp}.${raw_body}`; signed timestamps are valid for five minutes.
export function verifySePaySignature(req,bytes,secret,now=Date.now()){
  if(typeof secret!=='string'||secret.length<32)fail(503,'Chưa cấu hình kết nối thanh toán.');
  const stamp=req.headers.get('x-sepay-timestamp')||'',signature=req.headers.get('x-sepay-signature')||'';
  if(!/^\d{1,13}$/.test(stamp)||!/^sha256=[a-f0-9]{64}$/i.test(signature))fail(401,'Xác thực giao dịch không hợp lệ.');
  const seconds=Number(stamp);if(!Number.isSafeInteger(seconds)||Math.abs(now/1000-seconds)>300)fail(401,'Thông báo giao dịch đã hết thời gian xác thực.');
  const expected=createHmac('sha256',secret).update(stamp+'.','utf8').update(bytes).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))fail(401,'Xác thực giao dịch không hợp lệ.');
}
function bankTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))fail(400,'Thời gian giao dịch không hợp lệ.');
  const n=Date.parse(value.replace(' ','T')+'+07:00');
  if(!Number.isFinite(n)||new Date(n+7*3600000).toISOString().slice(0,19)!==value.replace(' ','T'))fail(400,'Thời gian giao dịch không hợp lệ.');
  return n;
}
export function parseTransaction(data){
  const id=validateTxId(data.id);
  if(typeof data.gateway!=='string'||typeof data.accountNumber!=='string'||!['in','out'].includes(data.transferType)||!Number.isSafeInteger(data.transferAmount)||data.transferAmount<=0||typeof data.content!=='string'||data.content.length>1000)fail(400,'Thông tin giao dịch không hợp lệ.');
  const occurred=bankTime(data.transactionDate);
  const reference=typeof data.referenceCode==='string'?data.referenceCode.trim():'';
  if(reference.length>200)fail(400,'Mã tham chiếu không hợp lệ.');
  return {id,bank:data.gateway.trim(),account:data.accountNumber.trim(),direction:data.transferType,amount:data.transferAmount,content:data.content,occurredAt:iso(occurred),reference};
}
function codesIn(content){return [...new Set((content.toUpperCase().match(/\bNCN[A-F0-9]{20}\b/g)||[]))];}
function fingerprint(t){return hash(JSON.stringify([t.id,t.bank.toLowerCase(),t.account,t.direction,t.amount,t.content,t.occurredAt,t.reference]));}

// A CAS update never performs side effects inside the retryable mutator.
async function atomic(store,key,initial,mutate){
  for(let i=0;i<12;i++){
    const old=await store.getWithMetadata(key,{type:'json'}),draft=structuredClone(old?old.data:initial);
    const result=mutate(draft,!!old);
    if(result?.skip)return result.value;
    if(old&&(typeof old.etag!=='string'||!old.etag))fail(503,'Chưa xác minh được phiên bản dữ liệu thanh toán. Vui lòng thử lại.');
    const written=await store.setJSON(key,draft,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(written.modified)return result?.value;
  }
  fail(503,'Có nhiều yêu cầu đồng thời. Vui lòng thử lại.');
}
async function getMember(store,user){
  const m=await store.get(memberKey(user.id),{type:'json'});
  if(m&&m.userId!==user.id)fail(503,'Chưa đọc được quyền VIP.');
  return m||emptyMember(user);
}
function orderView(order,member,now){
  const grant=member?.grants?.[order.id],paid=!!grant;
  const state=paid?'paid':order.status==='review'?'review':Date.parse(order.expiresAt)<=now?'expired':'pending';
  const qr=new URL('https://vietqr.app/img');
  qr.search=new URLSearchParams({acc:order.bankAccount,bank:'VietinBank',amount:String(order.amount),des:order.description}).toString();
  return {id:order.id,planId:order.planId,amount:order.amount,days:order.days,name:order.name,status:state,createdAt:order.createdAt,expiresAt:order.expiresAt,bankAccount:order.bankAccount,bankName:order.bankName,payeeName:order.payeeName,description:order.description,qrUrl:qr.href,paidAt:grant?.paidAt||null,vipExpiresAt:grant?.expiresAt||null,reviewReason:order.reviewReason||null};
}
async function newOrder(store,user,body,now){
  const plan=PLANS.find(p=>p.id===body.planId);
  if(!plan)fail(400,'Chọn gói VIP 30 ngày hoặc 60 ngày.');
  if(user.admin||user.vipSource==='manual')fail(409,'Tài khoản đã được ADMIN cấp VIP không giới hạn. Anh/chị không cần mua thêm gói.');
  const nonce=body.idempotencyKey;
  if(typeof nonce!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(nonce))fail(400,'Mã yêu cầu không hợp lệ. Tải lại trang rồi thử lại.');
  const id='NCN'+randomBytes(10).toString('hex').toUpperCase();
  const candidate={schema:1,id,userId:user.id,userEmail:user.email,name:plan.name,planId:plan.id,amount:plan.amount,days:plan.days,createdAt:iso(now),expiresAt:iso(now+ORDER_TTL),bankAccount:BANK.account,bankName:BANK.bank,payeeName:BANK.name,description:'SEVQR '+id,status:'pending',transactionId:null,reviewReason:null};
  const order=await atomic(store,memberKey(user.id),emptyMember(user),member=>{
    if(member.userId!==user.id)fail(503,'Chưa tạo được đơn thanh toán.');
    if(member.blocked)fail(403,'VIP thanh toán của tài khoản đang bị tạm khóa. Vui lòng liên hệ ADMIN.');
    member.requests=member.requests||{};member.grants=member.grants||{};
    if(own(member.requests,nonce)){
      const old=member.requests[nonce];if(old.planId!==plan.id)fail(409,'Yêu cầu này đã dùng cho gói khác. Chọn lại gói.');
      return {skip:true,value:old};
    }
    const recent=Object.entries(member.requests).filter(([,o])=>Date.parse(o.createdAt)>now-DAY);
    if(recent.length>=20)fail(429,'Đã tạo nhiều đơn trong ngày. Vui lòng dùng mã đơn đã có hoặc liên hệ ADMIN.');
    if(recent.filter(([,o])=>Date.parse(o.expiresAt)>now&&!member.grants[o.id]).length>=5)fail(429,'Đang có nhiều mã thanh toán còn hạn. Vui lòng dùng mã đơn đã có.');
    member.requests=Object.fromEntries(recent);member.requests[nonce]=candidate;member.updatedAt=iso(now);member.email=user.email;member.name=user.name;
    return {value:candidate};
  });
  await atomic(store,orderKey(order.id),order,(draft,exists)=>{
    if(exists&&(draft.userId!==user.id||draft.planId!==plan.id))fail(409,'Mã đơn đã được sử dụng.');
    return {skip:exists,value:draft};
  });
  return orderView(await store.get(orderKey(order.id),{type:'json'}),await getMember(store,user),now);
}

async function markReview(store,tx,reason,order,now){
  await atomic(store,txKey(tx.id),null,draft=>{
    if(draft.status==='applied')return {skip:true};
    draft.status='review';draft.reason=reason;draft.updatedAt=iso(now);return {};
  });
  if(order)await atomic(store,orderKey(order.id),null,draft=>{
    if(draft.status==='paid')return {skip:true};
    draft.status='review';draft.reviewReason=reason;return {};
  });
  return {success:true,review:true};
}

export async function applyTransaction(store,tx,now,{orderId=null,admin=null}={}){
  let record=await store.get(txKey(tx.id),{type:'json'});
  if(!record||record.fingerprint!==fingerprint(tx))fail(409,'Dữ liệu giao dịch không khớp bản đã xác thực.');
  if(record.status==='applied'){
    if(orderId&&record.orderId!==orderId)fail(409,'Giao dịch đã được dùng cho đơn khác.');
    return {success:true,duplicate:true};
  }
  const codes=codesIn(tx.content),code=orderId||(codes.length===1?codes[0]:null);
  if(!code)return markReview(store,tx,codes.length>1?'Nội dung có nhiều mã đơn.':'Chưa nhận diện được mã đơn.',null,now);
  const order=await store.get(orderKey(validateCode(code)),{type:'json'});
  if(!order)return markReview(store,tx,'Mã đơn chưa có trên NCN.',null,now);
  if(tx.amount!==order.amount)return markReview(store,tx,'Số tiền chuyển chưa khớp gói VIP.',order,now);
  if(tx.account!==order.bankAccount||tx.direction!=='in'||tx.bank.toLowerCase()!=='vietinbank')return markReview(store,tx,'Tài khoản nhận hoặc chiều giao dịch chưa khớp.',order,now);
  const paidWhen=Date.parse(tx.occurredAt),created=Date.parse(order.createdAt),expired=Date.parse(order.expiresAt);
  if(!admin&&(paidWhen<Math.floor(created/1000)*1000-1000||paidWhen>expired||paidWhen>now+300000))return markReview(store,tx,'Giao dịch nằm ngoài thời gian thanh toán; cần ADMIN đối chiếu.',order,now);

  // Reserve the bank reference too, so a duplicated provider ID cannot reuse a real receipt.
  if(tx.reference){
    const refKey='reference-'+hash(tx.account+'|'+tx.reference);
    const first=await atomic(store,refKey,{transactionId:tx.id,orderId:order.id,createdAt:iso(now)},(r,exists)=>({skip:exists,value:r}));
    if(first.transactionId!==tx.id)return markReview(store,tx,'Mã tham chiếu ngân hàng đã được ghi nhận ở giao dịch khác.',order,now);
  }
  record=await atomic(store,txKey(tx.id),null,r=>{
    if(r.orderId&&r.orderId!==order.id)fail(409,'Giao dịch đã được gắn với đơn khác.');
    if(r.status==='applied')return {skip:true,value:r};
    r.orderId=order.id;r.userId=order.userId;r.status='processing';r.reason=null;r.updatedAt=iso(now);if(admin)r.reviewedBy={id:admin.id,email:admin.email};return {value:r};
  });
  if(record.status==='applied')return {success:true,duplicate:true};

  // Grant and receipt marker are committed in ONE member CAS write.
  // A retry after any later write failure sees this marker and never adds days twice.
  const user={id:order.userId,email:order.userEmail,name:order.userEmail};
  let grant;
  try{
    grant=await atomic(store,memberKey(order.userId),emptyMember(user),member=>{
      if(member.userId!==order.userId)fail(503,'Chưa cập nhật được VIP.');
      member.grants=member.grants||{};
      if(own(member.grants,order.id)){
        if(member.grants[order.id].transactionId!==tx.id)fail(409,'Đơn đã thanh toán bằng một giao dịch khác.');
        return {skip:true,value:member.grants[order.id]};
      }
      if(member.blocked)fail(403,'Tài khoản đang bị tạm khóa VIP thanh toán.');
      if(![30,60].includes(order.days)||!Number.isSafeInteger(order.amount))fail(503,'Chưa xác minh được gói VIP của đơn.');
      const previous=Date.parse(member.expiresAt||''),start=Math.max(now,Number.isFinite(previous)?previous:0),end=start+order.days*DAY;
      const g={orderId:order.id,transactionId:tx.id,amount:order.amount,days:order.days,paidAt:iso(now),expiresAt:iso(end)};
      member.expiresAt=g.expiresAt;member.grants[order.id]=g;member.updatedAt=iso(now);return {value:g};
    });
  }catch(e){if(e.status===409||e.status===403)return markReview(store,tx,e.message,order,now);throw e;}
  await atomic(store,orderKey(order.id),null,o=>{
    if(o.transactionId&&o.transactionId!==tx.id)fail(409,'Đơn đã có giao dịch thanh toán khác.');
    o.status='paid';o.transactionId=tx.id;o.paidAt=grant.paidAt;o.grantedUntil=grant.expiresAt;o.reviewReason=null;return {};
  });
  await atomic(store,txKey(tx.id),null,r=>{r.status='applied';r.reason=null;r.appliedAt=grant.paidAt;r.grantedUntil=grant.expiresAt;r.updatedAt=iso(now);return {};});
  return {success:true};
}

export function createWebhookHandler(deps){return async req=>{
  try{
    if(!deps.production())fail(503,'Chỉ nhận thanh toán ở website chính thức.');
    if(req.method!=='POST')fail(405,'Phương thức không hỗ trợ.');
    const bytes=await rawBody(req,65536),now=deps.now?.()??Date.now();
    verifySePaySignature(req,bytes,deps.config().secret,now);
    const payload=jsonBody(bytes);
    // The dashboard's signed connection probe may use ID 0. It is never a bank
    // receipt: acknowledge connectivity without writing or granting anything.
    if(payload.id===0||payload.id==='0')return reply({success:true});
    const tx=parseTransaction(payload);
    if(tx.direction!=='in'||tx.bank.toLowerCase()!=='vietinbank'||tx.account!==BANK.account)return reply({success:true});
    const store=deps.store(),fp=fingerprint(tx);
    await atomic(store,txKey(tx.id),{schema:1,id:tx.id,fingerprint:fp,transaction:tx,status:'received',orderId:null,reason:null,receivedAt:iso(now),updatedAt:iso(now)},(old,exists)=>{
      if(exists&&old.fingerprint!==fp)fail(409,'Mã giao dịch đã có dữ liệu khác.');return {skip:exists};
    });
    await applyTransaction(store,tx,now);
    return reply({success:true});
  }catch(e){return errorReply(e,true);}
};}

async function listRecords(store,prefix,max=80,after=''){
  if(after&&(typeof after!=='string'||!after.startsWith(prefix)||!/^[a-zA-Z0-9-]+$/.test(after)))fail(400,'Mốc phân trang không hợp lệ.');
  const list=await store.list({prefix});
  const all=list.blobs.map(b=>b.key).sort().reverse().filter(k=>!after||k<after);
  const keys=all.slice(0,max);
  const records=await Promise.all(keys.map(k=>store.get(k,{type:'json'})));
  return {records:records.filter(Boolean),next:all.length>max?keys.at(-1):null};
}
export function createBillingHandler(deps){return async req=>{
  try{
    if(!deps.production())fail(503,'Thanh toán VIP chỉ hoạt động ở website chính thức.');
    const url=new URL(req.url),route=url.searchParams.get('route')||'me',now=deps.now?.()??Date.now(),config=deps.config();
    if(!['GET','POST'].includes(req.method))fail(405,'Phương thức không hỗ trợ.');
    if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail(403,'Yêu cầu phải gửi từ chính website.');
    if(req.method==='GET'&&route==='plans')return reply({plans:PLANS,bank:BANK,ready:isReady(config),serverNow:iso(now)});
    const rawUser=await deps.verify(req),store=deps.store();
    const user=await withPaidVip(rawUser,store,now);
    if(route==='me'&&req.method==='GET')return reply({user,serverNow:iso(now)});
    if(!user)fail(401,'Đăng nhập và xác nhận email để thanh toán VIP.');
    if(route==='create-order'&&req.method==='POST'){
      if(!isReady(config))fail(503,'Website tạm chưa nhận thanh toán. Vui lòng quay lại sau.');
      const body=jsonBody(await rawBody(req,8192));return reply({order:await newOrder(store,user,body,now),serverNow:iso(now)},201);
    }
    if(route==='order'&&req.method==='GET'){
      const order=await store.get(orderKey(validateCode(url.searchParams.get('id'))),{type:'json'});
      if(!order||order.userId!==user.id)fail(404,'Không tìm thấy đơn thanh toán.');
      return reply({order:orderView(order,await getMember(store,user),now),user,serverNow:iso(now)});
    }
    if(route==='orders'&&req.method==='GET'){
      const member=await getMember(store,user),ids=[...new Set([...Object.values(member.requests||{}).map(o=>o.id),...Object.keys(member.grants||{})])];
      const records=(await Promise.all(ids.slice(-200).map(id=>store.get(orderKey(validateCode(id)),{type:'json'})))).filter(o=>o&&o.userId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20);
      return reply({orders:records.map(o=>orderView(o,member,now)),serverNow:iso(now)});
    }
    if(['admin','admin-order','reconcile','block'].includes(route)){
      if(!user.admin)fail(403,'Chỉ ADMIN được quản lý thanh toán và thành viên.');
      if(route==='admin'&&req.method==='GET'){
        const [transactions,members]=await Promise.all([listRecords(store,'txn-',80,url.searchParams.get('afterTransaction')||''),listRecords(store,'member-',200,url.searchParams.get('afterMember')||'')]);
        return reply({transactions:transactions.records,members:members.records.map(m=>({userId:m.userId,email:m.email,name:m.name,expiresAt:m.expiresAt,blocked:!!m.blocked})),nextTransaction:transactions.next,nextMember:members.next,setup:{enabled:config.enabled===true,secretConfigured:typeof config.secret==='string'&&config.secret.length>=32,webhook:url.origin+'/.netlify/functions/ncn-sepay-webhook'},serverNow:iso(now)});
      }
      if(route==='admin-order'&&req.method==='GET'){
        const order=await store.get(orderKey(validateCode(url.searchParams.get('id'))),{type:'json'});
        if(!order)fail(404,'Không tìm thấy đơn thanh toán.');
        return reply({order:orderView(order,await getMember(store,{id:order.userId}),now),email:order.userEmail});
      }
      if(route==='reconcile'&&req.method==='POST'){
        const body=jsonBody(await rawBody(req,8192)),id=validateTxId(body.transactionId),orderId=validateCode(body.orderId),tx=await store.get(txKey(id),{type:'json'});
        if(!tx?.transaction||!tx.fingerprint)fail(404,'Chưa có giao dịch được SePay xác thực với mã này.');
        return reply(await applyTransaction(store,tx.transaction,now,{orderId,admin:user}));
      }
      if(route==='block'&&req.method==='POST'){
        const body=jsonBody(await rawBody(req,8192));
        if(typeof body.userId!=='string'||!body.userId||body.userId.length>100||typeof body.blocked!=='boolean')fail(400,'Thông tin thành viên không hợp lệ.');
        await atomic(store,memberKey(body.userId),null,m=>{if(!m||m.userId!==body.userId)fail(404,'Chưa có thành viên thanh toán này.');m.blocked=body.blocked;m.updatedAt=iso(now);m.updatedBy={id:user.id,email:user.email};return {};});
        return reply({success:true});
      }
    }
    fail(404,'Không tìm thấy chức năng.');
  }catch(e){return errorReply(e);}
};}
