import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261027-photo-save-1';
import {Ocean,LEVELS,FISH,STAGE_COUNT,clamp,cleanRecord,awardRecord} from './core.js?v=20261030-chill-200-1';
import {OceanPainter} from './draw.js?v=20261030-chill-200-1';
import {installScrollUI} from '../assets/ncn-theme/scroll-ui.js?v=20261024-compact-1';

const $=id=>document.getElementById(id),stage=$('ff-stage'),canvas=$('ff-canvas');
const KEY='ncn:fish:record:v1';
let record;try{record=cleanRecord(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{record=cleanRecord();}
const format=n=>Math.floor(n).toLocaleString('vi-VN'),clock=n=>Math.floor(n/60).toString().padStart(2,'0')+':'+Math.floor(n%60).toString().padStart(2,'0');
const text=(id,value)=>{const n=$(id);if(n&&n.textContent!==String(value))n.textContent=String(value);};
function save(){try{localStorage.setItem(KEY,JSON.stringify(record));return true;}catch{text('ff-storage-note',' · Tiến độ chưa lưu được trên máy này.');return false;}}
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
    else if(['grow','cleared','fever','won'].includes(type)){[392,494,587,784].forEach((n,i)=>this.tone(n,.23,i*.09,'sine',.45));}
    else if(type==='pickup'){this.tone(740,.15);this.tone(990,.22,.09);}
    else if(type==='over'){this.tone(330,.28);this.tone(247,.35,.19);}
  }
}
const audio=new OceanAudio(),painter=new OceanPainter(canvas),ocean=new Ocean({onEvent:event});
const siteChrome=installScrollUI();
const touchMode=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;stage.dataset.touch=String(touchMode);
let heading={x:0,y:0},inputMode=touchMode?'touch':'keyboard',stickId=null,dragId=null,dragAnchor=null,suckId=null,vacuumHeld=false,selectedLevel=record.unlocked-1,menuStamp='';
let settled=false,startingBest=record.best,keys=new Set(),mouse=null,lastFrame=performance.now(),accumulator=0,sceneTime=0,toastTimer=0,lastHUD=0,disposed=false;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
record.reduced=record.reduced||reducedQuery.matches;
function toast(message,duration=2600){text('ff-toast',message);$('ff-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('ff-toast').classList.remove('show'),duration);}
function updateSettings(){
  painter.skin=record.skin;painter.reduced=record.reduced;painter.follow=touchMode;audio.enabled=record.sound;
  $('ff-reduced').checked=record.reduced;$('ff-sound').setAttribute('aria-pressed',String(record.sound));$('ff-sound').setAttribute('aria-label',record.sound?'Tắt âm thanh':'Bật âm thanh');$('ff-sound').title=record.sound?'Tắt âm thanh':'Bật âm thanh';
  $('ff-sound').innerHTML=record.sound?'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4ZM16 9l5 6M21 9l-5 6"/></svg>';
  document.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===record.skin)));text('ff-best',format(record.best));
  $('ff-stage-picker').hidden=record.unlocked<2;
  $('ff-stage-select').innerHTML=LEVELS.map((level,i)=>'<option value="'+(i+1)+'"'+(i>=record.unlocked?' disabled':'')+'>Màn '+String(i+1).padStart(3,'0')+' · '+level.name+(i>=record.unlocked?' · Chưa mở':'')+'</option>').join('');
  $('ff-stage-select').value=String(selectedLevel+1);text('ff-start-label',selectedLevel?'Tiếp tục màn '+(selectedLevel+1):'Bắt đầu chuyến đi');
}
function clearInput(){keys.clear();mouse=null;heading={x:0,y:0};stickId=dragId=suckId=null;dragAnchor=null;vacuumHeld=false;$('ff-stick').classList.remove('is-held');$('ff-stick').firstElementChild.style.transform='';}
function externalPanel(){return document.body.matches('.ncn-menu-open,.ncn-game-menu-open')||Boolean(document.querySelector('dialog[open],.ncn-account-menu[open]'));}
function syncState(){
  const status=ocean.status,playing=status==='playing',paused=status==='paused',result=['won','over'].includes(status);if(stage.dataset.state!==status)stage.dataset.state=status;
  $('ff-welcome').hidden=status!=='ready';$('ff-paused').hidden=!paused;$('ff-result').hidden=!result;$('ff-hud').hidden=status==='ready';$('ff-controls').hidden=!playing;$('ff-stick').hidden=!playing||!touchMode;
  $('ff-cleared').hidden=status!=='cleared';
  $('ff-resume').disabled=externalPanel()||document.hidden;
  $('ff-fever').hidden=!playing||ocean.fever<=0;
}
function hud(){
  text('ff-score',format(ocean.score));text('ff-level',String(ocean.level+1).padStart(3,'0')+' / '+STAGE_COUNT);text('ff-zone',ocean.character.name);
  text('ff-goal',ocean.goalText);
  const value=Math.round(ocean.progress*100);$('ff-growth-fill').style.width=value+'%';$('ff-growth-meter').setAttribute('aria-valuenow',String(value));
  document.querySelectorAll('[data-growth]').forEach(node=>node.classList.toggle('is-current',Number(node.dataset.growth)===ocean.growth));
  const stamp=ocean.level+':'+ocean.growth;
  if(stamp!==menuStamp){menuStamp=stamp;$('ff-menu').innerHTML=ocean.config.menu.map((tier,i)=>'<span role="listitem" class="ff-menu-fish '+(i<=ocean.growth?'is-edible':'is-locked')+'" aria-label="'+FISH[tier].name+' · '+(i<=ocean.growth?'Ăn được':'Lớn thêm để ăn')+'"><canvas width="65" height="43" aria-hidden="true"></canvas><small>'+(i<=ocean.growth?'ĂN ĐƯỢC':'CHỜ LỚN')+'</small></span>').join('');$('ff-menu').querySelectorAll('canvas').forEach((c,i)=>painter.icon(c,ocean.config.menu[i]));}
  text('ff-lives',Array.from({length:3},(_,i)=>i<ocean.lives?'♥':'♡').join(' '));$('ff-lives').setAttribute('aria-label','Còn '+ocean.lives+' mạng');
  text('ff-time',clock(ocean.elapsed));text('ff-combo',ocean.combo>1?'COMBO ×'+ocean.combo:'');
  const frenzy=Math.round(Math.min(1,ocean.chain/10)*100);$('ff-frenzy-fill').style.width=frenzy+'%';$('ff-frenzy-meter').setAttribute('aria-valuenow',String(frenzy));
  const energy=Math.floor(ocean.energy);text('ff-energy-value',energy+'%');$('ff-energy-fill').style.width=energy+'%';$('ff-dash').disabled=ocean.status!=='playing'||ocean.energy<25||ocean.dashCooldown>0;
  $('ff-suck').disabled=ocean.status!=='playing'||!ocean.suctionUnlocked||ocean.energy<3;$('ff-suck').classList.toggle('is-held',ocean.sucking);text('ff-suck-label',ocean.suctionUnlocked?'Giữ để hút':'Hút · Màn 9');$('ff-suck').setAttribute('aria-label',ocean.suctionUnlocked?'Giữ để hút cá':'Hút cá mở từ màn 9');
  text('ff-dash-label',ocean.dashCooldown>0?ocean.dashCooldown.toFixed(1)+'s':'Lướt nước');text('ff-shield-label',ocean.shield>0?'◇ Lá chắn · '+Math.ceil(ocean.shield)+'s':ocean.safe>0?'◌ Đang được bảo vệ':'');
  $('ff-fever').hidden=ocean.status!=='playing'||ocean.fever<=0;
}
function event(e){
  audio.play(e.type);
  if(e.type==='grow')toast(ocean.growth===1?'Lớn rồi! Bây giờ ăn được cá vừa.':'Đủ lớn! Ăn được cả ba loài trong thực đơn.',2400);
  if(e.type==='cleared'){
    clearInput();siteChrome?.show();record.unlocked=Math.max(record.unlocked,Math.min(STAGE_COUNT,ocean.level+2));record.best=Math.max(record.best,ocean.score);selectedLevel=record.unlocked-1;const saved=save();updateSettings();scores.checkpoint(ocean.score,ocean.level+1,{force:true});
    text('ff-clear-title','Hoàn thành màn '+(ocean.level+1));text('ff-clear-note',saved?'Tiến độ đã lưu. Màn '+(ocean.level+2)+' đang chờ anh.':'Màn tiếp đã mở. Trình duyệt chưa lưu được tiến độ.');text('ff-clear-bonus',(e.perfect?'Màn hoàn hảo · ':'')+'Thưởng '+format(e.bonus)+' điểm · Hồi 1 mạng');hud();syncState();$('ff-next').focus({preventScroll:true});
  }
  if(e.type==='fever')toast('Cuồng ăn! Điểm được nhân đôi.',2300);
  if(e.type==='hit'){clearInput();toast(ocean.lives?'Còn '+ocean.lives+' mạng. Đã giữ nguyên cỡ cá và tăng trưởng.':'Có thể chơi lại ngay màn này.',2200);}
  if(e.type==='pickup')toast(e.kind==='shield'?'Lá chắn · Đỡ một va chạm':e.kind==='heart'?'Thêm một mạng, bơi tiếp thôi!':e.kind==='freeze'?'Các cá khác đóng băng 5 giây':e.kind==='speed'?'Tăng tốc 7 giây':'Ngọc biển · +150 điểm',1700);
  // Small schools enter at the edges without interrupting the quiet scene.
  if(e.type==='won'||e.type==='over')finish();
}
function finish(){
  if(settled)return;settled=true;scores.finish(ocean.score,ocean.level+1);clearInput();siteChrome?.show();const wasBest=startingBest,won=ocean.status==='won';record=awardRecord(record,ocean);save();updateSettings();
  text('ff-result-kicker',won?'CHÀO VUA ĐẠI DƯƠNG':'MỘT CHUYẾN ĐI ĐÁNG NHỚ');text('ff-result-title',won?'Từ cá bé, thành huyền thoại.':'Lớn hơn một chút rồi.');
  text('ff-final-score',format(ocean.score));text('ff-record-note',ocean.score>wasBest?'✦ Kỷ lục mới trên máy này!':'Màn '+(ocean.level+1)+' · '+LEVELS[ocean.level].name);
  text('ff-final-fish',ocean.eaten);text('ff-final-time',clock(ocean.elapsed));text('ff-final-combo','×'+ocean.bestCombo);
  text('ff-result-tip',won?'Đã chinh phục cả 200 màn và vua cá mập!':'Anh đã mở đến màn '+record.unlocked+'. Chơi lại màn này hoặc chọn màn đã mở ở màn hình đầu.');hud();syncState();$('ff-retry').focus({preventScroll:true});
}
async function start(at){
  if(externalPanel())return;const level=Number.isSafeInteger(at)?at:selectedLevel;if(!await scores.begin({mode:'classic'}))return;audio.unlock();clearInput();inputMode=touchMode?'touch':'keyboard';settled=false;startingBest=record.best;accumulator=0;ocean.start(undefined,clamp(level,0,record.unlocked-1));painter.reset();lastFrame=performance.now();$('ff-toast').classList.remove('show');hud();syncState();
  resize();canvas.focus({preventScroll:true});stage.scrollIntoView({block:'start',behavior:'instant'});toast(touchMode?'Kéo để dẫn cá · Thả tay là dừng · Bơi thong thả, tránh cá lớn.':'Cá bơi đến con trỏ và dừng ở đó. Bảng thực đơn cho biết cá ăn được.',3600);
}
function pause(reason='manual'){
  if(!ocean.pause())return;scores.checkpoint(ocean.score,ocean.level+1,{force:true});clearInput();siteChrome?.show();audio.suspend();text('ff-pause-note',reason==='tab'?'Ván chơi đã nghỉ cùng bạn. Cá, combo và thời gian đều được giữ lại.':'Cá, combo và thời gian đều đã tạm dừng.');hud();syncState();
}
function resume(){if(externalPanel()||document.hidden)return;if(ocean.resume()){clearInput();accumulator=0;lastFrame=performance.now();audio.unlock();syncState();canvas.focus({preventScroll:true});}}
function dash(){if(ocean.dash())hud();}
function direction(){
  let x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
  const suck=vacuumHeld||keys.has('KeyE');
  if(x||y)return {x,y,suck};if(stickId!==null)return {...heading,suck};if(mouse)return {...(mouse.targetX===undefined?painter.worldPoint(mouse.x,mouse.y):mouse),suck};return {x:0,y:0,suck};
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
function resize(){const view=window.visualViewport?.height||innerHeight,margin=parseFloat(getComputedStyle(stage).scrollMarginTop)||122,available=Math.min(650,Math.max(505,view-190));stage.style.setProperty('--ff-available',Math.round(available)+'px');stage.style.setProperty('--ff-play-height',Math.round(Math.min(650,Math.max(330,view-Math.min(margin,view*.32)-14)))+'px');painter.resize();}
const resizeObserver=new ResizeObserver(()=>painter.resize());resizeObserver.observe(stage);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
function checkPanels(){if(externalPanel())pause('panel');if(ocean.status==='paused')$('ff-resume').disabled=externalPanel()||document.hidden;}
const panelObserver=new MutationObserver(checkPanels);panelObserver.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','open']});
document.addEventListener('toggle',checkPanels,true);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('tab');else checkPanels();});window.addEventListener('blur',()=>pause('tab'));
window.addEventListener('pagehide',()=>{pause('tab');audio.suspend();});window.addEventListener('pageshow',()=>{lastFrame=performance.now();resize();checkPanels();});
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,textarea,select,[contenteditable=true]')||externalPanel())return;
  if(e.code==='Escape'&&stage.classList.contains('is-theater')){e.preventDefault();setTheater(false);return;}
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat)fullscreen();return;}
  if(e.code==='KeyP'||e.code==='Escape'){if(ocean.status==='playing'){e.preventDefault();pause();}else if(e.code==='KeyP'&&ocean.status==='paused'){e.preventDefault();resume();}return;}
  if(ocean.status!=='playing')return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);mouse=null;}
  if(e.code==='KeyE'){e.preventDefault();keys.add(e.code);}
  if(['Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();if(!e.repeat)dash();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
function steerStick(e){
  const r=$('ff-stick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,n=Math.hypot(dx,dy),k=Math.min(1,29/(n||1));
  heading=n>5?{x:dx/n*Math.min(1,n/29),y:dy/n*Math.min(1,n/29)}:{x:0,y:0};inputMode='touch';mouse=null;
  $('ff-stick').firstElementChild.style.transform='translate('+dx*k+'px,'+dy*k+'px)';
}
$('ff-stick').addEventListener('pointerdown',e=>{if(ocean.status!=='playing'||e.button!==0||stickId!==null)return;e.preventDefault();stickId=e.pointerId;steerStick(e);$('ff-stick').classList.add('is-held');$('ff-stick').setPointerCapture(e.pointerId);});
$('ff-stick').addEventListener('pointermove',e=>{if(e.pointerId===stickId){e.preventDefault();steerStick(e);}});
function steerCanvas(e){if(!dragAnchor)return;inputMode='touch';mouse={targetX:dragAnchor.x+(e.clientX-dragAnchor.clientX)/dragAnchor.zoom,targetY:dragAnchor.y+(e.clientY-dragAnchor.clientY)/dragAnchor.zoom};}
canvas.addEventListener('pointerdown',e=>{
  if(ocean.status!=='playing')return;
  if(e.button===2&&e.pointerType==='mouse'){e.preventDefault();vacuumHeld=true;suckId=e.pointerId;canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  if(e.pointerType==='mouse'){inputMode='mouse';const r=canvas.getBoundingClientRect();mouse={x:e.clientX-r.left,y:e.clientY-r.top};dash();return;}
  if(dragId!==null)return;e.preventDefault();dragId=e.pointerId;dragAnchor={clientX:e.clientX,clientY:e.clientY,x:ocean.player.x,y:ocean.player.y,zoom:painter.zoom};steerCanvas(e);canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(ocean.status!=='playing')return;
  if(e.pointerType==='mouse'){if(![...keys].some(key=>key!=='KeyE')){const r=canvas.getBoundingClientRect();inputMode='mouse';mouse={x:e.clientX-r.left,y:e.clientY-r.top};}return;}
  if(e.pointerId===dragId){e.preventDefault();steerCanvas(e);}
});
function release(e){if(stickId===e.pointerId){stickId=null;heading={x:0,y:0};$('ff-stick').classList.remove('is-held');$('ff-stick').firstElementChild.style.transform='';}if(dragId===e.pointerId){dragId=null;dragAnchor=null;mouse=null;}if(suckId===e.pointerId){suckId=null;vacuumHeld=false;}}
for(const type of ['pointerup','pointercancel','lostpointercapture']){canvas.addEventListener(type,release);$('ff-stick').addEventListener(type,release);$('ff-suck').addEventListener(type,release);}
canvas.addEventListener('contextmenu',e=>{if(ocean.status==='playing')e.preventDefault();});
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')mouse=null;});
$('ff-dash').addEventListener('pointerdown',e=>{e.preventDefault();audio.unlock();dash();});$('ff-dash').addEventListener('click',e=>{if(e.detail===0)dash();});
$('ff-suck').addEventListener('pointerdown',e=>{if($('ff-suck').disabled)return;e.preventDefault();suckId=e.pointerId;vacuumHeld=true;$('ff-suck').setPointerCapture(e.pointerId);});
$('ff-suck').addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();vacuumHeld=true;}});$('ff-suck').addEventListener('keyup',()=>{vacuumHeld=false;});$('ff-suck').addEventListener('blur',()=>{vacuumHeld=false;});
const scores=mountScores({game:'ocean',host:stage,anchor:document.querySelector('.ff-features'),pause:()=>pause('panel')});
$('ff-start').addEventListener('click',start);$('ff-retry').addEventListener('click',()=>start(ocean.level));$('ff-pause').addEventListener('click',()=>pause());$('ff-resume').addEventListener('click',resume);
$('ff-stage-select').addEventListener('change',e=>{selectedLevel=clamp(Number(e.target.value)-1,0,record.unlocked-1);updateSettings();});
$('ff-next').addEventListener('click',()=>{if(externalPanel()||!ocean.nextLevel())return;clearInput();accumulator=0;lastFrame=performance.now();painter.reset();menuStamp='';resize();hud();syncState();audio.unlock();canvas.focus({preventScroll:true});toast('Màn '+(ocean.level+1)+' · '+ocean.character.name,2300);});
$('ff-end').addEventListener('click',()=>{if(ocean.status==='paused'){ocean.resume();ocean.finish(false);}});
function home(){clearInput();ocean.reset(20261030,selectedLevel);ocean.status='ready';painter.reset();sceneTime=0;menuStamp='';updateSettings();hud();syncState();$('ff-start').focus({preventScroll:true});}
$('ff-result-home').addEventListener('click',home);$('ff-clear-home').addEventListener('click',()=>{scores.finish(ocean.score,ocean.level+1);if(!settled){settled=true;record=awardRecord(record,ocean);save();}home();});
$('ff-skins').addEventListener('click',e=>{const b=e.target.closest('[data-skin]');if(!b)return;record.skin=b.dataset.skin;save();updateSettings();});
$('ff-sound').addEventListener('click',()=>{record.sound=!record.sound;updateSettings();save();if(record.sound){audio.unlock().then(()=>audio.play('pickup'));}else audio.suspend();});
$('ff-reduced').addEventListener('change',e=>{record.reduced=e.target.checked;save();updateSettings();});
$('ff-help-open').addEventListener('click',()=>{pause('panel');$('ff-help').showModal();});$('ff-help-close').addEventListener('click',()=>$('ff-help').close());$('ff-help').addEventListener('close',checkPanels);
async function fullscreen(){
  if(stage.classList.contains('is-theater')){setTheater(false);return;}
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else setTheater(true);}catch{setTheater(true);}
}
function syncFullscreen(){clearInput();resize();const wide=Boolean(document.fullscreenElement)||stage.classList.contains('is-theater');$('ff-exit-fullscreen').hidden=!wide;$('ff-fullscreen').setAttribute('aria-label',wide?'Thoát toàn màn hình':'Mở toàn màn hình');}
function setTheater(active){document.body.classList.toggle('ncn-fish-theater',active);stage.classList.toggle('is-theater',active);syncFullscreen();if(active)canvas.focus({preventScroll:true});}
$('ff-fullscreen').addEventListener('click',fullscreen);$('ff-exit-fullscreen').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',syncFullscreen);
if(touchMode)text('ff-intro-input','Chạm kéo hoặc joystick để bơi · Thả tay là dừng');
updateSettings();resize();hud();syncState();requestAnimationFrame(frame);
// Leaving a live page removes observers naturally; this also supports page teardown tools.
window.addEventListener('unload',()=>{disposed=true;clearTimeout(toastTimer);panelObserver.disconnect();resizeObserver.disconnect();audio.suspend();},{once:true});
