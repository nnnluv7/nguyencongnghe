import {ensureSession,onAuthChange} from '../ncn-identity-client.js';

export function mountAdminGate({host,doc=document,win=window,fetcher=fetch,identity={ensureSession,onAuthChange}}){
  let epoch=0,abort=null,disposeApp=()=>{},loadedUser=null,disposed=false;
  function access(message,error=false){
    disposeApp();disposeApp=()=>{};loadedUser=null;host.replaceChildren();
    const panel=doc.createElement('section');panel.className='na-access';panel.id='ncn-admin-access';
    const kicker=doc.createElement('span');kicker.className='na-kicker';kicker.textContent='QUẢN TRỊ ADMIN';
    const heading=doc.createElement('h1');heading.textContent='Khu vực quản trị';
    const text=doc.createElement('p');text.textContent=message;text.setAttribute('role','status');
    panel.append(kicker,heading,text);
    if(error){const retry=doc.createElement('button');retry.type='button';retry.className='na-primary';retry.textContent='Thử lại';retry.addEventListener('click',()=>load());panel.append(retry);}
    else if(!win.NCNAccount?.state.user){const login=doc.createElement('button');login.type='button';login.className='na-primary';login.dataset.ncnAccountOpen='login';login.textContent='Đăng nhập tài khoản ADMIN';panel.append(login);}
    host.append(panel);
  }
  function clear(message='Đăng nhập tài khoản có quyền ADMIN để mở khu vực quản trị.'){
    ++epoch;abort?.abort();access(message);
  }
  async function api(route,data=null,query={}){
    const url=new URL('/.netlify/functions/ncn-library',win.location.origin);url.searchParams.set('route',route);
    for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
    const response=await fetcher(url.href,{method:data===null?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...(data===null?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
    const result=await response.json();
    if(!response.ok){
      if([401,403].includes(response.status)){clear(result.error);win.NCNAccount?.refresh({force:true}).catch(()=>{});}
      throw Object.assign(new Error(result.error||'Chưa thực hiện được.'),{status:response.status});
    }
    return result;
  }
  async function load(){
    const user=win.NCNAccount?.state.user;
    if(disposed||loadedUser&&user?.admin&&loadedUser===user.id)return;
    const generation=++epoch;abort?.abort();const controller=new AbortController();abort=controller;access('Đang kiểm tra quyền quản trị…');
    let timedOut=false;const timer=win.setTimeout(()=>{timedOut=true;controller.abort();},20000);
    try{
      const session=await identity.ensureSession();if(disposed||generation!==epoch)return;
      if(!session){access('Đăng nhập tài khoản có quyền ADMIN để mở khu vực quản trị.');return;}
      const url=new URL('/.netlify/functions/ncn-library',win.location.origin);url.searchParams.set('route','app');url.searchParams.set('view',host.dataset.view||'hub');
      const response=await fetcher(url.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      const result=await response.json();if(disposed||generation!==epoch)return;
      if(!response.ok){access(result.error||'Chưa kiểm tra được quyền quản trị.',![401,403].includes(response.status));return;}
      if(typeof result.html!=='string')throw Error('Chưa tải được khu vực quản trị.');
      host.innerHTML=result.html;loadedUser=win.NCNAccount?.state.user?.id||session.id||session.user?.id||null;
      if(host.dataset.view==='library'){
        const module=await import('./library.js?v=20261025-featured-1');if(disposed||generation!==epoch)return;
        disposeApp=module.mountLibraryAdmin({host,doc,win,api}).destroy;
      }
    }catch(error){if(!disposed&&generation===epoch&&(error.name!=='AbortError'||timedOut))access(timedOut?'Kết nối quản trị đang chậm. Anh thử lại nhé.':error.message||'Chưa tải được khu vực quản trị.',true);}
    finally{win.clearTimeout(timer);}
  }
  const accountChange=event=>{if(!event.detail?.user?.admin)clear('Tài khoản hiện tại không có quyền ADMIN.');else load();};
  const ready=()=>load(),signedOut=()=>clear(),pageshow=event=>{if(event.persisted){loadedUser=null;load();}};
  doc.addEventListener('ncn-account-change',accountChange);doc.addEventListener('ncn-account-ready',ready);doc.addEventListener('ncn-account-signed-out',signedOut);win.addEventListener('pageshow',pageshow);
  const unsubscribe=identity.onAuthChange(event=>{if(event==='logout')clear();});
  if(win.NCNAccount)win.NCNAccount.ready.then(load);else if(doc.readyState!=='loading')load();
  return {load,destroy(){disposed=true;++epoch;abort?.abort();disposeApp();unsubscribe?.();doc.removeEventListener('ncn-account-change',accountChange);doc.removeEventListener('ncn-account-ready',ready);doc.removeEventListener('ncn-account-signed-out',signedOut);win.removeEventListener('pageshow',pageshow);}};
}
if(typeof document!=='undefined'){
  const host=document.getElementById('ncn-admin-app');if(host)mountAdminGate({host});
}
