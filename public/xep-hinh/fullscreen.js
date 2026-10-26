import {createScreenAwake} from '../pikachu/wake-lock.js?v=20261026-fullscreen-2';

export function installFullscreen({app,button,status,resize,notify}){
 let active=false,native=false,pending=false,scrollY=0;
 const background=new Map();
 const awake=createScreenAwake({request:navigator.wakeLock?.request?type=>navigator.wakeLock.request(type):null,onChange(value){
  status.hidden=!active||['off','paused'].includes(value);status.dataset.state=value;
  status.textContent={active:'☀ Giữ sáng',pending:'☀ Đang bật…',unavailable:'☀ Chưa giữ sáng',interrupted:'☀ Giữ sáng đã ngắt'}[value]||'';
  status.title=value==='active'?'Giữ sáng màn hình khi chơi toàn màn hình.':'Trình duyệt hoặc điện thoại chưa cho phép giữ sáng.';
 }});
 function set(value){
  const changed=active!==value;active=value;app.classList.toggle('xh-immersive',value);
  document.documentElement.classList.toggle('xh-fullscreen-open',value);document.body.classList.toggle('xh-fullscreen-open',value);
  button.setAttribute('aria-pressed',String(value));button.setAttribute('aria-label',value?'Thoát toàn màn hình':'Mở toàn màn hình');
  if(value){for(let node=app;node&&node!==document.body;node=node.parentElement)for(const sibling of node.parentElement?.children||[]){if(sibling===node||sibling.matches('script,style,link,dialog'))continue;if(!background.has(sibling))background.set(sibling,sibling.hasAttribute('inert'));sibling.setAttribute('inert','');}}
  else{for(const [node,wasInert]of background)if(!wasInert)node.removeAttribute('inert');background.clear();if(changed){window.scrollTo(0,scrollY);button.focus({preventScroll:true});}}
  void awake.setActive(value);requestAnimationFrame(resize);
 }
 button.addEventListener('click',async()=>{
  if(pending)return;
  if(active){if(document.fullscreenElement===app){try{await document.exitFullscreen();}catch{notify('Dùng nút quay lại của trình duyệt để thoát toàn màn hình.');}}else set(false);return;}
  scrollY=window.scrollY;native=false;set(true);
  if(!app.requestFullscreen||document.fullscreenEnabled===false){notify('Đã mở khung chơi vừa màn hình.');return;}
  pending=true;try{await app.requestFullscreen({navigationUI:'hide'});native=document.fullscreenElement===app;if(native)set(true);}catch{notify('Đã mở khung chơi vừa màn hình.');}finally{pending=false;}
 });
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===app){native=true;set(true);}else if(native){native=false;set(false);}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.fullscreenElement&&!document.querySelector('dialog[open]')){e.preventDefault();set(false);}});
 document.addEventListener('visibilitychange',()=>void awake.visibilityChanged());
 window.addEventListener('pagehide',()=>void awake.setActive(false));
 window.addEventListener('pageshow',()=>{if(native&&document.fullscreenElement!==app){native=false;set(false);}else void awake.setActive(active);resize();});
 window.visualViewport?.addEventListener('resize',resize);
}
