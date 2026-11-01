import {getAccount} from './ncn-account.js?v=20261027-photo-save-1';

const ENDPOINT='/.netlify/functions/ncn-billing';
const money=value=>Number(value).toLocaleString('vi-VN')+'đ';
const date=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
const labels={pending:'Chờ chuyển khoản',paid:'Đã ghi nhận',expired:'Mã cũ đã hết hạn',review:'Cần đối chiếu',received:'Đã nhận',processing:'Đang xử lý',applied:'Đã ghi nhận đơn cũ',donated:'Đã nhận donate'};

export function mountBilling({doc=document,win=window,fetcher=fetch,account=getAccount(doc)}={}){
  const $=id=>doc.getElementById(id),listeners=[];
  const state={user:null,epoch:0,details:null,transactions:[],members:[],nextTransaction:null,nextMember:null,reconcile:null,disposed:false};
  let generation=0,controller=null;
  const listen=(node,type,fn)=>{node?.addEventListener(type,fn);listeners.push(()=>node?.removeEventListener(type,fn));};
  const text=(tag,value,cls)=>{const node=doc.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node;};
  function say(value,error=false,id='pay-message'){const node=$(id);node.textContent=value;node.hidden=!value;node.classList.toggle('pay-error',error);}
  async function run(fn,button){if(button)button.disabled=true;try{await fn();}catch(error){if(!state.disposed)say(error.message||'Kết nối đang chậm. Thử lại nhé.',true);}finally{if(button)button.disabled=false;}}
  function button(label,fn){const node=text('button',label,'pay-link');node.type='button';listen(node,'click',()=>run(fn,node));return node;}
  async function api(route,body,params={},signal){
    const url=new URL(ENDPOINT,win.location.origin);url.searchParams.set('route',route);
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,value);
    const response=await fetcher(url.href,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:signal||AbortSignal.timeout(15000)});
    let result;try{result=await response.json();}catch{throw Error('Máy chủ chưa trả lời được. Bạn có thể thử lại hoặc sao chép thông tin chuyển khoản bên dưới.');}if(!response.ok)throw new Error(result.error||'Chưa kết nối được. Thử lại nhé.');return result;
  }
  function invalidate(){
    generation++;controller?.abort();controller=null;$('donate-submit').disabled=false;
    $('donate-qr').hidden=true;$('donate-qr-open').hidden=true;$('donate-qr-error').hidden=true;
    $('donate-qr-note').textContent='Bấm tạo QR để cập nhật số tiền bạn chọn.';
    doc.querySelectorAll('[data-donate-amount]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.donateAmount===$('donate-amount').value.trim())));
  }
  async function prepare(){
    const input=$('donate-amount'),amount=input.value.trim();
    if(amount&&!/^[1-9]\d{0,12}$/.test(amount)){input.setCustomValidity('Nhập số tiền nguyên dương bằng VND, hoặc để trống để tự chọn khi chuyển khoản.');input.reportValidity();return;}
    const version=++generation;controller?.abort();controller=new AbortController();
    const current=controller,timeout=win.setTimeout(()=>current.abort(),15000);$('donate-submit').disabled=true;say('');$('donate-qr').hidden=true;$('donate-qr-open').hidden=true;$('donate-qr-error').hidden=true;$('donate-qr-note').textContent='Đang chuẩn bị QR…';
    try{
      const details=await api('donation',null,{amount},current.signal);
      if(version!==generation||state.disposed)return;
      const qr=new URL(details.qrUrl);if(qr.origin!=='https://vietqr.app'||qr.pathname!=='/img')throw Error('QR chưa hợp lệ. Thử lại nhé.');
      state.details=details;const image=$('donate-qr');image.dataset.generation=String(version);image.src=qr.href;
      $('donate-qr-open').href=qr.href;$('donate-qr-open').hidden=false;image.hidden=false;
      $('donate-bank').textContent=details.bank.bank;$('donate-bank-account').textContent=details.bank.account;$('donate-payee').textContent=details.bank.name;$('donate-description').textContent=details.description;
      $('donate-qr-note').textContent=details.amount===null?'Tự chọn số tiền trong ứng dụng ngân hàng.':'QR ủng hộ '+money(details.amount)+'.';
      $('donate-selected').textContent=details.amount===null?'Một chút tùy tâm':money(details.amount);
    }catch(error){if(version===generation&&!state.disposed){$('donate-qr-note').textContent='Bạn có thể chuyển khoản bằng thông tin bên dưới.';say(['TimeoutError','AbortError'].includes(error.name)?'Kết nối đang chậm. Thử tạo QR lại hoặc sao chép số tài khoản bên dưới.':error.message,true);}}
    finally{win.clearTimeout(timeout);if(version===generation){controller=null;$('donate-submit').disabled=false;}}
  }
  listen($('donate-form'),'submit',event=>{event.preventDefault();prepare();});
  listen($('donate-amount'),'input',()=>{$('donate-amount').setCustomValidity('');invalidate();});
  doc.querySelectorAll('[data-donate-amount]').forEach(node=>listen(node,'click',()=>{$('donate-amount').value=node.dataset.donateAmount;$('donate-amount').setCustomValidity('');invalidate();prepare();}));
  listen($('donate-qr'),'error',()=>{if($('donate-qr').dataset.generation!==String(generation))return;$('donate-qr').hidden=true;$('donate-qr-error').hidden=false;});
  doc.querySelectorAll('[data-donate-copy]').forEach(node=>listen(node,'click',()=>run(async()=>{
    const value=$(node.dataset.donateCopy).textContent;
    try{await win.navigator.clipboard.writeText(value);say('Đã sao chép.');}catch{say('Chạm giữ nội dung để sao chép thủ công nhé.',true);}
  },node)));
  function clearPreview(){state.reconcile=null;$('pay-reconcile-preview').hidden=true;$('pay-reconcile-apply').hidden=true;}
  function renderUser(user){
    $('ncn-billing-app').dataset.ncnAccountPanel='ready';
    const changed=user?.id!==state.user?.id||!!user?.admin!==!!state.user?.admin;
    state.user=user;
    if(changed){state.epoch++;state.transactions=[];state.members=[];$('pay-history').replaceChildren();$('pay-admin-transactions').replaceChildren();$('pay-admin-members').replaceChildren();$('pay-history-panel').open=false;$('pay-admin').open=false;clearPreview();}
    $('pay-email').textContent=user?.email||'Công cụ VIP dành cho thành viên NCN';
    $('pay-entitlement').textContent=user?'Bạn đã đăng nhập và có thể sử dụng Event, Giờ Vàng VIP.':'Đăng nhập hoặc tạo tài khoản để dùng Event và Giờ Vàng VIP.';
    $('pay-auth').hidden=!!user;$('pay-tools').hidden=!user;$('pay-history-panel').hidden=!user;$('pay-admin').hidden=!user?.admin;
  }
  function table(headers,rows){const node=doc.createElement('table'),head=doc.createElement('thead'),tr=doc.createElement('tr');for(const title of headers)tr.append(text('th',title));head.append(tr);node.append(head);const body=doc.createElement('tbody');for(const cells of rows){const row=doc.createElement('tr');for(const value of cells){const cell=doc.createElement('td');if(typeof value==='string')cell.textContent=value;else cell.append(value);row.append(cell);}body.append(row);}node.append(body);return node;}
  async function history(){
    if(!state.user)return;const epoch=state.epoch,result=await api('orders');if(epoch!==state.epoch||state.disposed)return;
    $('pay-history').replaceChildren(...(result.orders.length?result.orders.map(order=>{
      const row=text('div','','pay-history-item'),info=doc.createElement('div');info.append(text('strong',order.name+' · '+money(order.amount)),text('small',date(order.createdAt)+' · '+order.id));row.append(info,text('span',labels[order.status]||order.status,'pay-badge'));return row;
    }):[text('p','Chưa có giao dịch trước đây.','pay-caption')]));
  }
  function renderAdmin(){
    $('pay-admin-transactions').replaceChildren(table(['Giao dịch','Số tiền / nội dung','Kết quả','Thao tác'],state.transactions.map(t=>{
      const info=doc.createElement('div');info.append(text('strong',money(t.transaction.amount)),text('small',t.transaction.content));
      const outcome=doc.createElement('div');outcome.append(text('strong',labels[t.status]||t.status),text('small',t.reason||t.orderId||''));
      return [t.id+' · '+date(t.transaction.occurredAt),info,outcome,['applied','donated'].includes(t.status)?text('span','Đã ghi nhận'):button('Đối chiếu đơn cũ',()=>{const form=$('pay-reconcile');form.elements.transactionId.value=t.id;form.elements.orderId.value=t.orderId||(t.transaction.content.match(/\bNCN[A-Fa-f0-9]{20}\b/)||[])[0]||'';clearPreview();form.elements.orderId.focus();})];
    })));
    $('pay-admin-members').replaceChildren(table(['Thành viên','Hạn gói cũ','Hồ sơ gói cũ'],state.members.map(m=>[m.email||m.userId,date(m.expiresAt),m.blocked?'Đã tạm khóa gói cũ':'Đã lưu'])));
    $('pay-admin-more-tx').hidden=!state.nextTransaction;$('pay-admin-more-members').hidden=!state.nextMember;
  }
  async function loadAdmin(more=''){
    if(!state.user?.admin)return;const epoch=state.epoch,result=await api('admin',null,{afterTransaction:more==='tx'?state.nextTransaction:null,afterMember:more==='members'?state.nextMember:null});if(epoch!==state.epoch||state.disposed)return;
    if(!more){state.transactions=result.transactions;state.members=result.members;state.nextTransaction=result.nextTransaction;state.nextMember=result.nextMember;}
    else if(more==='tx'){state.transactions.push(...result.transactions);state.nextTransaction=result.nextTransaction;}
    else{state.members.push(...result.members);state.nextMember=result.nextMember;}
    $('pay-admin-setup').textContent=result.setup.secretConfigured?'Kết nối SePay đã được cấu hình. Các giao dịch donate được ghi nhận riêng.':'Donate bằng QR hoặc chuyển khoản. Kết nối ghi nhận SePay chưa được cấu hình.';renderAdmin();
  }
  listen($('pay-history-panel'),'toggle',()=>{if($('pay-history-panel').open)run(history);});
  listen($('pay-admin'),'toggle',()=>{if($('pay-admin').open)run(()=>loadAdmin());});
  listen($('pay-history-refresh'),'click',()=>run(history,$('pay-history-refresh')));
  listen($('pay-admin-refresh'),'click',()=>run(()=>loadAdmin(),$('pay-admin-refresh')));
  listen($('pay-admin-more-tx'),'click',()=>run(()=>loadAdmin('tx'),$('pay-admin-more-tx')));
  listen($('pay-admin-more-members'),'click',()=>run(()=>loadAdmin('members'),$('pay-admin-more-members')));
  listen($('pay-reconcile'),'input',clearPreview);
  listen($('pay-reconcile'),'submit',event=>{event.preventDefault();const form=event.currentTarget,epoch=state.epoch;run(async()=>{
    clearPreview();const transactionId=form.elements.transactionId.value.trim(),orderId=form.elements.orderId.value.trim().toUpperCase(),tx=state.transactions.find(t=>t.id===transactionId);
    if(!tx||['donated','applied'].includes(tx.status))throw Error('Chọn giao dịch chưa được ghi nhận từ danh sách.');
    const result=await api('admin-order',null,{id:orderId});if(epoch!==state.epoch)return;
    const ready=tx.transaction.amount===result.order.amount&&result.order.status!=='paid';
    $('pay-reconcile-preview').hidden=false;$('pay-reconcile-preview').textContent=result.email+' · '+result.order.name+' · '+money(result.order.amount)+' · '+result.order.id+'. '+(ready?'Kiểm tra đúng giao dịch trước khi xác nhận.':'Số tiền chưa khớp hoặc đơn đã được ghi nhận.');
    state.reconcile=ready?{transactionId,orderId}:null;$('pay-reconcile-apply').hidden=!ready;
  },form.querySelector('[type=submit]'));});
  listen($('pay-reconcile-apply'),'click',()=>run(async()=>{
    if(!state.reconcile||!state.user?.admin)return;const epoch=state.epoch,result=await api('reconcile',state.reconcile);if(epoch!==state.epoch)return;clearPreview();say(result.review?'Giao dịch vẫn cần đối chiếu.':'Đã ghi nhận giao dịch của đơn cũ.',!!result.review,'pay-admin-message');await loadAdmin();
  },$('pay-reconcile-apply')));
  listen(doc,'ncn-account-change',event=>renderUser(event.detail.user));
  const ready=prepare();account.ready.then(()=>{if(!state.disposed)renderUser(account.state.user);});
  return {state,ready,dispose(){state.disposed=true;controller?.abort();listeners.forEach(remove=>remove());}};
}
if(typeof document!=='undefined'&&document.getElementById('ncn-billing-app'))mountBilling();
