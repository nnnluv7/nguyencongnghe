import test from 'node:test';
import assert from 'node:assert/strict';
import {COLS,ROWS,RADIUS,WIDTH,HEIGHT,TOP,STEP,DANGER,MAX_ANGLE,LAUNCHER,WORLDS,MODES,maxLevels,validDate,levelSpec,point,rowSize,validCell,index,neighbors,cells,colorsLeft,createGame,traceShot,findCluster,dropFloating,shoot,swap,advance,readSave,readProgress} from '../public/ban-bong/core.js';

function tiny(level=1,mode='journey'){
 const g=createGame({mode,level,seed:9,date:'2026-10-27'});g.board.fill(0);g.board[index(0,5)]=1;g.board[index(1,4)]=1;g.board[index(1,5)]=2;g.current=1;g.next=2;return g;
}
test('60 stages, six colour worlds, relaxation and five reproducible daily stages are valid',()=>{
 assert.equal(WORLDS.length,6);assert.equal(Object.keys(MODES).length,3);
 for(const mode of Object.keys(MODES))for(let level=1;level<=maxLevels(mode);level++){
  const g=createGame({mode,level,seed:423,date:'2026-10-27'}),spec=levelSpec(level,mode,g.date);assert.deepEqual(readSave(g),g);assert.ok(spec.colors>=3&&spec.colors<=6);assert.ok(spec.rows>=3&&spec.rows<=8);assert.ok(cells(g.board,g.phase).every(t=>t.y+RADIUS<DANGER));assert.equal(dropFloating(structuredClone(g)).length,0);
 }
 const a=createGame({mode:'daily',level:3,date:'2026-10-27',seed:1}),b=createGame({mode:'daily',level:3,date:'2026-10-27',seed:999});assert.deepEqual(a,b);assert.notDeepEqual(a.board,createGame({mode:'daily',level:3,date:'2026-10-28'}).board);
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-10-27'),true);assert.throws(()=>createGame({mode:'constructor'}));assert.throws(()=>createGame({level:61}));assert.throws(()=>createGame({mode:'daily',date:'bad'}));
});
test('hex neighbours are reciprocal, exactly one diameter apart, and valid in both row phases',()=>{
 for(const phase of [0,1])for(let r=0;r<ROWS;r++)for(let c=0;c<rowSize(r,phase);c++)for(const [y,x]of neighbors(r,c,phase)){
  assert.ok(validCell(y,x,phase));assert.ok(neighbors(y,x,phase).some(([ny,nx])=>ny===r&&nx===c));const a=point(r,c,phase),b=point(y,x,phase);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-RADIUS*2)<.00001);
 }
 assert.equal(validCell(-1,0),false);assert.equal(validCell(1,10),false);assert.equal(validCell(1,10,1),true);
});
test('the shot ray stops at its first bubble or ceiling and wall bounces stay inside the field',()=>{
 let banks=0;
 for(const level of [1,10,20,30,40,50,60])for(let i=0;i<=120;i++){
  const g=createGame({level,seed:level}),angle=-MAX_ANGLE+i/120*MAX_ANGLE*2,path=traceShot(g,angle);assert.deepEqual(path.points[0],LAUNCHER);assert.ok(path.distance>0&&path.distance<5000);assert.ok(path.points.every(p=>p.x>=RADIUS-.1&&p.x<=WIDTH-RADIUS+.1&&p.y>=TOP-.1&&p.y<=HEIGHT));assert.ok(path.land);assert.ok(validCell(path.land.r,path.land.c,g.phase));assert.equal(g.board[index(path.land.r,path.land.c)],0);
  if(path.target){const end=path.points.at(-1);assert.ok(Math.abs(Math.hypot(end.x-path.target.x,end.y-path.target.y)-RADIUS*2)<.1);}if(path.bounces)banks++;
 }
 assert.ok(banks>0);const g=createGame();g.board.fill(0);assert.equal(traceShot(g,0).points.at(-1).y,TOP);assert.equal(traceShot(g,Infinity).angle,0);
});
test('three connected matching balls burst and unsupported balls fall, with exact cell accounting',()=>{
 const g=tiny(),before=g.board.filter(Boolean).length,event=shoot(g,0);assert.ok(event);assert.equal(event.popped.length,3);assert.equal(event.fallen.length,1);assert.equal(before+1-event.popped.length-event.fallen.length,0);assert.equal(g.status,'cleared');assert.equal(event.stars,3);assert.ok(g.score>600);assert.deepEqual(readSave(g),g);
 const next=advance(g);assert.equal(next.level,2);assert.equal(next.score,g.score);assert.equal(next.totalShots,g.totalShots);assert.equal(next.shots,0);assert.equal(next.powers.bomb,1);
});
test('a group of two does not pop, a separate floating component is removed without following colours',()=>{
 const g=createGame();g.board.fill(0);g.board[index(0,5)]=1;g.current=2;g.next=1;const event=shoot(g,0);assert.equal(event.popped.length,0);assert.equal(g.board.filter(Boolean).length,2);assert.equal(g.combo,0);assert.equal(g.misses,1);
 g.board[index(8,4)]=2;g.board[index(8,5)]=3;assert.equal(dropFloating(g).length,2);assert.equal(g.board.filter(Boolean).length,2);
 assert.equal(findCluster(g,0,5).length,1);
});
test('adding a row toggles the offset while every old ball keeps its horizontal position',()=>{
 const g=createGame();g.board.fill(0);g.board[index(0,0)]=1;g.board[index(0,1)]=2;g.board[index(0,10)]=3;g.current=3;g.next=2;g.shots=g.totalShots=g.totalMisses=g.misses=5;
 const old=cells(g.board,g.phase),event=shoot(g,0);assert.equal(event.rowAdded,true);assert.equal(g.phase,1);assert.equal(g.misses,0);assert.equal(g.rowsAdded,1);
 for(const tile of old){assert.equal(g.board[index(tile.r+1,tile.c)],tile.color);const after=point(tile.r+1,tile.c,g.phase);assert.equal(after.x,tile.x);assert.ok(Math.abs(after.y-tile.y-STEP)<.001);}
 assert.deepEqual(readSave(g),g);
});
test('relax mode never adds a pressure row, but a filled board still has a clear loss boundary',()=>{
 const g=createGame({mode:'relax'});for(let i=0;i<12&&g.status==='playing';i++)shoot(g,i%2?-.9:.9);assert.equal(g.rowsAdded,0);assert.equal(g.misses,0);
 const low=createGame();low.board.fill(0);for(let r=0;r<=13;r++)low.board[index(r,5)]=r%3+1;low.current=3;low.next=1;shoot(low,0);assert.equal(low.status,'lost');
});
test('rainbow inherits the contact colour, bombs burst a radius, and each special is available once per stage',()=>{
 const rainbow=tiny();rainbow.current=3;rainbow.board[index(1,5)]=1;rainbow.next=1;const r=shoot(rainbow,0,'rainbow');assert.equal(r.color,1);assert.equal(rainbow.powers.rainbow,0);assert.equal(rainbow.status,'cleared');
 const bomb=createGame({level:20});const event=shoot(bomb,0,'bomb');assert.ok(event.popped.length>=2);assert.equal(bomb.powers.bomb,0);if(bomb.status==='playing')assert.equal(shoot(bomb,0,'bomb'),null);assert.equal(shoot(bomb,0,'constructor'),null);
});
test('swapping conserves the two loaded balls and never consumes a shot or a special',()=>{
 const g=createGame(),a=g.current,b=g.next,before=structuredClone(g.board);assert.equal(swap(g),true);assert.equal(g.current,b);assert.equal(g.next,a);assert.equal(g.shots,0);assert.deepEqual(g.board,before);g.status='lost';assert.equal(swap(g),false);assert.equal(shoot(g,0),null);
});
test('stage 60 and daily stage five finish without creating an out-of-range stage',()=>{
 for(const [level,mode]of [[60,'journey'],[60,'relax'],[5,'daily']]){const g=tiny(level,mode);shoot(g,0);assert.equal(g.status,'won');assert.equal(advance(g),null);assert.deepEqual(readSave(g),g);}
});
test('random legal play keeps board bounds, a usable colour queue and exact bubble accounting',()=>{
 let n=17,shots=0;const rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 for(let trial=0;trial<65;trial++){
  let g=createGame({level:1+trial%60,mode:trial%3===0?'relax':'journey',seed:trial+1});
  for(let i=0;i<70&&g.status==='playing';i++){
   const before=g.board.filter(Boolean).length,phase=g.phase,event=shoot(g,(rng()*2-1)*MAX_ANGLE,i===5?'bomb':'normal');assert.ok(event);shots++;
   const added=event.rowAdded?rowSize(0,g.phase):0;if(g.status!=='lost')assert.equal(g.board.filter(Boolean).length,before+1-event.popped.length-event.fallen.length+added);
   assert.ok(g.board.every(Number.isInteger));assert.equal(g.board.length,COLS*ROWS);if(g.status==='playing'){assert.ok(colorsLeft(g).includes(g.current));assert.ok(colorsLeft(g).includes(g.next));assert.deepEqual(readSave(g),g);}
   if(event.rowAdded)assert.notEqual(g.phase,phase);
  }
 }
 assert.ok(shots>500);
});
test('save validation rejects bad geometry, dates, counters and values while progress is safely clamped',()=>{
 const g=createGame();for(const change of [{version:2},{phase:9},{current:99},{score:NaN},{score:1.5},{level:61},{mode:'__proto__'},{random:-1},{board:[]},{shots:-1},{powers:{rainbow:7,bomb:1}},{status:'cleared'}])assert.equal(readSave({...g,...change}),null,JSON.stringify(change));
 const malformed=structuredClone(g);malformed.board[index(1,10)]=1;assert.equal(readSave(malformed),null);const floating=structuredClone(g);floating.board[index(10,0)]=1;assert.equal(readSave(floating),null);
 assert.equal(readSave(null),null);assert.equal(readSave('bad'),null);
 const p=readProgress({version:1,best:300,modes:{journey:{unlocked:8,stars:{1:3,7:2,9:3,8:7}},relax:{unlocked:999,stars:{1:1}}}});assert.equal(p.best,300);assert.equal(p.modes.journey.unlocked,8);assert.deepEqual(p.modes.journey.stars,{1:3,7:2});assert.equal(p.modes.relax.unlocked,1);
});
