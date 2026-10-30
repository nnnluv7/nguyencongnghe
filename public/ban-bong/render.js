import {WIDTH,HEIGHT,RADIUS,LAUNCHER,DANGER,STONE,cells,traceShot,levelSpec} from './core.js?v=20261030-eggs-2';
import {createDinosaur} from './dinosaur.js?v=20261030-eggs-2';
export const COLORS=['#7ce6bd','#ff8ca7','#83c9ff','#ffe48a','#c1a1ff','#ffb486'];
export const COLOR_NAMES=['xanh ngọc','hồng','xanh dương','vàng','tím','cam'];
const SYMBOLS=['✦','♡','≋','●','◇','+'];
const mix=(a,b,t)=>a+(b-a)*t;
export function along(points,distance){
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.hypot(b.x-a.x,b.y-a.y);if(distance<=n)return {x:mix(a.x,b.x,distance/n),y:mix(a.y,b.y,distance/n)};distance-=n;}return points.at(-1);
}
export function createRenderer(canvas){
 const ctx=canvas.getContext('2d'),doc=canvas.ownerDocument,textures=new Map(),dinosaur=createDinosaur(doc);let dpr=0,background=null,world=-1,particles=[],drops=[],time=0;
 const eggPath=c=>{c.beginPath();c.moveTo(72,15);c.bezierCurveTo(46,15,22,53,22,82);c.bezierCurveTo(22,111,43,127,72,127);c.bezierCurveTo(101,127,122,111,122,82);c.bezierCurveTo(122,53,98,15,72,15);c.closePath();};
 function texture(key){
  if(textures.has(key))return textures.get(key);
  const image=doc.createElement('canvas');image.width=image.height=144;const c=image.getContext('2d'),x=72,y=70,r=54;
  if(key===String(STONE)){
   const shade=c.createLinearGradient(35,20,112,121);shade.addColorStop(0,'#c7c0ae');shade.addColorStop(.48,'#817c70');shade.addColorStop(1,'#434d4b');c.fillStyle=shade;c.shadowColor='#071c2566';c.shadowBlur=7;c.shadowOffsetY=4;c.beginPath();c.moveTo(49,20);c.lineTo(91,18);c.lineTo(121,48);c.lineTo(123,91);c.lineTo(92,121);c.lineTo(45,117);c.lineTo(22,83);c.lineTo(25,47);c.closePath();c.fill();c.shadowColor='transparent';c.strokeStyle='#e5dfcc80';c.lineWidth=2;c.stroke();c.strokeStyle='#31403cbb';c.lineWidth=3;c.beginPath();c.moveTo(63,21);c.lineTo(76,57);c.lineTo(60,79);c.lineTo(78,119);c.moveTo(76,57);c.lineTo(113,50);c.moveTo(60,79);c.lineTo(29,89);c.stroke();textures.set(key,image);return image;
  }
  c.shadowColor=key==='bomb'?'#ffb45e80':'#071b3440';c.shadowBlur=7;c.shadowOffsetY=4;
  const fill=c.createRadialGradient(x-20,y-23,2,x+12,y+17,69);
  const color=COLORS[(Number(key)||1)-1]||'#d9f9ee';
  fill.addColorStop(0,'#ffffff');fill.addColorStop(.2,key==='bomb'?'#ffda8d':color);fill.addColorStop(.63,key==='bomb'?'#e87f58':color);fill.addColorStop(1,key==='bomb'?'#783b41':'#163b4f');
  c.fillStyle=fill;eggPath(c);c.fill();c.shadowColor='transparent';
  c.save();eggPath(c);c.clip();
  for(const [i,p]of [[-27,12,13,10],[14,-25,10,13],[29,17,12,16],[-12,39,11,8],[-30,-19,7,10]].entries()){
   c.fillStyle=key==='rainbow'?COLORS[i]:'#0b344746';c.beginPath();c.ellipse(x+p[0],y+p[1],p[2],p[3],(i+(Number(key)||0))*.7,0,Math.PI*2);c.fill();
  }c.restore();
  c.strokeStyle='#ffffff86';c.lineWidth=1.8;eggPath(c);c.stroke();
  c.strokeStyle='#ffffff9c';c.lineWidth=2.2;c.lineCap='round';c.beginPath();c.moveTo(43,38);c.quadraticCurveTo(53,21,64,21);c.stroke();
  const shine=c.createRadialGradient(x-17,y-22,1,x-17,y-22,23);shine.addColorStop(0,'#ffffffce');shine.addColorStop(1,'#ffffff00');c.fillStyle=shine;c.beginPath();c.ellipse(x-18,y-21,25,16,-.7,0,Math.PI*2);c.fill();
  c.fillStyle='#ffffffa8';c.beginPath();c.arc(x+29,y+25,3,0,Math.PI*2);c.fill();
  c.font='800 '+(key==='bomb'||key==='rainbow'?34:23)+'px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#123a4f55';c.fillText(key==='rainbow'?'✦':key==='bomb'?'✺':SYMBOLS[(Number(key)||1)-1],x+1,y+5);c.fillStyle='#ffffffdc';c.fillText(key==='rainbow'?'✦':key==='bomb'?'✺':SYMBOLS[(Number(key)||1)-1],x,y+3);
  textures.set(key,image);return image;
 }
 const ball=(x,y,color,r=RADIUS,alpha=1)=>{ctx.globalAlpha=alpha;ctx.drawImage(texture(String(color)),x-r*1.3,y-r*1.32,r*2.6,r*2.6);ctx.globalAlpha=1;};
 function resize(){const next=Math.min(2,window.devicePixelRatio||1);if(next!==dpr||canvas.width!==Math.round(WIDTH*next)){dpr=next;canvas.width=Math.round(WIDTH*dpr);canvas.height=Math.round(HEIGHT*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);}
 function paintBackground(game){
  const spec=levelSpec(game.level,game.mode,game.date);if(world===spec.world&&background)return;world=spec.world;background=doc.createElement('canvas');background.width=WIDTH;background.height=HEIGHT;const c=background.getContext('2d');
  const fill=c.createLinearGradient(0,0,WIDTH,HEIGHT);fill.addColorStop(0,spec.sky);fill.addColorStop(.55,'#0e2f36');fill.addColorStop(1,'#143f3c');c.fillStyle=fill;c.fillRect(0,0,WIDTH,HEIGHT);
  for(const [x,y,r,paint]of [[460,230,360,spec.color+'2a'],[40,500,300,'#6cd9ba17'],[210,30,190,'#fff2b21a']]){const light=c.createRadialGradient(x,y,0,x,y,r);light.addColorStop(0,paint);light.addColorStop(1,'#ffffff00');c.fillStyle=light;c.fillRect(0,0,WIDTH,HEIGHT);}
  // Painted once per biome: misty cliffs, a distant volcano and giant ferns.
  c.fillStyle='#071d2a43';c.beginPath();c.moveTo(0,310);c.lineTo(70,180);c.lineTo(150,250);c.lineTo(250,135);c.lineTo(390,280);c.lineTo(460,170);c.lineTo(WIDTH,265);c.lineTo(WIDTH,HEIGHT);c.lineTo(0,HEIGHT);c.closePath();c.fill();
  if(spec.world%4===1||spec.world===9||spec.world===19){c.fillStyle='#0a263c55';c.beginPath();c.moveTo(285,510);c.lineTo(383,273);c.quadraticCurveTo(405,288,426,273);c.lineTo(528,510);c.fill();c.strokeStyle='#ffb17644';c.lineWidth=3;c.beginPath();c.moveTo(384,276);c.lineTo(404,303);c.lineTo(418,294);c.lineTo(428,333);c.stroke();}
  function fern(x,y,size,flip,paint){c.save();c.translate(x,y);c.scale(flip,1);c.strokeStyle=paint;c.fillStyle=paint;c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(size*.2,-size*.5,size*.05,-size);c.stroke();for(let i=1;i<7;i++){const py=-size*i/7,w=size*.35*(1-i/9);for(const side of [-1,1]){c.beginPath();c.moveTo(size*.09,py);c.quadraticCurveTo(side*w,py-size*.27,side*w,py-size*.05);c.quadraticCurveTo(side*w*.55,py+size*.08,size*.09,py);c.fill();}}c.restore();}
  fern(20,HEIGHT,170,1,'#0b393eaa');fern(WIDTH-8,HEIGHT,215,-1,'#092d3b99');fern(0,500,120,1,'#39726324');fern(WIDTH,370,150,-1,'#39726325');
  for(let i=0;i<35;i++){const x=(i*173+31)%WIDTH,y=(i*107+17)%HEIGHT;c.fillStyle=i%3?'#ffffff26':'#ffe8a85a';c.beginPath();c.arc(x,y,i%4===0?1.7:.8,0,Math.PI*2);c.fill();}
  c.strokeStyle='#b1e8d512';c.lineWidth=1;for(const r of [140,220,300]){c.beginPath();c.arc(485,HEIGHT-80,r,0,Math.PI*2);c.stroke();}
  c.fillStyle='#092a2b48';c.fillRect(0,DANGER,WIDTH,HEIGHT-DANGER);c.strokeStyle='#ffd19a5c';c.setLineDash([4,9]);c.beginPath();c.moveTo(17,DANGER);c.lineTo(WIDTH-17,DANGER);c.stroke();c.setLineDash([]);c.fillStyle='#f3d7b288';c.font='700 8px system-ui,sans-serif';c.textAlign='right';c.fillText('GIỮ TRỨNG TRÊN VẠCH TỔ',WIDTH-20,DANGER+17);
  const rail=c.createLinearGradient(0,0,WIDTH,0);rail.addColorStop(0,'#e2f6e62b');rail.addColorStop(.5,'#c8efd79e');rail.addColorStop(1,'#e2f6e62b');c.fillStyle=rail;c.fillRect(14,4,WIDTH-28,3);
 }
 function effect(event,reduced=false){
  if(reduced)return;
  for(const [i,tile]of event.popped.entries())for(let p=0;p<5;p++)particles.push({x:tile.x,y:tile.y,vx:Math.cos((p*1.256)+i)*90,vy:Math.sin(p*1.256+i)*90-45,life:.55,age:0,color:COLORS[tile.color-1],size:p%2?2:3.5});
  for(const [i,tile]of event.fallen.entries())drops.push({...tile,age:0,vx:(i%3-1)*32,vy:30+i%5*7});
  if(particles.length>400)particles=particles.slice(-400);if(drops.length>180)drops=drops.slice(-180);
 }
 function draw(game,{angle=0,flight=null,reduced=false,dt=0,aim=false,power='normal'}={}){
  if(!ctx)return;time+=dt;resize();paintBackground(game);ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(background,0,0);
  const board=flight?.before||game;
  for(const tile of cells(board.board,board.phase))ball(tile.x,tile.y,tile.color);
  if(aim&&!flight&&game.status==='playing'){
   const path=traceShot(game,angle),count=Math.min(110,Math.floor(Math.min(path.distance,levelSpec(game.level,game.mode,game.date).aimLength)/17));
   for(let i=1;i<count;i++){const p=along(path.points,i*17);ctx.fillStyle=i%3?'#e0fff1a6':'#ffe6a9dc';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.2,3-i*.022),0,Math.PI*2);ctx.fill();}
   if(path.land&&path.distance<=levelSpec(game.level,game.mode,game.date).aimLength){ctx.strokeStyle='#e9ffdb70';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(path.land.x,path.land.y,RADIUS-5,RADIUS-1,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  }
  const accent=levelSpec(game.level,game.mode,game.date).color;
  ctx.fillStyle='#071f2766';ctx.beginPath();ctx.ellipse(LAUNCHER.x,HEIGHT-9,65,9,0,0,Math.PI*2);ctx.fill();
  dinosaur.draw(ctx,{x:LAUNCHER.x,y:LAUNCHER.y,angle,time,recoil:flight?Math.max(0,1-flight.elapsed/.2):0,reduced});if(canvas.dataset.dinoRenderer!==dinosaur.kind)canvas.dataset.dinoRenderer=dinosaur.kind;
  if(!flight)ball(LAUNCHER.x,LAUNCHER.y,power==='normal'?game.current||1:power,RADIUS*1.08);
  else{const distance=Math.min(1,flight.elapsed/flight.duration)*flight.event.distance,p=along(flight.event.points,distance);for(let i=1;i<=3;i++){const tail=along(flight.event.points,Math.max(0,distance-i*9));ball(tail.x,tail.y,flight.power==='normal'?flight.before.current:flight.power,RADIUS*(1-i*.12),.14);}ball(p.x,p.y,flight.power==='normal'?flight.before.current:flight.power);}
  ctx.fillStyle='#c6e6d1b3';ctx.font='700 8px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText('TIẾP THEO',LAUNCHER.x+79,HEIGHT-29);ball(LAUNCHER.x+57,HEIGHT-33,game.next||1,15);
  ctx.strokeStyle=accent+'6b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(LAUNCHER.x+57,HEIGHT-33,20,0,Math.PI*2);ctx.stroke();
  if(!reduced){
   for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=140*dt;ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.color||'#c8c5b3';ctx.beginPath();ctx.moveTo(p.x,p.y-p.size*1.7);ctx.lineTo(p.x+p.size,p.y+p.size);ctx.lineTo(p.x-p.size*1.4,p.y+p.size*.6);ctx.closePath();ctx.fill();}
   particles=particles.filter(p=>p.age<p.life);ctx.globalAlpha=1;
   for(const p of drops){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=650*dt;ball(p.x,p.y,p.color,RADIUS,Math.max(0,1-p.age/1.2));}drops=drops.filter(p=>p.age<1.2&&p.y<HEIGHT+40);
  }
 }
 for(const key of [...COLORS.map((_,i)=>String(i+1)),String(STONE),'rainbow','bomb'])texture(key);
 resize();return {draw,resize,effect,reset(){particles=[];drops=[];world=-1;}};
}
