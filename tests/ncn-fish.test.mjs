import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ocean,LEVELS,CHARACTERS,WORLD,FISH,POPULATION,cleanRecord,awardRecord} from '../public/ca-lon-nuot-ca-be/core.js';
import {cameraFocus} from '../public/ca-lon-nuot-ca-be/draw.js';
const start=(seed=123,level=0)=>new Ocean().start(seed,level);
const quiet=(level=0)=>{const o=start(123,level);o.fish=[];o.jellies=[];o.items=[];o.oyster=null;return o;};
const food=(o,band=0,extra={})=>Object.assign(o.addFish({band,x:o.player.x,y:o.player.y,dir:1}),extra);
test('PC shows a fixed ocean; phones keep a readable player in view',()=>{
 for(const p of [{x:40,y:120},{x:640,y:400},{x:1240,y:710}]){
  assert.deepEqual(cameraFocus(p,1440,650,.8),{x:WORLD.width/2,y:WORLD.height/2});
  assert.deepEqual(cameraFocus(p,390,650,.6),p);assert.deepEqual(cameraFocus(p,844,390,1,true),p);
 }
});
test('forty stages use five playable characters, six regions and three real sizes',()=>{
 assert.equal(LEVELS.length,40);assert.equal(CHARACTERS.length,5);assert.equal(new Set(LEVELS.map(l=>l.name)).size,6);
 for(const l of LEVELS){assert.equal(l.menu.length,3);assert.equal(l.sizes.length,3);assert.ok(l.sizes[0]<l.sizes[1]&&l.sizes[1]<l.sizes[2]);assert.ok(l.menu.every(t=>FISH[t]));assert.ok(l.goal>0);}
 for(let chapter=0;chapter<5;chapter++)assert.equal(start(1,chapter*8).character,CHARACTERS[chapter]);
});
test('equal seeds reproduce the ocean, and ordinary steering reaches the first meal',()=>{
 assert.deepEqual(start().fish,start().fish);
 for(const seed of [1,12,123,987,2026]){const o=start(seed);for(let i=0;i<120;i++)o.step(1/60,{x:1,y:0});assert.ok(o.eaten>0);assert.ok(o.score>0);assert.equal(o.lives,3);}
});
test('pointer movement reaches the exact target without overshooting or oscillation',()=>{
 const o=quiet(),target={targetX:863,targetY:421};o.safe=100;
 for(let i=0;i<120;i++)o.step(1/60,target);
 assert.equal(o.player.x,target.targetX);assert.equal(o.player.y,target.targetY);assert.equal(o.player.vx,0);assert.equal(o.player.vy,0);
 for(let i=0;i<60;i++)o.step(1/60,target);assert.equal(o.player.x,target.targetX);assert.equal(o.player.y,target.targetY);
});
test('releasing keyboard, touch or joystick stops the fish instead of coasting',()=>{
 const o=quiet();o.safe=100;for(let i=0;i<20;i++)o.step(1/60,{x:1,y:.3});const at={x:o.player.x,y:o.player.y};
 for(let i=0;i<30;i++)o.step(1/60,{});assert.equal(o.player.x,at.x);assert.equal(o.player.y,at.y);assert.equal(o.player.vx,0);assert.equal(o.player.vy,0);
});
test('only genuinely smaller fish can be eaten and collection cannot award twice',()=>{
 const o=quiet(),small=food(o),medium=food(o,1);assert.ok(o.edible(small));assert.ok(o.dangerous(medium));assert.equal(o.eat(medium),false);assert.equal(o.eat(small),true);const score=o.score;assert.equal(o.eat(small),false);assert.equal(o.score,score);
});
test('the two growth markers unlock exactly the matching menu sizes',()=>{
 const o=quiet(),middle=food(o,1),large=food(o,2);assert.equal(o.edible(middle),false);assert.equal(o.edible(large),false);
 o.grow(o.config.goal/3);assert.equal(o.growth,1);assert.equal(o.player.size,o.config.sizes[1]);assert.equal(o.edible(middle),true);assert.equal(o.edible(large),false);
 o.grow(o.config.goal/3);assert.equal(o.growth,2);assert.equal(o.player.size,o.config.sizes[2]);assert.equal(o.edible(large),true);assert.equal(o.level,0);
});
test('a forgiving bite radius does not enlarge predator damage or damage equal-sized fish',()=>{
 const o=quiet();o.safe=0;food(o,0,{x:o.player.x+30,speed:0});o.step(1/60);assert.equal(o.eaten,1);
 o.fish=[];food(o,0,{size:o.player.size,speed:0});o.step(1/60);assert.equal(o.lives,3);
 o.fish=[];const big=food(o,2,{x:o.player.x+55,speed:0});o.step(1/60);assert.equal(o.lives,3);big.x=o.player.x;big.y=o.player.y;o.step(1/60);assert.equal(o.lives,2);
});
test('the opening has bounded traffic, nearby food, eight safe seconds and at most two distant predators',()=>{
 for(let seed=1;seed<=40;seed++){const o=start(seed),threats=o.fish.filter(f=>o.dangerous(f));assert.ok(o.fish.length>=POPULATION.target&&o.fish.length<=POPULATION.max);assert.equal(o.safe,8);assert.ok(threats.length<=2);assert.ok(threats.every(f=>Math.hypot(f.x-o.player.x,f.y-o.player.y)>=390));assert.ok(o.fish.filter(f=>o.edible(f)&&Math.hypot(f.x-o.player.x,f.y-o.player.y)<330).length>=POPULATION.nearbyPrey);assert.equal(o.jellies.length,0);assert.ok(o.fish.every(f=>f.kind==='fish'));}
});
test('casual movement to nearby prey clears each early stage in under 40 seconds',()=>{
 for(const seed of [1,12,123,987,2026])for(let level=0;level<8;level++){
  const o=start(seed,level);
  for(let i=0;i<2400&&o.status==='playing';i++){
   const prey=o.fish.filter(f=>o.edible(f)&&f.x>=40&&f.x<=WORLD.width-40).sort((a,b)=>Math.hypot(a.x-o.player.x,a.y-o.player.y)-Math.hypot(b.x-o.player.x,b.y-o.player.y))[0];
   o.step(1/60,prey?{targetX:prey.x,targetY:prey.y}:{});
  }
  assert.equal(o.status,'cleared','reachable stage '+(level+1)+', seed '+seed);assert.ok(o.lives>=2,'forgiving stage '+(level+1));assert.ok(o.elapsed<40);
 }
});
test('clearing pauses the ocean, saves the unlocked stage and waits for an explicit next stage',()=>{
 let clears=0;const o=new Ocean({onEvent:e=>{if(e.type==='cleared')clears++;}}).start(3);o.grow(o.config.goal);
 assert.equal(o.status,'cleared');assert.equal(clears,1);const snapshot=JSON.stringify(o);for(let i=0;i<100;i++)o.step(.05,{x:1});assert.equal(JSON.stringify(o),snapshot);assert.equal(o.nextLevel(),true);assert.equal(o.level,1);assert.equal(o.growth,0);assert.equal(o.progress,0);assert.equal(o.safe,8);assert.equal(o.status,'playing');assert.equal(o.nextLevel(),false);
});
test('all forty stages complete, with a real edible shark king required at the end',()=>{
 let wins=0;const o=new Ocean({onEvent:e=>{if(e.type==='won')wins++;}}).start(2);
 for(let level=0;level<40;level++){
  assert.equal(o.level,level);o.grow(o.config.goal);
  if(level<39){assert.equal(o.status,'cleared');assert.equal(o.nextLevel(),true);}
  else{assert.equal(o.status,'playing');const boss=o.fish.find(f=>f.kind==='boss');assert.ok(boss);assert.ok(o.edible(boss));assert.equal(o.eat(boss),true);assert.equal(o.status,'won');assert.equal(o.bossEaten,true);}
 }
 assert.equal(wins,1);o.finish(true);o.step(.05);assert.equal(wins,1);assert.equal(o.nextLevel(),false);
});
test('losing a life retains stage growth and gives safe space and five protected seconds',()=>{
 const o=quiet();o.grow(o.config.goal/2);const xp=o.xp,size=o.player.size;o.safe=0;assert.equal(o.hit({x:0,y:0}),true);assert.equal(o.xp,xp);assert.equal(o.player.size,size);assert.equal(o.safe,5);assert.equal(o.lives,2);assert.equal(o.hit({x:0,y:0}),false);
});
test('three hits end exactly one run and a retry can start on the same stage',()=>{
 let losses=0;const o=new Ocean({onEvent:e=>{if(e.type==='over')losses++;}}).start(1,12);for(let i=0;i<3;i++){o.safe=0;o.hit({x:0,y:0});}assert.equal(o.status,'over');assert.equal(losses,1);const snapshot=JSON.stringify(o);o.step(.05,{x:1});assert.equal(JSON.stringify(o),snapshot);o.start(2,12);assert.equal(o.level,12);assert.equal(o.lives,3);assert.equal(o.score,0);
});
test('dash is short, rechargeable and never makes a larger fish edible',()=>{
 const o=quiet(),large=food(o,2);assert.equal(o.dash(),true);assert.equal(o.energy,78);assert.equal(o.dash(),false);assert.equal(o.eat(large),false);o.fish=[];for(let i=0;i<90;i++)o.step(1/60);assert.equal(o.energy,100);assert.equal(o.dash(),true);o.pause();assert.equal(o.dash(),false);
});
test('suction unlocks at stage nine, pulls only edible fish and cannot draw energy below zero',()=>{
 const locked=quiet();locked.step(.05,{suck:true});assert.equal(locked.sucking,false);
 const o=quiet(8);o.safe=999;const small=food(o,0,{x:o.player.x+145,speed:0}),large=food(o,2,{x:o.player.x+190,speed:0});const before=small.x;
 o.step(.05,{suck:true});assert.ok(small.x<before);assert.equal(large.x,o.player.x+190);assert.ok(o.energy<100);assert.equal(o.sucking,true);
 for(let i=0;i<360;i++)o.step(1/60,{suck:true});assert.equal(o.sucking,false);assert.ok(o.energy>=0&&o.energy<=100);o.step(.05);o.step(.05,{suck:true});assert.equal(o.suctionExhausted,false);
});
test('pearls only score, golden minnows grow, and shields/hearts/freeze have finite effects',()=>{
 const o=quiet(),item=type=>{const p={type,x:o.player.x,y:o.player.y};o.items.push(p);return p;};
 const pearl=item('pearl');assert.equal(o.collect(pearl),true);assert.equal(o.collect(pearl),false);assert.equal(o.score,150);assert.equal(o.xp,0);
 const gold=food(o,0,{kind:'golden'});o.eat(gold);assert.ok(o.xp>4);o.collect(item('shield'));o.safe=0;assert.equal(o.hit({x:0,y:0}),false);assert.equal(o.lives,3);assert.equal(o.shield,0);
 o.lives=2;o.collect(item('heart'));assert.equal(o.lives,3);o.collect(item('heart'));assert.equal(o.lives,3);
 o.collect(item('freeze'));assert.equal(o.freeze,5);const f=food(o,0,{x:100,y:250,speed:100}),x=f.x;o.step(.05);assert.equal(f.x,x);o.collect(item('speed'));assert.equal(o.speedBoost,7);
});
test('pause freezes movement, powers, combo, hazards and every timer',()=>{
 const o=quiet(8);o.dash();o.pause();const snapshot=JSON.stringify(o);for(let i=0;i<100;i++)o.step(.05,{x:1,suck:true});assert.equal(JSON.stringify(o),snapshot);assert.equal(o.hit({x:0,y:0}),false);assert.equal(o.collect({type:'heart'}),false);assert.equal(o.resume(),true);o.step(.05);assert.ok(o.elapsed>0);
});
test('frenzy has a bounded timer and combo expires after a gap',()=>{
 const o=quiet(20);for(let i=0;i<10;i++){o.elapsed+=.2;o.eat(food(o));}assert.equal(o.fever,8);assert.ok(o.combo>=3);o.fever=3;for(let i=0;i<3;i++){o.elapsed+=.1;o.eat(food(o));}assert.equal(o.fever,3);o.elapsed+=5;o.eat(food(o));assert.equal(o.combo,1);assert.equal(o.chain,1);
});
test('long play keeps populations, particles and coordinates bounded, ignoring invalid frame times',()=>{
 const o=start(5,24);o.safe=99999;
 for(let i=0;i<6000&&o.status==='playing';i++){o.step(1/60,{x:Math.sin(i*.01),y:Math.cos(i*.01)});assert.ok(o.fish.length<=POPULATION.max);assert.ok(o.items.length<=3);assert.ok(o.effects.length<=140);assert.ok(o.labels.length<=18);assert.ok(o.player.x>=0&&o.player.x<=WORLD.width);assert.ok(o.player.y>=0&&o.player.y<=WORLD.height);}
 for(const dt of [NaN,Infinity,-1,0]){const prior=o.elapsed;o.step(dt);assert.equal(o.elapsed,prior);}assert.ok(o.jellies.length<=2);
});
test('old records migrate without losing scores or preferences, and progress cannot create roles',()=>{
 assert.deepEqual(cleanRecord({best:Infinity,fish:-8,wins:'7',skin:'<script>',sound:'yes',unlocked:Infinity,admin:true}),cleanRecord());
 const old=cleanRecord({version:1,best:400,fish:30,wins:2,skin:'aqua',sound:true});assert.equal(old.best,400);assert.equal(old.unlocked,1);assert.equal(old.skin,'aqua');assert.equal(old.sound,true);
 assert.equal(cleanRecord({unlocked:900}).unlocked,40);assert.equal(cleanRecord({unlocked:-8}).unlocked,1);assert.equal(Object.hasOwn(cleanRecord({admin:true}),'admin'),false);
 const cleared=awardRecord(old,{score:600,eaten:12,level:8,status:'cleared'});assert.equal(cleared.unlocked,10);assert.equal(cleared.fish,42);assert.equal(cleared.best,600);assert.equal(cleared.wins,2);
 const won=awardRecord(cleared,{score:900,eaten:30,level:39,status:'won'});assert.equal(won.unlocked,40);assert.equal(won.wins,3);
});
test('legitimate fast play and late-stage replays stay inside the existing score-server rate guard',()=>{
 for(const seed of [1,12,123,987,2026])for(const level of [0,8,16,24,32,39]){
  const o=start(seed,level);let target={};
  for(let i=0;i<6000&&o.status==='playing';i++){
   if(i%24===0){const f=o.fish.filter(f=>o.edible(f)&&f.x>=40&&f.x<=WORLD.width-40).sort((a,b)=>Math.hypot(a.x-o.player.x,a.y-o.player.y)-Math.hypot(b.x-o.player.x,b.y-o.player.y))[0];target=f?{targetX:f.x,targetY:f.y}:{};}
   o.step(1/60,target);assert.ok(o.score<=1000+2500*o.elapsed,'stage '+(level+1)+' score '+o.score+' at '+o.elapsed+'s');
  }
  assert.ok(['cleared','won'].includes(o.status),'replay completes, stage '+(level+1));
 }
});
test('the new game is present before hydration in navigation, home cards, Library, routes and sitemap',async()=>{
  const read=p=>readFile(p,'utf8'),config=JSON.parse(await read('public/assets/ncn-theme/config.json')),home=await read('public/index.html'),game=await read('public/ca-lon-nuot-ca-be/index.html'),routes=JSON.parse(await read('netlify/lib/ncn-shell/pages.json'));
  assert.equal(config.tools.filter(x=>x.href==='/ca-lon-nuot-ca-be/').length,1);assert.match(home,/data-ncn-pin="ca-lon-nuot-ca-be"/);assert.equal((home.match(/class="ncn-tool-card /g)||[]).length,config.tools.length);
  for(const route of ['/ca-lon-nuot-ca-be','/ca-lon-nuot-ca-be/','/ca-lon-nuot-ca-be/index.html'])assert.equal(routes[route],'ca-lon-nuot-ca-be/index.html');
  assert.match(game,/id="ncn-account-host"/);assert.match(game,/ncn-theme\/theme\.js/);assert.match(game,/ncn-theme\/announcements\.js/);assert.match(await read('public/sitemap.xml'),/https:\/\/nguyencongnghe.com\/ca-lon-nuot-ca-be\//);
  const seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json')),entry=seed.find(x=>x.href==='/ca-lon-nuot-ca-be/');assert.equal(entry.managedPage,false);assert.equal(entry.isPage,true);assert.equal(FISH.length,14);
});
