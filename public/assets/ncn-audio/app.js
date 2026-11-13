import {ensureSession,onAuthChange} from '../ncn-identity-client.js';
import {MAX_AUDIO_SAMPLE_BYTES,earliestAudioDate} from './shared.js';

const endpoint='/.netlify/functions/ncn-audio';
const savedKey='ncn:audio:order:v1';
const money=new Intl.NumberFormat('vi-VN');
const dateTime=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
const dayFormat=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeZone:'UTC'});
const currency=amount=>money.format(amount)+'đ';
const paymentLabels={pending:'Chờ chuyển khoản',paid:'Đã thanh toán',review:'Cần đối chiếu'};
const workLabels={new:'Chờ xử lý',recording:'Đang thu',done:'Hoàn tất'};

export function mountAudio({doc=document,win=window,fetcher=fetch,identity={ensureSession,onAuthChange}}={}){
 const $=id=>doc.getElementById('au-'+id),form=$('order-form'),sampleForm=$('sample-form'),history=doc.getElementById('audio-history');
 const node=(tag,value,cls)=>{const el=doc.createElement(tag);if(value)el.textContent=value;if(cls)el.className=cls;return el;};
 const message=(id,value)=>{$(id).textContent=value;};
 const fmt=value=>dateTime.format(new Date(value));
 const sampleURL=id=>endpoint+'?route=sample&id='+encodeURIComponent(id);
 let token=readToken(),current=null,ready=false,pending=false,poll=0,bookingGeneration=0;
 let staff=false,staffGeneration=0,staffRequest=null,historyBusy=false,cursor=null,samples=[],sampleBusy=false;

 function readToken(){try{return win.localStorage.getItem(savedKey)||'';}catch{return '';}}
 function saveToken(value){
  token=value;
  try{if(value)win.localStorage.setItem(savedKey,value);else win.localStorage.removeItem(savedKey);}catch{}
 }
 function syncDeliveryDate(){
  const date=form.elements.date;
  date.min=earliestAudioDate();
  if(!date.value)date.value=date.min;
 }
 async function api(route,{data,body,query,signal}={}){
  const url=new URL(endpoint,win.location.origin);url.searchParams.set('route',route);
  for(const [key,value] of Object.entries(query||{}))if(value)url.searchParams.set(key,value);
  const timeout=AbortSignal.timeout(body===undefined?18000:55000);
  const res=await fetcher(url.href,{
   method:data===undefined&&body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
   signal:signal?AbortSignal.any([signal,timeout]):timeout,
   ...(data===undefined?body===undefined?{}:{body}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(new Error(result.error||'Chưa thực hiện được. Vui lòng thử lại.'),{status:res.status});
  return result;
 }
 function showOrder(order){
  const first=!current;current=order;
  form.hidden=true;$('checkout').hidden=false;
  message('code',order.code);
  message('order-status',order.payment==='paid'?'Đã nhận chuyển khoản · '+workLabels[order.work]:order.payment==='review'?'SePay đã nhận giao dịch cần đối chiếu. Liên hệ Admin và gửi mã đơn bên dưới.':'Chờ SePay xác nhận chuyển khoản.');
  $('payment').hidden=!order.bank||order.payment==='paid';
  if(order.bank){
   message('bank',order.bank.bank);message('payee',order.bank.name);
   message('bank-account',order.bank.account);message('amount',currency(order.amount));
  }
  if(order.qr){
   $('qr').hidden=false;
   if($('qr').getAttribute('src')!==order.qr)$('qr').src=order.qr;
  }else{$('qr').hidden=true;$('qr').removeAttribute('src');}
  if(first)$('checkout-title').focus({preventScroll:true});
  queueStatus();
 }
 function queueStatus(){
  win.clearTimeout(poll);
  if(current?.payment==='pending'&&!doc.hidden&&Date.now()-Date.parse(current.createdAt)<15*60000)poll=win.setTimeout(()=>refreshStatus(),6500);
 }
 async function refreshStatus({initial=false,manual=false}={}){
  if(!token||pending)return;
  const generation=bookingGeneration;
  pending=true;$('check').disabled=true;
  try{
   const {order}=await api('status',{data:{token}});
   if(generation!==bookingGeneration)return;
   showOrder(order);message('booking-message','');
  }catch(error){
   if(generation!==bookingGeneration)return;
   if(error.status===404&&initial){form.hidden=false;return;}
   if(manual||initial)message('booking-message',error.message);
  }finally{
   pending=false;$('check').disabled=false;
   if(generation===bookingGeneration)queueStatus();
  }
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!ready||pending)return;
  syncDeliveryDate();
  if(!form.reportValidity())return;
  const fields=new FormData(form),generation=bookingGeneration;
  try{if(!token)saveToken(win.crypto.randomUUID());}catch{message('booking-message','Vui lòng mở trang qua HTTPS để đặt thu.');return;}
  pending=true;$('submit').disabled=true;message('booking-message','Đang tạo đơn…');
  try{
   const {order}=await api('create',{data:{...Object.fromEntries(fields),token,urgent:fields.has('urgent'),confirm:fields.has('confirm')}});
   if(generation!==bookingGeneration)return;
   showOrder(order);message('booking-message','');
  }catch(error){if(generation===bookingGeneration)message('booking-message',error.message);}
  finally{pending=false;$('submit').disabled=!ready;}
 });
 $('check').addEventListener('click',()=>refreshStatus({manual:true}));
 $('reset').addEventListener('click',()=>{
  if(pending)return;
  if(current?.payment!=='paid'&&!win.confirm('Đặt đơn mới sẽ bỏ mã theo dõi đơn này trên trình duyệt. Anh/chị đã lưu mã đơn chưa?'))return;
  ++bookingGeneration;win.clearTimeout(poll);saveToken('');current=null;
  $('checkout').hidden=true;$('qr').removeAttribute('src');form.hidden=false;form.reset();syncDeliveryDate();
  message('booking-message','');form.elements.name.focus();
 });
 $('copy').addEventListener('click',async()=>{
  try{await win.navigator.clipboard.writeText(current.code);message('booking-message','Đã sao chép mã đơn.');}
  catch{message('booking-message','Chọn và sao chép mã đơn hiển thị phía trên.');}
 });
 doc.addEventListener('visibilitychange',()=>{
  win.clearTimeout(poll);
  if(doc.hidden)return;
  syncDeliveryDate();
  if(current?.payment==='pending')refreshStatus();
 });

 function renderSamples(items){
  samples=items;
  const publicList=$('samples'),privateList=$('sample-list');
  publicList.replaceChildren();privateList.replaceChildren();
  if(!samples.length)publicList.append(node('p','Chưa có audio mẫu.'));
  for(const item of samples){
   const demo=node('div','','au-demo'),audio=node('audio');
   audio.controls=true;audio.preload='none';audio.src=sampleURL(item.id);audio.setAttribute('aria-label','Nghe thử '+item.title);
   demo.append(node('strong',item.title),audio);publicList.append(demo);
   if(staff){
    const row=node('div','','au-sample-row'),remove=node('button','Gỡ mẫu','au-secondary');
    remove.type='button';remove.dataset.removeSample=item.id;remove.setAttribute('aria-label','Gỡ mẫu '+item.title);
    row.append(node('strong',item.title),remove);privateList.append(row);
   }
  }
 }
 function clearStaff(){
  ++staffGeneration;staffRequest?.abort();staffRequest=null;staff=false;historyBusy=false;cursor=null;
  $('orders').replaceChildren();$('sample-list').replaceChildren();sampleForm.reset();
  $('refresh').hidden=$('more').hidden=$('login').hidden=$('sample-editor').hidden=$('staff-link').hidden=true;
  history.hidden=win.location.hash!=='#audio-history';
  message('history-message','');
 }
 function staffError(error,id){
  if(error.status===401||error.status===403){clearStaff();history.hidden=false;$('login').hidden=error.status!==401;message('history-message',error.message);}
  else message(id,error.message);
 }
 function orderCard(order){
  const details=node('details','','au-order'),summary=node('summary');
  const {booking,payment,work}=order;
  summary.textContent=booking.name+(booking.urgent?' · Cần thu gấp':'')+' · '+paymentLabels[payment.state]+' · '+workLabels[work.state];
  const content=node('div','','au-order-body'),badges=node('div','','au-order-head');
  badges.append(node('span',order.code,'au-state'),node('span',currency(order.amount),'au-state'));
  content.append(badges,node('p','Đặt lúc '+fmt(order.createdAt)+' · Ngày nhận dự kiến '+dayFormat.format(new Date(booking.date+'T00:00:00Z'))));
  content.append(node('p','Liên hệ '+booking.channel+' · '+booking.phone));
  if(payment.state==='paid')content.append(node('p','Đã nhận '+currency(payment.amount)+' lúc '+fmt(payment.paidAt)+(payment.reference?' · '+payment.reference:'')));
  if(payment.state==='review')content.append(node('p',payment.reason+' Đã nhận '+currency(payment.amount)+(payment.reference?' · '+payment.reference:'')));
  content.append(node('h3','Nội dung cần thu'),node('p',booking.script,'au-script-copy'));
  if(work.events.length){
   const log=node('ol');for(const item of [...work.events].reverse())log.append(node('li',fmt(item.at)+' · '+item.by+' · '+workLabels[item.state]+(item.note?' · '+item.note:'')));
   content.append(node('h3','Lịch sử xử lý'),log);
  }
  const edit=node('form'),status=node('select'),note=node('textarea'),save=node('button','Lưu xử lý','au-primary');
  for(const [key,label] of Object.entries(workLabels)){const option=node('option',label);option.value=key;status.append(option);}
  status.value=work.state;status.disabled=payment.state!=='paid';note.rows=2;note.maxLength=600;note.value=work.note;
  const stateLabel=node('label','Trạng thái xử lý'),noteLabel=node('label','Ghi chú nội bộ');stateLabel.append(status);noteLabel.append(note);save.type='submit';
  edit.append(stateLabel,noteLabel,save);content.append(edit);
  edit.addEventListener('submit',async event=>{
   event.preventDefault();if(!staff||save.disabled)return;
   const generation=staffGeneration;save.disabled=true;
   try{
    const {order:updated}=await api('update',{data:{code:order.code,version:order.version,state:status.value,note:note.value},signal:staffRequest.signal});
    if(generation!==staffGeneration)return;
    const next=orderCard(updated);next.open=true;details.replaceWith(next);
    next.querySelector('summary').focus({preventScroll:true});
    message('history-message','Đã lưu xử lý đơn.');
   }catch(error){if(generation===staffGeneration)staffError(error,'history-message');}
   finally{save.disabled=false;}
  });
  details.append(summary,content);return details;
 }
 async function loadHistory(more=false){
  if(!staff||historyBusy)return;
  const generation=staffGeneration;
  historyBusy=true;$('refresh').disabled=$('more').disabled=true;
  try{
   const result=await api('history',{query:{after:more?cursor:null},signal:staffRequest.signal});
   if(generation!==staffGeneration)return;
   const cards=result.orders.map(orderCard);
   if(more)$('orders').append(...cards);else $('orders').replaceChildren(...cards);
   cursor=result.next;$('more').hidden=!cursor;
   message('history-message',!more&&!cards.length?'Chưa có đơn đặt thu.':'');
  }catch(error){if(generation===staffGeneration)staffError(error,'history-message');}
  finally{if(generation===staffGeneration){historyBusy=false;$('refresh').disabled=$('more').disabled=false;}}
 }
 async function loadStaff(){
  clearStaff();
  const generation=staffGeneration,request=new AbortController();staffRequest=request;
  try{
   const session=await identity.ensureSession();
   if(generation!==staffGeneration)return;
   if(!session){if(!history.hidden){$('login').hidden=false;message('history-message','Đăng nhập tài khoản có quyền Audio hoặc Admin.');}return;}
   const access=await api('access',{signal:request.signal});
   if(generation!==staffGeneration)return;
   if(!access.allowed){if(!history.hidden)message('history-message','Tài khoản hiện tại chưa có quyền Audio.');return;}
   staff=true;history.hidden=$('staff-link').hidden=$('sample-editor').hidden=$('refresh').hidden=false;
   $('refresh').disabled=$('more').disabled=false;renderSamples(samples);
   if(win.location.hash==='#audio-history')history.scrollIntoView({block:'start'});
   await loadHistory();
  }catch(error){if(generation===staffGeneration&&!history.hidden)staffError(error,'history-message');}
 }
 async function editSamples(work){
  if(!staff||sampleBusy)return;
  const generation=staffGeneration,controls=[...sampleForm.querySelectorAll('input,button'),...$('sample-list').querySelectorAll('button')];
  sampleBusy=true;controls.forEach(el=>el.disabled=true);
  try{
   const result=await work();
   if(generation!==staffGeneration)return;
   renderSamples(result.samples);sampleForm.reset();message('sample-message','Đã cập nhật audio mẫu.');
  }catch(error){if(generation===staffGeneration)staffError(error,'sample-message');}
  finally{sampleBusy=false;controls.forEach(el=>el.disabled=false);}
 }
 sampleForm.addEventListener('submit',event=>{
  event.preventDefault();
  const file=sampleForm.elements.file.files[0],title=sampleForm.elements.title.value.trim();
  if(!file||!title)return;
  if(file.size>MAX_AUDIO_SAMPLE_BYTES){message('sample-message','Tệp MP3 phải dưới hoặc bằng 4 MB.');return;}
  editSamples(()=>api('add-sample',{query:{title},body:file,signal:staffRequest.signal}));
 });
 $('sample-list').addEventListener('click',event=>{
  const id=event.target.closest('[data-remove-sample]')?.dataset.removeSample;
  if(id&&staff&&!sampleBusy&&win.confirm('Gỡ audio mẫu này khỏi trang?'))editSamples(()=>api('remove-sample',{data:{id},signal:staffRequest.signal}));
 });
 $('refresh').addEventListener('click',()=>loadHistory());
 $('more').addEventListener('click',()=>loadHistory(true));
 win.addEventListener('hashchange',()=>{if(win.location.hash==='#audio-history'&&!staff)loadStaff();});
 win.addEventListener('pageshow',event=>{if(event.persisted){syncDeliveryDate();loadStaff();}});
 doc.addEventListener('ncn-account-change',event=>{if(!event.detail?.user)clearStaff();});
 doc.addEventListener('ncn-account-signed-out',clearStaff);
 identity.onAuthChange(event=>{if(event==='logout')clearStaff();else loadStaff();});

 form.elements.date.addEventListener('focus',syncDeliveryDate);
 syncDeliveryDate();
 async function start(){
  try{
   const setup=await api('setup');
   renderSamples(setup.samples);ready=setup.ready;$('submit').disabled=!ready;
   message('booking-message',ready?'':'Đặt thu sẽ mở khi kết nối SePay sẵn sàng.');
  }catch(error){
   message('booking-message',error.message);
   $('samples').replaceChildren(node('p','Chưa tải được audio mẫu.'));
  }
  if(token)await refreshStatus({initial:true});
 }
 start();loadStaff();
}
if(typeof document!=='undefined'&&document.getElementById('ncn-audio-app'))mountAudio();
