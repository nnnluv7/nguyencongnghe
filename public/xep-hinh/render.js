import {COLS,ROWS,SHAPES,pieceCells,ghost,levelSpec} from './core.js?v=20261026-1';

const HUES=[0,193,44,268,215,25,148,341];
export const shapeNames=['','Thanh dài','Vuông','Chữ T','Chữ J','Chữ L','Zích zắc xanh','Zích zắc hồng'];
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
export function createRenderer(canvas,holder){
 const ctx=canvas.getContext('2d'),frame=canvas.parentElement,miniCache=new WeakMap();let width=200,dpr=1,world=0,cache=new Map(),particles=[],dirty=true;
 const hue=(type)=>HUES[type]+(world%4)*9;
 function tile(type,size){
  const key=type+':'+Math.round(size*100)/100;if(cache.has(key))return cache.get(key);
  const art=document.createElement('canvas'),n=Math.max(4,Math.ceil(size*dpr));art.width=art.height=n;const c=art.getContext('2d');c.scale(n/size,n/size);
  const gap=Math.max(.8,size*.045),x=gap,y=gap,w=size-gap*2,h=w,r=Math.max(1.7,size*.12),face=c.createLinearGradient(0,0,size,size);
  face.addColorStop(0,`hsl(${hue(type)} 70% 77%)`);face.addColorStop(.55,`hsl(${hue(type)} 58% 65%)`);face.addColorStop(1,`hsl(${hue(type)} 48% 51%)`);
  c.fillStyle='rgba(0,0,0,.25)';rounded(c,x,y+size*.055,w,h,r);c.fill();c.fillStyle=face;rounded(c,x,y,w,h-size*.045,r);c.fill();
  c.save();rounded(c,x,y,w,h-size*.045,r);c.clip();
  c.fillStyle='rgba(255,255,255,.38)';c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.lineTo(x+w-size*.17,y+size*.16);c.lineTo(x+size*.16,y+size*.16);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.13)';c.beginPath();c.moveTo(x,y);c.lineTo(x+size*.16,y+size*.16);c.lineTo(x+size*.16,y+h-size*.18);c.lineTo(x,y+h);c.closePath();c.fill();
  c.fillStyle='rgba(25,34,67,.21)';c.beginPath();c.moveTo(x+w,y);c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.lineTo(x+size*.16,y+h-size*.18);c.lineTo(x+w-size*.16,y+h-size*.18);c.lineTo(x+w-size*.16,y+size*.16);c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,.27)';c.lineWidth=Math.max(.5,size*.018);rounded(c,x+size*.17,y+size*.17,w-size*.34,h-size*.37,Math.max(1,r*.5));c.stroke();c.restore();
  cache.set(key,art);return art;
 }
 function resize(){
  const box=holder.getBoundingClientRect(),padding=14;const next=Math.max(10,Math.floor(Math.min(box.width-padding-12,(box.height-padding-12)/2)));
  dpr=Math.min(2,window.devicePixelRatio||1);width=next;canvas.width=Math.round(width*dpr);canvas.height=Math.round(width*2*dpr);canvas.style.width=width+'px';canvas.style.height=width*2+'px';frame.style.width=width+12+'px';frame.style.height=width*2+12+'px';cache.clear();dirty=true;
 }
 function mini(target,type){
  const key=type+':'+world;if(miniCache.get(target)===key)return;miniCache.set(target,key);
  const c=target.getContext('2d'),w=target.width,h=target.height;c.clearRect(0,0,w,h);if(!type)return;
  const cells=pieceCells({type,rotation:0,x:0,y:0}),minX=Math.min(...cells.map(p=>p.x)),minY=Math.min(...cells.map(p=>p.y)),cols=Math.max(...cells.map(p=>p.x))-minX+1,rows=Math.max(...cells.map(p=>p.y))-minY+1,size=Math.min(w/(cols+1),h/(rows+.8),28);
  for(const p of cells)c.drawImage(tile(type,size),(w-cols*size)/2+(p.x-minX)*size,(h-rows*size)/2+(p.y-minY)*size,size,size);
 }
 function draw(game,dt=0,reduced=false){
  const nextWorld=levelSpec(game.level).world;if(world!==nextWorld){world=nextWorld;cache.clear();dirty=true;}
  if(!dirty&&!particles.length)return;dirty=false;const unit=width/COLS,spec=levelSpec(game.level);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,width*2);
  const bg=ctx.createLinearGradient(0,0,width,width*2);bg.addColorStop(0,spec.sky);bg.addColorStop(1,'#111f30');ctx.fillStyle=bg;ctx.fillRect(0,0,width,width*2);
  const glow=ctx.createRadialGradient(width*.4,width*.7,0,width*.4,width*.7,width*1.5);glow.addColorStop(0,'#c1d6eb0d');glow.addColorStop(1,'#c1d6eb00');ctx.fillStyle=glow;ctx.fillRect(0,0,width,width*2);
  ctx.strokeStyle='#ffffff0b';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<=COLS;x++){ctx.moveTo(x*unit,0);ctx.lineTo(x*unit,ROWS*unit);}for(let y=0;y<=ROWS;y++){ctx.moveTo(0,y*unit);ctx.lineTo(width,y*unit);}ctx.stroke();
  for(let i=0;i<game.board.length;i++)if(game.board[i])ctx.drawImage(tile(game.board[i],unit),(i%COLS)*unit,Math.floor(i/COLS)*unit,unit,unit);
  if(game.active){
   for(const {x,y}of pieceCells(ghost(game)))if(y>=0){ctx.fillStyle=`hsl(${hue(game.active.type)} 70% 72% / .09)`;ctx.strokeStyle=`hsl(${hue(game.active.type)} 65% 77% / .55)`;ctx.lineWidth=Math.max(1,unit*.045);rounded(ctx,x*unit+2,y*unit+2,unit-4,unit-4,unit*.1);ctx.fill();ctx.stroke();}
   for(const {x,y,type}of pieceCells(game.active))if(y>=0)ctx.drawImage(tile(type,unit),x*unit,y*unit,unit,unit);
  }
  if(reduced)particles=[];else for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*1.1;if(p.life<=0)continue;ctx.globalAlpha=Math.max(0,p.life/.65);ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x*unit,p.y*unit);ctx.rotate(p.life*3);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore();}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
 }
 function effect(event,reduced){
  if(reduced||!event?.count)return;
  for(const row of event.rows)for(let i=0;i<22;i++)particles.push({x:Math.random()*COLS,y:row+.5,vx:(Math.random()-.5)*8,vy:-1-Math.random()*4,life:.35+Math.random()*.4,size:2+Math.random()*3,color:`hsl(${Math.random()*360} 80% 75%)`});particles=particles.slice(-110);dirty=true;
 }
 return {resize,draw,mini,effect,invalidate(){dirty=true;},get cellSize(){return width/COLS;}};
}
