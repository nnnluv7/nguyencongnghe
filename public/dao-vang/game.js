import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261031-classic-200-1';
import {vietnamDate} from '../assets/ncn-arcade/catalog.js?v=20261031-classic-200-1';
import {WIDTH,HEIGHT,MODES,maxLevels,createGame,drop,dynamite,step,shop,buy,advance,readSave,endStage,difficulty,REGIONS,region,stageGoal,stageEarned,stageTime} from './core.js?v=20261031-classic-200-1';
import {createRenderer} from './render.js?v=20261031-classic-200-1';
import {installFullscreen} from '../xep-hinh/fullscreen.js?v=20261027-bubble-1';
const $=id=>document.getElementById('gm-'+id),SAVE='ncn-gold-save-v1',PREFS='ncn-gold-prefs-v1',BEST='ncn-gold-best-v1',format=n=>Math.floor(n||0).toLocaleString('vi-VN');
let storageOK=true;function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{storageOK=false;return null;}}function write(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{storageOK=false;}storageNote();}
function storageNote(){$('storage-note').textContent=storageOK?'Ván tự lưu trên trình duyệt này.':'Trình duyệt không cho lưu. Bạn vẫn có thể chơi bình thường.';}
let saved=readSave(read(SAVE)),prefs=read(PREFS)||{},best=read(BEST);best=Number.isSafeInteger(best)&&best>=0&&best<=1e9?best:0;
if(saved?.mode==='daily'&&saved.date!==vietnamDate())saved=null;
let mode=saved?.mode||(Object.hasOwn(MODES,prefs.mode)?prefs.mode:'classic'),game=createGame({mode,date:vietnamDate()}),state='ready',ranked=false,starting=false,pendingNew=null,previous=performance.now(),lastSave=0,lastUI=0,dirty=true,audio=null,lastClock=60;
let reduced=typeof prefs.reduced==='boolean'?prefs.reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,muted=prefs.sound!==true;
const renderer=createRenderer($('board')),say=value=>$('toast').textContent=value;
function savePrefs(){write(PREFS,{mode,sound:!muted,reduced});}
function applyPrefs(){$('app').classList.toggle('gm-reduced',reduced);$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Bật âm thanh':'Tắt âm thanh');$('sound').textContent=muted?'♩':'♫';$('reduced').checked=reduced;dirty=true;}
function sound(kind='drop'){
 if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();void audio.resume().catch(()=>{});const start=audio.currentTime,notes=kind==='bank'?[659,880,1175]:kind==='clear'?[523,659,784,1047]:kind==='blast'?[90,65,43]:kind==='catch'?[240]:kind==='tick'?[580]:[330,220];
 for(const [i,hz]of notes.entries()){const o=audio.createOscillator(),v=audio.createGain(),at=start+i*.065;o.type=kind==='blast'?'sawtooth':'triangle';o.frequency.setValueAtTime(hz,at);o.frequency.exponentialRampToValueAtTime(hz*(kind==='drop'?.65:1.04),at+.13);v.gain.setValueAtTime(.001,at);v.gain.linearRampToValueAtTime(kind==='blast'?.035:.045,at+.008);v.gain.exponentialRampToValueAtTime(.001,at+.18);o.connect(v);v.connect(audio.destination);o.start(at);o.stop(at+.2);}}
 catch{}
}
function update(){
 $('cash').textContent=format(game.money);$('goal').textContent=format(game.goal);$('level').textContent=String(game.level).padStart(3,'0')+' / '+maxLevels(game.mode);const clock=Math.ceil(game.time);$('clock').textContent=clock;$('clock').closest('.gm-timer').classList.toggle('is-urgent',clock<=10&&state==='playing');
 const earned=Math.max(0,stageEarned(game)),goal=stageGoal(game),d=difficulty(game.level);
 $('progress').setAttribute('aria-valuemax',String(goal));$('progress').setAttribute('aria-valuenow',String(Math.min(goal,earned)));$('progress').firstElementChild.style.width=Math.min(100,earned/goal*100)+'%';$('progress').parentElement.classList.toggle('is-met',game.money>=game.goal);$('met-goal').textContent=game.money>=game.goal?'Đủ mục tiêu · Đào thêm hoặc qua màn':'Còn $'+format(game.goal-game.money)+' để qua màn';
 $('exit-level').disabled=state!=='playing'||game.money<game.goal;$('region').textContent=REGIONS[region(game.level)];$('stage-tag').textContent=game.mode==='daily'?'Hôm nay · Màn '+game.level+' / 5 · '+stageTime(game)+'s':'Chặng '+String(d.chapter).padStart(2,'0')+' / 20 · '+d.tier+' · '+stageTime(game)+'s';
 $('bomb-count').textContent=game.dynamite;$('drop').disabled=state!=='playing'||game.hook.state!=='swing';$('bomb').disabled=state!=='playing'||game.hook.item===null||!game.dynamite;
 $('pause').disabled=!['playing','paused'].includes(state);$('pause').textContent=state==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',state==='paused'?'Tiếp tục chơi':'Tạm dừng');$('best').textContent=format(Math.max(best,game.score));$('run-type').textContent=ranked?'NCN Arcade · Có bảng điểm':'Chơi trên máy · Không lên bảng điểm';
 $('board').tabIndex=state==='playing'?0:-1;$('board').setAttribute('aria-label','Mỏ vàng, màn '+game.level+'. Tiền '+format(game.money)+', mục tiêu '+format(game.goal)+'. Còn '+clock+' giây. Space hoặc mũi tên xuống để thả móc, mũi tên lên để dùng thuốc nổ.');
 for(const b of document.querySelectorAll('[data-gm-mode]'))b.setAttribute('aria-pressed',String(b.dataset.gmMode===mode));
 if(state==='playing'&&clock<=10&&clock!==lastClock)sound('tick');lastClock=clock;dirty=true;
}
function overlay(){
 const data={ready:['TRỞ VỀ MỘT THỜI MÊ MẢI','Đào một mẻ.<br><em>Vui cả tuổi thơ.</em>','Móc lắc qua, lắc lại. Vàng lớn ở ngay kia.<br>Canh thật chuẩn rồi kéo lên nào!','Bắt đầu đào vàng'],paused:['NGHỈ TAY MỘT CHÚT','Mỏ vàng vẫn chờ.<br><em>Đào tiếp nhé?</em>','Thời gian, tiền và vật đang kéo đều được giữ lại.','Tiếp tục chơi'],lost:['CHƯA ĐỦ MỘT MẺ VÀNG','Hết giờ rồi.<br><em>Thêm một ván nhé?</em>','Màn '+game.level+' cần $'+format(game.goal)+'. Bạn đã có $'+format(game.money)+'.<br>Thử ưu tiên vàng gần, nhẹ hoặc kim cương nhé!','Đào lại từ đầu'],won:[mode==='daily'?'5 MÀN · MỘT NGÀY BỘI THU':'200 MÀN · MỘT HÀNH TRÌNH VÀNG','Một mẻ thật lớn.<br><em>Một trời tuổi thơ.</em>',mode==='daily'?'Bạn đã đào hết 5 màn hôm nay.<br>Hẹn một mỏ mới vào ngày mai!':'Bạn đã đi hết 200 màn.<br>Cảm ơn vì chuyến xuống mỏ thật dài.','Chơi một hành trình mới']}[state];
 if(!data)return;$('kicker').textContent=state==='ready'&&mode==='daily'?'HÔM NAY · CÙNG MỘT MỎ VÀNG':data[0];$('title').innerHTML=data[1];$('copy').innerHTML=data[2];$('start-label').textContent=data[3];$('mode-picker').hidden=state!=='ready';$('quick').hidden=state!=='ready';$('back').hidden=state==='ready';$('result').hidden=!['lost','won'].includes(state);$('result-score').textContent=format(game.score);
 const available=state==='ready'&&saved&&saved.mode===mode&&['playing','shop'].includes(saved.status)&&(mode!=='daily'||saved.date===vietnamDate());$('continue').hidden=!available;$('continue').textContent=saved?'Tiếp tục màn '+saved.level+' · '+MODES[saved.mode]:'';
}
function view(next){state=next;$('app').dataset.state=next;$('screen').hidden=['playing','shop'].includes(next);update();overlay();}
function persist(){if(!['playing','paused','shop'].includes(state))return;saved=readSave({...game,ranked});if(saved)write(SAVE,saved);}
function record(){if(game.score>best){best=game.score;write(BEST,best);}}
function checkpoint(force=false){if(ranked)scores.checkpoint(game.score,game.level,{force});}
function enter(next){game=next;mode=next.mode;renderer.reset();previous=performance.now();lastClock=Math.ceil(game.time);view('playing');persist();$('board').focus({preventScroll:true});say('Màn '+game.level+' · Đào thêm $'+format(stageGoal(game))+' trong '+stageTime(game)+' giây. Vàng lớn kéo chậm!');}
async function begin(wantRanked=true){
 if(starting)return;starting=true;$('start').disabled=$('quick').disabled=true;
 try{const date=vietnamDate();if(wantRanked&&!await scores.begin({mode,date}))return;ranked=wantRanked;enter(createGame({mode,date,seed:1+Math.floor(Math.random()*4294967294)}));savePrefs();$('app').scrollIntoView({block:'start',behavior:'instant'});}
 finally{starting=false;$('start').disabled=$('quick').disabled=false;}
}
function requestStart(wantRanked=true){if(starting)return;if(saved){pendingNew=wantRanked;$('confirm').showModal();}else void begin(wantRanked);}
function pause(){if(state!=='playing')return;view('paused');persist();checkpoint(true);}
function resume(){if(state!=='paused')return;previous=performance.now();view('playing');$('board').focus({preventScroll:true});}
function home(){pause();persist();if($('shop').open)$('shop').close();game=createGame({mode,date:vietnamDate()});renderer.reset();view('ready');}
async function restore(){
 if(!saved||starting||saved.mode==='daily'&&saved.date!==vietnamDate())return;starting=true;
 try{const next=readSave(saved);if(!next)return;if(next.ranked&&!await scores.begin({mode:next.mode,date:next.date,restore:true}))return;ranked=next.ranked;game=next;mode=next.mode;renderer.reset();previous=performance.now();if(game.status==='shop'){view('shop');showShop();}else{view('paused');say('Ván đã được khôi phục. Bấm Tiếp tục khi sẵn sàng.');}savePrefs();$('app').scrollIntoView({block:'start',behavior:'instant'});}
 finally{starting=false;}
}
function fire(){if(state!=='playing'||document.querySelector('dialog[open]'))return;if(drop(game)){sound('drop');update();persist();$('board').focus({preventScroll:true});}}
function blast(){if(state!=='playing'||document.querySelector('dialog[open]'))return;const event=dynamite(game);if(event){renderer.effect(event,reduced);sound('blast');say('Đã phá vật đang kéo. Móc sẽ trở về nhanh hơn.');update();persist();$('board').focus({preventScroll:true});}}
function shopItems(){
 $('shop-money').textContent=format(game.money);$('shop-title').textContent='Màn '+game.level+' hoàn thành!';$('shop-note').textContent='Màn '+(game.level+1)+' cần đào thêm $'+format(stageGoal(advance(game)||game))+' trong '+difficulty(game.level+1).time+' giây. Mua đồ không làm giảm chỉ tiêu đào mới.';
 const fragment=document.createDocumentFragment();for(const offer of shop(game)){const row=document.createElement('article');row.className='gm-shop-item';const icon=document.createElement('span'),detail=document.createElement('div'),name=document.createElement('strong'),note=document.createElement('p'),b=document.createElement('button');icon.textContent=offer.icon;icon.setAttribute('aria-hidden','true');name.textContent=offer.name;note.textContent=offer.note;detail.append(name,note);b.type='button';b.dataset.good=offer.id;const owned=game.bought.includes(offer.id),full=offer.id==='dynamite'&&game.dynamite>=9;b.disabled=owned||full||game.money<offer.price;b.textContent=owned?'Đã mua':full?'Đủ 9 quả':'$'+format(offer.price);b.setAttribute('aria-label',(owned?'Đã mua ':full?'Đã đủ ':game.money<offer.price?'Không đủ tiền mua ':'Mua ')+offer.name+' giá '+offer.price);row.append(icon,detail,b);fragment.append(row);}$('shop-items').replaceChildren(fragment);
}
function showShop(){shopItems();if(!$('shop').open)$('shop').showModal();}
function ended(){record();if(ranked)scores.finish(game.score,game.level);if(game.status==='shop'){view('shop');persist();sound('clear');showShop();}else{saved=null;write(SAVE,null);view(game.status);if(game.status==='won')sound('clear');say(game.status==='won'?'Chuyến xuống mỏ hoàn thành!':'Hết giờ. Kỷ lục đã được giữ lại.');}}
const scores=mountScores({game:'gold',host:$('app'),anchor:$('details'),pause});
$('start').addEventListener('click',()=>{if(state==='paused')resume();else requestStart(true);});$('quick').addEventListener('click',()=>requestStart(false));$('continue').addEventListener('click',restore);$('back').addEventListener('click',home);$('drop').addEventListener('click',fire);$('bomb').addEventListener('click',blast);$('pause').addEventListener('click',()=>state==='playing'?pause():resume());
$('shop-items').addEventListener('click',event=>{const b=event.target.closest('[data-good]');if(!b||b.disabled)return;const id=b.dataset.good;if(buy(game,id)){sound('bank');shopItems();update();persist();const next=$('shop-items').querySelector('[data-good="'+id+'"]');if(next&&!next.disabled)next.focus();else $('shop-next').focus();}});
$('exit-level').addEventListener('click',()=>{if(state!=='playing'||game.money<game.goal)return;endStage(game);ended();});
$('shop-next').addEventListener('click',()=>{const next=advance(game);if(!next)return;$('shop').close();enter(next);});$('shop-back').addEventListener('click',home);$('shop').addEventListener('cancel',event=>{event.preventDefault();home();});
$('help-open').addEventListener('click',()=>{pause();$('help').showModal();});for(const b of document.querySelectorAll('[data-gm-close]'))b.addEventListener('click',()=>document.getElementById(b.dataset.gmClose).close());
$('sound').addEventListener('click',()=>{muted=!muted;applyPrefs();savePrefs();if(!muted)sound('bank');});$('reduced').addEventListener('change',()=>{reduced=$('reduced').checked;applyPrefs();savePrefs();});
$('confirm-no').addEventListener('click',()=>{$('confirm').close();pendingNew=null;});$('confirm-yes').addEventListener('click',()=>{const next=pendingNew;pendingNew=null;$('confirm').close();if(next!==null)void begin(next);});$('confirm').addEventListener('cancel',()=>pendingNew=null);
for(const b of document.querySelectorAll('[data-gm-mode]'))b.addEventListener('click',()=>{if(state!=='ready')return;mode=b.dataset.gmMode;game=createGame({mode,date:vietnamDate()});renderer.reset();view('ready');savePrefs();});
let touchStart=null;
$('board').addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button===0)fire();else if(event.pointerType!=='mouse'&&state==='playing')touchStart={id:event.pointerId,x:event.clientX,y:event.clientY};});
$('board').addEventListener('pointerup',event=>{if(touchStart?.id===event.pointerId&&Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)<10)fire();touchStart=null;});$('board').addEventListener('pointercancel',()=>touchStart=null);
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||!$('app').contains(event.target)||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))return;
 const key=event.key.toLowerCase();if(event.target.closest('button,a')&&[' ','enter'].includes(key))return;
 if(key==='p'&&['playing','paused'].includes(state)){event.preventDefault();if(!event.repeat)state==='playing'?pause():resume();return;}if(key==='f'&&!event.repeat){event.preventDefault();$('fullscreen').click();return;}
 if(state!=='playing')return;if([' ','arrowdown','arrowup','d'].includes(key)){event.preventDefault();if(!event.repeat)['arrowup','d'].includes(key)?blast():fire();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);window.addEventListener('pagehide',()=>{pause();persist();});
