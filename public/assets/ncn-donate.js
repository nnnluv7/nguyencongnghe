const money=value=>Number(value).toLocaleString('vi-VN')+'đ';
const date=value=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});

export function mountDonate({doc,win,account,api,say}){
  const form=doc.getElementById('donate-form');if(!form)return null;
  const $=id=>doc.getElementById(id),listeners=[];
  const state={user:null,order:null,plans:[],enabled:false,epoch:0,timer:null,busy:false,request:null,disposed:false};
  const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  function stop(){if(state.timer)win.clearTimeout(state.timer);state.timer=null;}
  function save(id){try{const key='ncn:donate:order:'+state.user.id;if(id)win.sessionStorage.setItem(key,id);else win.sessionStorage.removeItem(key);}catch{}}
  function controls(){
    $('donate-create').disabled=!state.enabled||state.busy;
    $('donate-create').textContent=state.busy?'Đang tạo mã…':state.user?'Tạo QR Donate':'Đăng nhập để Donate';
    const plan=state.plans.find(p=>p.id===form.elements.planId.value),quantity=Number(form.elements.quantity.value);
    if(plan)$('donate-total').textContent=money(plan.amount*quantity)+' · '+plan.days*quantity+' ngày VIP';
  }
  function clear(){stop();state.order=null;state.request=null;$('donate-order').hidden=true;$('donate-qr').removeAttribute('src');$('donate-owner').textContent='';}
  function paint(order){
    state.order=order;$('donate-order').hidden=false;
    const pending=order.status==='pending',paid=order.status==='paid';
    $('donate-qr').hidden=!pending;
    if(pending){$('donate-qr-error').hidden=true;$('donate-qr').src=order.qrUrl;}
    else $('donate-qr').removeAttribute('src');
    $('donate-status').textContent=paid?'ĐÃ GHI NHẬN':pending?'CHỜ CHUYỂN KHOẢN':order.status==='expired'?'QR ĐÃ HẾT HẠN':'CẦN ĐỐI CHIẾU';
    $('donate-order-title').textContent=order.name;
    $('donate-owner').textContent=state.user.email;
    $('donate-bank').textContent=order.bankName+' · '+order.payeeName;
    $('donate-account').textContent=order.bankAccount;
    $('donate-amount').textContent=money(order.amount);
    $('donate-description').textContent=order.description;
    $('donate-expiry').textContent=date(order.expiresAt);
    $('donate-check').hidden=!pending;$('donate-copy').hidden=!pending;
    $('donate-order-note').textContent=paid?'Cảm ơn bạn đã ủng hộ! VIP được cộng đến '+date(order.vipExpiresAt)+'.':pending?'Giữ nguyên số tiền và nội dung. Hệ thống sẽ tự cập nhật khi SePay xác nhận.':order.status==='expired'?'Chưa chuyển khoản thì hãy tạo QR mới. Nếu đã chuyển, liên hệ Admin kèm mã đơn để được đối chiếu.':(order.reviewReason||'Giao dịch cần được Admin đối chiếu. Vui lòng giữ biên lai.');
    if(!pending){stop();save(null);}else{save(order.id);schedule();}
  }
  function schedule(){stop();if(!state.disposed&&state.order?.status==='pending')state.timer=win.setTimeout(()=>{if(doc.visibilityState==='hidden'){schedule();return;}check().catch(()=>schedule());},5000);}
  async function check(){
    if(!state.order||!state.user)return;const epoch=state.epoch,result=await api('order',null,{id:state.order.id});
    if(epoch!==state.epoch||state.disposed)return;paint(result.order);
    if(result.order.status==='paid'){await account.refresh({force:true});say('Đã ghi nhận Donate và cộng '+result.order.days+' ngày VIP. Cảm ơn bạn đã ủng hộ!');}
  }
  async function render(user){
    const changed=state.user?.id!==user?.id;state.user=user;
    if(changed){++state.epoch;state.busy=false;clear();}
    controls();if(!user||!changed)return;
    let id;try{id=win.sessionStorage.getItem('ncn:donate:order:'+user.id);}catch{}
    if(!/^NCN[A-F0-9]{20}$/.test(id||''))return;
    const epoch=state.epoch;
    try{const result=await api('order',null,{id});if(epoch===state.epoch&&!state.disposed)paint(result.order);}catch{if(epoch===state.epoch)save(null);}
  }
  listen(form,'change',()=>{state.request=null;controls();});
  listen(form,'submit',async event=>{
    event.preventDefault();if(!state.enabled||state.busy)return;
    if(!state.user){account.open('login');return;}
    state.busy=true;controls();const epoch=state.epoch;
    if(!state.request)state.request={planId:form.elements.planId.value,quantity:Number(form.elements.quantity.value),requestId:win.crypto.randomUUID()};
    try{const result=await api('create-order',state.request);if(epoch!==state.epoch||state.disposed)return;paint(result.order);say('QR chỉ dành cho '+state.user.email+'. Chuyển đúng số tiền và nội dung hiển thị.');}
    catch(error){if(epoch===state.epoch)say(error.message,true);}
    finally{if(epoch===state.epoch){state.busy=false;controls();}}
  });
  listen($('donate-new'),'click',()=>{clear();save(null);controls();form.scrollIntoView({behavior:'smooth',block:'center'});});
  listen($('donate-check'),'click',async()=>{const button=$('donate-check');button.disabled=true;try{await check();}catch(error){say(error.message,true);}finally{button.disabled=false;}});
  listen($('donate-copy'),'click',async()=>{try{await win.navigator.clipboard.writeText(state.order.description);say('Đã sao chép nội dung chuyển khoản.');}catch{say('Hãy chọn và sao chép nội dung chuyển khoản đang hiển thị.');}});
  listen($('donate-qr'),'error',()=>{$('donate-qr-error').hidden=false;});
  listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='visible'&&state.order?.status==='pending')check().catch(()=>schedule());});
  const ready=api('plans').then(result=>{
    if(state.disposed)return;state.plans=result.plans;state.enabled=result.enabled===true;
    $('donate-setup').textContent=state.enabled?'Donate tự động đã sẵn sàng. Đăng nhập đúng tài khoản trước khi tạo QR.':'Donate tự động đang chờ Admin kết nối SePay. Chưa chuyển khoản lúc này.';
    controls();
  }).catch(error=>{$('donate-setup').textContent=error.message;controls();});
  return {state,ready,render,dispose(){state.disposed=true;stop();listeners.forEach(remove=>remove());}};
}
