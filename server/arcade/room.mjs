import {Arena,SKINS,random,hash,TAU,clamp,wrap} from '../../public/ran-luot/core.js';

// Each player uses the same scoring/growth rules as the solo engine. Only the
// room advances physics; network clients send direction and skill intentions.
export class Room {
 constructor(code,{now=Date.now,onFinish=()=>{},seed=hash(code)}={}){
  this.code=code;this.now=now;this.onFinish=onFinish;this.rng=random(seed);this.players=new Map();this.pool=new Arena().start({seed});this.pool.bots=[];this.pool.food=this.pool.food.slice(0,520);this.elapsed=0;this.event=null;this.cycle=-1;this.nextPickup=8;this.added=[];this.removed=[];this.moved=new Map();
 }
 add(claims,send){
  if(this.players.size>=16)throw Error('Phòng đang đủ 16 người chơi.');if(this.players.has(claims.sub))throw Error('Tài khoản này đã ở trong phòng trên thiết bị khác.');
  const game=new Arena({onEvent:e=>{send({type:'effect',event:e});}}).start({seed:hash(claims.jti),skin:claims.skin,name:claims.name});game.bots=[];game.food=[];
  let x=0,y=0,angle=0;
  for(let i=0;i<60;i++){const a=this.rng()*TAU,r=this.rng()*1000;x=Math.cos(a)*r;y=Math.sin(a)*r;angle=wrap(a+Math.PI);if([...this.players.values()].every(p=>p.game.player.points.every(q=>Math.hypot(x-q.x,y-q.y)>180)))break;}
  game.player=game.snake(x,y,angle,110,SKINS.find(s=>s.id===claims.skin)||SKINS[0],claims.name,true);game.player.safe=4;
  const p={claims,game,send,angle,boost:false,lastInput:this.now(),seq:-1,startedAt:this.now(),full:true};this.players.set(claims.sub,p);return p;
 }
 input(sub,message){const p=this.players.get(sub);if(!p)return;
  if(!Number.isInteger(message.seq)||message.seq<=p.seq||message.seq>1e9||!Number.isFinite(message.angle)||Math.abs(message.angle)>TAU||typeof message.boost!=='boolean'||message.phase!==undefined&&typeof message.phase!=='boolean')throw Error('Lệnh điều khiển không hợp lệ.');
  p.seq=message.seq;p.angle=message.angle;p.boost=message.boost;p.lastInput=this.now();if(message.phase)p.game.phaseDash();
 }
 finish(sub,reason){const p=this.players.get(sub);if(!p)return;this.players.delete(sub);p.game.status='over';p.game.reason=reason;
  const g=p.game,endedAt=this.now(),result={sub,room:this.code,runId:p.claims.jti,name:p.claims.name,score:g.score,kills:g.kills,elapsed:Math.min(180,g.elapsed),maxCombo:g.maxCombo,startedAt:p.startedAt,endedAt,reason};
  p.send({type:'over',...result,recorded:null});
  // Retry max-score writes are idempotent, so a lost response cannot inflate scores.
  Promise.resolve(this.onFinish(result)).then(()=>p.send({type:'record',recorded:true})).catch(()=>p.send({type:'record',recorded:false}));
  const before=this.pool.food.length;for(let i=0;i<g.player.points.length;i+=3){const q=g.player.points[i];this.pool.addFood(q.x,q.y,3,'loot');}this.added.push(...this.pool.food.slice(before));
 }
 tick(dt=1/30){
  dt=Math.min(dt,1/30);this.elapsed+=dt;this.pool.elapsed=this.elapsed;
  const first=this.players.values().next().value;
  if(first){this.pool.player=first.game.player;const before=new Set(this.pool.food.map(f=>f.id));this.pool.eventStep();const after=new Set(this.pool.food.map(f=>f.id));this.added.push(...this.pool.food.filter(f=>!before.has(f.id)));for(const id of before)if(!after.has(id))this.removed.push(id);this.event=this.pool.event;}
  const actors=[...this.players.values()],dead=new Map(),grid=new Map(),cell=64;
  const near=(x,y)=>{const out=[],cx=Math.floor(x/cell),cy=Math.floor(y/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)out.push(...(grid.get((cx+dx)+','+(cy+dy))||[]));return out;};
  for(const p of actors){
   const g=p.game;g.elapsed+=dt;g.event=this.event;for(const k of ['phase','cooldown','fever','feverLock'])g[k]=Math.max(0,g[k]-dt);
   if(g.elapsed-g.lastEat>2.1){g.combo=1;g.streak=0;}
   const boosted=p.boost&&g.energy>1;g.energy=clamp(g.energy+(boosted?-28:17)*dt,0,100);g.move(g.player,p.angle,boosted,dt);
   if(this.now()-p.lastInput>10000)dead.set(p.claims.sub,{reason:'away'});else if(g.elapsed>=180)dead.set(p.claims.sub,{reason:'time'});else if(Math.hypot(g.player.x,g.player.y)>g.radius-g.size(g.player))dead.set(p.claims.sub,{reason:'edge'});
   for(let i=0;i<g.player.points.length;i+=2){const q=g.player.points[i],key=Math.floor(q.x/cell)+','+Math.floor(q.y/cell);let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push({p,x:q.x,y:q.y});}
  }
  for(const p of actors){const g=p.game,s=g.player;if(dead.has(p.claims.sub)||s.safe>0||g.phase>0)continue;
   let closest=Infinity;
   for(const q of near(s.x,s.y)){if(q.p===p)continue;const distance=Math.hypot(s.x-q.x,s.y-q.y),r=g.size(s)+g.size(q.p.game.player);closest=Math.min(closest,distance-r);if(distance<r*.85){if(s.shield>0){s.shield=0;s.safe=1.6;g.emit('shieldBreak');}else dead.set(p.claims.sub,{reason:'snake',killer:q.p});break;}}
   if(closest>0&&closest<15&&g.elapsed-s.nearAt>3){s.nearAt=g.elapsed;g.score+=35;g.emit('near',{x:s.x,y:s.y});}
  }
  // Resolve every earned takedown before sending any terminal score snapshot.
  for(const death of dead.values())if(death.killer){death.killer.game.kills++;death.killer.game.score+=180;death.killer.game.emit('kill',{name:'đối thủ',x:death.killer.game.player.x,y:death.killer.game.player.y});}
  for(const [sub,d]of dead)this.finish(sub,d.reason);
  const alive=[...this.players.values()];
  this.pool.food=this.pool.food.filter(f=>{
   for(const p of alive){const g=p.game,s=g.player,dx=f.x-s.x,dy=f.y-s.y,d=Math.hypot(dx,dy);if((s.magnet>0||this.event?.type==='magnet')&&d<190&&d>1){f.x-=dx/d*300*dt;f.y-=dy/d*300*dt;this.moved.set(f.id,f);}if(d<g.size(s)+8){g.collect(f);this.removed.push(f.id);return false;}}
   return true;
  });
  const before=this.pool.food.length;for(let i=0;i<3&&this.pool.food.length<520;i++)this.pool.addFood();this.added.push(...this.pool.food.slice(before));
  if(this.elapsed>=this.nextPickup){this.nextPickup+=16;if(this.pool.pickups.length<5){const a=this.rng()*TAU,r=this.rng()*1000;this.pool.pickups.push({id:++this.pool.id,type:this.rng()<.5?'shield':'magnet',x:Math.cos(a)*r,y:Math.sin(a)*r});}}
  this.pool.pickups=this.pool.pickups.filter(item=>{for(const p of alive){const g=p.game;if(Math.hypot(g.player.x-item.x,g.player.y-item.y)<g.size(g.player)+15){g.player[item.type]=8;g.emit('power',{power:item.type});return false;}}return true;});
 }
 snapshot(p){
  const g=p.game,s=g.player,round=n=>Math.round(n),food=f=>[f.id,round(f.x),round(f.y),f.value,f.type,f.hue];
  const snakes=[...this.players.values()].map(other=>{const a=other.game.player;return {id:other.claims.sub,x:round(a.x),y:round(a.y),angle:a.angle,mass:a.mass,skin:a.skin.id,name:a.name,safe:a.safe,shield:a.shield,magnet:a.magnet,phase:other.game.phase,boosting:a.boosting,points:a.points.filter((_,i)=>i%2===0).map(q=>[round(q.x),round(q.y)])};});
  const snapshot={type:'state',you:p.claims.sub,radius:1450,snakes,pickups:this.pool.pickups,event:this.event,stats:{score:g.score,kills:g.kills,eaten:g.eaten,maxCombo:g.maxCombo,combo:g.combo,elapsed:g.elapsed,energy:g.energy,phase:g.phase,cooldown:g.cooldown,fever:g.fever},food:p.full?{full:this.pool.food.map(food)}:{added:this.added.map(food),removed:this.removed,moved:[...this.moved.values()].map(food)}};
  p.full=false;return snapshot;
 }
 broadcast(){for(const p of this.players.values())p.send(this.snapshot(p));this.added=[];this.removed=[];this.moved.clear();}
}