new MutationObserver(()=>{if(state==='playing'&&document.querySelector('dialog[open],#ncn-sidebar[aria-hidden="false"],.ncn-account-menu[open]'))pause();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','aria-hidden']});
function frame(now){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;if(state==='playing'){
 const events=step(game,dt);for(const event of events){renderer.effect(event,reduced);if(event.type==='bank'){record();checkpoint();sound('bank');say(event.reward||('Kéo lên '+(event.value?'$'+format(event.value):'một túi rỗng')+'.'));}else if(event.type==='blast'){sound('blast');say('Thùng TNT nổ! Vật xung quanh đã bị phá.');}else if(event.type==='catch')sound('catch');}
 if(game.status!=='playing')ended();else if(now-lastUI>=100||events.length){lastUI=now;update();}if(now-lastSave>=1000){lastSave=now;persist();}
 }if(state==='playing'||dirty||renderer.animating){renderer.draw(game,{dt,reduced,active:state==='playing'});dirty=false;}requestAnimationFrame(frame);}
const resize=()=>{$('app').style.setProperty('--gm-normal-width',Math.round(Math.min(1280,Math.max(300,innerHeight-310)*1.6))+'px');renderer.resize();dirty=true;renderer.draw(game,{reduced,active:state==='playing'});};
installFullscreen({app:$('app'),button:$('fullscreen'),status:$('awake-status'),resize,notify:say,immersiveClass:'gm-immersive',rootClass:'gm-fullscreen-open'});new ResizeObserver(resize).observe($('field'));window.addEventListener('resize',resize);
applyPrefs();view('ready');storageNote();resize();requestAnimationFrame(frame);
