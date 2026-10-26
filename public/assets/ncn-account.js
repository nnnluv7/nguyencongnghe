import * as identityClient from './ncn-identity-client.js';
import {readDisplayProfile,saveDisplayProfile,displayProfile} from './ncn-account-session.js?v=20261026-profile-1';
import {mountMemberPanel,paintAvatar,profileUpdate} from './ncn-member-profile.js?v=20261026-profile-1';

const accounts=new WeakMap();
const labels={login:'Đăng nhập',register:'Tạo tài khoản',recovery:'Quên mật khẩu',reset:'Đặt mật khẩu mới',profile:'Tài khoản NCN',vip:'Thông tin VIP'};
const aliases={reg:'register',forgot:'recovery'};

export function quizProfile(user,hint=null){
  if(!user?.id||!user?.email)return null;
  const sameEmail=String(hint?.email||'').toLowerCase()===user.email.toLowerCase();
  return {id:user.id,email:user.email,username:String(user.name||(sameEmail&&hint?.username)||user.email)};
}

export function mountAccount({doc=document,win=window,identity=identityClient,fetcher=fetch,storage,sessionStorage,timers=win,clock=Date.now}={}){
  if(accounts.has(doc))return accounts.get(doc);
  if(storage===undefined)try{storage=win.localStorage;}catch{}
  if(sessionStorage===undefined)try{sessionStorage=win.sessionStorage;}catch{}
  const $=id=>doc.getElementById(id),listeners=[];
  const state={user:null,profile:readDisplayProfile(sessionStorage,doc.cookie,clock()),ready:false,busy:false,resetPending:false,settings:null,redirect:null,error:null,checkedAt:0,signingOut:false,serverOffset:0};
  let epoch=0,disposed=false,origin=null,pending=null,afterLogin=null;
  const listen=(node,type,fn,options)=>{node?.addEventListener(type,fn,options);listeners.push(()=>node?.removeEventListener(type,fn,options));};
  const node=(tag,text,cls)=>{const el=doc.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
  function legacyHint(){try{const value=JSON.parse(storage?.getItem('qz_user')||'null');return value&&typeof value.email==='string'?{email:value.email,username:typeof value.username==='string'?value.username:''}:null;}catch{return null;}}
  const hint=legacyHint();
  // Old forms and their local profile are never a source of authentication.
  doc.querySelectorAll('.auth-modal').forEach(el=>el.remove());
  const dialog=node('dialog',null,'ncn-account-dialog');dialog.id='ncn-account-dialog';dialog.setAttribute('aria-labelledby','ncn-account-title');
  dialog.innerHTML=`<header><div><small>NGUYENCONGNGHE.COM</small><h2 id="ncn-account-title">Đăng nhập</h2></div><button type="button" data-account-close aria-label="Đóng tài khoản">×</button></header>
    <p class="ncn-account-intro">Một tài khoản dùng chung toàn website, Event và Giờ Vàng VIP.</p>
    <div class="ncn-account-social" hidden><button type="button" data-account-facebook>Tiếp tục với Facebook</button><small>Dùng tên hồ sơ của bạn để chơi và so sánh thành tích.</small></div>
    <div class="ncn-account-tabs" role="group" aria-label="Tài khoản"><button type="button" data-account-mode="login">Đăng nhập</button><button type="button" data-account-mode="register">Đăng ký</button></div>
    <p id="ncn-account-message" role="status" aria-live="polite" hidden></p>
    <form data-account-form="login"><label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button type="submit" class="ncn-account-primary">Đăng nhập</button><button type="button" class="ncn-account-link" data-account-mode="recovery">Quên mật khẩu?</button></form>
    <form data-account-form="register" hidden><label>Họ tên<input name="name" autocomplete="name" required maxlength="100"></label><label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Mật khẩu<input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><label>Nhập lại mật khẩu<input name="repeat" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit" class="ncn-account-primary">Tạo tài khoản dùng chung</button><details class="ncn-account-legacy"><summary>Đã có tài khoản website cũ?</summary><p>Dùng đúng email cũ để tạo tài khoản chung một lần. Lịch sử theo email được giữ lại. Mật khẩu của hệ thống cũ không tự chuyển sang. Đã có tài khoản Event hoặc VIP? Đăng nhập trực tiếp bằng tài khoản đó.</p></details></form>
    <form data-account-form="recovery" hidden><label>Email đã đăng ký<input name="email" type="email" autocomplete="username" required maxlength="254"></label><button type="submit" class="ncn-account-primary">Gửi email đặt lại mật khẩu</button><button type="button" class="ncn-account-link" data-account-mode="login">Quay lại đăng nhập</button></form>
    <form data-account-form="reset" hidden><label>Mật khẩu mới<input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><label>Nhập lại mật khẩu<input name="repeat" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit" class="ncn-account-primary">Lưu mật khẩu</button></form>
    <footer><a href="/premium/">Đăng ký / gia hạn VIP ↗</a><span>VIP được gắn với email đã xác nhận.</span></footer>`;
  doc.body.append(dialog);
  const forms=Object.fromEntries([...dialog.querySelectorAll('[data-account-form]')].map(f=>[f.dataset.accountForm,f]));
  const member=mountMemberPanel({doc,dialog,getUser:()=>state.user,clock,onMessage:message,onMode:mode,onRefresh:()=>run(()=>refresh({force:true})),onSave:saveMember});
  function renderAdminNavigation(){
    const admin=!!state.user?.admin;
    doc.querySelectorAll('[data-ncn-admin-only]').forEach(el=>el.hidden=!admin);
    const nav=$('ncn-navigation');let entry=$('ncn-admin-navigation');
    if(!admin){entry?.remove();return;}
    if(nav&&!entry){
      entry=node('a',null,'ncn-nav-link');entry.id='ncn-admin-navigation';entry.href='/admin/';
      entry.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6"/></svg><span>Quản trị Admin</span>';
      nav.append(entry);
    }
  }
  for(const form of Object.values(forms))if(form.elements.email&&hint)form.elements.email.value=hint.email;
  if(hint?.username)forms.register.elements.name.value=hint.username;
  function message(text,error=false){const el=$('ncn-account-message');el.textContent=text;el.hidden=!text;el.classList.toggle('ncn-account-error',error);}
  function mode(value){
    const name=aliases[value]||value;if(!labels[name])return;
    state.mode=name;$('ncn-account-title').textContent=labels[name];
    dialog.dataset.accountMode=name;
    for(const [key,form] of Object.entries(forms))form.hidden=key!==name;
    const managing=['profile','vip'].includes(name);
    dialog.querySelector('.ncn-account-tabs').hidden=name==='reset'||managing;
    dialog.querySelector('.ncn-account-intro').textContent=managing?'Hồ sơ và VIP dùng chung trên website và cả 5 game NCN Arcade.':'Một tài khoản dùng chung toàn website, Event và Giờ Vàng VIP.';
    dialog.querySelector('.ncn-account-social').hidden=managing||!state.settings?.providers?.facebook||state.resetPending;
    dialog.querySelectorAll('[data-account-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.accountMode===name)));
    member.render(state.user,{tab:name,busy:state.busy,serverOffset:state.serverOffset});
  }
  async function settings(){
    if(!state.settings){state.settings=await identity.getSettings();render();}
    return state.settings;
  }
  function open(value='login'){
    let name=aliases[value]||value;
    if(['profile','vip'].includes(name)&&!state.user&&!state.profile){afterLogin=name;name='login';}
    origin=doc.activeElement;mode(state.resetPending?'reset':name);message('');
    doc.querySelectorAll('.ncn-account-menu[open]').forEach(el=>el.open=false);
    if(!dialog.open)dialog.showModal();
    const first=forms[state.mode]?.querySelector('input');first?.focus({preventScroll:true});
    if(['profile','vip'].includes(state.mode)&&state.user)member.focus();
    settings().then(config=>{
      if(config.disableSignup&&state.mode==='register'){mode('login');message('Đăng ký mới đang tạm đóng. Liên hệ Admin để được hỗ trợ.',true);}
    }).catch(error=>message(error.message||'Chưa kết nối được dịch vụ tài khoản.',true));
  }
  function close(){afterLogin=null;member.reset();dialog.close();}
  async function facebook(){
    try{const config=await settings();if(!config.providers?.facebook)throw Error('Facebook chưa được mở. Bạn có thể đăng nhập bằng email NCN.');
      const path=win.location.pathname+win.location.search;if(path.startsWith('/ran-luot/'))try{sessionStorage?.setItem('ncn-oauth-return',path);}catch{}
      win.location.assign('/.netlify/identity/authorize?provider=facebook');
    }catch(error){message(error.message||'Chưa kết nối được Facebook.',true);}
  }
  listen(dialog,'close',()=>{if(dialog.open)return;afterLogin=null;dialog.querySelectorAll('input[type=password]').forEach(input=>input.value='');member.reset();origin?.focus?.({preventScroll:true});});
  listen(dialog,'click',event=>{if(event.target===dialog||event.target.closest('[data-account-close]'))close();});
  listen(doc,'click',event=>{
    if(event.target.closest('[data-account-facebook]')){event.preventDefault();facebook();return;}
    const button=event.target.closest('[data-ncn-account-open]');if(button){event.preventDefault();open(button.dataset.ncnAccountOpen);}
    const change=event.target.closest('[data-account-mode]');if(change&&dialog.contains(change)){message('');mode(change.dataset.accountMode);}
  });
  function render(){
    dialog.querySelector('.ncn-account-social').hidden=['profile','vip'].includes(state.mode)||!state.settings?.providers?.facebook||state.resetPending;
    const verified=state.user,user=verified||state.profile;
    const phase=verified?'authenticated':state.error?'error':state.ready?'guest':'restoring';
    doc.documentElement.dataset.ncnAccountState=phase;
    doc.querySelectorAll('.ncn-account-dropdown>strong').forEach(el=>el.textContent='Tài khoản của bạn');
    const host=$('ncn-account-host');
    let auth=$('auth-header-desktop');
    if(!auth&&host){auth=node('div',null,'auth-wrap-desktop');auth.id='auth-header-desktop';host.replaceChildren(auth);}
    if(host&&auth&&!host.closest('.ncn-account-menu')&&!host.querySelector('.ncn-account-menu')){
      const menu=node('details',null,'ncn-account-menu'),summary=node('summary');summary.setAttribute('aria-label','Tài khoản');
      const dropdown=node('div',null,'ncn-account-dropdown');dropdown.append(node('strong','Tài khoản của bạn'),auth);const vip=node('a','Đăng ký / gia hạn VIP ↗');vip.href='/premium/';dropdown.append(vip);menu.append(summary,dropdown);host.replaceChildren(menu);
    }
    const summary=(host?.closest('.ncn-account-menu')||host?.querySelector('.ncn-account-menu'))?.querySelector('summary');
    if(summary){let avatar=summary.querySelector('[data-account-avatar]');if(!avatar){avatar=node('span',null,'ncn-account-avatar');avatar.dataset.accountAvatar='';summary.replaceChildren(avatar);}if(user)paintAvatar(avatar,user);else avatar.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg>';}
    const fill=target=>{
      if(!target)return;target.dataset.ncnAccountState=phase;target.replaceChildren();
      if(user){
        const info=node('div',null,'ncn-account-info');info.append(node('strong',user.name||user.email),node('small',user.email));
        const status=!verified?'Tài khoản':verified.admin?'ADMIN':verified.vip?'VIP đang hoạt động':'Thành viên';info.append(node('span',status,'ncn-account-badge'));
        if(verified?.vipExpiresAt)info.append(node('small','Hạn VIP: '+new Date(verified.vipExpiresAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})));
        target.append(info);
        if(verified){const manage=node('button','Quản lý tài khoản','auth-btn btn-login');manage.type='button';manage.dataset.ncnAccountOpen='profile';target.append(manage);const details=node('button','Thông tin VIP','auth-btn btn-login');details.type='button';details.dataset.ncnAccountOpen='vip';target.append(details);const history=node('a','Lịch sử thi','auth-btn btn-login');history.href='/p/lich-su-thi.html';target.append(history);}
        if(verified?.admin){const admin=node('a','Quản trị Admin','auth-btn btn-login');admin.href='/admin/';target.append(admin);}
        const out=node('button','Đăng xuất','auth-btn btn-login');out.type='button';out.dataset.ncnAccountSignout='';out.disabled=state.busy;target.append(out);
      }else if(phase==='restoring'){
        const status=node('span','Tài khoản của bạn','ncn-account-placeholder');status.setAttribute('role','status');target.append(status);
      }else if(phase!=='error'){
        for(const [value,label] of [['login','Đăng nhập'],['register','Đăng ký']]){
          const button=node('button',label,'auth-btn '+(value==='login'?'btn-login':'btn-reg'));button.type='button';button.dataset.ncnAccountOpen=value;button.hidden=value==='register'&&state.settings?.disableSignup;target.append(button);
        }
      }
      if(phase==='error'){
        target.append(node('span','Kết nối tài khoản đang chậm.','ncn-account-status'));
        const retry=node('button','Thử lại','auth-btn btn-login');retry.type='button';retry.dataset.ncnAccountRetry='';target.append(retry);
      }
    };
    fill(auth);fill($('auth-header-mobile'));
    doc.querySelectorAll('.ncn-account-dropdown>a[href="/premium/"]').forEach(el=>el.textContent='Đăng ký / gia hạn VIP ↗');
    doc.querySelectorAll('[data-account-mode=register],[data-ncn-account-open=register]').forEach(b=>b.hidden=!!state.settings?.disableSignup);
    doc.querySelectorAll('[data-ncn-announcement-admin]').forEach(el=>el.hidden=!verified?.admin);
    renderAdminNavigation();
    member.render(state.user,{tab:state.mode,busy:state.busy,serverOffset:state.serverOffset});
    if(win.QuizSystem)win.QuizSystem.user=quizProfile(verified,hint);
  }
  const userKey=user=>JSON.stringify(user?[user.id,user.email,user.name,user.avatar,user.createdAt,user.admin,user.vip,user.vipSource,user.vipExpiresAt,user.paidVipBlocked]:null);
  function publish(user){
    const changed=userKey(state.user)!==userKey(user);
    state.user=user;state.profile=displayProfile(user);saveDisplayProfile(sessionStorage,user,clock());
    if(changed||!state.ready)render();
    if(changed)doc.dispatchEvent(new win.CustomEvent('ncn-account-change',{detail:{user}}));
  }
  function refresh({force=false}={}){
    if(pending)return pending;
    if(!force&&state.ready&&!state.error&&clock()-state.checkedAt<15000)return Promise.resolve(state.user);
    const version=epoch;
    let task;task=(async()=>{
      try{
        const session=await identity.ensureSession();if(disposed||version!==epoch)return state.user;
        let user=null;
        if(session){
          const response=await fetcher('/.netlify/functions/ncn-billing?route=me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
          const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Chưa kiểm tra được tài khoản.'),{status:response.status});
          user=result.user?.id&&result.user?.email?result.user:null;
          if(Number.isFinite(Date.parse(result.serverNow)))state.serverOffset=Date.parse(result.serverNow)-clock();
        }
        if(disposed||version!==epoch)return state.user;
        const hadError=state.error;state.error=null;state.checkedAt=clock();publish(user);if(hadError)render();return user;
      }catch(error){
        if(!disposed&&version===epoch){
          state.error=error;
          if(error.status===401||error.status===403){state.error=null;publish(null);}else render();
        }
        throw error;
      }finally{if(pending===task)pending=null;}
    })();
    pending=task;return task;
  }
  async function signOut(){
    ++epoch;pending=null;state.error=null;state.checkedAt=0;state.signingOut=true;publish(null);
    try{await identity.signOut();member.reset();if(['profile','vip'].includes(state.mode))mode('login');message('Đã đăng xuất tài khoản trên website.');}
    finally{state.signingOut=false;doc.dispatchEvent(new win.CustomEvent('ncn-account-signed-out'));}
  }
  async function run(work){
    if(state.busy)return;state.busy=true;dialog.querySelectorAll('[type=submit]').forEach(b=>b.disabled=true);render();
    try{return await work();}catch(error){message(error.name==='MissingIdentityError'?'Dịch vụ tài khoản chưa sẵn sàng. Vui lòng liên hệ Admin.':error.message||'Chưa thực hiện được. Vui lòng thử lại.',true);return null;}
    finally{state.busy=false;dialog.querySelectorAll('[type=submit]').forEach(b=>b.disabled=false);render();}
  }
  function saveMember({owner,name,photo}){return run(async()=>{
    if(!state.user||state.user.id!==owner)throw new Error('Đăng nhập lại đúng tài khoản để lưu hồ sơ.');
    profileUpdate(name);message('Đang lưu thông tin tài khoản…');
    const session=await identity.ensureSession();if(!session||session.id!==owner||state.user?.id!==owner)throw new Error('Phiên đăng nhập đã thay đổi. Mở lại tài khoản rồi thử nhé.');
    let avatar;
    if(photo){const response=await fetcher('/.netlify/functions/ncn-profile?route=upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:photo}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Chưa tải được ảnh đại diện.');avatar=result.avatar;}
    if(state.user?.id!==owner||state.signingOut)throw new Error('Tài khoản đã thay đổi. Ảnh chưa được gắn vào hồ sơ.');
    ++epoch;pending=null;
    await identity.updateUser(profileUpdate(name,avatar));
    const updated=await refresh({force:true});if(updated?.id!==owner)throw new Error('Chưa đồng bộ được hồ sơ. Đăng nhập lại để kiểm tra nhé.');return updated;
  });}
  function signedIn(){if(afterLogin){const next=afterLogin;afterLogin=null;mode(next);member.focus();}else close();}
  listen(doc,'click',event=>{
    if(event.target.closest('[data-ncn-account-signout]'))run(signOut);
    if(event.target.closest('[data-ncn-account-retry]'))run(()=>refresh({force:true}));
  });
  for(const [name,form] of Object.entries(forms))listen(form,'submit',event=>{event.preventDefault();run(async()=>{
    message('');
    if(name==='login'){
      await identity.signIn(form.elements.email.value.trim(),form.elements.password.value);form.elements.password.value='';
      const user=await refresh({force:true});if(!user)throw new Error('Xác nhận email tài khoản trước khi tiếp tục.');signedIn();
    }else if(name==='register'){
      const config=await settings();if(config.disableSignup)throw new Error('Đăng ký mới đang tạm đóng.');
      if(form.elements.password.value!==form.elements.repeat.value)throw new Error('Hai mật khẩu chưa khớp.');
      const email=form.elements.email.value.trim(),password=form.elements.password.value;
      await identity.signUp(email,password,{full_name:form.elements.name.value.trim()});form.reset();
      if(config.autoconfirm){await identity.signIn(email,password);if(!await refresh({force:true}))throw new Error('Đã tạo tài khoản. Đăng nhập lại để xác nhận phiên trước khi mua VIP.');signedIn();}
      else{forms.login.elements.email.value=email;mode('login');message('Đã tạo tài khoản chung. Mở email xác nhận để đăng nhập và đăng ký VIP.');}
    }else if(name==='recovery'){
      await identity.sendRecovery(form.elements.email.value.trim());message('Nếu email đã đăng ký, bạn sẽ nhận được thư đặt lại mật khẩu.');
    }else{
      if(form.elements.password.value!==form.elements.repeat.value)throw new Error('Hai mật khẩu chưa khớp.');
      const password=form.elements.password.value;
      if(state.redirect?.type==='invite'){
        const user=await identity.acceptInvite(state.redirect.token,password);if(user?.email)await identity.signIn(user.email,password);
      }else await identity.updateUser({password});
      form.reset();state.resetPending=false;await refresh({force:true});mode('login');message('Đã lưu mật khẩu mới cho tài khoản chung.');
    }
  });});
  const unsubscribe=identity.onAuthChange((event,user)=>{
    if(event==='logout'){++epoch;pending=null;state.error=null;state.checkedAt=0;publish(null);}
    else{
      if(user?.id&&(state.user||state.profile)?.id!==user.id){++epoch;pending=null;publish(null);}
      state.checkedAt=0;refresh({force:true}).catch(()=>{});
    }
  });
  listen(doc,'ncn-navigation-ready',render);
  listen(doc,'visibilitychange',()=>{if(!doc.hidden&&(state.user||state.profile||state.error))refresh().catch(()=>{});});
  listen(win,'online',()=>{if(state.user||state.profile||state.error)refresh({force:true}).catch(()=>{});});
  listen(win,'pageshow',event=>{if(event.persisted)refresh({force:true}).catch(()=>{});});
  const timer=timers.setInterval(()=>{if(!doc.hidden&&(state.user||state.profile||state.error))refresh().catch(()=>{});},60000);
  const api={state,open,close,refresh,signOut,facebook,ready:null,dispose(){disposed=true;++epoch;unsubscribe?.();timers.clearInterval(timer);listeners.forEach(remove=>remove());dialog.remove();accounts.delete(doc);}};
  accounts.set(doc,api);win.NCNAccount=api;render();
  api.ready=(async()=>{
    const callback=/(?:access_token|confirmation_token|recovery_token|invite_token|email_change_token)=/.test(win.location.hash);
    try{
      state.redirect=await identity.consumeRedirect();
      state.resetPending=['recovery','invite'].includes(state.redirect?.type);
      await refresh();
      if(state.redirect?.type==='oauth'&&state.user){let path;try{path=sessionStorage?.getItem('ncn-oauth-return');sessionStorage?.removeItem('ncn-oauth-return');}catch{}if(typeof path==='string'&&/^\/ran-luot\/(?:\?room=[\w-]{22})?$/.test(path)&&path!==win.location.pathname+win.location.search)win.location.replace(path);}
      if(state.resetPending){open('reset');message('Nhập mật khẩu mới để hoàn tất tài khoản chung.');}
      else if(state.redirect?.type==='confirmation'){open('login');message('Email đã được xác nhận. Bạn có thể đăng ký / gia hạn VIP.');}
    }catch(error){if(callback){open('login');message(error.message||'Chưa xác nhận được tài khoản.',true);}}
    finally{state.ready=true;render();doc.dispatchEvent(new win.CustomEvent('ncn-account-ready'));}
    return state.user;
  })();
  return api;
}

export function getAccount(doc=document){return accounts.get(doc)||mountAccount({doc,win:doc.defaultView||window});}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>getAccount(),{once:true});
  else getAccount();
}
