/* Shared public ticker. Only the server decides who can manage it. */
const endpoint='/.netlify/functions/ncn-announcements';
export async function callAnnouncements(route,data){
  const response=await fetch(endpoint+'?route='+route,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000),method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'Chưa tải được thông báo.'),{status:response.status});
  return result;
}
export function installAnnouncements({doc=document,win=window,call=callAnnouncements}={}){
  const bar=doc.getElementById('ncn-announcement'),copy=doc.getElementById('ncn-announcement-text'),pause=doc.getElementById('ncn-announcement-pause');
  if(!bar||!copy||bar.dataset.installed)return;
  bar.dataset.installed='true';let pending=false,paused=false,last='';
  pause?.addEventListener('click',()=>{paused=!paused;bar.classList.toggle('ncn-announcement-paused',paused);pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'Tiếp tục chạy thông báo':'Tạm dừng thông báo');pause.textContent=paused?'▶':'Ⅱ';});
  async function refresh(){
    if(pending||doc.hidden)return;pending=true;
    try{
      const {items}=await call('list'),text=(Array.isArray(items)?items:[]).filter(x=>typeof x.text==='string').map(x=>x.text).join('     •     ');
      // textContent keeps all Admin text as text, including HTML-like content.
      if(text!==last){copy.textContent=text;copy.style.setProperty('--ncn-ticker-duration',Math.max(18,Math.min(120,text.length*.16))+'s');last=text;}
      bar.hidden=!text;doc.body.classList.toggle('ncn-has-announcements',!!text);
    }catch{/* A transient failure keeps the last confirmed notice. No cached notice survives navigation. */}
    finally{pending=false;}
  }
  const visible=()=>{if(!doc.hidden)refresh();};
  doc.addEventListener('visibilitychange',visible);win.addEventListener('pageshow',visible);win.addEventListener('ncn-announcements-changed',refresh);
  const timer=win.setInterval(refresh,30000);refresh();
  // Avoid extra Identity requests for visitors without an existing session cookie.
  if(/(?:^|;\s*)nf_jwt=/.test(doc.cookie))call('me').then(result=>{doc.querySelectorAll('[data-ncn-announcement-admin]').forEach(link=>link.hidden=!result.admin);}).catch(()=>{});
  return {refresh,destroy(){win.clearInterval(timer);doc.removeEventListener('visibilitychange',visible);win.removeEventListener('pageshow',visible);win.removeEventListener('ncn-announcements-changed',refresh);}};
}
if(typeof document!=='undefined')installAnnouncements();
