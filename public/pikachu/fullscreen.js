import {createScreenAwake} from './wake-lock.js?v=20261026-fullscreen-2';

export function installFullscreen({app,button,board,holder,awakeStatus,notify=()=>{}}){
 let active=false,kind='window',pending=false,frame=0,scroll=0;
 const background=new Map();
 const awake=createScreenAwake({
  request:navigator.wakeLock?.request?type=>navigator.wakeLock.request(type):null,
  onChange(status){
   awakeStatus.hidden=!active||status==='off'||status==='paused';
   awakeStatus.dataset.state=status;
   awakeStatus.textContent={active:'☀ Giữ sáng',pending:'☀ Đang bật…',unavailable:'☀ Chưa giữ sáng',interrupted:'☀ Giữ sáng đã ngắt'}[status]||'';
   awakeStatus.title=status==='active'?'Màn hình được giữ sáng khi trò chơi toàn màn hình.':'Trình duyệt hoặc điện thoại chưa cho phép giữ sáng màn hình.';
  }
 });
 function lockBackground(){for(let node=app;node&&node!==document.body;node=node.parentElement)for(const sibling of node.parentElement?.children||[]){if(sibling===node||sibling.matches('dialog,script,style,link'))continue;if(!background.has(sibling))background.set(sibling,sibling.hasAttribute('inert'));sibling.setAttribute('inert','');}}
 function unlockBackground(){for(const [node,hadInert]of background)if(!hadInert)node.removeAttribute('inert');background.clear();}
 function fit(){
  frame=0;if(!active){board.style.removeProperty('width');return;}
  const box=holder.getBoundingClientRect(),cols=Number(board.style.getPropertyValue('--frame-cols')),rows=Number(board.style.getPropertyValue('--frame-rows'));
  if(box.width>0&&box.height>0&&cols>0&&rows>0)board.style.width=Math.floor(Math.min(box.width,box.height*cols/rows))+'px';
 }
 const scheduleFit=()=>{if(!frame)frame=requestAnimationFrame(fit);};
 function setImmersive(value,nextKind=kind){
  const changed=active!==value;active=value;kind=nextKind;
  app.classList.toggle('pk-immersive',value);app.dataset.fullscreenMode=value?kind:'off';
  document.documentElement.classList.toggle('pk-fullscreen-active',value);document.body.classList.toggle('pk-immersive-open',value);
  button.setAttribute('aria-pressed',String(value));button.setAttribute('aria-label',value?'Thoát toàn màn hình':'Mở toàn màn hình');
  if(value)lockBackground();else{unlockBackground();board.style.removeProperty('width');if(changed){window.scrollTo(0,scroll);button.focus({preventScroll:true});}}
  void awake.setActive(value);scheduleFit();
 }
 async function toggle(){
  if(pending)return;
  if(active){if(document.fullscreenElement===app){try{await document.exitFullscreen();}catch{notify('Chạm nút quay lại của trình duyệt để thoát toàn màn hình.');}}else setImmersive(false);return;}
  scroll=window.scrollY;setImmersive(true,'window');
  if(!app.requestFullscreen||document.fullscreenEnabled===false){notify('Đã mở khung chơi vừa màn hình. Trình duyệt này vẫn có thể giữ thanh địa chỉ.');return;}
  pending=true;
  try{await app.requestFullscreen({navigationUI:'hide'});if(document.fullscreenElement===app)setImmersive(true,'native');}
  catch{if(active)notify('Đã mở khung chơi vừa màn hình. Trình duyệt này vẫn có thể giữ thanh địa chỉ.');}
  finally{pending=false;}
 }
 button.hidden=false;button.setAttribute('aria-pressed','false');button.addEventListener('click',toggle);
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===app)setImmersive(true,'native');else if(kind==='native')setImmersive(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active&&document.fullscreenElement!==app&&!document.querySelector('dialog[open]')){event.preventDefault();setImmersive(false);}});
 document.addEventListener('visibilitychange',()=>void awake.visibilityChanged());
 window.addEventListener('pagehide',()=>void awake.setActive(false));
 window.addEventListener('pageshow',()=>{if(kind==='native'&&document.fullscreenElement!==app)setImmersive(false);else void awake.setActive(active);scheduleFit();});
 window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleFit);observer.observe(holder);}
 return {fit:scheduleFit,get active(){return active;}};
}
