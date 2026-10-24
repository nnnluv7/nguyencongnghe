import * as identity from './ncn-identity-client.js';
import {getAccount} from './ncn-account.js?v=20261024-account-1';

// Authentication belongs to the shared account. Every private route still checks
// current Identity credentials and server-side VIP entitlement independently.
export function mountVipGate(endpoint,{doc=document,win=window,fetcher=fetch}={}){
  const gate=doc.getElementById('vip-gate');if(!gate)return;
  const account=getAccount(doc),app=doc.getElementById('vip-app');
  let loadedUser=null,pending=null,again=false,started=false;
  const say=(text,error=false)=>{const el=doc.getElementById('vip-message');el.hidden=!text;el.textContent=text;el.classList.toggle('ev-error',error);};
  async function call(route,body){
    await identity.ensureSession();
    const response=await fetcher(endpoint+'?route='+route,{credentials:'same-origin',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Chưa kết nối được máy chủ.'),{status:response.status});return result;
  }
  function clearPrivate(){win.NCN_VIP=null;app.replaceChildren();gate.hidden=false;win.location.reload();}
  async function check(){
    if(pending){again=true;return pending;}
    pending=(async()=>{do{
      again=false;const result=await call('me');
      if(loadedUser&&(!result.allowed||result.user?.id!==loadedUser)){clearPrivate();return;}
      if(!result.allowed){
        gate.hidden=false;doc.getElementById('vip-account').hidden=!result.user;doc.getElementById('vip-account').textContent=result.user?.email||'';
        doc.getElementById('vip-signout').hidden=!result.user;
        doc.querySelector('[data-vip-auth]').hidden=!!result.user;
        say(result.user?'Tài khoản website đã đăng nhập. Mua / gia hạn VIP để sử dụng công cụ.':'Dùng tài khoản nguyencongnghe.com để đăng nhập và đăng ký VIP.');
        continue;
      }
      if(loadedUser)continue;
      const content=await call('app');
      // A logout or user switch while the request was pending must not mount it.
      if(!account.state.user||content.user.id!==account.state.user.id){say('Chưa xác nhận được tài khoản website. Đăng nhập lại hoặc bấm kiểm tra quyền VIP.',true);return;}
      win.NCN_VIP={user:content.user,call};app.innerHTML=content.html;loadedUser=content.user.id;gate.hidden=true;
      for(const name of ['core','ui']){
        const script=doc.createElement('script');script.src=endpoint+'?route=asset&name='+name;
        await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('Không tải được công cụ. Tải lại trang.'));doc.body.append(script);});
      }
      doc.getElementById('ev-vip-logout')?.addEventListener('click',()=>account.signOut().catch(error=>say(error.message,true)));
    }while(again);})().catch(error=>{
      if(loadedUser&&(error.status===401||error.status===403))clearPrivate();else{gate.hidden=false;say(error.message,true);}
    }).finally(()=>pending=null);
    return pending;
  }
  doc.getElementById('vip-check').addEventListener('click',()=>check());
  doc.getElementById('vip-signout').addEventListener('click',()=>account.signOut().catch(error=>say(error.message,true)));
  doc.addEventListener('ncn-account-change',event=>{if(!started)return;if(loadedUser&&event.detail.user?.id!==loadedUser)clearPrivate();else check();});
  doc.addEventListener('visibilitychange',()=>{if(started&&!doc.hidden)check();});
  const timer=win.setInterval(()=>{if(started&&!doc.hidden)check();},60000);
  const ready=account.ready.then(()=>{started=true;return check();});
  return {ready,check,dispose(){win.clearInterval(timer);}};
}
