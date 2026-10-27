import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261027-avatar-1';
import {COLS,ROWS,WORLDS,levelSpec,createGame,move,rotate,softDrop,hardDrop,hold,lock,fits,advance,readSave,readProgress} from './core.js?v=20261026-1';
import {createRenderer,shapeNames} from './render.js?v=20261026-1';
import {installFullscreen} from './fullscreen.js?v=20261026-1';

const $=id=>document.getElementById('xh-'+id),saveKey='ncn-xep-hinh-save-v1',progressKey='ncn-xep-hinh-progress-v1',prefsKey='ncn-xep-hinh-prefs-v1';
let storageOK=true;
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{storageOK=false;return null;}}
function write(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{storageOK=false;}$('storage-note').textContent=storageOK?'':'Trình duyệt không cho lưu. Bạn vẫn có thể chơi bình thường.';}
let saved=readSave(read(saveKey)),progress=readProgress(read(progressKey)),prefs=read(prefsKey)||{};
if(saved)progress.unlocked=Math.max(progress.unlocked,saved.level);
let selected=progress.unlocked,game=createGame({level:selected,seed:117}),state='ready',reduced=typeof prefs.reduced==='boolean'?prefs.reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,muted=prefs.sound!==true;
let lastFrame=performance.now(),gravityTime=0,groundTime=0,lockResets=0,lastSaved=0,repeatDelay=null,repeatTimer=null,audio=null,pendingLevel=1,resumeOnCancel=false,mapWorld=Math.floor((selected-1)/10),gesture=null;
const renderer=createRenderer($('board'),$('board-holder')),format=n=>Math.floor(n).toLocaleString('vi-VN');
const controls=[...document.querySelectorAll('[data-action]')];
const say=text=>$('toast').textContent=text;
function stopRepeat(){clearTimeout(repeatDelay);clearInterval(repeatTimer);repeatDelay=repeatTimer=null;}
function savePrefs(){write(prefsKey,{sound:!muted,reduced});}
function applyPrefs(){
 $('app').classList.toggle('xh-reduced',reduced);$('reduced').checked=reduced;$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Bật âm thanh':'Tắt âm thanh');$('sound').innerHTML='♫'+(muted?'<span class="xh-muted">╱</span>':'');renderer.invalidate();
}
function sound(clear=false){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const start=audio.currentTime;for(const [i,hz]of (clear?[523,659,784]:[330]).entries()){const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.value=hz;gain.gain.setValueAtTime(.001,start+i*.065);gain.gain.linearRampToValueAtTime(.025,start+i*.065+.008);gain.gain.exponentialRampToValueAtTime(.001,start+i*.065+.14);o.connect(gain);gain.connect(audio.destination);o.start(start+i*.065);o.stop(start+i*.065+.15);}}catch{}}
function persist(force=false){
 if(!['playing','paused','cleared'].includes(state))return;
 const now=performance.now();if(!force&&now-lastSaved<400)return;lastSaved=now;
 saved=readSave(game);write(saveKey,saved);
}
function record(){scores.checkpoint(game.score,game.level,{force:state==='paused'});if(game.score>progress.best)progress.best=game.score;write(progressKey,progress);}
function update(){
 const spec=levelSpec(game.level);$('app').style.setProperty('--xh-accent',spec.color);$('app').style.setProperty('--xh-sky',spec.sky);$('app').dataset.world=spec.world;
 $('world-name').textContent=spec.name.toLocaleUpperCase('vi-VN');document.querySelector('.xh-world-number').textContent=String(spec.world+1).padStart(2,'0')+' / 10';$('level').textContent=String(game.level).padStart(2,'0');$('score').textContent=format(game.score);$('best').textContent=format(Math.max(progress.best,game.score));$('lines').textContent=game.stageLines;$('goal').textContent=spec.goal;$('stage-title').textContent=spec.title;$('progress').max=spec.goal;$('progress').value=Math.min(spec.goal,game.stageLines);
 $('combo').textContent='×'+Math.max(1,game.combo+1);$('combo-note').textContent=game.combo>0?game.combo+1+' lượt xóa liên tiếp':'Mỗi hàng, một sắc vui.';
 $('hold').disabled=state!=='playing'||game.holdUsed;$('hold-note').textContent=game.holdUsed?'Đợi khối kế tiếp nhé.':game.hold?'Chạm để đổi khối.':'Để dành một nước hay.';
 $('pause').disabled=!['playing','paused'].includes(state);$('pause').setAttribute('aria-label',state==='paused'?'Tiếp tục chơi':'Tạm dừng');$('pause').textContent=state==='paused'?'▶':'Ⅱ';
 for(const c of controls)c.disabled=state!=='playing';
 const p=game.active;$('board').setAttribute('aria-label','Bàn 10 cột, 20 hàng. Màn '+game.level+'. '+game.stageLines+'/'+spec.goal+' hàng. '+(p?shapeNames[p.type]+', cột '+(p.x+1)+', hàng '+Math.max(1,p.y+1)+'. Dùng mũi tên để di chuyển và xoay; Space thả nhanh.':'Đang nghỉ.'));
 $('board').setAttribute('aria-disabled',String(state!=='playing'));
 renderer.invalidate();renderer.draw(game,0,reduced);for(let i=0;i<3;i++){renderer.mini($('next-'+i),game.queue[i]);$('next-'+i).setAttribute('aria-label','Khối tiếp theo thứ '+(i+1)+': '+shapeNames[game.queue[i]]);}renderer.mini($('held'),game.hold);
}
function setView(next){state=next;$('app').dataset.state=next;$('overlay').hidden=next==='playing';if(next!=='playing'){stopRepeat();gesture=null;}$('board').tabIndex=next==='playing'?0:-1;update();if(next!=='playing')overlay(next);}
function overlay(kind){
 const spec=levelSpec(game.level),data={
  ready:['100 MÀN · 10 THẾ GIỚI MÀU','Đặt một khối.<br><em>Thêm một sắc.</em>','Xoay cho vừa. Ghép cho khít.<br>Một hàng sáng lên, thêm một niềm vui nhỏ.','Chơi màn '+String(selected).padStart(2,'0')],
  paused:['NGHỈ MỘT NHỊP','Sắc màu<br><em>vẫn chờ bạn.</em>','Khối và điểm đã được giữ lại.<br>Khi sẵn sàng, mình ghép tiếp nhé.','Tiếp tục chơi'],
  cleared:['THÊM MỘT SẮC MÀU','Màn '+game.level+' hoàn thành.<br><em>Đẹp lắm!</em>','Đã mở màn '+(game.level+1)+'. '+(game.level%10===0?'Một thế giới màu mới đang chờ.':'Xóa thêm hàng, mở thêm những niềm vui.'),'Sang màn '+(game.level+1)],
  lost:['NGHỈ MỘT NHỊP, THỬ MỘT CÁCH','Đổi góc nhìn.<br><em>Ghép lại nhé.</em>','Khối đã chạm đỉnh bàn.<br>Các màn và sao đã mở vẫn được giữ.','Chơi lại màn '+game.level],
  won:['100 MÀN · MỘT HÀNH TRÌNH RỰC RỠ','Cả vũ trụ<br><em>là sắc màu.</em>','Bạn đã đi hết 100 màn Khối Sắc.<br>Chơi lại các màn để gom thêm sao nhé!','Chơi lại màn 100']
 }[kind];
 const [kicker,title,copy,label]=data;$('overlay-kicker').textContent=kicker;$('overlay-title').innerHTML=title;$('overlay-copy').innerHTML=copy;$('start-label').textContent=label;
 $('continue').hidden=kind!=='ready'||!saved||saved.status==='won';$('continue').textContent=saved?'Tiếp tục màn '+(saved.status==='cleared'?saved.level+1:saved.level)+' · '+levelSpec(Math.min(100,saved.status==='cleared'?saved.level+1:saved.level)).name:'';
 $('home').hidden=kind==='ready';$('levels').hidden=kind==='paused';$('free-note').hidden=kind!=='ready';$('result').hidden=!['cleared','lost','won'].includes(kind);$('result-score').textContent=format(game.score);
 const stars=1+(game.maxClear>=2?1:0)+(game.maxClear>=4?1:0);$('result-stars').hidden=kind==='lost';$('result-stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('result-stars').setAttribute('aria-label',stars+' trên 3 sao');
}
function resetClocks(){lastFrame=performance.now();gravityTime=groundTime=lockResets=0;}
function enterRun(next){game=next;selected=game.level;resetClocks();setView('playing');persist(true);$('board').focus({preventScroll:true});say('Xóa '+levelSpec(game.level).goal+' hàng để mở màn tiếp theo. Chúc bạn chơi vui!');}
async function begin(level){if(!await scores.begin({mode:'classic'}))return;enterRun(createGame({level,seed:1+Math.floor(Math.random()*4294967294)}));}
function pause(){if(state!=='playing')return;setView('paused');persist(true);record();}
function resume(){if(state!=='paused')return;resetClocks();setView('playing');$('board').focus({preventScroll:true});}
function home(){if(state==='playing')pause();if(state==='paused')persist(true);selected=Math.min(100,progress.unlocked);game=createGame({level:selected,seed:117});setView('ready');}
async function restore(){if(!saved||!await scores.begin({mode:'classic',restore:true}))return;const next=saved.status==='cleared'?advance(saved):structuredClone(saved);if(next)enterRun(next);}
function requestStart(level){
 if(level>progress.unlocked||level<1)return;
 if(saved?.status==='playing'){resumeOnCancel=state==='playing';pause();pendingLevel=level;$('confirm-copy').textContent='Ván đang lưu sẽ được thay bằng màn '+level+'. Các màn và sao đã mở vẫn được giữ.';$('confirm').showModal();}
 else begin(level);
}
function handleEvent(event){
 if(!event)return;
 if(['cleared','won','lost'].includes(game.status))scores.finish(game.score,game.level);
 renderer.effect(event,reduced);if(event.count){say((['','MỘT HÀNG SÁNG!','GHÉP ĐÔI!','BỘ BA RỰC RỠ!','BÙNG SẮC MÀU!'][event.count])+' +'+format(event.earned)+' điểm'+(game.combo>0?' · Chuỗi '+(game.combo+1):''));if(!reduced){$('flash').classList.remove('is-active');void $('flash').offsetWidth;$('flash').classList.add('is-active');}sound(true);}else sound();
 if(['cleared','won'].includes(game.status)){
  progress.unlocked=Math.max(progress.unlocked,Math.min(100,game.level+1));progress.stars[game.level]=Math.max(progress.stars[game.level]||0,event.stars);record();setView(game.status);
  if(game.status==='won'){saved=null;write(saveKey,null);}else persist(true);
 }else if(game.status==='lost'){record();saved=null;write(saveKey,null);setView('lost');say('Khối chạm đỉnh. Thử một cách xếp mới nhé!');}
 else{update();persist(true);}
 gravityTime=groundTime=lockResets=0;
}
function act(action){
 if(state!=='playing')return;const grounded=game.active&&!fits(game.board,{...game.active,y:game.active.y+1});let changed=false,event=null;
 if(action==='left')changed=move(game,-1,0);else if(action==='right')changed=move(game,1,0);else if(action==='rotate')changed=rotate(game);else if(action==='counter')changed=rotate(game,-1);else if(action==='down')changed=softDrop(game);else if(action==='hold')changed=hold(game);else if(action==='drop'){event=hardDrop(game);changed=!!event;}
 if(!changed)return;
 if(action==='hold'){gravityTime=groundTime=lockResets=0;if(game.status==='lost')event={kind:'lost',rows:[],count:0};}
 else if(grounded&&lockResets<12&&action!=='down'){groundTime=0;lockResets++;}
 if(event)handleEvent(event);else{update();persist();}
}
function tick(now){
 const dt=Math.min(100,Math.max(0,now-lastFrame));lastFrame=now;
 if(state==='playing'){
  gravityTime+=dt;const interval=levelSpec(game.level).interval;
  if(gravityTime>=interval){gravityTime%=interval;if(move(game,0,1)){groundTime=0;renderer.invalidate();update();persist();}}
  if(game.active&&!fits(game.board,{...game.active,y:game.active.y+1})){groundTime+=dt;if(groundTime>=450)handleEvent(lock(game));}else groundTime=0;
 }
 renderer.draw(game,dt/1000,reduced);requestAnimationFrame(tick);
}
function openMap(){pause();mapWorld=Math.floor((selected-1)/10);$('world-select').value=String(mapWorld);renderMap();$('map').showModal();}
function renderMap(){
 const world=WORLDS[mapWorld];$('unlocked').textContent=progress.unlocked;$('total-stars').textContent=Object.values(progress.stars).reduce((a,b)=>a+b,0)+' ★';$('world-note').textContent=world.note+' · Màn '+(mapWorld*10+1)+'–'+(mapWorld*10+10);const fragment=document.createDocumentFragment();
 for(let i=1;i<=10;i++){const n=mapWorld*10+i,button=document.createElement('button'),stars=progress.stars[n]||0;button.type='button';button.disabled=n>progress.unlocked;button.dataset.level=n;button.setAttribute('aria-label','Màn '+n+(n>progress.unlocked?' · Chưa mở':stars?' · '+stars+' sao':' · Đã mở'));button.setAttribute('aria-current',String(n===selected));button.innerHTML='<strong>'+String(n).padStart(2,'0')+'</strong><small>'+(n>progress.unlocked?'KHÓA':'★'.repeat(stars)+'☆'.repeat(3-stars))+'</small>';fragment.append(button);}$('map-grid').replaceChildren(fragment);
}
for(const [i,world]of WORLDS.entries()){const option=document.createElement('option');option.value=i;option.textContent=String(i+1).padStart(2,'0')+' · '+world.name;$('world-select').append(option);}
const scores=mountScores({game:'blocks',host:$('app'),anchor:document.querySelector('.xh-features'),pause});
$('world-select').addEventListener('change',()=>{mapWorld=Number($('world-select').value);renderMap();});
$('map-grid').addEventListener('click',event=>{const b=event.target.closest('button[data-level]');if(!b||b.disabled)return;$('map').close();selected=Number(b.dataset.level);requestStart(selected);});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>document.getElementById(button.dataset.close).close());
$('map-open').addEventListener('click',openMap);$('levels').addEventListener('click',openMap);
$('start').addEventListener('click',()=>{if(state==='paused')resume();else if(state==='cleared')enterRun(advance(game));else if(['lost','won'].includes(state))begin(game.level);else requestStart(selected);});
$('continue').addEventListener('click',restore);$('home').addEventListener('click',home);$('pause').addEventListener('click',()=>state==='playing'?pause():resume());$('new').addEventListener('click',()=>requestStart(state==='ready'?selected:game.level));$('hold').addEventListener('click',()=>act('hold'));
$('confirm-yes').addEventListener('click',()=>{$('confirm').close();begin(pendingLevel);});function cancelNew(){$('confirm').close();if(resumeOnCancel)resume();}$('confirm-no').addEventListener('click',cancelNew);$('confirm').addEventListener('cancel',e=>{e.preventDefault();cancelNew();});
$('help-open').addEventListener('click',()=>{pause();$('help').showModal();});$('sound').addEventListener('click',()=>{muted=!muted;applyPrefs();savePrefs();if(!muted)sound(true);});$('reduced').addEventListener('change',()=>{reduced=$('reduced').checked;applyPrefs();savePrefs();});
for(const button of controls){
 const action=button.dataset.action,repeatable=['left','right','down'].includes(action);
 if(repeatable){button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;e.preventDefault();stopRepeat();button.setPointerCapture?.(e.pointerId);act(action);repeatDelay=setTimeout(()=>{repeatTimer=setInterval(()=>act(action),75);},180);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,stopRepeat);button.addEventListener('click',e=>{if(e.detail===0)act(action);});}
 else button.addEventListener('click',()=>act(action));
}
const board=$('board');
board.addEventListener('pointerdown',e=>{if(state!=='playing'||e.button!==0)return;e.preventDefault();board.focus({preventScroll:true});board.setPointerCapture?.(e.pointerId);gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,moved:false,time:performance.now()};});
board.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId||state!=='playing')return;const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.y,unit=Math.max(14,renderer.cellSize*.8);if(Math.abs(e.clientX-gesture.x)>Math.abs(dy)&&Math.abs(dx)>=unit){const steps=Math.min(10,Math.floor(Math.abs(dx)/unit));for(let i=0;i<steps;i++)act(dx<0?'left':'right');gesture.lastX+=Math.sign(dx)*steps*unit;gesture.moved=true;}});
board.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const start=gesture;gesture=null;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!start.moved&&dy>Math.max(35,renderer.cellSize*1.5)&&dy>Math.abs(dx)*1.4)act('drop');else if(!start.moved&&Math.abs(dx)<14&&Math.abs(dy)<14&&performance.now()-start.time<450)act('rotate');});
board.addEventListener('pointercancel',()=>gesture=null);
const holder=$('board-holder');holder.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduced||state!=='playing')return;const r=holder.getBoundingClientRect();$('app').style.setProperty('--xh-tilt-y',((e.clientX-r.left)/r.width-.5)*2+'deg');$('app').style.setProperty('--xh-tilt-x',((e.clientY-r.top)/r.height-.5)*-1.2+'deg');});holder.addEventListener('pointerleave',()=>{$('app').style.setProperty('--xh-tilt-y','0deg');$('app').style.setProperty('--xh-tilt-x','0deg');});
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))return;
 if(e.key.toLowerCase()==='p'&&['playing','paused'].includes(state)){e.preventDefault();state==='playing'?pause():resume();return;}
 if(state!=='playing')return;if(e.target.closest('.xh-toolbar button')&&[' ','Enter'].includes(e.key))return;
 const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop',x:'rotate',X:'rotate',z:'counter',Z:'counter',c:'hold',C:'hold'}[e.key];if(!action)return;e.preventDefault();if(e.repeat&&['drop','hold','rotate','counter'].includes(action))return;act(action);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',()=>{stopRepeat();pause();});window.addEventListener('pagehide',()=>{pause();persist(true);});
new MutationObserver(()=>{if(state==='playing'&&document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))pause();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','aria-hidden']});
const resize=()=>{renderer.resize();renderer.invalidate();renderer.draw(game,0,reduced);};
installFullscreen({app:$('app'),button:$('fullscreen'),status:$('awake-status'),resize,notify:say});
new ResizeObserver(resize).observe(holder);window.addEventListener('resize',resize);
applyPrefs();setView('ready');resize();$('storage-note').textContent=storageOK?'':'Trình duyệt không cho lưu. Bạn vẫn có thể chơi bình thường.';requestAnimationFrame(tick);
