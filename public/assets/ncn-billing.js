import * as identityClient from './ncn-identity-client.js';
import {getAccount} from './ncn-account.js?v=20261024-account-2';

const ENDPOINT='/.netlify/functions/ncn-billing';
const money=value=>Number(value).toLocaleString('vi-VN')+'đ';
const date=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có';
const labels={pending:'Chờ thanh toán',paid:'Đã thanh toán',expired:'Đã hết hạn',review:'Cần đối chiếu',received:'Đã nhận',processing:'Đang xử lý',applied:'Đã cấp VIP'};

export function mountBilling({doc=document,identity=identityClient,fetcher=fetch,clock=Date.now,timers=globalThis,storage=globalThis.localStorage,account=getAccount(doc)}={}){
  const win=doc.defaultView||globalThis,$=id=>doc.getElementById(id);
  const state={user:null,ready:false,order:null,offset:0,busy:false,checking:false,epoch:0,transactions:[],members:[],nextTransaction:null,nextMember:null,reconcile:null,disposed:false};
  const listeners=[];
  function listen(node,type,handler){node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));}
  function say(message,error=false,id='pay-message'){const node=$(id);node.textContent=message;node.hidden=!message;node.classList.toggle('pay-error',error);}
  function text(tag,value,className){const node=doc.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
  function button(label,action,className='pay-link'){const node=text('button',label,className);node.type='button';node.addEventListener('click',()=>run(action,node));return node;}
  async function run(action,node){if(node)node.disabled=true;try{await action();}catch(e){say(e.message||'Chưa kết nối được. Vui lòng thử lại.',true);}finally{if(node)node.disabled=false;updateButtons();}}
  async function api(route,body,params={}){
    const url=new URL(ENDPOINT,win.location.origin);url.searchParams.set('route',route);
    for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);
    const controller=new AbortController(),timeout=timers.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetcher(url.href,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
      let data;try{data=await response.json();}catch{throw new Error('Máy chủ chưa trả lời được. Vui lòng thử lại.');}
      if(!response.ok){const error=new Error(data.error||'Chưa thực hiện được.');error.status=response.status;throw error;}
      if(data.serverNow)state.offset=Date.parse(data.serverNow)-clock();return data;
    }catch(e){if(e.name==='AbortError')throw new Error('Kết nối chậm. Vui lòng kiểm tra lại trạng thái, không chuyển tiền thêm.');throw e;}
    finally{timers.clearTimeout(timeout);}
  }
  function updateButtons(){
    const unlimited=state.user&&(state.user.admin||state.user.vipSource==='manual');
    doc.querySelectorAll('[data-pay-plan]').forEach(b=>{b.disabled=!state.ready||state.busy||!!unlimited||!!state.user?.paidVipBlocked;});
    $('pay-availability').textContent=unlimited?'Tài khoản đã có quyền VIP do ADMIN cấp. Bạn không cần thanh toán.':state.user?.paidVipBlocked?'VIP thanh toán đang bị tạm khóa. Liên hệ ADMIN trước khi gia hạn.':state.ready?'Chuyển khoản một lần cho mỗi gói. Gia hạn khi bạn cần.':'Thanh toán đang tạm đóng. Vui lòng quay lại sau hoặc liên hệ hỗ trợ.';
  }
  function renderUser(){
    const user=state.user;
    $('ncn-billing-app').dataset.ncnAccountPanel='ready';
    if(!user){renderOrder(null);state.transactions=[];state.members=[];clearPreview();$('pay-admin-transactions').replaceChildren();$('pay-admin-members').replaceChildren();}
    $('pay-email').textContent=user?.email||'Đăng nhập để mua VIP';
    $('pay-auth').hidden=!!user;$('pay-logout').hidden=!user;$('pay-history-panel').hidden=!user;$('pay-admin').hidden=!user?.admin;
    $('pay-open-event').hidden=!(user?.vip||user?.admin);$('pay-open-gvgs').hidden=!(user?.vip||user?.admin);
    $('pay-entitlement').textContent=!user?'Quyền VIP được gắn với email đã xác nhận.':user.admin?'ADMIN · Toàn quyền quản lý':user.vipSource==='manual'?'VIP được ADMIN cấp · Không giới hạn thời gian':user.paidVipBlocked?'VIP thanh toán đang bị tạm khóa. Vui lòng liên hệ ADMIN.':user.vip?'VIP đang hoạt động · Hết hạn '+date(user.vipExpiresAt):user.vipExpiresAt?'Gói VIP đã hết hạn '+date(user.vipExpiresAt):'Chưa có VIP · Chọn gói bên dưới để bắt đầu.';
    updateButtons();
  }
  function safeStore(key,value){try{if(value===null)storage?.removeItem(key);else storage?.setItem(key,value);}catch{}}
  function readStore(key){try{return storage?.getItem(key);}catch{return null;}}
  function attemptKey(plan){return 'ncn:pay:attempt:'+state.user.id+':'+plan;}
  function nonce(plan){
    const key=attemptKey(plan);let previous;try{previous=JSON.parse(readStore(key));}catch{}
    if(previous?.id&&clock()-previous.created<30*60000)return previous.id;
    const id=win.crypto.randomUUID();safeStore(key,JSON.stringify({id,created:clock()}));return id;
  }
  function rememberOrder(order){safeStore('ncn:pay:last-order',order?.id||null);}
  function renderOrder(order,{focus=false}={}){
    state.order=order;$('pay-checkout').hidden=!order;if(!order)return;
    rememberOrder(order);
    $('pay-state').textContent=labels[order.status]||order.status;$('pay-state').dataset.state=order.status;
    $('pay-selected-plan').textContent=order.name+' · '+money(order.amount);
    const qr=$('pay-qr');qr.hidden=order.status!=='pending';$('pay-qr-error').hidden=true;
    if(order.status==='pending'){
      const src=new URL(order.qrUrl);if(src.origin!=='https://vietqr.app'||src.pathname!=='/img')throw new Error('Mã QR chưa hợp lệ.');
      if(qr.getAttribute('src')!==src.href)qr.src=src.href;
    }else qr.removeAttribute('src');
    $('pay-transfer-fields').replaceChildren();
    for(const [label,value,copy] of [['Ngân hàng',order.bankName,false],['Số tài khoản',order.bankAccount,true],['Người nhận',order.payeeName,false],['Số tiền',money(order.amount),false],['Nội dung chuyển khoản',order.description,true],['Mã đơn',order.id,true]]){
      const row=doc.createElement('div');row.className='pay-transfer-row';row.append(text('span',label));const line=doc.createElement('div');line.append(text('strong',value));
      if(copy)line.append(button('Sao chép',async()=>{try{await win.navigator.clipboard.writeText(value);say('Đã sao chép '+label.toLowerCase()+'.');}catch{say('Chưa sao chép được. Chạm giữ nội dung để sao chép thủ công.',true);}}));
      row.append(line);$('pay-transfer-fields').append(row);
    }
    const note=order.status==='paid'?'Thanh toán đã được ghi nhận. VIP của gói này đến '+date(order.vipExpiresAt)+'. Mở Event hoặc GVGS ở phần tài khoản để sử dụng.':order.status==='review'?'Giao dịch cần ADMIN đối chiếu. '+(order.reviewReason||'Giữ lại mã đơn để được hỗ trợ.')+' Không chuyển thêm lần nữa.':order.status==='expired'?'Mã thanh toán đã hết hạn. Nếu chưa chuyển, chọn lại gói để tạo mã mới. Nếu đã chuyển, liên hệ ADMIN kèm mã đơn.':'Chờ xác nhận từ SePay. Số tiền và nội dung sẽ được điền sẵn khi quét QR.';
    $('pay-order-note').textContent=note;$('pay-order-note').classList.toggle('pay-success',order.status==='paid');
    if(['paid','expired'].includes(order.status)&&state.user)safeStore(attemptKey(order.planId),null);
    countdown();if(focus){$('pay-checkout-title').focus();$('pay-checkout').scrollIntoView?.({behavior:'smooth',block:'start'});}
  }
  function countdown(){
    if(!state.order)return;const remaining=Date.parse(state.order.expiresAt)-(clock()+state.offset);
    $('pay-countdown').textContent=state.order.status==='pending'?(remaining>0?'Mã thanh toán còn '+Math.floor(remaining/60000)+':'+String(Math.floor(remaining/1000)%60).padStart(2,'0'):'Đang kiểm tra trạng thái hết hạn…'):state.order.status==='paid'?'Cảm ơn bạn đã sử dụng NCN.':'Giữ mã đơn để được hỗ trợ.';
  }
  async function history(){
    const epoch=state.epoch,result=await api('orders');if(epoch!==state.epoch)return;
    const target=$('pay-history');target.replaceChildren();if(!result.orders.length){target.append(text('p','Chưa có đơn thanh toán.','pay-caption'));return;}
    for(const order of result.orders){
      const row=doc.createElement('div');row.className='pay-history-item';const info=doc.createElement('div');info.append(text('strong',order.name+' · '+money(order.amount)),text('small',date(order.createdAt)+' · '+order.id));
      row.append(info,text('span',labels[order.status]||order.status,'pay-badge'),button('Xem đơn',()=>{renderOrder(order,{focus:true});return checkOrder(false);}));target.append(row);
    }
  }
  async function refreshUser(){const epoch=state.epoch;const user=await account.refresh();if(epoch!==state.epoch)return;state.user=user;renderUser();return user;}
  async function checkOrder(manual=false){
    if(!state.order||!state.user||state.checking)return;state.checking=true;const epoch=state.epoch,id=state.order.id;
    try{
      await identity.ensureSession();const result=await api('order',null,{id});if(epoch!==state.epoch||state.order?.id!==id)return;
      const old=state.order.status;state.user=result.user;renderUser();renderOrder(result.order);
      if(old!==result.order.status){await history();if(result.order.status==='paid')account.refresh({force:true}).catch(()=>{});}
      if(manual)say(result.order.status==='paid'?'VIP đã được kích hoạt.':result.order.status==='review'?'Giao dịch đang chờ ADMIN đối chiếu.':'Đã kiểm tra. '+$('pay-order-note').textContent);
    }catch(e){if(e.status===401){state.epoch++;state.user=null;renderUser();renderOrder(null);say('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra đơn.',true);}else if(e.status===404){rememberOrder(null);renderOrder(null);if(manual)say(e.message,true);}else if(manual)say(e.message,true);}
    finally{state.checking=false;}
  }
  async function choose(plan){
    if(!state.user){account.open('login');say('Dùng tài khoản website để đăng nhập hoặc đăng ký trước khi chọn gói.');return;}
    const epoch=state.epoch;
    state.busy=true;updateButtons();try{await identity.ensureSession();if(epoch!==state.epoch||!state.user)return;const result=await api('create-order',{planId:plan,idempotencyKey:nonce(plan)});if(epoch!==state.epoch)return;renderOrder(result.order,{focus:true});say('Đã tạo mã thanh toán. Kiểm tra người nhận và số tiền trước khi chuyển.');await history();}finally{state.busy=false;updateButtons();}
  }
  function table(headers,rows){const table=doc.createElement('table'),head=doc.createElement('thead'),tr=doc.createElement('tr');headers.forEach(h=>tr.append(text('th',h)));head.append(tr);table.append(head);const body=doc.createElement('tbody');rows.forEach(cells=>{const row=doc.createElement('tr');cells.forEach(value=>{const td=doc.createElement('td');if(typeof value==='string')td.textContent=value;else td.append(value);row.append(td);});body.append(row);});table.append(body);return table;}
  function renderAdmin(){
    $('pay-admin-transactions').replaceChildren(table(['Giao dịch','Số tiền / nội dung','Kết quả','Thao tác'],state.transactions.map(t=>{
      const info=doc.createElement('div');info.append(text('strong',money(t.transaction.amount)),text('small',t.transaction.content));
      const outcome=doc.createElement('div');outcome.append(text('strong',labels[t.status]||t.status),text('small',t.reason||t.orderId||''));
      return [t.id+' · '+date(t.transaction.occurredAt),info,outcome,t.status==='applied'?text('span','Đã ghi nhận'):button('Đối chiếu',()=>{
        const f=$('pay-reconcile');f.elements.transactionId.value=t.id;const code=t.orderId||(t.transaction.content.match(/\bNCN[A-Fa-f0-9]{20}\b/)||[])[0]||'';f.elements.orderId.value=code;clearPreview();f.elements.orderId.focus();f.scrollIntoView?.({behavior:'smooth'});
      })];
    })));
    $('pay-admin-members').replaceChildren(table(['Thành viên','Hạn VIP trả phí','Trạng thái','Thao tác'],state.members.map(m=>[m.email||m.userId,date(m.expiresAt),m.blocked?'Tạm khóa':Date.parse(m.expiresAt)>clock()+state.offset?'Còn hạn':'Chưa có / hết hạn',button(m.blocked?'Mở lại VIP trả phí':'Tạm khóa VIP trả phí',async()=>{await api('block',{userId:m.userId,blocked:!m.blocked});say('Đã cập nhật VIP trả phí của '+(m.email||m.userId)+'.',false,'pay-admin-message');await loadAdmin();})])));
    $('pay-admin-more-tx').hidden=!state.nextTransaction;$('pay-admin-more-members').hidden=!state.nextMember;
  }
  async function loadAdmin(more=''){
    if(!state.user?.admin)return;const epoch=state.epoch,result=await api('admin',null,{afterTransaction:more==='tx'?state.nextTransaction:null,afterMember:more==='members'?state.nextMember:null});if(epoch!==state.epoch)return;
    if(!more){state.transactions=result.transactions;state.members=result.members;state.nextTransaction=result.nextTransaction;state.nextMember=result.nextMember;}
    else if(more==='tx'){state.transactions.push(...result.transactions);state.nextTransaction=result.nextTransaction;}
    else{state.members.push(...result.members);state.nextMember=result.nextMember;}
    $('pay-admin-setup').textContent=(result.setup.enabled&&result.setup.secretConfigured?'Đang mở thanh toán.':'Thanh toán chưa được bật đủ cấu hình.')+' Webhook SePay (LIVE, HMAC-SHA256): '+result.setup.webhook;
    renderAdmin();
  }
  function clearPreview(){state.reconcile=null;$('pay-reconcile-preview').hidden=true;$('pay-reconcile-apply').hidden=true;}
  async function signedIn(){const epoch=++state.epoch;await refreshUser();if(epoch!==state.epoch||!state.user)return;await history();if(epoch!==state.epoch)return;if(state.user.admin)await loadAdmin();if(epoch!==state.epoch)return;const id=readStore('ncn:pay:last-order');if(/^NCN[A-F0-9]{20}$/.test(id||'')){state.order={id,status:'pending'};await checkOrder();}}
  doc.querySelectorAll('[data-pay-plan]').forEach(b=>listen(b,'click',()=>run(()=>choose(b.dataset.payPlan))));
  listen($('pay-logout'),'click',()=>run(async()=>{await account.signOut();say('Đã đăng xuất tài khoản website.');}));
  let started=false;
  listen(doc,'ncn-account-change',event=>{
    const user=event.detail.user;
    if(!started){state.user=user;renderUser();return;}
    if(user?.id===state.user?.id){state.user=user;renderUser();return;}
    state.epoch++;state.user=null;renderUser();
    if(user)run(signedIn);
  });
  listen($('pay-check'),'click',()=>run(()=>checkOrder(true),$('pay-check')));
  listen($('pay-new'),'click',()=>{renderOrder(null);$('pay-plan-title').scrollIntoView?.({behavior:'smooth'});});
  listen($('pay-history-refresh'),'click',()=>run(history,$('pay-history-refresh')));
  listen($('pay-admin-refresh'),'click',()=>run(()=>loadAdmin(),$('pay-admin-refresh')));
  listen($('pay-admin-more-tx'),'click',()=>run(()=>loadAdmin('tx'),$('pay-admin-more-tx')));
  listen($('pay-admin-more-members'),'click',()=>run(()=>loadAdmin('members'),$('pay-admin-more-members')));
  listen($('pay-qr'),'error',()=>{$('pay-qr').hidden=true;$('pay-qr-error').hidden=false;});
  listen($('pay-reconcile'),'input',clearPreview);
  listen($('pay-reconcile'),'submit',event=>{event.preventDefault();const f=event.currentTarget;run(async()=>{
    clearPreview();const transactionId=f.elements.transactionId.value.trim(),orderId=f.elements.orderId.value.trim().toUpperCase();
    const tx=state.transactions.find(t=>t.id===transactionId);if(!tx)throw new Error('Chọn giao dịch SePay đã xác thực từ danh sách bên trên.');
    const result=await api('admin-order',null,{id:orderId});
    const ready=tx.transaction.amount===result.order.amount&&result.order.status!=='paid'&&tx.status!=='applied';
    $('pay-reconcile-preview').hidden=false;$('pay-reconcile-preview').textContent='Khách: '+result.email+' · '+result.order.name+' · '+money(result.order.amount)+' · '+result.order.id+'. Giao dịch '+transactionId+': '+money(tx.transaction.amount)+'. '+(ready?'Kiểm tra đúng người mua trước khi xác nhận.':'Chưa thể cấp: số tiền không khớp hoặc đơn/giao dịch đã thanh toán.');
    state.reconcile=ready?{transactionId,orderId}:null;$('pay-reconcile-apply').hidden=!ready;
  },f.querySelector('[type="submit"]'));});
  listen($('pay-reconcile-apply'),'click',()=>run(async()=>{
    if(!state.reconcile)return;const result=await api('reconcile',state.reconcile);clearPreview();say(result.review?'Giao dịch vẫn cần đối chiếu. Xem lý do trong danh sách.':'Đã ghi nhận giao dịch và cấp/gia hạn VIP.',!!result.review,'pay-admin-message');await loadAdmin();
  },$('pay-reconcile-apply')));
  listen(doc,'visibilitychange',()=>{if(!doc.hidden)run(async()=>{await refreshUser();await checkOrder();});});
  const tick=timers.setInterval(countdown,1000),poll=timers.setInterval(()=>{
    if(!state.disposed&&!doc.hidden&&state.order&&['pending','review'].includes(state.order.status))checkOrder();
  },5000);
  const authTimer=timers.setInterval(()=>{if(!doc.hidden&&state.user)refreshUser().catch(()=>{});},60000);
  async function start(){
    try{const plans=await api('plans');
      if(plans.plans?.find(p=>p.id==='vip30')?.amount!==30000||plans.plans?.find(p=>p.id==='vip60')?.amount!==55000)throw new Error('Gói VIP đã thay đổi. Tải lại trang để xem giá mới.');
      state.ready=plans.ready;updateButtons();
      await account.ready;started=true;
      await signedIn();
    }catch(e){updateButtons();say(e.name==='MissingIdentityError'?'ADMIN cần bật Netlify Identity trước khi đăng nhập.':e.message,true);}
  }
  $('pay-email').textContent=account.state.profile?.email||'Tài khoản của bạn';
  $('pay-entitlement').textContent='Một tài khoản dùng chung toàn website.';
  $('pay-auth').hidden=true;
  account.ready.then(()=>{if(!state.disposed&&!started&&!account.state.error){state.user=account.state.user;renderUser();}});
  const ready=start();
  return {state,ready,refreshUser,checkOrder,dispose(){state.disposed=true;[tick,poll,authTimer].forEach(t=>timers.clearInterval(t));listeners.forEach(fn=>fn());}};
}

if(typeof document!=='undefined'&&document.getElementById('ncn-billing-app'))mountBilling();
