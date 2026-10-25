/* Deterministic arena simulation. Rendering, accounts and storage live outside this module. */
export const TAU = Math.PI * 2;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const SKINS = [
  {id:'mint', name:'Ngọc lục bảo', color:'#61f5cb', dark:'#167d76', xp:0},
  {id:'blue', name:'Sóng NCN', color:'#79bdff', dark:'#315fbe', xp:0},
  {id:'coral', name:'Hoàng hôn', color:'#ffb18b', dark:'#b74e65', xp:350},
  {id:'violet', name:'Tinh vân', color:'#c6a2ff', dark:'#7050aa', xp:1000},
  {id:'gold', name:'Vương miện', color:'#ffe196', dark:'#b68432', xp:2400}
];
export function hash(text) { let n=2166136261; for(const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
export function random(seed=1) { let n=seed>>>0; return ()=>{n+=0x6D2B79F5; let t=n; t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
export function vietnamDate(date=new Date()) { const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); return ['year','month','day'].map(t=>p.find(x=>x.type===t).value).join('-'); }
export function challengeDate(value) { if(!/^20\d\d-\d\d-\d\d$/.test(value||''))return ''; const d=new Date(value+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value?value:''; }
export function cleanProfile(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const integer=(n,max=1e9)=>Number.isFinite(n)?Math.floor(clamp(n,0,max)):0;
  return {best:integer(value.best),daily:integer(value.daily),date:challengeDate(value.date),xp:integer(value.xp),runs:integer(value.runs),skin:SKINS.some(s=>s.id===value.skin&&s.xp<=integer(value.xp))?value.skin:'mint',muted:value.muted!==false,reduced:typeof value.reduced==='boolean'?value.reduced:null};
}
export function awardProfile(profile,run,date) {
  const p=cleanProfile(profile),score=Math.floor(Math.max(0,run.score||0));
  p.runs++;p.xp+=Math.min(400,Math.floor(score/9)+(run.kills||0)*12+Math.floor((run.elapsed||0)/8));
  if(run.mode==='daily'){if(p.date!==date){p.date=date;p.daily=0;}p.daily=Math.max(p.daily,score);}else p.best=Math.max(p.best,score);
  return p;
}
class Grid {
  constructor(size=64){this.size=size;this.cells=new Map();}
  add(x,y,value){const key=Math.floor(x/this.size)+','+Math.floor(y/this.size);let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=[]);cell.push(value);}
  near(x,y){const result=[],cx=Math.floor(x/this.size),cy=Math.floor(y/this.size);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const cell=this.cells.get((cx+dx)+','+(cy+dy));if(cell)result.push(...cell);}return result;}
}
const NAMES=['Trà Sữa','Mì Tôm','Cáo Nhỏ','Lười Nhưng Lì','Bánh Mì','Mèo Mun','Tí Hon','Ớt Hiểm','Mây Lang Thang','Cú Đêm','Rồng Con','Bơ Bơ'];
export class Arena {
  constructor({onEvent=()=>{}}={}) {this.onEvent=onEvent;this.radius=1450;this.status='ready';}
  emit(type,extra={}) {this.onEvent({type,...extra});}
  start({seed=Date.now(),mode='arena',skin='mint',name='Bạn'}={}) {
    this.rng=random(seed);this.mode=mode==='daily'?'daily':'arena';this.elapsed=0;this.score=0;this.kills=0;this.eaten=0;this.maxCombo=1;this.combo=1;this.streak=0;this.lastEat=-9;this.fever=0;this.feverLock=0;this.phase=0;this.cooldown=0;this.energy=100;this.event=null;this.cycle=-1;this.nextPickup=10;this.id=0;this.food=[];this.pickups=[];this.bots=[];this.status='playing';this.reason='';
    this.player=this.snake(0,0,0,110,SKINS.find(x=>x.id===skin)||SKINS[0],name,true);this.player.safe=4;
    for(let i=0;i<10;i++)this.bots.push(this.spawnBot(i));
    for(let i=0;i<650;i++)this.addFood();
    // An inviting first trail: the first reward is within a second of moving.
    for(let i=0;i<22;i++){const x=90+i*24,y=Math.sin(i*.27)*48;this.addFood(x,y,2);}
    this.pickups.push({id:++this.id,type:'shield',x:650,y:130});
    return this;
  }
  snake(x,y,angle,mass,skin,name,player=false) {
    const s={id:++this.id,x,y,angle,mass,skin,name,player,alive:true,points:[],safe:2,shield:0,magnet:0,brain:0,wander:angle,boost:false,respawn:0,nearAt:-10};
    const count=Math.ceil((150+mass*.43)/6);
    for(let i=0;i<count;i++)s.points.push({x:x-Math.cos(angle)*i*6,y:y-Math.sin(angle)*i*6});
    return s;
  }
  spawnBot(index) {
    let x,y;for(let i=0;i<30;i++){const a=this.rng()*TAU,r=400+this.rng()*740;x=Math.cos(a)*r;y=Math.sin(a)*r;if(Math.hypot(x-this.player.x,y-this.player.y)>390)break;}
    return this.snake(x,y,Math.atan2(-y,-x)+(this.rng()-.5)*2,160+this.rng()*650,SKINS[index%SKINS.length],NAMES[index%NAMES.length]);
  }
  size(s) {return 10+Math.min(9,Math.sqrt(s.mass)*.2);}
  addFood(x,y,value=1,type='nectar') {
    if(this.food.length>=1000)return;
    if(x===undefined){const a=this.rng()*TAU,r=Math.sqrt(this.rng())*(this.radius-90);x=Math.cos(a)*r;y=Math.sin(a)*r;}
    const distance=Math.hypot(x,y),limit=this.radius-35;if(distance>limit){x*=limit/distance;y*=limit/distance;}
    this.food.push({id:++this.id,x,y,value,type,hue:Math.floor(this.rng()*5)});
  }
  phaseDash() {
    if(this.status!=='playing'||this.cooldown>0)return false;
    this.phase=1.15;this.cooldown=13;this.emit('phase',{x:this.player.x,y:this.player.y});return true;
  }
  pause() {if(this.status==='playing')this.status='paused';}
  resume() {if(this.status==='paused')this.status='playing';}
  finish(reason) {if(this.status!=='playing')return;this.status='over';this.reason=reason;this.emit('over',{reason,x:this.player.x,y:this.player.y});}
  collect(food) {
    if(this.elapsed-this.lastEat>2.1)this.streak=0;
    this.streak++;this.lastEat=this.elapsed;this.combo=Math.min(5,1+Math.floor(this.streak/6));this.maxCombo=Math.max(this.maxCombo,this.combo);this.eaten++;
    const points=Math.round(food.value*10*this.combo*(this.fever>0?2:1)*(this.event?.type==='bloom'?2:1));
    this.score+=points;this.player.mass=Math.min(2000,this.player.mass+food.value*1.8);this.energy=clamp(this.energy+food.value*2,0,100);
    this.emit('eat',{x:food.x,y:food.y,points,core:food.type==='core'});
    if(food.type==='core'){this.cooldown=0;this.score+=250;this.emit('core',{x:food.x,y:food.y});}
    if(this.streak>=18&&this.fever<=0&&this.feverLock<=0){this.fever=7;this.feverLock=18;this.emit('fever');}
  }
  kill(s,killer=null) {
    if(!s.alive)return;s.alive=false;s.respawn=3;
    if(s.player){this.finish('snake');return;}
    for(let i=0;i<s.points.length;i+=3)this.addFood(s.points[i].x,s.points[i].y,3,'loot');
    if(killer?.player){this.kills++;this.score+=180;this.energy=clamp(this.energy+25,0,100);this.emit('kill',{name:s.name,x:s.x,y:s.y});}
  }
  eventStep() {
    const cycle=Math.floor(this.elapsed/35),at=this.elapsed%35;
    if(at>=20&&this.cycle!==cycle){
      this.cycle=cycle;const type=['bloom','core','magnet'][cycle%3];this.event={type,remaining:12};
      if(type==='bloom')for(let i=0;i<70;i++){const a=this.rng()*TAU,r=100+this.rng()*380;this.addFood(this.player.x+Math.cos(a)*r,this.player.y+Math.sin(a)*r,2);}
      if(type==='core')this.addFood(0,0,15,'core');
      this.emit('event',{event:type});
    }
    if(this.event){this.event.remaining=32-at;if(at<20||at>=32){this.event=null;this.food=this.food.filter(f=>f.type!=='core');}}
  }
  steerBot(s,grid,dt) {
    s.brain-=dt;if(s.brain>0)return;s.brain=.16+this.rng()*.1;
    let tx=Math.cos(s.wander),ty=Math.sin(s.wander),nearest=500*500;
    if(this.rng()<.09)s.wander=wrap(s.wander+(this.rng()-.5)*2);
    for(let i=Math.floor(this.rng()*4);i<this.food.length;i+=4){const f=this.food[i],d=(f.x-s.x)**2+(f.y-s.y)**2;if(d<nearest){nearest=d;const length=Math.sqrt(d)||1;tx=(f.x-s.x)/length;ty=(f.y-s.y)/length;}}
    if(Math.hypot(s.x,s.y)>this.radius-240){tx=-s.x/400;ty=-s.y/400;}
    for(const p of grid.near(s.x+Math.cos(s.angle)*65,s.y+Math.sin(s.angle)*65)){
      if(p.s===s)continue;const dx=s.x-p.x,dy=s.y-p.y,d=Math.hypot(dx,dy);if(d<105&&d>0){tx+=dx/d*(105-d)*.14;ty+=dy/d*(105-d)*.14;}
    }
    s.target=Math.atan2(ty,tx);s.boost=this.rng()<.12&&nearest<150**2&&s.mass>170;
  }
  move(s,target,boost,dt) {
    const phase=s.player&&this.phase>0;
    const rate=phase?5.5:3.1;const change=clamp(wrap(target-s.angle),-rate*dt,rate*dt);s.angle=wrap(s.angle+change);
    const speed=(s.player?155:130)+(boost?95:0)+(phase?135:0)-(Math.min(s.mass,1500)/1500)*18;
    s.x+=Math.cos(s.angle)*speed*dt;s.y+=Math.sin(s.angle)*speed*dt;s.boosting=boost||phase;
    s.safe=Math.max(0,s.safe-dt);s.shield=Math.max(0,s.shield-dt);s.magnet=Math.max(0,s.magnet-dt);
    const p=s.points[0];if(!p||Math.hypot(p.x-s.x,p.y-s.y)>=5.5)s.points.unshift({x:s.x,y:s.y});
    const max=Math.ceil((150+s.mass*.43)/6);if(s.points.length>max)s.points.length=max;
  }
  step(dt,input={}) {
    if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);this.elapsed+=dt;
    for(const key of ['phase','cooldown','fever','feverLock'])this[key]=Math.max(0,this[key]-dt);
    if(this.elapsed-this.lastEat>2.1){this.combo=1;this.streak=0;}
    this.eventStep();
    if(this.elapsed>=this.nextPickup){this.nextPickup+=16;if(this.pickups.length<5){const a=this.rng()*TAU,r=this.rng()*1000;this.pickups.push({id:++this.id,type:this.rng()<.5?'shield':'magnet',x:Math.cos(a)*r,y:Math.sin(a)*r});}}
    let grid=new Grid();for(const s of [this.player,...this.bots])if(s.alive)for(let i=0;i<s.points.length;i+=2)grid.add(s.points[i].x,s.points[i].y,{...s.points[i],s});
    const boosting=!!input.boost&&this.energy>1;
    this.energy=clamp(this.energy+(boosting?-28:17)*dt,0,100);
    this.move(this.player,Number.isFinite(input.angle)?input.angle:this.player.angle,boosting,dt);
    for(const s of this.bots){if(!s.alive){s.respawn-=dt;if(s.respawn<=0)Object.assign(s,this.spawnBot(this.bots.indexOf(s)));continue;}this.steerBot(s,grid,dt);this.move(s,s.target??s.angle,s.boost,dt);}
    const dead=[];
    for(const s of [this.player,...this.bots]){
      if(!s.alive)continue;
      if(Math.hypot(s.x,s.y)>this.radius-this.size(s)){
        if(s.player){this.finish('edge');return;}dead.push([s,null]);continue;
      }
      if(s.safe>0||s.player&&this.phase>0)continue;
      let closest=Infinity;
      for(const p of grid.near(s.x,s.y)){
        if(p.s===s||!p.s.alive)continue;const d=Math.hypot(s.x-p.x,s.y-p.y),r=this.size(s)+this.size(p.s);closest=Math.min(closest,d-r);
        if(d<r*.85){if(s.player&&s.shield>0){s.shield=0;s.safe=1.6;this.emit('shieldBreak');break;}dead.push([s,p.s]);break;}
      }
      if(s.player&&closest>0&&closest<15&&this.elapsed-s.nearAt>3){s.nearAt=this.elapsed;this.score+=35;this.emit('near',{x:s.x,y:s.y});}
    }
    // Resolve earned points before the terminal event snapshots this run.
    for(const [s,killer]of dead)if(!s.player)this.kill(s,killer);
    for(const [s,killer]of dead)if(s.player)this.kill(s,killer);
    if(this.status!=='playing')return;
    const magnet=this.player.magnet>0||this.event?.type==='magnet';
    this.food=this.food.filter(f=>{
      const dx=f.x-this.player.x,dy=f.y-this.player.y,d=Math.hypot(dx,dy);
      if(magnet&&d<190&&d>1){f.x-=dx/d*300*dt;f.y-=dy/d*300*dt;}
      if(d<this.size(this.player)+8){this.collect(f);return false;}
      for(const s of this.bots)if(s.alive&&Math.hypot(s.x-f.x,s.y-f.y)<this.size(s)+5){s.mass=Math.min(1700,s.mass+f.value*1.5);return false;}
      return true;
    });
    for(let i=0;i<4&&this.food.length<650;i++)this.addFood();
    this.pickups=this.pickups.filter(p=>{if(Math.hypot(p.x-this.player.x,p.y-this.player.y)>this.size(this.player)+15)return true;this.player[p.type]=8;this.emit('power',{power:p.type});return false;});
    if(this.mode==='daily'&&this.elapsed>=180)this.finish('time');
  }
}
