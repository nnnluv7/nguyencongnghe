import * as identity from './ncn-identity-client.js';
import {getAccount} from './ncn-account.js?v=20261027-photo-save-1';
import {printDocument} from './ncn-direct/print.js';
import {writeFrame} from './ncn-direct/frame.js';
import {setAccessView} from './ncn-access-view.js';
import {takeToolPrefetch} from './ncn-account-prefetch.js';

// Every mount and print is authorized by the server, including guest trials.
export function mountVipGate(endpoint,{doc=document,win=window,fetcher=fetch}={}){
  const gate=doc.getElementById('vip-gate');if(!gate)return;
  const account=getAccount(doc),app=doc.getElementById('vip-app'),listeners=[];
  let loaded=null,pending=null,disposed=false,lastPrint=null,reloadPending=false,revision=0,owner=null;
  const listen=(node,type,fn)=>{node?.addEventListener(type,fn);listeners.push(()=>node?.removeEventListener(type,fn));};
  const phase=value=>{gate.dataset.ncnGateState=value;setAccessView({root:app.parentElement,gate,content:app},value==='loading'?'pending':value);};
  phase('loading');
  const banner=doc.createElement('div');banner.className='ncn-trial-banner';banner.hidden=true;app.before(banner);
  function balance(trial,user){
    banner.replaceChildren();banner.hidden=false;
    const text=doc.createElement('span');text.textContent=trial?`Dùng thử: còn ${trial.remaining}/${trial.limit} lượt chung cho Event VIP và Giờ vàng VIP.`:user.vipSource==='payment'?'Thành viên ủng hộ · Không giới hạn lượt trong thời hạn VIP.':'VIP · Không giới hạn lượt.';banner.append(text);
    const link=doc.createElement('a');link.href='/donate/#reg';link.textContent='Donate · Gia hạn VIP';banner.append(link);
  }
  function message(text,error=false){const el=doc.getElementById('vip-message');el.hidden=!text;el.textContent=text;el.classList.toggle('ev-error',error);}
  function showGate(user,error){
    gate.hidden=false;phase(user&&!user.guest?'member':'guest');banner.hidden=true;
    const member=user&&!user.guest;doc.getElementById('vip-account').hidden=!member;doc.getElementById('vip-account').textContent=member?user.email:'';
    doc.getElementById('vip-signout').hidden=!member;doc.querySelector('[data-vip-auth]').hidden=!!member;
    message(error||'Bạn đã dùng hết 3 lượt. Donate để mở Event VIP và Giờ vàng VIP không giới hạn.');
  }
  async function call(route,body){
    if(!body&&route==='catalogues'&&loaded?.initial){const initial=loaded.initial;delete loaded.initial;return initial;}
    await identity.ensureSession();
    if(route==='print'){
      const signature=JSON.stringify(body);
      if(!lastPrint||lastPrint.signature!==signature)lastPrint={signature,id:win.crypto.randomUUID()};
      body={...body,requestId:lastPrint.id};
    }
    const url=endpoint+'?route='+route+(route==='app'?'&bundle=1':'');
    const response=await (route==='app'&&!body&&takeToolPrefetch(win,doc,url)||fetcher(url,{credentials:'same-origin',cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)}));
    const result=await response.json();
    if(!response.ok){if(response.status<500)lastPrint=null;if(response.status===403&&loaded)balance({limit:3,remaining:0},loaded.user);throw Object.assign(new Error(result.error||'Chưa kết nối được máy chủ.'),{status:response.status});}
    if(route==='print'){lastPrint=null;if(result.trial){loaded.user.trial=result.trial;balance(result.trial,loaded.user);}}
    return result;
  }
  function reset(){revision++;pending=null;loaded=null;lastPrint=null;win.NCN_VIP=null;app.replaceChildren();banner.hidden=true;gate.hidden=false;phase('loading');if(account.state.signingOut){reloadPending=true;showGate(null);return;}win.location.reload();}
  function execute(code){
    const script=doc.createElement('script');script.textContent=code;
    let failure;const failed=event=>{failure=event.error||new Error(event.message);event.preventDefault();};
    win.addEventListener('error',failed);
    try{doc.body.append(script);}finally{win.removeEventListener('error',failed);script.remove();}
    if(failure)throw failure;
  }
  function check(){
    if(pending)return pending;
    if(!loaded)phase('loading');
    const version=revision;
    const task=(async()=>{
      const session=await identity.ensureSession();
      if(disposed||version!==revision)return;
      const currentId=session?.id||null;owner=currentId;
      let status;
      try{status=await call(loaded?'me':'app');}
      catch(error){if(disposed||version!==revision)return;if(!loaded&&[401,403].includes(error.status)){showGate(session,error.message);return;}throw error;}
      if(disposed||version!==revision)return;
      if(status.user&&!status.user.guest&&status.user.id!==currentId)throw new Error('Phiên đăng nhập đã thay đổi. Mở lại công cụ để tiếp tục.');
      if(status.user?.guest)owner=null;
      if(loaded){
        if(!status.user||status.user.id!==loaded.user.id||status.user.admin!==loaded.user.admin||status.user.paidVipBlocked||(loaded.user.vipSource==='manual'&&!status.user.vip)){reset();return;}
        loaded.user=status.user;win.NCN_VIP.user=status.user;balance(status.trial,status.user);return;
      }
      phase('loading');
      const content=status;
      if(typeof content.html!=='string')throw new Error('Không tải được công cụ. Bấm kiểm tra lại hoặc tải lại trang.');
      if(disposed||version!==revision)return;
      loaded=content;win.NCN_VIP={user:content.user,call,preview:writeFrame,print:html=>printDocument(html,{doc,win})};
      if(!content.templateHash||app.dataset.ncnTemplate!==content.templateHash||!app.querySelector('#ncn-event-app'))app.innerHTML=content.html;
      if(typeof content.scripts?.core==='string'&&typeof content.scripts?.ui==='string'){
        execute(content.scripts.core);execute(content.scripts.ui);
      }else for(const name of ['core','ui']){
        const script=doc.createElement('script');script.src=endpoint+'?route=asset&name='+name;
        await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('Không tải được công cụ. Bấm kiểm tra lại hoặc tải lại trang.'));doc.body.append(script);});
        if(disposed||loaded!==content||version!==revision)return;
      }
      await win.NCN_VIP?.ready;
      if(disposed||version!==revision)return;
      delete content.scripts;delete content.html;delete content.initial;
      gate.hidden=true;phase('ready');balance(content.trial,content.user);
      if(win.performance?.now)app.dataset.ncnReadyMs=String(Math.round(win.performance.now()));
      const out=doc.getElementById('ev-vip-logout');if(out){out.hidden=!!content.user.guest;listen(out,'click',()=>account.signOut().catch(error=>message(error.message,true)));}
    })().catch(error=>{if(disposed||version!==revision)return;if(!loaded||gate.dataset.ncnGateState!=='ready'){loaded=null;app.replaceChildren();win.NCN_VIP=null;gate.hidden=false;phase('error');}message(error.message,true);}).finally(()=>{if(pending===task)pending=null;});
    pending=task;return task;
  }
  listen(doc.getElementById('vip-check'),'click',()=>check());
  listen(doc.getElementById('vip-signout'),'click',()=>account.signOut().catch(error=>message(error.message,true)));
  listen(doc,'ncn-account-signed-out',()=>{if(reloadPending&&!disposed)win.location.reload();});
  listen(doc,'ncn-account-change',event=>{
    // Also cancel an app request that has not mounted yet. Logout must flush
    // in-flight script listeners after the shared cookie has been cleared.
    if(account.state.signingOut){reset();return;}
    const user=event.detail?.user;
    if(loaded&&((user?.id||null)!==(loaded.user.guest?null:loaded.user.id)||!!user?.admin!==!!loaded.user.admin||!!user?.vip!==!!loaded.user.vip||!!user?.paidVipBlocked!==!!loaded.user.paidVipBlocked))reset();
    else if(!loaded&&!pending&&(user?.admin||user?.vip))check();
  });
  const unsubscribe=identity.onAuthChange((event,user)=>{
    if(event==='logout'){reset();return;}
    if(event==='login'&&user?.id!==owner){if(loaded){reset();return;}revision++;pending=null;owner=user?.id||null;check();}
  });
  account.ready.then(()=>{if(!disposed&&!account.state.error&&owner&&!account.state.user&&!loaded?.user.guest){revision++;pending=null;loaded=null;owner=null;app.replaceChildren();win.NCN_VIP=null;showGate(null,'Đăng nhập tài khoản đã xác nhận email để tiếp tục.');}});
  const ready=check().then(()=>pending||undefined);
  return {ready,check,dispose(){disposed=true;revision++;unsubscribe();listeners.forEach(remove=>remove());banner.remove();}};
}
