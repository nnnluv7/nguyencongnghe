import {getAccount} from './ncn-account.js?v=20261027-photo-save-1';
import {canUseVip} from './ncn-vip-access.js';

const ENDPOINT='/.netlify/functions/ncn-billing';
const money=value=>Number(value).toLocaleString('vi-VN')+'đ';
const date=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
const labels={pending:'Chờ chuyển khoản',paid:'Đã ghi nhận',expired:'Mã cũ đã hết hạn',review:'Cần đối chiếu',received:'Đã nhận',processing:'Đang xử lý',applied:'Đã ghi nhận đơn cũ',donated:'Đã ghi nhận'};

export function mountBilling({doc=document,win=window,fetcher=fetch,account=getAccount(doc)}={}){
  const $=id=>doc.getElementById(id),listeners=[];
  const state={user:null,epoch:0,transactions:[],members:[],nextTransaction:null,nextMember:null,reconcile:null,disposed:false};
  const listen=(node,type,fn)=>{node?.addEventListener(type,fn);listeners.push(()=>node?.removeEventListener(type,fn));};
  const text=(tag,value,cls)=>{const node=doc.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node;};
  function say(value,error=false,id='pay-message'){const node=$(id);node.textContent=value;node.hidden=!value;node.classList.toggle('pay-error',error);}
  async function run(fn,button){if(button)button.disabled=true;try{await fn();}catch(error){if(!state.disposed)say(error.message||'Kết nối đang chậm. Thử lại nhé.',true);}finally{if(button)button.disabled=false;}}
  function button(label,fn){const node=text('button',label,'pay-link');node.type='button';listen(node,'click',()=>run(fn,node));return node;}
  async function api(route,body,params={},signal){
    const url=new URL(ENDPOINT,win.location.origin);url.searchParams.set('route',route);
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,value);
    const response=await fetcher(url.href,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:signal||AbortSignal.timeout(15000)});
    let result;try{result=await response.json();}catch{throw Error('Máy chủ chưa trả lời được. Vui lòng thử lại.');}if(!response.ok)throw new Error(result.error||'Chưa kết nối được. Thử lại nhé.');return result;
  }
  function clearPreview(){state.reconcile=null;$('pay-reconcile-preview').hidden=true;$('pay-reconcile-apply').hidden=true;}
  function renderUser(user){
    $('ncn-billing-app').dataset.ncnAccountPanel='ready';
    const changed=user?.id!==state.user?.id||!!user?.admin!==!!state.user?.admin;
    state.user=user;
    if(changed){state.epoch++;state.transactions=[];state.members=[];$('pay-history').replaceChildren();$('pay-admin-transactions').replaceChildren();$('pay-admin-members').replaceChildren();$('pay-history-panel').open=false;$('pay-admin').open=false;clearPreview();}
    $('pay-email').textContent=user?.email||'Đăng nhập tài khoản';
    const allowed=canUseVip(user);
    $('pay-entitlement').textContent=allowed?'Tài khoản đã được cấp quyền VIP.':user?'Tài khoản đang sử dụng quyền thành viên thông thường.':'Đăng nhập hoặc tạo tài khoản để sử dụng website.';
    $('pay-auth').hidden=!!user;$('pay-tools').hidden=!allowed;$('pay-history-panel').hidden=!user;$('pay-admin').hidden=!user?.admin;
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
    $('pay-admin-setup').textContent=result.setup.secretConfigured?'Kết nối SePay đã được cấu hình.':'Kết nối ghi nhận SePay chưa được cấu hình.';renderAdmin();
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
  const ready=account.ready.then(()=>{if(!state.disposed)renderUser(account.state.user);});
  return {state,ready,dispose(){state.disposed=true;listeners.forEach(remove=>remove());}};
}
if(typeof document!=='undefined'&&document.getElementById('ncn-billing-app'))mountBilling();
