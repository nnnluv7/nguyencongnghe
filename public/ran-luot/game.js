import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261027-bubble-1';
import {Arena,SKINS,TAU,clamp,hash,vietnamDate,challengeDate,cleanProfile,awardProfile} from './core.js?v=20261025-snake-1';

const $=id=>document.getElementById('rl-'+id),stage=$('stage'),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false}),radar=$('radar').getContext('2d');
const KEY='ncn-ran-luot-v1',keys=new Set(),events={bloom:['MƯA NĂNG LƯỢNG','Mọi mồi đều nhân đôi điểm'],core:['TRANH LÕI TRUNG TÂM','Lõi vàng ở tâm bản đồ · +250 điểm'],magnet:['TRƯỜNG HÚT','Ánh sáng tự tìm đến bạn']};
let profile,storageOK=true;
try{profile=cleanProfile(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{profile=cleanProfile();storageOK=false;}
let reduced=profile.reduced??matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode='arena',date='',width=1280,height=650,dpr=1,lastFrame=0,accumulator=0,time=0,uiAt=0,toastUntil=0,shake=0;
let camera={x:0,y:0,zoom:.8},particles=[],floaters=[],inputMode='keyboard',pointer={x:0,y:0,active:false},angle=0,boost=false,stickId=null,boostId=null,dragId=null;
let audio=null,lastTone=0,runAwarded=false,previewTime=0;
const soloArena=new Arena({onEvent});let arena=soloArena;
const sprites=SKINS.map(s=>{const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d'),glow=g.createRadialGradient(24,24,1,24,24,23);glow.addColorStop(0,s.color+'a0');glow.addColorStop(.3,s.color+'35');glow.addColorStop(1,s.color+'00');g.fillStyle=glow;g.fillRect(0,0,48,48);g.fillStyle=s.color;g.beginPath();g.arc(24,24,3.4,0,TAU);g.fill();g.fillStyle='#e9fff4';g.beginPath();g.arc(23,23,1.4,0,TAU);g.fill();return c;});
function persist(){try{profile.muted=profile.muted!==false;profile.reduced=reduced;localStorage.setItem(KEY,JSON.stringify(profile));storageOK=true;}catch{storageOK=false;}storageNotice();}
function storageNotice(){$('storage-note').textContent=storageOK?'':' · Không lưu được trên máy này';}
function score(n){return Math.floor(n).toLocaleString('vi-VN');}
function clock(n){n=Math.max(0,Math.floor(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function record(){return mode==='daily'?(profile.date===date?profile.daily:0):profile.best;}
function paintProfile(){
  $('best').textContent=score(profile.best);$('skins').replaceChildren();
  for(const skin of SKINS){const b=document.createElement('button');b.type='button';b.className='rl-skin';b.style.setProperty('--skin',skin.color);b.dataset.skin=skin.id;b.disabled=skin.xp>profile.xp;b.setAttribute('aria-label',skin.name+(b.disabled?' · Mở ở '+skin.xp+' XP':''));b.title=skin.name+(b.disabled?' · '+skin.xp+' XP':'');b.setAttribute('aria-pressed',String(profile.skin===skin.id));if(b.disabled){const lock=document.createElement('span');lock.textContent='⌑';b.append(lock);}b.addEventListener('click',()=>{profile.skin=skin.id;persist();paintProfile();});$('skins').append(b);}
  const label=document.createElement('span');label.textContent=score(profile.xp)+' XP';$('skins').append(label);storageNotice();
}
function unlockAudio(){if(profile.muted)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!audio)audio=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function tone(type){
  if(profile.muted||!audio||audio.state!=='running')return;
  const now=audio.currentTime;if(type==='eat'&&now-lastTone<.075)return;lastTone=now;
  try{const osc=audio.createOscillator(),gain=audio.createGain(),map={eat:[650+arena.combo*95,1100,.055],phase:[180,900,.2],fever:[420,1450,.35],kill:[330,990,.23],over:[190,55,.32],power:[550,1200,.18],core:[650,1900,.28],near:[380,700,.1],shieldBreak:[700,130,.18],event:[360,680,.18]},[from,to,duration]=map[type]||map.eat;
    osc.type=type==='over'?'triangle':'sine';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);gain.gain.setValueAtTime(type==='eat'?.018:.035,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+duration);osc.onended=()=>{gain.disconnect();osc.disconnect();};
  }catch{}
}
function soundUI(){const enabled=!profile.muted;$('sound').setAttribute('aria-pressed',String(enabled));$('sound').setAttribute('aria-label',enabled?'Tắt âm thanh':'Bật âm thanh');$('sound').innerHTML='<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4Z"/>'+(enabled?'<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>':'<path d="m16 9 5 6M21 9l-5 6"/>')+'</svg>';}
function toast(text,seconds=2){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=time+seconds;}
function burst(x,y,color,count=12){if(reduced)count=Math.min(3,count);for(let i=0;i<count&&particles.length<(reduced?35:170);i++){const a=Math.random()*TAU,v=30+Math.random()*110;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+Math.random()*.4,color,r:1+Math.random()*2});}}
function onEvent(e){
  tone(e.type);
  if(e.type==='eat'){burst(e.x,e.y,e.core?'#ffdc86':SKINS.find(s=>s.id===profile.skin).color,4);if(e.points>=40&&floaters.length<12)floaters.push({x:e.x,y:e.y,text:'+'+e.points,life:.7});}
  if(e.type==='phase'){burst(e.x,e.y,'#93fddf',25);toast('LƯỚT PHA · Xuyên rắn, không xuyên biên',1.3);}
  if(e.type==='near'){toast('NÉ SÁT! +35',1.1);}
  if(e.type==='fever'){toast('CUỒNG NHIỆT! · Điểm ×2 trong 7 giây',2.3);burst(arena.player.x,arena.player.y,'#ffe19b',35);}
  if(e.type==='event')toast(events[e.event][0],2.2);
  if(e.type==='power')toast(e.power==='shield'?'LÁ CHẮN · Đỡ một cú chạm rắn':'NAM CHÂM · Hút mồi trong 8 giây');
  if(e.type==='shieldBreak'){toast('LÁ CHẮN ĐÃ ĐỠ VA CHẠM!',1.2);burst(arena.player.x,arena.player.y,'#b4e1ff',23);}
  if(e.type==='core'){toast('LÕI NĂNG LƯỢNG +250 · Lướt pha đã hồi');burst(e.x,e.y,'#ffe39b',35);}
  if(e.type==='kill'){toast('HẠ '+e.name.toLocaleUpperCase('vi-VN')+' · +180');burst(e.x,e.y,'#ffdb91',24);}
  if(e.type==='over'){shake=reduced?0:7;burst(e.x,e.y,'#71f7cd',40);showResult();}
}
function clearInput(){keys.clear();boost=false;pointer.active=false;stickId=boostId=dragId=null;$('boost').classList.remove('is-held');$('stick').firstElementChild.style.transform='';}
function stateUI(){
  const state=arena.status;stage.dataset.state=state;$('pause').disabled=state!=='playing';canvas.tabIndex=state==='playing'?0:-1;
  $('hud').hidden=state==='ready';$('bottom').hidden=state!=='playing';$('stick').hidden=state!=='playing';$('welcome').hidden=state!=='ready';$('paused').hidden=state!=='paused';$('result').hidden=state!=='over';
}
async function start(nextMode=mode,keepDate=false){
  const nextDate=nextMode==='daily'?(keepDate?date:challengeDate(new URLSearchParams(location.search).get('challenge'))||vietnamDate()):vietnamDate();
  if(!await scores.begin({mode:nextMode,date:nextDate}))return;
  mode=nextMode;if(mode==='daily'&&!keepDate)date=challengeDate(new URLSearchParams(location.search).get('challenge'))||vietnamDate();
  clearInput();unlockAudio();particles=[];floaters=[];accumulator=0;shake=0;runAwarded=false;
  arena.start({seed:mode==='daily'?hash('ncn-ran-luot-v1:'+date):(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0,mode,skin:profile.skin,name:(scores.profile()?.name||'Rắn Nhỏ').slice(0,20)});
  angle=0;camera={x:0,y:0,zoom:width<640?.69:.82};stateUI();updateHUD();canvas.focus({preventScroll:true});toast(stage.dataset.touch==='true'?'Kéo joystick để lái · Giữ ϟ tăng tốc':'Gom ánh sáng · Q lướt pha · Né biên đỏ',2.4);
}
function pause(){if(arena.status!=='playing')return;arena.pause();clearInput();accumulator=0;stateUI();scores.checkpoint(arena.score,0,{force:true});$('resume').focus({preventScroll:true});}
function resume(){if(arena.status!=='paused'||document.querySelector('dialog[open]')||document.body.classList.contains('ncn-menu-open'))return;arena.resume();clearInput();accumulator=0;lastFrame=performance.now();stateUI();canvas.focus({preventScroll:true});unlockAudio();}
function home(){arena.status='ready';clearInput();particles=[];floaters=[];stateUI();paintProfile();$('toast').classList.remove('show');$('start').focus({preventScroll:true});}
function showResult(){
  if(runAwarded)return;runAwarded=true;scores.finish(arena.score);const before=record(),oldXP=profile.xp;profile=awardProfile(profile,arena,date);persist();paintProfile();clearInput();stateUI();
  $('final-score').textContent=score(arena.score);$('final-time').textContent=clock(arena.elapsed);$('final-kills').textContent=arena.kills;$('final-combo').textContent='×'+arena.maxCombo;
  $('result-kicker').textContent=mode==='daily'?'THỬ THÁCH '+date:'ĐẤU TRƯỜNG · HẸN VÁN SAU';
  $('result-title').textContent=arena.reason==='time'?'Trọn 3 phút. Quá lì!':arena.reason==='edge'?'Biên không biết né.':'Lượn hơi sát rồi!';
  $('record-note').textContent=arena.score>before?'✦ Kỷ lục mới trên máy này!':'Kỷ lục '+(mode==='daily'?'ngày này':'của bạn')+': '+score(record());
  $('result-tip').textContent=arena.reason==='edge'?'Thấy viền đỏ thì quay đầu sớm. Lướt pha không giúp xuyên biên.':arena.reason==='time'?'Cùng bản đồ xuất phát, một đường đi mới. Chia sẻ để bạn bè cùng thử.':'Giữ Q cho lúc cần thoát vây. Rắn lớn chưa chắc thắng rắn khéo.';
  const unlocked=SKINS.filter(s=>s.xp>oldXP&&s.xp<=profile.xp),next=SKINS.find(s=>s.xp>profile.xp);
  $('xp-note').textContent='+'+(profile.xp-oldXP)+' XP · '+(unlocked.length?'Đã mở '+unlocked.map(s=>s.name).join(', '):next?'Còn '+(next.xp-profile.xp)+' XP để mở '+next.name:'Đã mở đủ 5 màu rắn');
  $('share-status').textContent='';$('retry').focus({preventScroll:true});
}
function updateHUD(){
  if(!arena.player)return;$('score').textContent=score(arena.score);$('run-info').textContent=mode==='daily'?'Thử thách '+date.slice(8)+'/'+date.slice(5,7)+' · Còn '+clock(180-arena.elapsed):'Đấu trường tự do · '+clock(arena.elapsed);
  $('pause').setAttribute('aria-label','Tạm dừng');$('pause').title='Tạm dừng (P)';document.querySelector('.rl-board-footer').textContent='Bạn + 10 rắn AI · Chơi đơn';$('retry').firstElementChild.textContent='Thêm một ván';
  const shield=arena.player.shield>0?' · ◇ Lá chắn '+Math.ceil(arena.player.shield)+'s':'',magnet=arena.player.magnet>0?' · Hút mồi '+Math.ceil(arena.player.magnet)+'s':'';
  $('combo').textContent=(arena.fever>0?'✦ CUỒNG NHIỆT ×2 · '+arena.fever.toFixed(1)+'s':arena.combo>1?'COMBO ×'+arena.combo:'')+shield+magnet;
  const event=arena.event,eventTitle=arena.fever>0?'CUỒNG NHIỆT · ×2 ĐIỂM':event?events[event.type][0]:'SỰ KIỆN KẾ TIẾP · '+Math.ceil((arena.elapsed%35<20?20:55)-arena.elapsed%35)+'s';
  $('event').replaceChildren(document.createTextNode(eventTitle));const small=document.createElement('small');small.textContent=event?events[event.type][1]+' · '+Math.ceil(event.remaining)+'s':'Ăn liên tục để tăng combo';$('event').append(small);
  const leaders=[arena.player,...arena.bots].filter(s=>s.alive).sort((a,b)=>b.mass-a.mass),top=leaders.slice(0,4);if(!top.includes(arena.player))top.push(arena.player);
  $('leaders').replaceChildren(...top.map(s=>{const li=document.createElement('li'),name=document.createElement('span'),value=document.createElement('b');name.textContent=(leaders.indexOf(s)+1)+'. '+(s.player?'Bạn':s.name);value.textContent=Math.ceil(150+s.mass*.43);li.append(name,value);if(s.player)li.className='rl-you';return li;}));
  $('energy-value').textContent=Math.round(arena.energy)+'%';$('energy-fill').style.width=arena.energy+'%';$('phase').disabled=arena.cooldown>0;$('phase-text').textContent=arena.cooldown>0?'◇ '+arena.cooldown.toFixed(1)+'s':'◇ LƯỚT PHA';$('boost').classList.toggle('is-held',boost||keys.has('ShiftLeft')||keys.has('ShiftRight'));
}
function resize(){
  // Include the real shared header/notice height so touch controls stay above
  // the bottom of a phone screen rather than below the fold.
  if(!document.fullscreenElement){const top=stage.getBoundingClientRect().top+scrollY,available=Math.max(360,Math.min(740,(window.visualViewport?.height||innerHeight)-Math.min(top,280)-14));stage.style.setProperty('--rl-available',available+'px');}
  const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;const changed=Math.abs(r.width/width-1)>.4;if(changed&&arena.status==='playing')pause();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
}
function circle(x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function strokeCircle(x,y,r,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
function snake(s,preview=false){
  if(!s.alive||!s.points.length)return;const r=arena.size(s),skin=s.skin;
  const path=()=>{ctx.beginPath();ctx.moveTo(s.x,s.y);for(const p of s.points)ctx.lineTo(p.x,p.y);};
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';const phasing=s.player?arena.phase>0:s.phase>0;if(phasing&&!preview)ctx.globalAlpha=.52;
  path();ctx.strokeStyle='#031a21';ctx.lineWidth=r*2+5;ctx.stroke();
  if(s.player&&!reduced){ctx.shadowColor=skin.color;ctx.shadowBlur=s.boosting?21:8;}
  path();ctx.strokeStyle=skin.dark;ctx.lineWidth=r*2;ctx.stroke();ctx.shadowBlur=0;
  for(let i=s.points.length-1;i>=0;i-=2){const p=s.points[i];circle(p.x,p.y,r*.89,i%4===0?skin.color:skin.dark);circle(p.x-2,p.y-3,r*.35,skin.color+'69');}
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);circle(0,0,r+1,skin.color);circle(-3,-3,r*.65,skin.color);circle(r*.4,-r*.55,r*.36,'#f1fff6');circle(r*.4,r*.55,r*.36,'#f1fff6');circle(r*.55,-r*.55,r*.17,'#0b3840');circle(r*.55,r*.55,r*.17,'#0b3840');ctx.restore();
  if(!preview&&(s.safe>0||s.shield>0||phasing)){ctx.setLineDash(s.shield>0?[]:[4,5]);strokeCircle(s.x,s.y,r+9,phasing?'#92ffe6':'#9ae4ff88',1.7);ctx.setLineDash([]);}
  if(!preview){ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.fillStyle=s.player?'#ddfff2':'#9ac3b8';ctx.fillText(s.name,s.x,s.y-r-16);}
  ctx.restore();
}
function background(){
  ctx.fillStyle='#071b20';ctx.fillRect(0,0,width,height);const g=ctx.createRadialGradient(width*.65,height*.45,0,width*.65,height*.45,width*.8);g.addColorStop(0,'#143a3340');g.addColorStop(1,'#05151e00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
}
function world(){
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
  const left=camera.x-width/(2*camera.zoom),right=camera.x+width/(2*camera.zoom),top=camera.y-height/(2*camera.zoom),bottom=camera.y+height/(2*camera.zoom);
  ctx.lineWidth=1/camera.zoom;ctx.strokeStyle='#77bea510';ctx.beginPath();for(let x=Math.floor(left/64)*64;x<=right;x+=64){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}for(let y=Math.floor(top/64)*64;y<=bottom;y+=64){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
  ctx.fillStyle='#8de0be18';for(let x=Math.floor(left/128)*128;x<right;x+=128)for(let y=Math.floor(top/128)*128;y<bottom;y+=128)ctx.fillRect(x-1,y-1,2,2);
  const boundary=arena.radius;strokeCircle(0,0,boundary,'#ff797025',24);strokeCircle(0,0,boundary,'#ff8a7580',2);ctx.setLineDash([6,12]);strokeCircle(0,0,boundary-40,'#ff927c26');ctx.setLineDash([]);
  strokeCircle(0,0,120,'#8ef7cc12');strokeCircle(0,0,135,'#8ef7cc08');
  for(const f of arena.food){if(f.x<left-30||f.x>right+30||f.y<top-30||f.y>bottom+30)continue;
    if(f.type==='core'){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(time*.8);strokeCircle(0,0,30+Math.sin(time*3)*3,'#ffe5a564',2);ctx.fillStyle='#ffe49c';ctx.fillRect(-10,-10,20,20);ctx.restore();continue;}
    const size=f.type==='loot'?38:f.value>1?30:23;ctx.globalAlpha=reduced?.7:.77+Math.sin(time*2+f.id)*.15;ctx.drawImage(sprites[f.hue],f.x-size/2,f.y-size/2,size,size);
  }ctx.globalAlpha=1;
  for(const p of arena.pickups){if(p.x<left-40||p.x>right+40||p.y<top-40||p.y>bottom+40)continue;strokeCircle(p.x,p.y,22,'#bde4e542',1.5);circle(p.x,p.y,17,p.type==='shield'?'#285175':'#5b3e74');ctx.fillStyle='#dcecff';ctx.textAlign='center';ctx.font='700 20px system-ui';ctx.fillText(p.type==='shield'?'◇':'∩',p.x,p.y+7);}
  for(const s of [...arena.bots,arena.player])if(s.alive&&s.points.some(p=>p.x>left-40&&p.x<right+40&&p.y>top-40&&p.y<bottom+40))snake(s);
  for(const p of particles){ctx.globalAlpha=clamp(p.life/.45,0,1);circle(p.x,p.y,p.r,p.color);}ctx.globalAlpha=1;
  ctx.font='750 14px system-ui';ctx.textAlign='center';for(const f of floaters){ctx.globalAlpha=clamp(f.life/.5,0,1);ctx.fillStyle='#b7ffdb';ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;
  ctx.restore();
  const distance=Math.hypot(arena.player.x,arena.player.y);
  if(distance>boundary-240){const danger=clamp((distance-(boundary-240))/240,0,.75);const g=ctx.createRadialGradient(width/2,height/2,Math.min(width,height)*.12,width/2,height/2,Math.max(width,height)*.6);g.addColorStop(0,'#ee603500');g.addColorStop(1,'rgba(255,91,68,'+(danger*.5)+')');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.font='700 11px system-ui';ctx.fillStyle='#ffc2a5';ctx.fillText('SẮP CHẠM BIÊN · QUAY ĐẦU',width/2,height-25);}
}
function preview(){
  const sx=width*.73,sy=height*.5,scale=width<640?.8:Math.min(1.8,width/780);ctx.save();ctx.translate(sx,sy);ctx.scale(scale,scale);
  ctx.strokeStyle='#81efb617';ctx.lineWidth=1;for(const r of [90,155,230])strokeCircle(0,0,r,'#81efb612');
  for(let i=0;i<65;i++){const a=i*2.399,r=80+((i*73)%260);const x=Math.cos(a)*r,y=Math.sin(a)*r;ctx.drawImage(sprites[i%5],x-14,y-14,28,28);}
  const points=[];const drift=reduced?0:Math.sin(previewTime*.48)*.12;
  for(let i=0;i<130;i++){const t=i/129,a=-1.1+t*TAU*1.25+drift,r=30+t*135;points.push({x:Math.cos(a)*r,y:Math.sin(a)*r});}
  const head=points[0],second=points[1],skin=SKINS.find(s=>s.id===profile.skin),s={...head,angle:Math.atan2(head.y-second.y,head.x-second.x),points,mass:650,skin,alive:true,player:true};
  snake(s,true);ctx.textAlign='center';ctx.fillStyle='#74b49b';ctx.font='600 8px system-ui';ctx.letterSpacing='2px';ctx.fillText('NCN / ENERGY ARENA',0,215);ctx.restore();
}
function drawRadar(){
  radar.clearRect(0,0,166,138);const k=60/arena.radius;radar.save();radar.translate(83,69);radar.fillStyle='#a5e1c606';radar.strokeStyle='#a5e1c62a';radar.beginPath();radar.arc(0,0,61,0,TAU);radar.fill();radar.stroke();
  for(const s of arena.bots)if(s.alive){radar.fillStyle='#5fa68e';radar.beginPath();radar.arc(s.x*k,s.y*k,2,0,TAU);radar.fill();}
  if(arena.event?.type==='core'){radar.fillStyle='#ffe59c';radar.fillRect(-3,-3,6,6);}
  radar.fillStyle='#e9fff7';radar.beginPath();radar.arc(arena.player.x*k,arena.player.y*k,3,0,TAU);radar.fill();radar.restore();
}
function frame(now){
  const dt=Math.min(.08,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;time+=dt;
  if(arena.status==='playing'){
    accumulator+=dt;let steps=0;
    while(accumulator>=1/60&&steps++<6){
      const dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dy=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
      if(dx||dy)angle=Math.atan2(dy,dx);else if(inputMode==='pointer'&&pointer.active){const px=width/2+(arena.player.x-camera.x)*camera.zoom,py=height/2+(arena.player.y-camera.y)*camera.zoom;if(Math.hypot(pointer.x-px,pointer.y-py)>14)angle=Math.atan2(pointer.y-py,pointer.x-px);}
      arena.step(1/60,{angle,boost:boost||keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('Space')});accumulator-=1/60;
    }
    const follow=1-Math.exp(-dt*7);camera.x+=(arena.player.x-camera.x)*follow;camera.y+=(arena.player.y-camera.y)*follow;const desired=(width<640?.69:.82)-Math.min(.18,arena.player.mass/10000);camera.zoom+=(desired-camera.zoom)*follow;
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const f of floaters){f.y-=25*dt;f.life-=dt;}floaters=floaters.filter(f=>f.life>0);
    if(time-uiAt>.1){updateHUD();drawRadar();uiAt=time;}
  }else if(arena.status==='ready')previewTime+=dt;
  if(toastUntil<time)$('toast').classList.remove('show');
  ctx.setTransform(dpr,0,0,dpr,0,0);background();ctx.save();if(shake>0&&!reduced){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*25);}
  if(arena.status==='ready')preview();else world();ctx.restore();requestAnimationFrame(frame);
}
function point(e){const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;pointer.active=true;inputMode='pointer';}
canvas.addEventListener('pointermove',e=>{if(arena.status==='playing'&&(e.pointerType==='mouse'||e.pointerId===dragId)){point(e);e.preventDefault();}});
canvas.addEventListener('pointerdown',e=>{if(arena.status!=='playing'||e.button!==0)return;canvas.focus({preventScroll:true});point(e);if(e.pointerType==='mouse')boost=true;else{dragId=e.pointerId;canvas.setPointerCapture(e.pointerId);}e.preventDefault();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){pointer.active=false;boost=false;}});
function stick(e){const r=$('stick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy);if(len>5){angle=Math.atan2(dy,dx);inputMode='stick';pointer.active=false;}const k=Math.min(1,26/(len||1));$('stick').firstElementChild.style.transform='translate('+dx*k+'px,'+dy*k+'px)';}
$('stick').addEventListener('pointerdown',e=>{if(arena.status!=='playing'||stickId!==null)return;stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);stick(e);e.preventDefault();});$('stick').addEventListener('pointermove',e=>{if(e.pointerId===stickId){stick(e);e.preventDefault();}});
$('boost').addEventListener('pointerdown',e=>{if(arena.status!=='playing'||e.button!==0)return;boostId=e.pointerId;boost=true;$('boost').setPointerCapture(e.pointerId);e.preventDefault();});
$('boost').addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&arena.status==='playing'){boost=true;e.preventDefault();}});$('boost').addEventListener('keyup',()=>{boost=false;});
function release(e){if(e.pointerId===stickId){stickId=null;$('stick').firstElementChild.style.transform='';}if(e.pointerId===boostId){boostId=null;boost=false;}if(e.pointerId===dragId){dragId=null;pointer.active=false;}if(e.pointerType==='mouse')boost=false;}
for(const name of ['pointerup','pointercancel','lostpointercapture'])addEventListener(name,release);
$('phase').addEventListener('click',()=>{unlockAudio();arena.phaseDash();updateHUD();});
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]')||document.body.classList.contains('ncn-menu-open'))return;
  if(arena.status==='playing'&&(e.code==='KeyP'||e.code==='Escape')){e.preventDefault();pause();return;}
  if(arena.status==='paused'&&(e.code==='KeyP'||e.code==='Escape')&&stage.contains(e.target)){e.preventDefault();resume();return;}
  if(arena.status!=='playing'||!$('app').contains(e.target))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'].includes(e.code)){keys.add(e.code);if(!e.code.startsWith('Shift')&&e.code!=='Space'){inputMode='keyboard';pointer.active=false;}e.preventDefault();}
  if(e.code==='KeyQ'&&!e.repeat){arena.phaseDash();updateHUD();e.preventDefault();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',pause);addEventListener('pagehide',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(arena.status==='ready')$('daily-date').textContent='Ngày '+(challengeDate(new URLSearchParams(location.search).get('challenge'))||vietnamDate())+' · Cùng bản đồ xuất phát';});
document.addEventListener('click',e=>{if(e.target.closest('#ncn-menu-open,[data-ncn-search-open],[data-ncn-account-open],.ncn-account-menu>summary'))pause();},true);
const modals=new MutationObserver(()=>{if(document.querySelector('dialog[open]')||document.body.classList.contains('ncn-menu-open'))pause();});modals.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','class']});
$('start').addEventListener('click',()=>start('arena'));$('daily').addEventListener('click',()=>start('daily'));$('retry').addEventListener('click',()=>start(mode,true));$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('home-paused').addEventListener('click',home);$('result-home').addEventListener('click',home);
$('sound').addEventListener('click',()=>{profile.muted=!profile.muted;unlockAudio();soundUI();persist();if(!profile.muted)tone('power');});
$('help-open').addEventListener('click',()=>{pause();$('help').showModal();});$('help-close').addEventListener('click',()=>$('help').close());$('help').addEventListener('click',e=>{if(e.target===$('help'))$('help').close();});
$('reduced').checked=reduced;$('reduced').addEventListener('change',()=>{reduced=$('reduced').checked;particles=[];floaters=[];shake=0;persist();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else{toast('Trình duyệt này chưa hỗ trợ toàn màn hình.');return;}resize();}catch{toast('Chưa mở được toàn màn hình trên trình duyệt này.');}});
document.addEventListener('fullscreenchange',resize);
$('share').addEventListener('click',async()=>{const link=new URL('/ran-luot/',location.origin);if(mode==='daily')link.searchParams.set('challenge',date);const text='Mình vừa đạt '+score(arena.score)+' điểm trong Rắn Lướt NCN'+(mode==='daily'?' · thử thách '+date:'')+'. Thử vượt kỷ lục nhé! '+link.href;try{await navigator.clipboard.writeText(text);$('share-status').textContent='Đã sao chép điểm và liên kết thách đấu.';}catch{$('share-status').textContent='Liên kết thách đấu: '+link.href;}});
const scores=mountScores({game:'snake',host:stage,anchor:document.querySelector('.rl-features'),pause});
$('daily-date').textContent='Ngày '+(challengeDate(new URLSearchParams(location.search).get('challenge'))||vietnamDate())+' · Cùng bản đồ xuất phát';
stage.dataset.touch=String(matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0);
paintProfile();soundUI();stateUI();resize();new ResizeObserver(resize).observe(stage);addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);requestAnimationFrame(frame);
