/* Original NCN classic ocean. Pure simulation; no browser, account or storage access. */
export const WORLD={width:1280,height:800};
export const STAGE_COUNT=200;
export const POPULATION={target:12,max:22,nearbyPrey:3};
export function difficultyForStage(index){
 const t=Math.min(1,Math.max(0,Number.isFinite(index)?index/(STAGE_COUNT-1):0));
 return {target:12+Math.floor(t*8),predators:1+Math.floor(t*4),fishSpeed:1+t*1.3,spawnGap:1.15-t*.45,protection:6-t*3.5,growthProtection:1.4-t*.6,itemGap:26+t*6,swarmGap:32-t*6,sharkGap:32-t*10,warning:1.8-t*.5,jellies:index>=160?3:index>=90?2:index>=20?1:0};
}
const PALETTES=[
 {sky:'#70e1ee',water:'#199dd0',deep:'#086398',sand:'#e5d8a6'},
 {sky:'#87ecdb',water:'#1aabae',deep:'#096d82',sand:'#ddd6a0'},
 {sky:'#a4ddfb',water:'#339fd2',deep:'#155a9b',sand:'#e5d3ae'},
 {sky:'#bdc9f7',water:'#697bc7',deep:'#344488',sand:'#c8b3bd'},
 {sky:'#66dce8',water:'#2188b8',deep:'#0a477e',sand:'#c8d8bf'},
 {sky:'#75d7ef',water:'#187eaf',deep:'#083c70',sand:'#e1d5ad'}
];
export const CHARACTERS=[
 {name:'Cá thiên thần',body:'angel',pattern:'bands',color:'#ffbe69',shade:'#d87535',fin:'#f29d45'},
 {name:'Cá sư tử',body:'lion',pattern:'bands',color:'#efae75',shade:'#b96056',fin:'#f4c7a0'},
 {name:'Cá nóc',body:'puffer',pattern:'pearls',color:'#f4d974',shade:'#b89e43',fin:'#e8b75e'},
 {name:'Cá săn biển',body:'long',pattern:'ribbon',color:'#75d9d7',shade:'#318baf',fin:'#4aa3bd'},
 {name:'Cá voi sát thủ',body:'orca',pattern:'orca',color:'#375365',shade:'#142c43',fin:'#283f54'}
];
const REGIONS=['Rạn san hô','Vườn tảo ngọc','Vịnh ngọc trai','Biển hoàng hôn','Biển sao lấp lánh','Vua đại dương'];
const MENUS=[[0,8,9],[1,10,11],[2,3,12],[10,13,5],[4,6,7]];
export const LEVELS=Array.from({length:STAGE_COUNT},(_,index)=>{
 const chapter=Math.floor(index/40),region=Math.min(5,Math.floor(index/34)),final=index===STAGE_COUNT-1;
 const sizes=final?[42,88,156]:[24+chapter*3,40+chapter*4,66+chapter*6];
 return {...PALETTES[region],name:REGIONS[region],title:final?'Vua cá mập':REGIONS[region]+' · Màn '+(index+1),chapter,menu:[...MENUS[chapter]],sizes,size:sizes[0],bands:final?[24,54,96]:[13+chapter*2,28+chapter*3,48+chapter*4],goal:90+Math.floor(index*.45),difficulty:difficultyForStage(index),final};
});
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
export function cleanRecord(value={}){const unlocked=value?.version===2&&value.unlocked===40&&Number.isFinite(value.wins)&&value.wins>0?41:Math.max(1,finite(value?.unlocked,STAGE_COUNT));return {version:3,best:finite(value?.best,1e9),fish:finite(value?.fish,1e7),wins:finite(value?.wins,1e6),skin:['coral','aqua','violet'].includes(value?.skin)?value.skin:'coral',sound:value?.sound===true,reduced:value?.reduced===true,unlocked};}
export function awardRecord(value,game){const p=cleanRecord(value);return {...p,best:Math.max(p.best,finite(game.score,1e9)),fish:p.fish+finite(game.eaten,1e6),wins:p.wins+(game.status==='won'?1:0),unlocked:Math.max(p.unlocked,Math.min(STAGE_COUNT,finite(game.level,STAGE_COUNT-1)+1+(game.status==='cleared'?1:0)))};}
export class Ocean{
 constructor({onEvent=()=>{}}={}){this.onEvent=onEvent;this.reset(20261030);this.status='ready';}
 reset(seed,level=0){
  this.rng=randomSource(seed);this.serial=0;this.elapsed=0;this.score=0;this.eaten=0;this.lives=3;this.chain=0;this.combo=1;this.bestCombo=1;this.lastMeal=-99;this.fever=0;this.feverCooldown=0;
  this.effects=[];this.labels=[];this.player={x:640,y:400,vx:0,vy:0,angle:0,face:1,size:24};this.prepareLevel(Number.isSafeInteger(level)?clamp(level,0,STAGE_COUNT-1):0);return this;
 }
 start(seed=(Date.now()^Math.floor(Math.random()*4294967295))>>>0,level=0){this.reset(seed,level);this.emit('start');return this;}
 emit(type,extra={}){this.onEvent({type,...extra});}
 get config(){return LEVELS[this.level];}
 get difficulty(){return this.config.difficulty;}
 get progress(){return clamp(this.xp/this.config.goal,0,1);}
 get goalText(){return this.config.final&&this.growth===2?'Đã đủ lớn! Ăn vua cá mập để chiến thắng.':['Ăn cá nhỏ để lớn lần 1','Ăn được cá vừa · Lớn thêm lần nữa','Ăn được cả 3 loài · Ăn đầy thanh để qua màn'][this.growth];}
 get suctionUnlocked(){return this.level>=8;}
 get character(){return CHARACTERS[this.config.chapter];}
 prepareLevel(level){
  this.level=level;this.status='playing';this.xp=0;this.growth=0;this.levelElapsed=0;this.stageHits=0;this.energy=100;this.safe=this.difficulty.protection;this.shield=0;this.bite=0;this.freeze=0;this.speedBoost=0;this.sucking=false;this.suctionExhausted=false;this.dashTime=0;this.dashCooldown=0;this.bossEaten=false;
  this.chain=0;this.combo=1;this.fever=0;this.feverCooldown=0;this.lastMeal=-99;this.player={x:WORLD.width/2,y:WORLD.height/2,vx:0,vy:0,angle:0,face:1,size:this.config.sizes[0]};
  this.fish=[];this.items=[];this.jellies=[];this.effects=[];this.labels=[];this.nextSwarm=24;this.nextItem=18;this.nextArrival=1.2;this.nextShark=22;
  this.oyster=level>=4?{x:WORLD.width*.24,y:WORLD.height-115,open:true,nextPearl:9}:null;
  for(let i=0;i<this.difficulty.target-3;i++)this.addFish({initial:true});
  for(let i=0;i<3;i++)this.addFish({band:0,x:760+i*100,y:400+Math.sin(i*1.8)*21,dir:-1});
  for(let i=0;i<this.difficulty.jellies;i++)this.jellies.push({x:[190,1060,640][i],y:[240,580,165][i],phase:this.rng()*6,size:19});
 }
 nextLevel(){if(this.status!=='cleared'||this.level>=STAGE_COUNT-1)return false;this.prepareLevel(this.level+1);this.emit('stage',{level:this.level});return true;}
 edible(fish){return fish.size<=this.player.size*.9;}
 dangerous(fish){return fish.size>this.player.size*1.12;}
 preyTiers(){return this.config.menu.slice(0,this.growth+1);}
 pickPrey(){const pool=this.preyTiers();return pool[this.rng()<.65?pool.length-1:Math.floor(this.rng()*pool.length)];}
 addFish({tier,band,x,y,dir,initial=false,kind='fish',size}={}){
  if(this.fish.length>=POPULATION.max)return null;
  if(tier===undefined){
   if(band===undefined){const threats=this.fish.filter(f=>this.dangerous(f)).length;band=this.rng()<.77||this.growth===2||threats>=this.difficulty.predators?Math.floor(this.rng()*(this.growth+1)):Math.min(2,this.growth+1+Math.floor(this.rng()*(2-this.growth)));}
   tier=this.config.menu[clamp(band,0,2)];
  }
  tier=clamp(Math.floor(tier),0,FISH.length-1);if(band===undefined)band=this.config.menu.indexOf(tier);
  const species=FISH[tier],actualSize=size??(band>=0?this.config.bands[band]:species.size);dir=dir|| (this.rng()<.5?1:-1);
  x=x??(initial?65+this.rng()*(WORLD.width-130):dir===1?-100:WORLD.width+100);y=y??(145+this.rng()*(WORLD.height-280));
  if(initial&&this.dangerous({size:actualSize})&&Math.hypot(x-this.player.x,y-this.player.y)<390)x=x<this.player.x?-85:WORLD.width+85;
  const item={id:++this.serial,tier,band,size:actualSize,kind,x,y,angle:dir===1?0:Math.PI,face:dir,speed:(kind==='boss'?88:kind==='shark'?76+60*this.level/(STAGE_COUNT-1):(36+Math.max(0,band)*9+this.config.chapter*2)*this.difficulty.fishSpeed)*(.9+this.rng()*.2),phase:this.rng()*Math.PI*2,warning:kind==='shark'||kind==='boss'?this.difficulty.warning:0};this.fish.push(item);return item;
 }
 ensurePrey(){
  if(this.fish.length>=this.difficulty.target)return false;
  const food=this.fish.filter(f=>this.edible(f)).length;
  return this.addFish(food<POPULATION.nearbyPrey?{tier:this.pickPrey()}:{});
 }
 pause(){if(this.status!=='playing')return false;this.status='paused';this.sucking=false;return true;}
 resume(){if(this.status!=='paused')return false;this.status='playing';return true;}
 dash(){if(this.status!=='playing'||this.energy<25||this.dashCooldown>0)return false;this.energy-=25;this.dashTime=.2;this.dashCooldown=1.15;this.emit('dash');return true;}
 burst(x,y,color,n=10){for(let i=0;i<n&&this.effects.length<140;i++){const a=this.rng()*Math.PI*2,s=25+this.rng()*85;this.effects.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+this.rng()*.5,max:1,color,size:2+this.rng()*3});}}
 label(x,y,text,color='#fff7bb'){this.labels.push({x,y,text,color,life:1.1});if(this.labels.length>18)this.labels.shift();}
 eat(fish){
  if(this.status!=='playing'||!this.edible(fish))return false;const at=this.fish.indexOf(fish);if(at<0)return false;
  this.fish.splice(at,1);this.eaten++;this.bite=.25;this.chain=this.elapsed-this.lastMeal<=4?this.chain+1:1;this.lastMeal=this.elapsed;this.combo=Math.min(5,1+Math.floor((this.chain-1)/3));this.bestCombo=Math.max(this.bestCombo,this.combo);
  if(this.chain>=10&&this.feverCooldown<=0){this.fever=8;this.feverCooldown=18;this.emit('fever');}
  const points=Math.round((6+fish.size*.5)*this.combo*(this.fever>0?2:1));this.score+=points;
  this.burst(fish.x,fish.y,fish.kind==='golden'?'#ffe08a':FISH[fish.tier].color,4);this.label(fish.x,fish.y-10,'+'+points);this.emit('eat',{points,tier:fish.tier});
  if(fish.kind==='boss'){this.bossEaten=true;this.grow(this.config.goal);}
  else this.grow(fish.kind==='golden'?Math.ceil(this.config.goal*.22):[4,6,9][Math.max(0,fish.band)]||5);
  return true;
 }
 grow(amount){
  if(this.status!=='playing'||!Number.isFinite(amount)||amount<=0)return;
  this.xp=Math.min(this.config.goal,this.xp+amount);const growth=Math.min(2,Math.floor((this.xp+1e-9)/this.config.goal*3));
  if(growth>this.growth){this.growth=growth;this.player.size=this.config.sizes[growth];this.safe=Math.max(this.safe,this.difficulty.growthProtection);this.burst(this.player.x,this.player.y,'#fff5a9',22);this.emit('grow',{growth});this.ensurePrey();}
  if(this.config.final&&this.growth===2&&!this.bossEaten&&!this.fish.some(f=>f.kind==='boss'))this.addFish({tier:7,size:132,kind:'boss',x:WORLD.width+85,y:WORLD.height*.5,dir:-1});
  if(this.xp>=this.config.goal&&(!this.config.final||this.bossEaten))this.completeLevel();
 }
 completeLevel(){
  if(this.status!=='playing')return false;const bonus=150+(this.level+1)*15+(this.stageHits===0?100:0);this.score+=bonus;this.lives=Math.min(3,this.lives+1);this.player.vx=this.player.vy=0;this.sucking=false;
  if(this.level===STAGE_COUNT-1){this.finish(true);return true;}
  this.status='cleared';this.emit('cleared',{level:this.level,bonus,perfect:this.stageHits===0});return true;
 }
 hit(source){
  if(this.status!=='playing'||this.safe>0)return false;
  if(this.shield>0){this.shield=0;this.safe=2;this.emit('shield');this.burst(this.player.x,this.player.y,'#88f4ff',20);return false;}
  this.lives--;this.stageHits++;this.safe=4;this.chain=0;this.combo=1;this.fever=0;this.sucking=false;
  this.player.x=WORLD.width/2;this.player.y=WORLD.height/2;this.player.vx=this.player.vy=0;
  this.fish=this.fish.filter(f=>!this.dangerous(f)||Math.hypot(f.x-this.player.x,f.y-this.player.y)>230);this.ensurePrey();
  this.burst(this.player.x,this.player.y,'#ffd9da',20);this.emit('hit',{lives:this.lives});if(this.lives<=0)this.finish(false);return true;
 }
 collect(item){
  if(this.status!=='playing')return false;const index=this.items.indexOf(item);if(index<0)return false;this.items.splice(index,1);
  if(item.type==='shield'){this.shield=10;this.label(item.x,item.y,'Lá chắn','#a0f1ff');}
  else if(item.type==='heart'){this.lives=Math.min(3,this.lives+1);this.label(item.x,item.y,'+1 mạng','#ffb7c7');}
  else if(item.type==='freeze'){this.freeze=5;this.label(item.x,item.y,'Đóng băng 5s','#baf5ff');}
  else if(item.type==='speed'){this.speedBoost=7;this.label(item.x,item.y,'Tăng tốc','#baf5ff');}
  else{this.score+=150;this.energy=Math.min(100,this.energy+35);this.label(item.x,item.y,'+150','#fff5a9');}
  this.burst(item.x,item.y,'#ffedac',12);this.emit('pickup',{kind:item.type});return true;
 }
 finish(won){if(this.status!=='playing')return;this.status=won?'won':'over';this.sucking=false;this.player.vx=this.player.vy=0;this.emit(this.status);}
 step(seconds,input={}){
  if(this.status!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
  const dt=Math.min(seconds,.05);this.elapsed+=dt;this.levelElapsed+=dt;
  for(const key of ['safe','shield','dashTime','dashCooldown','fever','feverCooldown','bite','freeze','speedBoost'])this[key]=Math.max(0,this[key]-dt);
  if(input.suck!==true)this.suctionExhausted=false;if(input.suck===true&&this.energy<=2)this.suctionExhausted=true;this.sucking=this.suctionUnlocked&&input.suck===true&&!this.suctionExhausted&&this.energy>2;this.energy=clamp(this.energy+dt*(this.sucking?-26:15),0,100);
  if(this.elapsed-this.lastMeal>4){this.chain=0;this.combo=1;}
  const p=this.player,speed=310*(this.dashTime>0?1.65:this.speedBoost>0?1.25:1);let dx=Number.isFinite(input.x)?input.x:0,dy=Number.isFinite(input.y)?input.y:0;
  if(Number.isFinite(input.targetX)&&Number.isFinite(input.targetY)){
   dx=clamp(input.targetX,35,WORLD.width-35)-p.x;dy=clamp(input.targetY,110,WORLD.height-85)-p.y;
   const distance=Math.hypot(dx,dy),travel=Math.min(distance,speed*dt);p.vx=distance?dx/distance*travel/dt:0;p.vy=distance?dy/distance*travel/dt:0;
  }else{const n=Math.hypot(dx,dy);if(n>1){dx/=n;dy/=n;}p.vx=dx*speed;p.vy=dy*speed;}
  const margin=Math.max(35,p.size*1.2);p.x=clamp(p.x+p.vx*dt,margin,WORLD.width-margin);p.y=clamp(p.y+p.vy*dt,Math.max(115,margin),WORLD.height-Math.max(90,margin));
  if(Math.abs(p.vx)>1)p.face=p.vx>0?1:-1;p.angle=clamp(Math.atan2(p.vy,Math.abs(p.vx)+100)*.16,-.25,.25)*p.face;
  for(const f of this.fish){
   if(f.warning>0){f.warning=Math.max(0,f.warning-dt);continue;}
   const k=this.freeze>0?0:1;f.x+=f.face*f.speed*dt*k;f.y+=Math.sin(this.elapsed*1.1+f.phase)*dt*5*k;f.y=clamp(f.y,130,WORLD.height-110);if(f.kind==='boss'&&f.x<-140){f.x=WORLD.width+85;f.warning=this.difficulty.warning;}
   if(this.sucking&&this.edible(f)){const dx=f.x-p.x,dy=f.y-p.y,d=Math.hypot(dx,dy);if(d<195&&dx*p.face>-p.size*.5&&d>1){f.x-=dx/d*350*dt;f.y-=dy/d*350*dt;}}
  }
  this.fish=this.fish.filter(f=>f.x>-180&&f.x<WORLD.width+180);
  for(const f of [...this.fish]){
   if(this.status!=='playing')break;if(f.warning>0)continue;const distance=Math.hypot(f.x-p.x,f.y-p.y);
   if(this.edible(f)){if(distance<(p.size+f.size)*1.02)this.eat(f);}
   else if(this.dangerous(f)&&distance<(p.size+f.size)*.48)this.hit(f);
  }
  for(const j of this.jellies)if(Math.hypot(p.x-j.x,p.y-(j.y+Math.sin(this.elapsed+j.phase)*12))<p.size*.5+j.size*.6)this.hit(j);
  if(this.oyster){const o=this.oyster;o.open=(this.levelElapsed%12)<6;if(o.open&&this.levelElapsed>=o.nextPearl){o.nextPearl=this.levelElapsed+12;if(this.items.length<2)this.items.push({id:++this.serial,x:o.x,y:o.y-24,type:'pearl',phase:0});}if(!o.open&&this.level>=80&&Math.hypot(p.x-o.x,p.y-o.y)<p.size*.45+20)this.hit(o);}
  for(const item of [...this.items])if(Math.hypot(item.x-p.x,item.y-p.y)<p.size+20)this.collect(item);
  if(this.status!=='playing')return;
  if(this.levelElapsed>=this.nextSwarm){this.nextSwarm+=this.difficulty.swarmGap;const right=this.rng()>.5;for(let i=0;i<2;i++)this.addFish({tier:this.pickPrey(),x:right?WORLD.width+60+i*35:-60-i*35,y:clamp(p.y+Math.sin(i)*36,145,WORLD.height-125),dir:right?-1:1});this.emit('swarm');}
  if(this.levelElapsed>=this.nextItem){
   this.nextItem+=this.difficulty.itemGap;const roll=this.rng();if(this.items.length<2)this.items.push({id:++this.serial,x:clamp(p.x+(this.rng()-.5)*400,100,WORLD.width-100),y:clamp(p.y+(this.rng()-.5)*300,160,WORLD.height-140),type:this.lives<3?'heart':roll<.35?'shield':roll<.55?'freeze':roll<.7?'speed':'pearl',phase:this.rng()*6});
   if(!this.fish.some(f=>f.kind==='golden')){const right=this.rng()<.5;this.addFish({band:0,size:10,kind:'golden',x:right?-50:WORLD.width+50,y:250+this.rng()*200,dir:right?1:-1});}
  }
  if(this.level>=30&&this.levelElapsed>=this.nextShark){this.nextShark+=this.difficulty.sharkGap;if(!this.fish.some(f=>f.kind==='shark'))this.addFish({tier:6,size:Math.max(this.config.sizes[2]*1.22,90),kind:'shark'});}
  if(this.levelElapsed>=this.nextArrival){this.nextArrival=this.levelElapsed+this.difficulty.spawnGap;this.ensurePrey();}
  for(const e of this.effects){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=20*dt;e.life-=dt;}this.effects=this.effects.filter(e=>e.life>0);for(const e of this.labels){e.y-=dt*32;e.life-=dt;}this.labels=this.labels.filter(e=>e.life>0);
 }
}
