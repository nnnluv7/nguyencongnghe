import {Ocean,LEVELS,clamp,cleanRecord,awardRecord} from './core.js';
import {OceanPainter} from './draw.js';
import {installScrollUI} from '../assets/ncn-theme/scroll-ui.js?v=20261024-compact-1';

const $=id=>document.getElementById(id),stage=$('ff-stage'),canvas=$('ff-canvas');
const KEY='ncn:fish:record:v1';
let record;try{record=cleanRecord(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{record=cleanRecord();}
const format=n=>Math.floor(n).toLocaleString('vi-VN'),clock=n=>Math.floor(n/60).toString().padStart(2,'0')+':'+Math.floor(n%60).toString().padStart(2,'0');
const text=(id,value)=>{const n=$(id);if(n&&n.textContent!==String(value))n.textContent=String(value);};
function save(){try{localStorage.setItem(KEY,JSON.stringify(record));}catch{text('ff-storage-note',' · Kỷ lục chưa lưu được trên máy này.');}}
class OceanAudio{
  constructor(){this.ctx=null;this.master=null;this.enabled=false;}
  async unlock(){if(!this.enabled)return;try{if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.14;this.master.connect(this.ctx.destination);}await this.ctx.resume();}catch{/* Audio is optional; a browser policy must not stop the game. */}}
  suspend(){this.ctx?.suspend().catch(()=>{});}
  tone(frequency,duration=.14,delay=0,type='sine',volume=.6){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
    const a=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,a);o.frequency.exponentialRampToValueAtTime(Math.max(40,frequency*.7),a+duration);g.gain.setValueAtTime(.001,a);g.gain.linearRampToValueAtTime(volume,a+.012);g.gain.exponentialRampToValueAtTime(.001,a+duration);o.connect(g);g.connect(this.master);o.start(a);o.stop(a+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  play(type){
    if(type==='eat'){this.tone(600+Math.random()*180,.11,0,'sine',.42);this.tone(930,.09,.035,'sine',.22);}
    else if(type==='dash'){this.tone(260,.22,0,'triangle',.35);this.tone(590,.14,.05,'sine',.18);}
    else if(type==='hit'){this.tone(190,.27,0,'triangle',.5);this.tone(120,.2,.1,'sine',.45);}
    else if(['level','fever','won'].includes(type)){[392,494,587,784].forEach((n,i)=>this.tone(n,.23,i*.09,'sine',.45));}
    else if(type==='pickup'){this.tone(740,.15);this.tone(990,.22,.09);}
    else if(type==='over'){this.tone(330,.28);this.tone(247,.35,.19);}
  }
}
const audio=new OceanAudio(),painter=new OceanPainter(canvas),ocean=new Ocean({onEvent:event});
const siteChrome=installScrollUI();
let settled=false,keys=new Set(),mouse=null,touch=null,touchVector=null,lastFrame=performance.now(),accumulator=0,sceneTime=0,toastTimer=0,lastHUD=0,disposed=false;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
record.reduced=record.reduced||reducedQuery.matches;
function toast(message,duration=2600){text('ff-toast',message);$('ff-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('ff-toast').classList.remove('show'),duration);}
function updateSettings(){
  painter.skin=record.skin;painter.reduced=record.reduced;audio.enabled=record.sound;
  $('ff-reduced').checked=record.reduced;$('ff-sound').setAttribute('aria-pressed',String(record.sound));$('ff-sound').setAttribute('aria-label',record.sound?'Tắt âm thanh':'Bật âm thanh');$('ff-sound').title=record.sound?'Tắt âm thanh':'Bật âm thanh';
  $('ff-sound').innerHTML=record.sound?'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4ZM16 9l5 6M21 9l-5 6"/></svg>';
  document.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===record.skin)));text('ff-best',format(record.best));
}
function clearInput(){keys.clear();mouse=null;touch=null;touchVector=null;$('ff-stick').hidden=true;}
function externalPanel(){return document.body.matches('.ncn-menu-open,.ncn-game-menu-open')||Boolean(document.querySelector('dialog[open],.ncn-account-menu[open]'));}
function syncState(){
  const status=ocean.status,playing=status==='playing',paused=status==='paused',result=['won','over'].includes(status);if(stage.dataset.state!==status)stage.dataset.state=status;
  $('ff-welcome').hidden=status!=='ready';$('ff-paused').hidden=!paused;$('ff-result').hidden=!result;$('ff-hud').hidden=status==='ready';$('ff-controls').hidden=!playing;
  $('ff-resume').disabled=externalPanel()||document.hidden;
  $('ff-fever').hidden=!playing||ocean.fever<=0;
}
function hud(){
  text('ff-score',format(ocean.score));text('ff-level',String(ocean.level+1).padStart(2,'0')+' / 06');text('ff-zone',LEVELS[ocean.level].name);
  text('ff-goal',ocean.level===5?ocean.largeEaten+' / 8 cá lớn · Sắp thành vua đại dương':ocean.goalText);
  const value=Math.round(ocean.progress*100);$('ff-growth-fill').style.width=value+'%';$('ff-growth-meter').setAttribute('aria-valuenow',String(value));
  text('ff-lives',Array.from({length:3},(_,i)=>i<ocean.lives?'♥':'♡').join(' '));$('ff-lives').setAttribute('aria-label','Còn '+ocean.lives+' mạng');
  text('ff-time',clock(ocean.elapsed));text('ff-combo',ocean.combo>1?'COMBO ×'+ocean.combo:'');
  const energy=Math.floor(ocean.energy);text('ff-energy-value',energy+'%');$('ff-energy-fill').style.width=energy+'%';$('ff-dash').disabled=ocean.status!=='playing'||ocean.energy<28||ocean.dashCooldown>0;
  text('ff-dash-label',ocean.dashCooldown>0?ocean.dashCooldown.toFixed(1)+'s':'Lướt nước');text('ff-shield-label',ocean.shield>0?'◇ Lá chắn · '+Math.ceil(ocean.shield)+'s':ocean.safe>0?'◌ Đang được bảo vệ':'');
  $('ff-fever').hidden=ocean.status!=='playing'||ocean.fever<=0;
}
function event(e){
  audio.play(e.type);
  if(e.type==='level'){painter.background=null;toast('Vùng biển '+(e.level+1)+' · '+LEVELS[e.level].name,3200);}
  if(e.type==='fever')toast('Cuồng ăn! Điểm được nhân đôi.',2300);
  if(e.type==='hit')toast(ocean.lives?'Còn '+ocean.lives+' mạng. Bơi ra chỗ an toàn nhé!':'Hành trình khép lại.',2000);
  if(e.type==='pickup')toast(e.kind==='shield'?'Lá chắn · Đỡ một va chạm':e.kind==='heart'?'Thêm một mạng, bơi tiếp thôi!':'Ngọc biển · +150 điểm',1700);
  if(e.type==='swarm')toast('Một đàn cá đang ghé thăm!',1900);
  if(e.type==='won'||e.type==='over')finish();
}
function finish(){
  if(settled)return;settled=true;clearInput();siteChrome?.show();const wasBest=record.best,won=ocean.status==='won';record=awardRecord(record,ocean);save();updateSettings();
  text('ff-result-kicker',won?'CHÀO VUA ĐẠI DƯƠNG':'MỘT CHUYẾN ĐI ĐÁNG NHỚ');text('ff-result-title',won?'Từ cá bé, thành huyền thoại.':'Lớn hơn một chút rồi.');
  text('ff-final-score',format(ocean.score));text('ff-record-note',ocean.score>wasBest?'✦ Kỷ lục mới trên máy này!':'Vùng '+(ocean.level+1)+' · '+LEVELS[ocean.level].name);
  text('ff-final-fish',ocean.eaten);text('ff-final-time',clock(ocean.elapsed));text('ff-final-combo','×'+ocean.bestCombo);
  text('ff-result-tip',won?'Cả đại dương từng lớn hơn bạn. Giờ thì thử phá kỷ lục nhé.':'Chỉ ăn cá có vòng xanh. Lướt nước giúp thoát hiểm, nhưng không xuyên được cá lớn.');hud();syncState();$('ff-retry').focus({preventScroll:true});
}
function start(){
  if(externalPanel())return;audio.unlock();clearInput();settled=false;accumulator=0;ocean.start();painter.reset();lastFrame=performance.now();$('ff-toast').classList.remove('show');hud();syncState();
  canvas.focus({preventScroll:true});stage.scrollIntoView({block:'start',behavior:record.reduced?'instant':'smooth'});toast('Bạn được bảo vệ 4 giây. Bơi về phía cá nhỏ để bắt đầu.',3600);
}
function pause(reason='manual'){
  if(!ocean.pause())return;clearInput();siteChrome?.show();audio.suspend();text('ff-pause-note',reason==='tab'?'Ván chơi đã nghỉ cùng bạn. Cá, combo và thời gian đều được giữ lại.':'Cá, combo và thời gian đều đã tạm dừng.');hud();syncState();
}
function resume(){if(externalPanel()||document.hidden)return;if(ocean.resume()){clearInput();accumulator=0;lastFrame=performance.now();audio.unlock();syncState();canvas.focus({preventScroll:true});}}
function dash(){if(ocean.dash())hud();}
function direction(){
  let x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
  if(x||y)return {x,y};if(touchVector)return touchVector;if(mouse)return painter.vector(mouse.x,mouse.y,ocean.player);return {x:0,y:0};
}
function frame(now){
  if(disposed)return;const dt=clamp((now-lastFrame)/1000,0,.1);lastFrame=now;
  if(ocean.status==='playing'){accumulator+=dt;while(accumulator>=1/60){ocean.step(1/60,direction());accumulator-=1/60;if(ocean.status!=='playing')break;}}
  else accumulator=0;
  if(ocean.status==='ready')sceneTime+=dt;
  painter.paint(ocean,ocean.status==='ready'?sceneTime:ocean.elapsed,dt);
  if(now-lastHUD>100){hud();lastHUD=now;}
  requestAnimationFrame(frame);
}
function resize(){const available=Math.min(650,Math.max(505,(window.visualViewport?.height||innerHeight)-190));stage.style.setProperty('--ff-available',Math.round(available)+'px');painter.resize();}
const resizeObserver=new ResizeObserver(()=>painter.resize());resizeObserver.observe(stage);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
function checkPanels(){if(externalPanel())pause('panel');if(ocean.status==='paused')$('ff-resume').disabled=externalPanel()||document.hidden;}
const panelObserver=new MutationObserver(checkPanels);panelObserver.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','open']});
document.addEventListener('toggle',checkPanels,true);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('tab');else checkPanels();});window.addEventListener('blur',()=>pause('tab'));
window.addEventListener('pagehide',()=>{pause('tab');audio.suspend();});window.addEventListener('pageshow',()=>{lastFrame=performance.now();resize();checkPanels();});
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,textarea,select,[contenteditable=true]')||externalPanel())return;
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat)fullscreen();return;}
  if(e.code==='KeyP'||e.code==='Escape'){if(ocean.status==='playing'){e.preventDefault();pause();}else if(e.code==='KeyP'&&ocean.status==='paused'){e.preventDefault();resume();}return;}
  if(ocean.status!=='playing')return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);mouse=null;}
  if(['Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();if(!e.repeat)dash();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('pointerdown',e=>{
  if(ocean.status!=='playing')return;
  if(e.pointerType==='mouse'){if(e.button===0)dash();return;}
  e.preventDefault();mouse=null;touch={id:e.pointerId,x:e.clientX,y:e.clientY};touchVector={x:0,y:0};canvas.setPointerCapture(e.pointerId);
  const r=stage.getBoundingClientRect();$('ff-stick').style.left=clamp(e.clientX-r.left-48,5,r.width-101)+'px';$('ff-stick').style.top=clamp(e.clientY-r.top-48,95,r.height-155)+'px';$('ff-stick').hidden=false;
});
canvas.addEventListener('pointermove',e=>{
  if(ocean.status!=='playing')return;const r=canvas.getBoundingClientRect();
  if(e.pointerType==='mouse'){if(!keys.size)mouse={x:e.clientX-r.left,y:e.clientY-r.top};return;}
  if(!touch||touch.id!==e.pointerId)return;e.preventDefault();const dx=(e.clientX-touch.x)/48,dy=(e.clientY-touch.y)/48,n=Math.max(1,Math.hypot(dx,dy));touchVector={x:dx/n,y:dy/n};$('ff-stick').firstElementChild.style.transform='translate('+touchVector.x*26+'px,'+touchVector.y*26+'px)';
});
function release(e){if(touch?.id===e.pointerId){touch=null;touchVector=null;$('ff-stick').hidden=true;$('ff-stick').firstElementChild.style.transform='';try{canvas.releasePointerCapture(e.pointerId);}catch{}}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')mouse=null;});
$('ff-dash').addEventListener('pointerdown',e=>{e.preventDefault();audio.unlock();dash();});$('ff-dash').addEventListener('click',e=>{if(e.detail===0)dash();});
$('ff-start').addEventListener('click',start);$('ff-retry').addEventListener('click',start);$('ff-pause').addEventListener('click',()=>pause());$('ff-resume').addEventListener('click',resume);
$('ff-end').addEventListener('click',()=>{if(ocean.status==='paused'){ocean.resume();ocean.finish(false);}});
$('ff-result-home').addEventListener('click',()=>{clearInput();ocean.reset(20261025);ocean.status='ready';painter.reset();sceneTime=0;syncState();$('ff-start').focus({preventScroll:true});});
$('ff-skins').addEventListener('click',e=>{const b=e.target.closest('[data-skin]');if(!b)return;record.skin=b.dataset.skin;save();updateSettings();});
$('ff-sound').addEventListener('click',()=>{record.sound=!record.sound;updateSettings();save();if(record.sound){audio.unlock().then(()=>audio.play('pickup'));}else audio.suspend();});
$('ff-reduced').addEventListener('change',e=>{record.reduced=e.target.checked;save();updateSettings();});
$('ff-help-open').addEventListener('click',()=>{pause('panel');$('ff-help').showModal();});$('ff-help-close').addEventListener('click',()=>$('ff-help').close());$('ff-help').addEventListener('close',checkPanels);
async function fullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else toast('Anh xoay ngang màn hình để có khoảng biển rộng hơn nhé.');}catch{toast('Chưa mở được toàn màn hình. Anh có thể tiếp tục chơi tại đây.');}
}
$('ff-fullscreen').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',()=>{resize();$('ff-fullscreen').setAttribute('aria-label',document.fullscreenElement?'Thoát toàn màn hình':'Mở toàn màn hình');});
if(matchMedia('(pointer: coarse)').matches)text('ff-intro-input','Chạm kéo trong biển để bơi · Chạm Lướt nước để tăng tốc');
updateSettings();resize();hud();syncState();requestAnimationFrame(frame);
// Leaving a live page removes observers naturally; this also supports page teardown tools.
window.addEventListener('unload',()=>{disposed=true;clearTimeout(toastTimer);panelObserver.disconnect();resizeObserver.disconnect();audio.suspend();},{once:true});
