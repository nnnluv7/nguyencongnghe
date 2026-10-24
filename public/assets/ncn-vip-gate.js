import * as identity from './ncn-identity-client.js';
import {getAccount} from './ncn-account.js?v=20261024-account-2';

// Cached profile text never opens this gate. The private app response is verified
// by the server on every page; shared account refreshes handle later role changes.
export function mountVipGate(endpoint,{doc=document,win=window,fetcher=fetch}={}){
  const gate=doc.getElementById('vip-gate');if(!gate)return;
  const account=getAccount(doc),app=doc.getElementById('vip-app'),listeners=[];
  let loadedUser=null,loadedAdmin=false,pending=null,again=false,forceNext=false,started=false,disposed=false,reloadPending=false;
  const listen=(node,type,fn)=>{node?.addEventListener(type,fn);listeners.push(()=>node?.removeEventListener(type,fn));};
  const waiting=doc.createElement('div');waiting.className='ncn-gate-loading';
  waiting.innerHTML='<p>Mở công cụ của bạn</p><span></span><span></span><span></span>';gate.append(waiting);
  const phase=value=>{gate.dataset.ncnGateState=value;gate.setAttribute('aria-busy',String(value==='loading'));};phase('loading');
  const say=(text,error=false)=>{const el=doc.getElementById('vip-message');el.hidden=!text;el.textContent=text;el.classList.toggle('ev-error',error);};
  const allowed=user=>!!(user&&(user.admin||user.vip));
  async function call(route,body){
    await identity.ensureSession();
    const response=await fetcher(endpoint+'?route='+route,{credentials:'same-origin',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Chưa kết nối được máy chủ.'),{status:response.status});return result;
  }
  function clearPrivate(){
    if(!loadedUser)return;
    loadedUser=null;win.NCN_VIP=null;app.replaceChildren();gate.hidden=false;
    if(account.state.signingOut){reloadPending=true;showGate(null);return;}
    phase('loading');win.location.reload();
  }
  function showGate(user){
    gate.hidden=false;phase(user?'member':'guest');doc.getElementById('vip-account').hidden=!user;
    doc.getElementById('vip-account').textContent=user?.email||'';doc.getElementById('vip-signout').hidden=!user;
    doc.querySelector('[data-vip-auth]').hidden=!!user;
    say(user?'Tài khoản website đã đăng nhập. Mua / gia hạn VIP để sử dụng công cụ.':'Dùng tài khoản nguyencongnghe.com để đăng nhập và đăng ký VIP.');
  }
  function check({refresh=true}={}){
    forceNext=forceNext||refresh;
    if(pending){again=true;return pending;}
    pending=(async()=>{do{
      again=false;const force=forceNext;forceNext=false;
      if(force||account.state.error)await account.refresh({force});
      if(disposed)return;
      if(account.state.error&&!account.state.user)throw account.state.error;
      const user=account.state.user;
      if(loadedUser){
        if(!allowed(user)||user.id!==loadedUser||!!user.admin!==loadedAdmin)clearPrivate();
        else win.NCN_VIP.user=user;
        continue;
      }
      if(!allowed(user)){showGate(user);continue;}
      phase('loading');
      const content=await call('app'),current=account.state.user;
      if(disposed)return;
      if(!allowed(current)||content.user?.id!==current.id||!!content.user.admin!==!!current.admin)return;
      win.NCN_VIP={user:content.user,call};app.innerHTML=content.html;
      for(const name of ['core','ui']){
        const script=doc.createElement('script');script.src=endpoint+'?route=asset&name='+name;
        await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('Không tải được công cụ. Bấm kiểm tra lại hoặc tải lại trang.'));doc.body.append(script);});
      }
      if(disposed||account.state.user?.id!==content.user.id||!allowed(account.state.user)){app.replaceChildren();win.NCN_VIP=null;return;}
      loadedUser=content.user.id;loadedAdmin=!!content.user.admin;gate.hidden=true;phase('ready');
      listen(doc.getElementById('ev-vip-logout'),'click',()=>account.signOut().catch(error=>say(error.message,true)));
    }while(again);})().catch(error=>{
      if(disposed)return;
      if(loadedUser&&(error.status===401||error.status===403))clearPrivate();
      else{if(!loadedUser){app.replaceChildren();win.NCN_VIP=null;}gate.hidden=false;phase('error');say(error.message,true);}
    }).finally(()=>{pending=null;if(again&&!disposed)check({refresh:false});});
    return pending;
  }
  listen(doc,'ncn-account-signed-out',()=>{if(reloadPending&&!disposed)win.location.reload();});
  listen(doc.getElementById('vip-check'),'click',()=>check());
  listen(doc.getElementById('vip-signout'),'click',()=>account.signOut().catch(error=>say(error.message,true)));
  listen(doc,'ncn-account-change',event=>{
    if(!started)return;
    const user=event.detail.user;
    if(loadedUser&&(!allowed(user)||user.id!==loadedUser||!!user.admin!==loadedAdmin))clearPrivate();
    else check({refresh:false});
  });
  // One account controller owns visibility/timer refreshes. Repainting the same
  // verified user no longer starts another round of permission requests.
  const ready=account.ready.then(()=>{started=true;return check({refresh:false});});
  return {ready,check,dispose(){disposed=true;listeners.forEach(remove=>remove());waiting.remove();}};
}
