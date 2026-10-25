import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Arena,hash,vietnamDate,challengeDate,cleanProfile,awardProfile,SKINS} from '../public/ran-luot/core.js';

const start=options=>new Arena().start({seed:777,...options});
function opponent(arena,x=5,y=0){const s=arena.snake(x,y,0,110,SKINS[1],'AI');s.safe=0;s.points=Array.from({length:25},()=>({x,y}));return s;}
function collisionFixture(){const a=start();a.food=[];a.player.safe=0;a.bots=[opponent(a)];return a;}
test('daily seeds reproduce the world, while different dates create a new arena',()=>{
  const snapshot=a=>JSON.stringify({food:a.food,bots:a.bots});const a=start({seed:hash('2026-10-25')}),b=start({seed:hash('2026-10-25')}),c=start({seed:hash('2026-10-26')});assert.equal(snapshot(a),snapshot(b));assert.notEqual(snapshot(a),snapshot(c));
  for(let i=0;i<300;i++){a.step(1/60,{angle:1.2,boost:i%60<10});b.step(1/60,{angle:1.2,boost:i%60<10});}assert.equal(snapshot(a),snapshot(b));assert.equal(a.score,b.score);
});
test('dates use Vietnam midnight and shared challenges reject impossible calendar values',()=>{
  assert.equal(vietnamDate(new Date('2026-10-25T17:00:00Z')),'2026-10-26');assert.equal(vietnamDate(new Date('2026-10-25T16:59:59Z')),'2026-10-25');assert.equal(challengeDate('2026-02-29'),'');assert.equal(challengeDate('2028-02-29'),'2028-02-29');assert.equal(challengeDate('<script>'),'');
});
test('combo expires after a gap, grows to x5 and fever has a bounded duration and cooldown',()=>{
  const a=start();a.bots=[];a.food=[];const f={x:0,y:0,value:1,type:'nectar'};
  for(let i=0;i<17;i++){a.elapsed+=.1;a.collect(f);}assert.equal(a.combo,3);a.collect(f);assert.equal(a.fever,7);const prior=a.score;a.collect(f);assert.ok(a.score-prior>=60);
  for(let i=0;i<35;i++){a.elapsed+=.01;a.collect(f);}assert.equal(a.maxCombo,5);assert.equal(a.fever,7);a.elapsed+=2.2;a.collect(f);assert.equal(a.combo,1);
});
test('boost consumes only replenishable energy, preserves growth and cannot go below zero',()=>{
  const a=start();a.bots=[];a.food=[];const mass=a.player.mass;
  for(let i=0;i<150;i++)a.step(1/60,{angle:i*.025,boost:true});assert.ok(a.energy<40);assert.ok(a.player.mass>=mass);
  for(let i=0;i<60;i++)a.step(1/60,{angle:i*.04,boost:false});assert.ok(a.energy>10);assert.ok(a.energy<=100);
});
test('phase crosses another snake and pauses freeze the entire simulation',()=>{
  const a=collisionFixture();assert.equal(a.phaseDash(),true);assert.equal(a.phaseDash(),false);a.step(1/60,{angle:0});assert.equal(a.status,'playing');assert.ok(a.cooldown>12);
  a.pause();const snapshot=JSON.stringify(a);for(let i=0;i<10;i++)a.step(.05,{boost:true});assert.equal(JSON.stringify(a),snapshot);assert.equal(a.phaseDash(),false);a.resume();assert.equal(a.status,'playing');
});
test('snake collisions kill, a shield absorbs one collision, phase never bypasses the arena boundary',()=>{
  const dead=collisionFixture();dead.step(1/60);assert.equal(dead.status,'over');assert.equal(dead.reason,'snake');
  const shield=collisionFixture();shield.player.shield=8;shield.step(1/60);assert.equal(shield.status,'playing');assert.equal(shield.player.shield,0);assert.ok(shield.player.safe>1);
  const edge=start();edge.bots=[];edge.player.x=edge.radius-5;edge.phaseDash();edge.step(1/60);assert.equal(edge.reason,'edge');
});
test('AI deaths award only player-caused kills and spill a bounded amount of loot',()=>{
  const a=start(),s=a.bots[0],before=a.food.length;a.kill(s,a.player);assert.equal(a.kills,1);assert.equal(a.score,180);assert.ok(a.food.length>before);a.kill(s,a.player);assert.equal(a.kills,1);
  a.kill(a.bots[1],a.bots[2]);assert.equal(a.kills,1);for(let i=0;i<2000;i++)a.addFood();assert.equal(a.food.length,1000);
});
test('simultaneous collisions finalize all earned points before the result and never spill food outside the arena',()=>{
  let terminalScore=-1;const a=new Arena({onEvent:e=>{if(e.type==='over')terminalScore=a.score;}}).start({seed:42});a.player.safe=0;a.player.points=Array.from({length:40},()=>({x:0,y:0}));a.bots=[opponent(a,4,0)];a.step(1/60);assert.equal(a.status,'over');assert.equal(a.kills,1);assert.equal(terminalScore,a.score);
  a.addFood(9999,9999,2);assert.ok(a.food.every(f=>Math.hypot(f.x,f.y)<a.radius-30));
});
test('weather triggers once per cycle and core collection refreshes phase',()=>{
  const a=start();a.elapsed=20;a.eventStep();assert.equal(a.event.type,'bloom');const count=a.food.length;a.eventStep();assert.equal(a.food.length,count);a.elapsed=55;a.eventStep();assert.equal(a.event.type,'core');assert.equal(a.food.filter(f=>f.type==='core').length,1);a.cooldown=8;a.collect(a.food.find(f=>f.type==='core'));assert.equal(a.cooldown,0);assert.ok(a.score>=400);a.elapsed=67;a.eventStep();assert.equal(a.event,null);assert.equal(a.food.some(f=>f.type==='core'),false);
});
test('daily runs finish exactly at three minutes and do not advance after finishing',()=>{
  const a=start({mode:'daily'});a.elapsed=180-1/120;a.bots=[];a.step(1/60);assert.equal(a.status,'over');assert.equal(a.reason,'time');const elapsed=a.elapsed;a.step(.05);assert.equal(a.elapsed,elapsed);
});
test('local records are validated, cosmetic unlocks require XP and daily records stay separate',()=>{
  assert.deepEqual(cleanProfile({best:-1,xp:NaN,skin:'gold',date:'oops'}),cleanProfile());const p=cleanProfile({best:500,xp:340,skin:'mint'}),r=awardProfile(p,{score:900,kills:2,elapsed:80,mode:'daily'},'2026-10-25');assert.equal(r.best,500);assert.equal(r.daily,900);assert.equal(r.date,'2026-10-25');assert.equal(r.xp,474);assert.equal(p.xp,340);assert.equal(cleanProfile({...r,skin:'coral'}).skin,'coral');assert.equal(cleanProfile({...r,skin:'gold'}).skin,'mint');
});
test('game is discoverable before hydration, uses the shared account and has all public routes',async()=>{
  const read=p=>readFile(p,'utf8'),home=await read('public/index.html'),game=await read('public/ran-luot/index.html'),routes=JSON.parse(await read('netlify/lib/ncn-shell/pages.json')),config=JSON.parse(await read('public/assets/ncn-theme/config.json'));
  assert.equal(config.tools.filter(t=>t.href==='/ran-luot/').length,1);assert.match(home,/data-ncn-pin="ran-luot"/);assert.match(game,/id="ncn-account-host"/);assert.match(game,/ncn-theme\/theme\.js/);assert.equal(routes['/ran-luot/'],'ran-luot/index.html');assert.equal(routes['/ran-luot/index.html'],'ran-luot/index.html');assert.equal(routes['/ran-luot'],'ran-luot/index.html');
  assert.equal((home.match(/class="ncn-tool-card /g)||[]).length,config.tools.length);assert.match(await read('public/sitemap.xml'),/https:\/\/nguyencongnghe.com\/ran-luot\//);
});
