/* This controller is also inlined before external resources in every page head. */
export function installAppearance({doc=document,win=window}={}){
 if(win.NCN_APPEARANCE?.document===doc)return win.NCN_APPEARANCE;
 const root=doc.documentElement,valid=v=>v==='dark'||v==='light';
 let mode=valid(root.dataset.ncnTheme)?root.dataset.ncnTheme:'light',volatile=false;
 const read=()=>{try{
  const value=win.localStorage.getItem('ncn-theme');if(valid(value))return value;
  const old=win.localStorage.getItem('mode');
  if(old==='darkmode'||old==='mydark'){const migrated=old==='darkmode'?'dark':'light';try{win.localStorage.setItem('ncn-theme',migrated);}catch{}return migrated;}
  return 'light';
 }catch{return mode;}};
 const icon=dark=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(dark?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>':'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>')+'</svg>';
 function set(value,persist=false){
  mode=valid(value)?value:'light';const dark=mode==='dark';root.dataset.ncnTheme=mode;doc.body?.classList.toggle('dark',dark);
  const button=doc.getElementById('ncn-theme-toggle');
  if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Chuyển sang chế độ sáng':'Chuyển sang chế độ tối');button.innerHTML=icon(dark);}
  if(persist)try{win.localStorage.setItem('ncn-theme',mode);volatile=false;}catch{volatile=true;}
  return mode;
 }
 const refresh=()=>set(volatile?mode:read()),api={document:doc,get mode(){return mode;},set,refresh};win.NCN_APPEARANCE=api;refresh();
 doc.addEventListener('click',e=>{if(!e.target?.closest?.('#ncn-theme-toggle'))return;e.preventDefault();set(mode==='dark'?'light':'dark',true);});
 doc.addEventListener('DOMContentLoaded',refresh,{once:true});win.addEventListener('pageshow',refresh);
 doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')refresh();});
 win.addEventListener('storage',e=>{if(e.key!==null&&e.key!=='ncn-theme')return;try{if(e.storageArea&&e.storageArea!==win.localStorage)return;}catch{}refresh();});
 return api;
}
if(typeof window!=='undefined'&&typeof document!=='undefined')installAppearance();
