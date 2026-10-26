import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ocean,LEVELS,FISH,POPULATION,cleanRecord,awardRecord} from '../public/ca-lon-nuot-ca-be/core.js';
import {cameraFocus} from '../public/ca-lon-nuot-ca-be/draw.js';

const start=()=>new Ocean().start(123),quiet=()=>{const o=start();o.fish=[];o.jellies=[];o.items=[];return o;};
const prey=(o,tier=0)=>o.addFish({tier,x:o.player.x,y:o.player.y,dir:1});
test('the phone camera follows the player even at ocean edges instead of hiding it under the HUD or touch controls',()=>{
  for(const player of [{x:45,y:90},{x:800,y:500},{x:1555,y:920}]){
    assert.deepEqual(cameraFocus(player,390,650,.53),player);
    assert.deepEqual(cameraFocus(player,844,390,.9,true),player);
  }
  assert.deepEqual(cameraFocus({x:45,y:90},1440,650,1.25),{x:576,y:235});
  assert.deepEqual(cameraFocus({x:45,y:90},1800,1300,1),{x:800,y:500});
});
test('equal seeds reproduce the ocean and the first meal is reachable with ordinary keyboard movement',()=>{
  const a=start(),b=start();assert.deepEqual(a.fish,b.fish);
  for(const seed of [1,12,123,987,2026]){
    const o=new Ocean().start(seed);for(let i=0;i<120;i++)o.step(1/60,{x:1,y:0});assert.ok(o.eaten>0,'reachable minnows, seed '+seed);assert.ok(o.score>0);assert.equal(o.lives,3);
  }
});
test('only smaller prey can be eaten; duplicate collection cannot award points twice',()=>{
  const o=quiet(),small=prey(o,1),large=prey(o,4);assert.equal(o.edible(small),true);assert.equal(o.edible(large),false);
  assert.equal(o.eat(large),false);assert.equal(o.score,0);assert.equal(o.eat(small),true);const score=o.score;assert.equal(o.eat(small),false);assert.equal(o.score,score);assert.equal(o.eaten,1);
});
test('collision uses the same size rule as the visible prey rings',()=>{
  const o=quiet();prey(o,0);o.step(1/60);assert.equal(o.eaten,1);
  o.safe=0;o.fish=[];prey(o,4);o.step(1/60);assert.equal(o.lives,2);assert.equal(o.eaten,1);
});
test('equally sized fish are harmless and the bite area is forgiving without enlarging predator collisions',()=>{
  const o=quiet();o.safe=0;const neutral=prey(o,10);neutral.speed=0;assert.equal(o.edible(neutral),false);assert.equal(o.dangerous(neutral),false);o.step(1/60);assert.equal(o.lives,3);assert.equal(o.eaten,0);
  o.fish=[];const small=prey(o,0);small.x+=30;small.speed=0;o.step(1/60);assert.equal(o.eaten,1);
  o.fish=[];const big=prey(o,4);big.x+=45;big.speed=0;o.step(1/60);assert.equal(o.lives,3);big.x=o.player.x;big.y=o.player.y;o.step(1/60);assert.equal(o.lives,2);
});
test('the opening has a dense varied food supply, eight seconds of protection and no nearby predators',()=>{
  for(let seed=1;seed<=30;seed++){const o=new Ocean().start(seed);assert.ok(o.fish.length>=POPULATION.target&&o.fish.length<=POPULATION.max);assert.equal(o.safe,8);assert.ok(o.fish.filter(f=>o.edible(f)).length/o.fish.length>=.7);assert.ok(new Set(o.fish.filter(f=>o.edible(f)).map(f=>f.tier)).size>=5);assert.ok(o.fish.filter(f=>o.edible(f)&&Math.hypot(f.x-800,f.y-500)<430).length>=POPULATION.nearbyPrey);assert.ok(o.fish.filter(f=>o.dangerous(f)).every(f=>Math.hypot(f.x-800,f.y-500)>=420));assert.ok(o.fish.every(f=>!FISH[f.tier].shark));}
});
test('casual steering toward nearby prey can reach the next region in thirty seconds without losing all lives',()=>{
  for(const seed of[1,12,123,987,2026]){const o=new Ocean().start(seed);for(let i=0;i<1800&&o.status==='playing'&&o.level===0;i++){const target=o.fish.filter(f=>o.edible(f)).sort((a,b)=>Math.hypot(a.x-o.player.x,a.y-o.player.y)-Math.hypot(b.x-o.player.x,b.y-o.player.y))[0];const dx=target.x-o.player.x,dy=target.y-o.player.y,n=Math.hypot(dx,dy)||1;o.step(1/60,{x:dx/n,y:dy/n});}assert.ok(o.level>=1,'reachable growth, seed '+seed);assert.ok(o.lives>=2,'forgiving first region, seed '+seed);}
});
test('growth changes the real body size and unlocks previously dangerous species',()=>{
  const o=quiet(),medium=prey(o,3);assert.equal(o.edible(medium),false);o.grow(LEVELS[0].goal);
  assert.equal(o.level,1);assert.equal(o.player.size,LEVELS[1].size);assert.equal(o.edible(medium),true);assert.equal(o.energy,100);assert.ok(o.safe>=2.5);assert.equal(LEVELS.length,6);
});
test('combo resets after a gap and fever is bounded rather than continually renewed',()=>{
  const o=quiet();for(let i=0;i<12;i++){o.elapsed+=.2;o.eat(prey(o));}assert.equal(o.combo,4);assert.equal(o.fever,7);
  o.fever=3;for(let i=0;i<10;i++){o.elapsed+=.1;o.eat(prey(o));}assert.equal(o.combo,5);assert.equal(o.bestCombo,5);assert.equal(o.fever,3);
  o.elapsed+=4;o.eat(prey(o));assert.equal(o.combo,1);assert.equal(o.chain,1);
});
test('spawn protection, post-hit immunity and terminal loss prevent repeated instant bites',()=>{
  const o=quiet(),big={x:800,y:500};assert.equal(o.hit(big),false);assert.equal(o.lives,3);
  for(let i=0;i<3;i++){o.safe=0;assert.equal(o.hit(big),true);assert.equal(o.hit(big),false);}
  assert.equal(o.status,'over');assert.equal(o.lives,0);const snapshot=JSON.stringify(o);o.step(.05,{x:1});assert.equal(JSON.stringify(o),snapshot);
});
test('a shield absorbs one collision, hearts are capped, pearls award once',()=>{
  const o=quiet();o.safe=0;const item=type=>{const p={type,x:o.player.x,y:o.player.y};o.items.push(p);return p;};
  o.collect(item('shield'));assert.equal(o.shield,10);assert.equal(o.hit({x:810,y:500}),false);assert.equal(o.shield,0);assert.equal(o.lives,3);
  o.collect(item('heart'));assert.equal(o.lives,3);o.lives=1;o.collect(item('heart'));assert.equal(o.lives,2);
  o.energy=20;const pearl=item('pearl');assert.equal(o.collect(pearl),true);assert.equal(o.collect(pearl),false);assert.equal(o.score,150);assert.equal(o.energy,55);
});
test('jellyfish remain dangerous at the largest size',()=>{
  const o=quiet();o.grow(LEVELS.slice(0,5).reduce((sum,x)=>sum+x.goal,0));o.fish=[];o.items=[];o.jellies=[{x:o.player.x,y:o.player.y,phase:0,size:22}];o.safe=0;o.step(1/60);assert.equal(o.lives,2);
});
test('dash uses replenishable energy, respects cooldown and never makes large fish edible',()=>{
  const o=quiet();o.safe=0;const big=prey(o,6);assert.equal(o.dash(),true);assert.equal(o.energy,72);assert.equal(o.dash(),false);assert.equal(o.edible(big),false);assert.equal(o.eat(big),false);
  o.fish=[];o.hit(big);assert.equal(o.lives,2);o.safe=999;for(let i=0;i<240;i++)o.step(1/60);assert.equal(o.energy,100);assert.equal(o.dash(),true);o.pause();assert.equal(o.dash(),false);
});
test('pause freezes every simulation timer and ignores movement, damage, collection and dash',()=>{
  const o=quiet();o.dash();o.pause();const snapshot=JSON.stringify(o);for(let i=0;i<100;i++)o.step(.05,{x:1,y:1});assert.equal(JSON.stringify(o),snapshot);assert.equal(o.hit({x:0,y:0}),false);assert.equal(o.collect({type:'heart'}),false);assert.equal(o.dash(),false);assert.equal(o.resume(),true);o.step(.05,{x:1});assert.ok(o.elapsed>0);
});
test('the final objective requires eight genuinely large prey and awards a single terminal result',()=>{
  let wins=0;const o=new Ocean({onEvent:e=>{if(e.type==='won')wins++;}}).start(4);o.grow(LEVELS.slice(0,5).reduce((sum,x)=>sum+x.goal,0));assert.equal(o.level,5);
  o.eat(prey(o,0));assert.equal(o.largeEaten,0);
  for(let i=0;i<8;i++)o.eat(prey(o,i%2?6:5));assert.equal(o.status,'won');assert.equal(o.largeEaten,8);assert.equal(o.progress,1);assert.equal(wins,1);o.finish(true);o.step(.05);assert.equal(wins,1);assert.equal(o.eat(prey(o,5)),false);
});
test('long runs keep fish, particles, rewards and hazards bounded and cannot leave the ocean',()=>{
  const o=start();o.grow(LEVELS.slice(0,5).reduce((sum,x)=>sum+x.goal,0));o.safe=99999;
  for(let i=0;i<10000;i++){o.step(1/60,{x:Math.sin(i*.01)*2,y:Math.cos(i*.01)*2});assert.ok(o.fish.length<=POPULATION.max);assert.ok(o.items.length<=3);assert.ok(o.effects.length<=140);assert.ok(o.labels.length<=18);}
  assert.ok(o.jellies.length<=4);assert.ok(o.player.x>=45&&o.player.x<=1555);assert.ok(o.player.y>=90&&o.player.y<=920);assert.ok(Number.isFinite(o.score));assert.ok(o.energy>=0&&o.energy<=100);
  for(const dt of [NaN,Infinity,-1,0]){const prior=o.elapsed;o.step(dt);assert.equal(o.elapsed,prior);}
});
test('local record validation preserves honest best scores and stores no identity or role hints',()=>{
  assert.deepEqual(cleanRecord({best:Infinity,fish:-8,wins:'7',skin:'<script>',sound:'yes',admin:true}),cleanRecord());
  const a=awardRecord({best:400,skin:'aqua'},{score:90,eaten:12,status:'over'});assert.equal(a.best,400);assert.equal(a.fish,12);assert.equal(a.skin,'aqua');
  const b=awardRecord(a,{score:600,eaten:30,status:'won'});assert.equal(b.best,600);assert.equal(b.fish,42);assert.equal(b.wins,1);assert.equal(Object.hasOwn(b,'admin'),false);
});
test('the new game is present before hydration in navigation, home cards, Library, routes and sitemap',async()=>{
  const read=p=>readFile(p,'utf8'),config=JSON.parse(await read('public/assets/ncn-theme/config.json')),home=await read('public/index.html'),game=await read('public/ca-lon-nuot-ca-be/index.html'),routes=JSON.parse(await read('netlify/lib/ncn-shell/pages.json'));
  assert.equal(config.tools.filter(x=>x.href==='/ca-lon-nuot-ca-be/').length,1);assert.match(home,/data-ncn-pin="ca-lon-nuot-ca-be"/);assert.equal((home.match(/class="ncn-tool-card /g)||[]).length,config.tools.length);
  for(const route of ['/ca-lon-nuot-ca-be','/ca-lon-nuot-ca-be/','/ca-lon-nuot-ca-be/index.html'])assert.equal(routes[route],'ca-lon-nuot-ca-be/index.html');
  assert.match(game,/id="ncn-account-host"/);assert.match(game,/ncn-theme\/theme\.js/);assert.match(game,/ncn-theme\/announcements\.js/);assert.match(await read('public/sitemap.xml'),/https:\/\/nguyencongnghe.com\/ca-lon-nuot-ca-be\//);
  const seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json')),entry=seed.find(x=>x.href==='/ca-lon-nuot-ca-be/');assert.equal(entry.managedPage,false);assert.equal(entry.isPage,true);assert.equal(FISH.length,14);
});
