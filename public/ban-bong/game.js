import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261027-avatar-1';
import {vietnamDate} from '../assets/ncn-arcade/catalog.js?v=20261027-bubble-1';
import {WIDTH,HEIGHT,LAUNCHER,MAX_ANGLE,MODES,WORLDS,maxLevels,levelSpec,createGame,shoot,swap,advance,readSave,readProgress,cells} from './core.js?v=20261027-bubble-1';
import {createRenderer,COLORS,COLOR_NAMES} from './render.js?v=20261027-bubble-1';
import {installFullscreen} from '../xep-hinh/fullscreen.js?v=20261027-bubble-1';

const $=id=>document.getElementById('bb-'+id),saveKey='ncn-bubble-save-v1',progressKey='ncn-bubble-progress-v1',prefsKey='ncn-bubble-prefs-v1';
const format=n=>Math.floor(n||0).toLocaleString('vi-VN'),today=()=>vietnamDate();
let storageOK=true;
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{storageOK=false;return null;}}
function write(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{storageOK=false;}storageNote();}
function storageNote(){$('storage-note').textContent=storageOK?'Tiến độ tự lưu trên trình duyệt này.':'Trình duyệt không cho lưu. Bạn vẫn có thể chơi bình thường.';}
let saved=readSave(read(saveKey)),progress=readProgress(read(progressKey)),prefs=read(prefsKey)||{};
if(saved?.mode==='daily'&&saved.date!==today())saved=null;
if(saved&&saved.mode!=='daily')progress.modes[saved.mode].unlocked=Math.max(progress.modes[saved.mode].unlocked,Math.min(60,saved.level+(saved.status==='cleared'?1:0)));
let mode=saved?.mode||(Object.hasOwn(MODES,prefs.mode)?prefs.mode:'journey'),selected=mode==='daily'?1:progress.modes[mode].unlocked;
let game=createGame({mode,level:selected,seed:147,date:today()}),state='ready',angle=0,power='normal',flight=null,gesture=null,previous=performance.now(),pendingNew=null,mapWorld=0,starting=false,audio=null;
let reduced=typeof prefs.reduced==='boolean'?prefs.reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,muted=prefs.sound!==true;
const renderer=createRenderer($('board')),say=text=>$('toast').textContent=text;
function savePrefs(){write(prefsKey,{mode,sound:!muted,reduced});}
function applyPrefs(){$('app').classList.toggle('bb-reduced',reduced);$('reduced').checked=reduced;$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Bật âm thanh':'Tắt âm thanh');$('sound').textContent=muted?'♩':'♫';}
function sound(kind='shot'){
 if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();void audio.resume().catch(()=>{});const start=audio.currentTime,notes=kind==='clear'?[523,659,784,1047]:kind==='pop'?[659,784]:kind==='swap'?[392]:[260];
 for(const [i,hz]of notes.entries()){const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.setValueAtTime(hz,start+i*.055);o.frequency.exponentialRampToValueAtTime(hz*(kind==='shot' ? .6 : 1.08),start+i*.055+.12);v.gain.setValueAtTime(.001,start+i*.055);v.gain.linearRampToValueAtTime(.032,start+i*.055+.008);v.gain.exponentialRampToValueAtTime(.001,start+i*.055+.18);o.connect(v);v.connect(audio.destination);o.start(start+i*.055);o.stop(start+i*.055+.2);}}
 catch{}
}
function update(){
 const spec=levelSpec(game.level,game.mode,game.date),remaining=cells(game.board,game.phase).length;
 $('app').style.setProperty('--bb-accent',spec.color);$('world-name').textContent=mode==='daily'?'THỬ THÁCH HÔM NAY':spec.name.toLocaleUpperCase('vi-VN');$('stage-title').textContent=spec.title;$('world-note').textContent=mode==='daily'?'5 màn giống nhau cho mọi người. Bảng điểm đổi mới mỗi ngày.':spec.note;
 $('score').textContent=format(game.score);$('level').textContent=String(game.level).padStart(2,'0');$('total').textContent=maxLevels(mode);$('remaining').textContent=remaining;$('best').textContent=format(Math.max(game.score,progress.best));
 $('pressure-label').textContent=mode==='relax'?'KHÔNG HẠ HÀNG':'TRƯỚC KHI HẠ HÀNG';$('misses').replaceChildren();
 if(spec.missLimit){for(let i=0;i<spec.missLimit;i++){const dot=document.createElement('i');dot.classList.toggle('used',i<game.misses);dot.setAttribute('aria-hidden','true');$('misses').append(dot);}$('misses').setAttribute('aria-label',(spec.missLimit-game.misses)+' lượt trượt trước khi thêm hàng');}
 else{const infinity=document.createElement('b');infinity.textContent='∞';$('misses').append(infinity);$('misses').setAttribute('aria-label','Không thêm hàng bóng trong chế độ Thư giãn');}
 $('pause').disabled=!['playing','paused'].includes(state);$('pause').textContent=state==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',state==='paused'?'Tiếp tục chơi':'Tạm dừng');
 $('swap').disabled=state!=='playing'||!!flight;
 for(const kind of ['rainbow','bomb']){$(kind).disabled=state!=='playing'||!!flight||game.powers[kind]===0;$(kind).setAttribute('aria-pressed',String(power===kind));$(kind+'-count').textContent=game.powers[kind]?'Còn 1 bóng':'Đã sử dụng';}
 for(const b of document.querySelectorAll('[data-bb-mode]'))b.setAttribute('aria-pressed',String(b.dataset.bbMode===mode));
 $('map-open').disabled=mode==='daily';$('map-open').firstChild.textContent=mode==='daily'?'Hôm nay · 5 màn chung ':'Bản đồ 60 màn ';
 $('board').tabIndex=state==='playing'?0:-1;$('board').setAttribute('aria-busy',String(!!flight));$('board').setAttribute('aria-label','Bàn bắn bóng, màn '+game.level+'. '+remaining+' bóng còn lại. Bóng đang cầm màu '+(COLOR_NAMES[game.current-1]||'')+'. Dùng mũi tên để ngắm, Space để bắn, X đổi bóng.');
}
function persist(){if(!['playing','paused','cleared'].includes(state))return;saved=readSave(game);if(saved)write(saveKey,saved);}
function record(){progress.best=Math.max(progress.best,game.score);write(progressKey,progress);}
function overlay(){
 const last=game.level===maxLevels(mode),data={
 ready:['60 MÀN · 6 MIỀN SẮC MÀU','Bắn một viên.<br><em>Vui cả tuổi thơ.</em>','Ghép 3 bóng cùng màu. Bật tường thật khéo.<br>Một cú bắn hay, cả chùm ký ức rơi xuống.','Chơi màn '+String(selected).padStart(2,'0')],
 paused:['NGHỈ MỘT NHỊP','Bóng vẫn chờ.<br><em>Mình chơi tiếp nhé?</em>','Bàn bóng và điểm được giữ lại.<br>Thêm một cú bắn đẹp khi bạn sẵn sàng.','Tiếp tục chơi'],
 cleared:['MỘT CHÙM NIỀM VUI','Màn '+game.level+' hoàn thành.<br><em>Lấp lánh quá!</em>','Bạn đã dọn sạch bàn bóng.<br>'+(mode==='daily'?'Cùng chinh phục thử thách tiếp theo.':'Màn '+(game.level+1)+' đang chờ thêm một cú bắn hay.'),'Sang màn '+(game.level+1)],
 lost:['ĐỔI MỘT GÓC NGẮM','Một lần nữa.<br><em>Một cú bắn hay hơn.</em>','Bóng đã chạm vạch giới hạn.<br>Thử đổi bóng và nhắm vào chùm ở trên nhé.','Chơi lại màn '+game.level],
 won:[mode==='daily'?'5 MÀN · MỘT NGÀY RỰC RỠ':'60 MÀN · CẢ MỘT TRỜI KÝ ỨC',mode==='daily'?'Hôm nay<br><em>thật lấp lánh.</em>':'Đi hết hành trình.<br><em>Giữ lại niềm vui.</em>',mode==='daily'?'Bạn đã hoàn thành 5 màn hôm nay.<br>So điểm với bạn bè hoặc quay lại ngày mai.':'Bạn đã chinh phục cả 60 màn.<br>Các ngôi sao và kỷ lục đã được giữ lại.','Chơi lại '+(mode==='daily'?'thử thách hôm nay':'màn 60')]
 }[state];
 if(!data)return;const [kicker,title,copy,label]=data;$('overlay-kicker').textContent=state==='ready'&&mode==='daily'?'HÔM NAY · 5 MÀN CHUNG':kicker;$('overlay-title').innerHTML=title;$('overlay-copy').innerHTML=copy;$('start-label').textContent=label;
 $('mode-picker').hidden=state!=='ready';$('free-note').hidden=state!=='ready';$('levels').hidden=state==='paused'||mode==='daily';$('home').hidden=state==='ready';
 const canContinue=state==='ready'&&saved&&saved.mode===mode&&['playing','cleared'].includes(saved.status)&&(mode!=='daily'||saved.date===today());$('continue').hidden=!canContinue;$('continue').textContent=saved?'Tiếp tục màn '+(saved.status==='cleared'?saved.level+1:saved.level)+' · '+MODES[saved.mode]:'';
 $('result').hidden=!['cleared','won','lost'].includes(state);$('result-score').textContent=format(game.score);const stars=state==='lost'?0:game.totalMisses===0?3:game.totalMisses<=Math.max(2,Math.floor(game.shots/4))?2:1;$('result-stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('result-stars').setAttribute('aria-label',stars+' trên 3 sao');$('result-stars').hidden=state==='lost';
}
function setView(next){state=next;$('app').dataset.state=state;$('overlay').hidden=state==='playing';gesture=null;update();if(state!=='playing')overlay();}
function enter(next){game=next;mode=game.mode;selected=game.level;angle=0;power='normal';flight=null;renderer.reset();previous=performance.now();setView('playing');persist();$('board').focus({preventScroll:true});say(mode==='relax'?'Cứ thong thả nhé. Không hạ hàng, không đếm thời gian.':'Kéo ngắm, thả tay để bắn. Thử một cú bật tường nhé!');}
async function begin(nextMode,nextLevel){
 if(starting)return;starting=true;$('start').disabled=true;
 try{const date=today();if(!await scores.begin({mode:nextMode,date}))return;mode=nextMode;enter(createGame({mode,level:nextLevel,date,seed:1+Math.floor(Math.random()*4294967294)}));savePrefs();$('app').scrollIntoView({block:'start',behavior:'instant'});}
 finally{starting=false;$('start').disabled=false;}
}
function requestStart(nextMode=mode,nextLevel=selected){
 if(starting||nextMode!=='daily'&&nextLevel>progress.modes[nextMode].unlocked)return;
 if(saved?.status==='playing'){pendingNew={mode:nextMode,level:nextLevel};pause();$('confirm-copy').textContent='Ván '+MODES[saved.mode]+' đang lưu sẽ được thay bằng một ván mới. Các màn và sao đã mở vẫn được giữ.';$('confirm').showModal();}
 else void begin(nextMode,nextLevel);
}
function settle(){
 if(!flight)return;const event=flight.event;flight=null;renderer.effect(event,reduced);power='normal';
 if(event.popped.length){const count=event.popped.length+event.fallen.length,label=event.fallen.length>=5?'RƠI CẢ CHÙM!':game.combo>=3?'COMBO ×'+Math.min(5,game.combo):event.bounces?'BẬT TƯỜNG ĐẸP!':'BÙNG SẮC MÀU!';say(label+' '+count+' bóng · +'+format(event.earned)+' điểm');$('combo-toast').textContent=label;$('combo-toast').classList.remove('is-active');void $('combo-toast').offsetWidth;$('combo-toast').classList.add('is-active');sound(['cleared','won'].includes(game.status)?'clear':'pop');}
 else say(event.rowAdded?'Thêm một hàng bóng. Đổi góc bắn hoặc dùng bóng đặc biệt nhé!':mode==='relax'?'Đổi bóng hoặc thử bật tường để ghép một chùm cùng màu.':'Chưa đủ 3 bóng. Còn '+(levelSpec(game.level,mode,game.date).missLimit-game.misses)+' lượt trượt trước khi hạ hàng.');
 record();
 if(['cleared','won'].includes(game.status)){
  if(mode!=='daily'){const p=progress.modes[mode];p.unlocked=Math.max(p.unlocked,Math.min(60,game.level+1));p.stars[game.level]=Math.max(p.stars[game.level]||0,event.stars);write(progressKey,progress);}
  scores.finish(game.score,game.level);setView(game.status);if(game.status==='won'){saved=null;write(saveKey,null);}else persist();
 }else if(game.status==='lost'){scores.finish(game.score,game.level);saved=null;write(saveKey,null);setView('lost');}
 else{update();persist();scores.checkpoint(game.score,game.level);}
}
function pause(){if(state!=='playing')return;settle();if(state!=='playing')return;setView('paused');persist();scores.checkpoint(game.score,game.level,{force:true});}
function resume(){if(state!=='paused')return;previous=performance.now();setView('playing');$('board').focus({preventScroll:true});}
function home(){pause();if(state==='paused'||state==='cleared')persist();selected=mode==='daily'?1:progress.modes[mode].unlocked;game=createGame({mode,level:selected,seed:147,date:today()});flight=null;renderer.reset();setView('ready');}
async function restore(){
 if(!saved||starting||saved.mode==='daily'&&saved.date!==today())return;starting=true;
 try{if(!await scores.begin({mode:saved.mode,date:saved.date||today(),restore:true}))return;const next=saved.status==='cleared'?advance(saved):structuredClone(saved);if(next){enter(next);$('app').scrollIntoView({block:'start',behavior:'instant'});}}
 finally{starting=false;}
}
function fire(){
 if(state!=='playing'||flight||document.querySelector('dialog[open]'))return;
 const before=structuredClone(game),chosen=power,event=shoot(game,angle,chosen);if(!event)return;flight={before,event,power:chosen,elapsed:0,duration:reduced ? .06 : Math.min(.78,Math.max(.2,event.distance/1250))};sound();$('board').setAttribute('aria-busy','true');$('swap').disabled=$('rainbow').disabled=$('bomb').disabled=true;
}
function changeBall(){if(state!=='playing'||flight)return;if(swap(game)){power='normal';sound('swap');update();persist();say('Đã đổi bóng. Bóng đang cầm màu '+COLOR_NAMES[game.current-1]+'.');}}
function special(kind){if(state!=='playing'||flight||!game.powers[kind])return;power=power===kind?'normal':kind;update();say(power==='rainbow'?'Bóng cầu vồng sẽ nhận màu bóng chạm vào.':power==='bomb'?'Bóng nổ sẽ dọn một vùng quanh điểm chạm.':'Đã trở lại bóng thường.');}
function map(){pause();if(mode==='daily'){say('Thử thách hôm nay gồm 5 màn theo thứ tự, giống nhau cho mọi người.');return;}mapWorld=Math.floor((selected-1)/10);$('world-select').value=String(mapWorld);renderMap();$('map').showModal();}
function renderMap(){const p=progress.modes[mode];$('unlocked').textContent='Đã mở '+p.unlocked+' / 60 màn · '+MODES[mode];$('total-stars').textContent=Object.values(p.stars).reduce((a,b)=>a+b,0)+' ★';$('map-note').textContent=WORLDS[mapWorld].note;const fragment=document.createDocumentFragment();for(let i=1;i<=10;i++){const level=mapWorld*10+i,b=document.createElement('button'),stars=p.stars[level]||0;b.type='button';b.dataset.level=level;b.disabled=level>p.unlocked;b.setAttribute('aria-label','Màn '+level+(b.disabled?' · Chưa mở':stars?' · '+stars+' sao':' · Đã mở'));b.setAttribute('aria-current',String(level===selected));const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=String(level).padStart(2,'0');small.textContent=b.disabled?'KHÓA':'★'.repeat(stars)+'☆'.repeat(3-stars);b.append(strong,small);fragment.append(b);}$('map-grid').replaceChildren(fragment);}
for(const [i,world]of WORLDS.entries()){const option=document.createElement('option');option.value=i;option.textContent=String(i+1).padStart(2,'0')+' · '+world.name;$('world-select').append(option);}
const scores=mountScores({game:'bubble',host:$('app'),anchor:$('features'),pause});
$('start').addEventListener('click',()=>{if(state==='paused')resume();else if(state==='cleared'){const next=advance(game);if(next)enter(next);}else if(['won','lost'].includes(state))void begin(mode,state==='won'&&mode==='daily'?1:game.level);else requestStart();});
$('continue').addEventListener('click',restore);$('home').addEventListener('click',home);$('pause').addEventListener('click',()=>state==='playing'?pause():resume());$('swap').addEventListener('click',changeBall);$('rainbow').addEventListener('click',()=>special('rainbow'));$('bomb').addEventListener('click',()=>special('bomb'));$('levels').addEventListener('click',map);$('map-open').addEventListener('click',map);
$('world-select').addEventListener('change',()=>{mapWorld=Number($('world-select').value);renderMap();});$('map-grid').addEventListener('click',event=>{const b=event.target.closest('[data-level]');if(!b||b.disabled)return;$('map').close();selected=Number(b.dataset.level);requestStart(mode,selected);});
for(const b of document.querySelectorAll('[data-bb-close]'))b.addEventListener('click',()=>document.getElementById(b.dataset.bbClose).close());
$('help-open').addEventListener('click',()=>{pause();$('help').showModal();});$('sound').addEventListener('click',()=>{muted=!muted;applyPrefs();savePrefs();if(!muted)sound('pop');});$('reduced').addEventListener('change',()=>{reduced=$('reduced').checked;applyPrefs();savePrefs();});
$('confirm-no').addEventListener('click',()=>{$('confirm').close();pendingNew=null;});$('confirm-yes').addEventListener('click',()=>{const next=pendingNew;pendingNew=null;$('confirm').close();if(next)void begin(next.mode,next.level);});$('confirm').addEventListener('cancel',()=>pendingNew=null);
for(const b of document.querySelectorAll('[data-bb-mode]'))b.addEventListener('click',()=>{if(state!=='ready')return;mode=b.dataset.bbMode;selected=mode==='daily'?1:progress.modes[mode].unlocked;game=createGame({mode,level:selected,seed:147,date:today()});renderer.reset();setView('ready');savePrefs();});
function aim(event){const r=$('board').getBoundingClientRect(),x=(event.clientX-r.left)/r.width*WIDTH,y=(event.clientY-r.top)/r.height*HEIGHT;angle=Math.max(-MAX_ANGLE,Math.min(MAX_ANGLE,Math.atan2(x-LAUNCHER.x,LAUNCHER.y-y)));}
$('board').addEventListener('pointerdown',event=>{if(state!=='playing'||flight||event.button!==0||gesture)return;event.preventDefault();$('board').focus({preventScroll:true});gesture={id:event.pointerId};$('board').setPointerCapture?.(event.pointerId);aim(event);});
$('board').addEventListener('pointermove',event=>{if(state!=='playing'||event.pointerType!=='mouse'&&gesture?.id!==event.pointerId)return;aim(event);});
$('board').addEventListener('pointerup',event=>{if(gesture?.id!==event.pointerId)return;gesture=null;aim(event);fire();});for(const type of ['pointercancel','lostpointercapture'])$('board').addEventListener(type,()=>gesture=null);
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))return;
 const key=event.key.toLowerCase();if(key==='p'&&['playing','paused'].includes(state)){event.preventDefault();state==='playing'?pause():resume();return;}if(key==='f'&&!event.repeat){event.preventDefault();$('fullscreen').click();return;}
 if(state!=='playing'||event.target.closest('button')&&[' ','enter'].includes(key))return;
 if(key==='arrowleft'||key==='arrowright'){event.preventDefault();angle=Math.max(-MAX_ANGLE,Math.min(MAX_ANGLE,angle+(key==='arrowleft'?-.045:.045)));}
 else if([' ','arrowup','x','1','2'].includes(key)){event.preventDefault();if(event.repeat)return;if(key==='x')changeBall();else if(key==='1')special('rainbow');else if(key==='2')special('bomb');else fire();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);window.addEventListener('pagehide',()=>{pause();persist();});
new MutationObserver(()=>{if(state==='playing'&&document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))pause();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','aria-hidden']});
function draw(now){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;if(state==='playing'&&flight){flight.elapsed+=dt;if(flight.elapsed>=flight.duration)settle();}renderer.draw(game,{angle,flight,reduced,power,dt,aim:state==='playing'});requestAnimationFrame(draw);}
const resize=()=>{renderer.resize();renderer.draw(game,{angle,flight,reduced,power,aim:state==='playing'});};
installFullscreen({app:$('app'),button:$('fullscreen'),status:$('awake-status'),resize,notify:say,immersiveClass:'bb-immersive',rootClass:'bb-fullscreen-open'});new ResizeObserver(resize).observe($('field'));window.addEventListener('resize',resize);
applyPrefs();setView('ready');storageNote();resize();requestAnimationFrame(draw);
