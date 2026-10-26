/* Original NCN ocean simulation. Rendering, browser storage and input stay outside. */
export const WORLD={width:1600,height:1000};
export const POPULATION={target:90,max:120,nearbyPrey:14};
export const LEVELS=[
  {name:'Rạn san hô',size:24,goal:90,sky:'#53d8ea',water:'#087fc0',deep:'#064b82',sand:'#bddbcc'},
  {name:'Vườn tảo ngọc',size:32,goal:150,sky:'#6be7d5',water:'#0c9eac',deep:'#06566d',sand:'#b8d4ae'},
  {name:'Vịnh nắng vàng',size:44,goal:230,sky:'#8ae3f3',water:'#249bd1',deep:'#0c5f9c',sand:'#e6dcc0'},
  {name:'Hoàng hôn tím',size:60,goal:330,sky:'#bdc5f4',water:'#6174c2',deep:'#284a90',sand:'#c4b8d7'},
  {name:'Biển sao lấp lánh',size:82,goal:460,sky:'#5ac8d0',water:'#126d9d',deep:'#073659',sand:'#94bdb8'},
  {name:'Vua đại dương',size:118,goal:8,sky:'#67d6f1',water:'#147cb9',deep:'#084875',sand:'#ccdbc4'}
];
export const FISH=[
  {size:8,color:'#8ceade',shade:'#159fab',fin:'#5fcfd0',name:'Cá bạc',speed:66},
  {size:13,color:'#f4d66c',shade:'#d49c38',fin:'#e1b149',name:'Cá nắng',speed:76},
  {size:19,color:'#87b8fb',shade:'#476bc2',fin:'#6988df',name:'Cá sọc xanh',speed:81},
  {size:27,color:'#f69aab',shade:'#cb5f86',fin:'#e17f9d',name:'Cá san hô',speed:88},
  {size:37,color:'#bee48c',shade:'#599e5d',fin:'#83bd75',name:'Cá lá',speed:91},
  {size:51,color:'#c0a5ec',shade:'#7562ac',fin:'#9d83d0',name:'Cá bướm',speed:94},
  {size:70,color:'#9dbac9',shade:'#476f8e',fin:'#6c90a8',name:'Cá mập',speed:105,shark:true},
  {size:104,color:'#7196b3',shade:'#2d506e',fin:'#517e9b',name:'Cá mập lớn',speed:94,shark:true},
  {size:12,color:'#ffb15f',shade:'#dc6239',fin:'#f59553',name:'Cá hề',speed:54,pattern:'clown'},
  {size:17,color:'#e8d7ff',shade:'#a68acb',fin:'#c3aff1',name:'Cá thiên thần',speed:58,body:'angel',pattern:'bands'},
  {size:24,color:'#ffe595',shade:'#d5a347',fin:'#edc960',name:'Cá bướm vàng',speed:64,body:'disc',pattern:'mask'},
  {size:32,color:'#fcb6cf',shade:'#c86b97',fin:'#df8fbb',name:'Cá hồng ngọc',speed:68,body:'disc',pattern:'pearls'},
  {size:43,color:'#85dfd7',shade:'#348eac',fin:'#77bbef',name:'Cá bàng chài',speed:76,body:'long',pattern:'ribbon'},
  {size:58,color:'#86b9ff',shade:'#3d65bb',fin:'#f4d46d',name:'Cá đuôi vàng',speed:83,body:'disc',pattern:'tang'}
];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function randomSource(seed=1){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let v=Math.imul(n^n>>>15,1|n);v^=v+Math.imul(v^v>>>7,61|v);return ((v^v>>>14)>>>0)/4294967296;};}
const finite=(n,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
export function cleanRecord(value={}){return {version:1,best:finite(value?.best,1e9),fish:finite(value?.fish,1e7),wins:finite(value?.wins,1e6),skin:['coral','aqua','violet'].includes(value?.skin)?value.skin:'coral',sound:value?.sound===true,reduced:value?.reduced===true};}
export function awardRecord(value,game){const p=cleanRecord(value);return {...p,best:Math.max(p.best,finite(game.score,1e9)),fish:p.fish+finite(game.eaten,1e6),wins:p.wins+(game.status==='won'?1:0)};}
export class Ocean{
  constructor({onEvent=()=>{}}={}){this.onEvent=onEvent;this.reset(20261025);this.status='ready';}
  reset(seed){
    this.rng=randomSource(seed);this.serial=0;this.status='playing';this.elapsed=0;this.level=0;this.xp=0;this.score=0;this.eaten=0;this.largeEaten=0;this.lives=3;this.energy=100;
    this.chain=0;this.combo=1;this.bestCombo=1;this.lastMeal=-99;this.fever=0;this.feverCooldown=0;this.dashTime=0;this.dashCooldown=0;this.safe=8;this.shield=0;this.bite=0;
    this.player={x:800,y:500,vx:0,vy:0,angle:0,face:1,size:LEVELS[0].size};this.fish=[];this.items=[];this.jellies=[];this.effects=[];this.labels=[];this.nextSwarm=14;this.nextItem=9;this.nextNursery=2;
    for(let i=0;i<72;i++)this.addFish({initial:true});
    // A few nearby minnows make the first meal teachable rather than random.
    for(let i=0;i<9;i++)this.addFish({tier:[0,8,1,9,2][i%5],x:900+i*34,y:500+Math.sin(i*1.8)*32,dir:1});
    while(this.fish.length<POPULATION.target)this.addFish({initial:true});this.ensurePrey();
    return this;
  }
  start(seed=(Date.now()^Math.floor(Math.random()*4294967295))>>>0){this.reset(seed);this.emit('start');return this;}
  emit(type,extra={}){this.onEvent({type,...extra});}
  get progress(){return this.level===5?clamp(this.largeEaten/8,0,1):clamp(this.xp/LEVELS[this.level].goal,0,1);}
  get goalText(){return this.level===5?'Ăn 8 cá lớn để làm vua đại dương':'Ăn cá nhỏ để lớn lên';}
  edible(fish){return fish.size<=this.player.size*.9;}
  dangerous(fish){return fish.size>this.player.size*1.12;}
  preyTiers(){return FISH.map((f,i)=>this.edible(f)?i:-1).filter(i=>i>=0);}
  pickPrey(){const tiers=this.preyTiers(),larger=tiers.filter(i=>FISH[i].size>=this.player.size*.3);const pool=this.rng()<.7&&larger.length?larger:tiers;return pool[Math.floor(this.rng()*pool.length)];}
  addFish({tier,x,y,dir,initial=false}={}){
    if(this.fish.length>=POPULATION.max)return null;
    if(tier===undefined){const roll=this.rng(),ceiling=[37,51,70,104,104,104][this.level],other=FISH.map((f,i)=>!this.edible(f)&&f.size<=ceiling&&(!f.shark||this.level>=2)?i:-1).filter(i=>i>=0);tier=roll<.82||!other.length?this.pickPrey():other[Math.floor(this.rng()*other.length)];}
    tier=clamp(Math.floor(tier),0,FISH.length-1);const species=FISH[tier];dir=dir|| (this.rng()<.5?1:-1);
    x=x??(initial?this.rng()*WORLD.width:dir===1?-120:WORLD.width+120);y=y??(115+this.rng()*730);
    if(initial&&this.dangerous(species)&&Math.hypot(x-this.player.x,y-this.player.y)<420)x=x<this.player.x?-100:WORLD.width+100;
    const item={id:++this.serial,tier,size:species.size,x,y,angle:dir===1?0:Math.PI,face:dir,baseY:y,speed:species.speed*(.72+this.rng()*.2),phase:this.rng()*Math.PI*2};this.fish.push(item);return item;
  }
  ensurePrey(){
    const p=this.player,near=this.fish.filter(f=>this.edible(f)&&Math.hypot(f.x-p.x,f.y-p.y)<430).length;
    for(let i=near;i<POPULATION.nearbyPrey;i++){
      if(this.fish.length>=POPULATION.max){const far=this.fish.findIndex(f=>Math.hypot(f.x-p.x,f.y-p.y)>550);if(far<0)break;this.fish.splice(far,1);}
      const a=this.rng()*Math.PI*2,r=150+this.rng()*240;this.addFish({tier:this.pickPrey(),x:clamp(p.x+Math.cos(a)*r,65,1535),y:clamp(p.y+Math.sin(a)*r,135,865),dir:this.rng()<.5?1:-1});
    }
  }
  pause(){if(this.status!=='playing')return false;this.status='paused';return true;}
  resume(){if(this.status!=='paused')return false;this.status='playing';return true;}
  dash(){if(this.status!=='playing'||this.energy<28||this.dashCooldown>0)return false;this.energy-=28;this.dashTime=.55;this.dashCooldown=1.8;this.emit('dash');return true;}
  burst(x,y,color,n=10){for(let i=0;i<n&&this.effects.length<140;i++){const a=this.rng()*Math.PI*2,s=25+this.rng()*85;this.effects.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+this.rng()*.5,max:1,color,size:2+this.rng()*3});}}
  label(x,y,text,color='#fff7bb'){this.labels.push({x,y,text,color,life:1.1});if(this.labels.length>18)this.labels.shift();}
  eat(fish){
    if(this.status!=='playing'||!this.edible(fish))return false;
    const at=this.fish.indexOf(fish);if(at<0)return false;this.fish.splice(at,1);this.eaten++;this.bite=.25;
    this.chain=this.elapsed-this.lastMeal<=3.3?this.chain+1:1;this.lastMeal=this.elapsed;this.combo=Math.min(5,1+Math.floor((this.chain-1)/3));this.bestCombo=Math.max(this.bestCombo,this.combo);
    if(this.chain>=12&&this.feverCooldown<=0){this.fever=7;this.feverCooldown=24;this.emit('fever');}
    const points=Math.round((12+fish.size*1.8)*this.combo*(this.fever>0?2:1));this.score+=points;
    this.burst(fish.x,fish.y,FISH[fish.tier].color,9);this.label(fish.x,fish.y-10,'+'+points);this.emit('eat',{points,tier:fish.tier});
    if(this.level===5){if(fish.size>=51){this.largeEaten++;if(this.largeEaten>=8)this.finish(true);}}
    else this.grow(Math.round(3+fish.size*.32));
    return true;
  }
  grow(amount){
    if(this.status!=='playing'||this.level===5)return;
    this.xp+=amount;
    while(this.level<5&&this.xp>=LEVELS[this.level].goal){
      this.xp-=LEVELS[this.level].goal;this.level++;this.player.size=LEVELS[this.level].size;this.safe=Math.max(this.safe,4);this.energy=100;
      this.burst(this.player.x,this.player.y,'#fff5a9',30);this.emit('level',{level:this.level});
      this.restock();
    }
  }
  restock(){
    // Growing actually unlocks larger prey; the whole ecosystem doesn't grow with you.
    this.fish=this.fish.filter(f=>Math.hypot(f.x-this.player.x,f.y-this.player.y)<750).slice(0,75);
    while(this.fish.length<POPULATION.target)this.addFish({initial:true});this.ensurePrey();
    while(this.jellies.length<Math.min(4,this.level))this.jellies.push({x:120+this.rng()*1360,y:240+this.rng()*520,phase:this.rng()*6,size:22});
  }
  hit(source){
    if(this.status!=='playing'||this.safe>0)return false;
    if(this.shield>0){this.shield=0;this.safe=1.7;this.emit('shield');this.burst(this.player.x,this.player.y,'#88f4ff',20);return false;}
    this.lives--;this.safe=4;this.chain=0;this.combo=1;this.fever=0;this.xp=Math.max(0,this.xp-4);
    const dx=this.player.x-source.x,dy=this.player.y-source.y,n=Math.hypot(dx,dy)||1;
    this.player.x=clamp(this.player.x+dx/n*85,50,1550);this.player.y=clamp(this.player.y+dy/n*85,90,915);this.player.vx=dx/n*160;this.player.vy=dy/n*160;
    this.burst(this.player.x,this.player.y,'#ffd9da',20);this.emit('hit',{lives:this.lives});
    if(this.lives<=0)this.finish(false);return true;
  }
  collect(item){
    if(this.status!=='playing')return false;const index=this.items.indexOf(item);if(index<0)return false;this.items.splice(index,1);
    if(item.type==='shield'){this.shield=10;this.label(item.x,item.y,'Lá chắn','#a0f1ff');}
    else if(item.type==='heart'){this.lives=Math.min(3,this.lives+1);this.label(item.x,item.y,'+1 mạng','#ffb7c7');}
    else{this.score+=150;this.energy=Math.min(100,this.energy+35);this.label(item.x,item.y,'+150','#fff5a9');}
    this.burst(item.x,item.y,'#ffedac',15);this.emit('pickup',{kind:item.type});return true;
  }
  finish(won){if(this.status!=='playing')return;this.status=won?'won':'over';this.emit(this.status);}
  step(seconds,input={}){
    if(this.status!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
    const dt=Math.min(seconds,.05);this.elapsed+=dt;this.safe=Math.max(0,this.safe-dt);this.shield=Math.max(0,this.shield-dt);this.dashTime=Math.max(0,this.dashTime-dt);this.dashCooldown=Math.max(0,this.dashCooldown-dt);this.fever=Math.max(0,this.fever-dt);this.feverCooldown=Math.max(0,this.feverCooldown-dt);this.bite=Math.max(0,this.bite-dt);this.energy=Math.min(100,this.energy+dt*15);
    if(this.elapsed-this.lastMeal>3.3){this.chain=0;this.combo=1;}
    const p=this.player;let dx=Number.isFinite(input.x)?input.x:0,dy=Number.isFinite(input.y)?input.y:0,n=Math.hypot(dx,dy);if(n>1){dx/=n;dy/=n;}
    const speed=(220-this.level*4)*(this.dashTime>0?1.8:1),blend=1-Math.exp(-dt*12);
    p.vx+=(dx*speed-p.vx)*blend;p.vy+=(dy*speed-p.vy)*blend;p.x=clamp(p.x+p.vx*dt,45,1555);p.y=clamp(p.y+p.vy*dt,90,920);
    if(Math.abs(p.vx)>8)p.face=p.vx>0?1:-1;p.angle=clamp(Math.atan2(p.vy,Math.abs(p.vx)+60)*.45,-.55,.55)*p.face;
    for(const f of this.fish){
      const distance=Math.hypot(f.x-p.x,f.y-p.y);let aim=f.face===1?0:Math.PI;
      if(this.edible(f)&&distance<70)aim=Math.atan2(f.y-p.y,f.x-p.x);
      else if(this.dangerous(f)&&distance<170&&this.safe<=0&&this.level>0&&this.elapsed>18)aim=Math.atan2(p.y-f.y,p.x-f.x);
      let delta=Math.atan2(Math.sin(aim-f.angle),Math.cos(aim-f.angle));f.angle+=clamp(delta,-dt*1.7,dt*1.7);
      f.x+=Math.cos(f.angle)*f.speed*dt;f.y+=Math.sin(f.angle)*f.speed*dt+Math.sin(this.elapsed*1.2+f.phase)*dt*7;f.y=clamp(f.y,100,910);f.face=Math.cos(f.angle)>=0?1:-1;
    }
    this.fish=this.fish.filter(f=>f.x>-220&&f.x<WORLD.width+220);
    for(const f of [...this.fish]){
      if(this.status!=='playing')break;
      const distance=Math.hypot(f.x-p.x,f.y-p.y);
      if(this.edible(f)){if(distance<(p.size+f.size)*.98)this.eat(f);}
      else if(this.dangerous(f)&&distance<(p.size+f.size)*.6)this.hit(f);
    }
    for(const j of this.jellies){j.x=clamp(j.x+Math.sin(this.elapsed*.3+j.phase)*dt*9,65,1535);if(Math.hypot(p.x-j.x,p.y-(j.y+Math.sin(this.elapsed+j.phase)*12))<p.size*.65+j.size*.7)this.hit(j);}
    for(const item of [...this.items])if(Math.hypot(item.x-p.x,item.y-p.y)<p.size+18)this.collect(item);
    if(this.status!=='playing')return;
    if(this.elapsed>=this.nextSwarm){
      this.nextSwarm+=22;const right=this.rng()>.5;
      for(let i=0;i<9;i++)this.addFish({tier:this.pickPrey(),x:clamp(p.x+(right?1:-1)*(240+i*27),40,1560),y:clamp(p.y+Math.sin(i)*65,130,870),dir:right?-1:1});
      this.emit('swarm');
    }
    if(this.elapsed>=this.nextItem){
      this.nextItem+=18;
      if(this.items.length<3)this.items.push({id:++this.serial,x:clamp(p.x+(this.rng()-.5)*600,120,1480),y:clamp(p.y+(this.rng()-.5)*450,160,850),type:this.lives<3&&this.rng()<.45?'heart':this.rng()<.45?'shield':'pearl',phase:this.rng()*6});
    }
    while(this.fish.length<POPULATION.target)this.addFish();
    if(this.elapsed>=this.nextNursery){this.nextNursery=this.elapsed+2;this.ensurePrey();}
    for(const e of this.effects){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=20*dt;e.life-=dt;}this.effects=this.effects.filter(e=>e.life>0);
    for(const e of this.labels){e.y-=dt*32;e.life-=dt;}this.labels=this.labels.filter(e=>e.life>0);
  }
}
