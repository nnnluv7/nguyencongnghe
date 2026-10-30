// Pure, deterministic Bubble Shooter rules. Rendering and storage live elsewhere.
export const COLS=11,ROWS=15,RADIUS=24,WIDTH=528,HEIGHT=744,TOP=32,STEP=Math.sqrt(3)*RADIUS;
export const LAUNCHER={x:WIDTH/2,y:HEIGHT-58},DANGER=HEIGHT-130,MAX_ANGLE=1.34;
export const MODES={journey:'Hành trình',relax:'Thư giãn',daily:'Hôm nay'};
export const CAMPAIGN_LEVELS=200,STONE=7;
export const WORLDS=[
 {name:'Vườn ban mai',color:'#85e0bf',sky:'#123c38',note:'Một góc vườn, một trời ký ức.'},
 {name:'Biển thủy tinh',color:'#82d8f4',sky:'#143a50',note:'Những viên bi mang màu của sóng.'},
 {name:'Đồi hoàng hôn',color:'#ffb294',sky:'#493446',note:'Gom một chút nắng cuối ngày.'},
 {name:'Vườn mộng tím',color:'#c8afff',sky:'#343450',note:'Bật tường, chạm những vì sao.'},
 {name:'Rừng đom đóm',color:'#d6e986',sky:'#253d36',note:'Một chuỗi bóng, ngàn tia lấp lánh.'},
 {name:'Thung lũng trứng',color:'#ffb2d4',sky:'#44324d',note:'Tìm một đường cắt qua những chùm trứng.'},
 {name:'Đầm sương bạc',color:'#b9e3ec',sky:'#264854',note:'Đừng để hàng trứng chạm vạch tổ.'},
 {name:'Vách đá hổ phách',color:'#f5ca7e',sky:'#4d3d2d',note:'Trứng đá không ghép màu: hãy cắt chùm phía trên.'},
 {name:'Rừng cổ thụ',color:'#92cba4',sky:'#193e37',note:'Giữ trợ lực cho cú bắn thật cần thiết.'},
 {name:'Miệng núi lửa',color:'#ffac7e',sky:'#4c3037',note:'Cột mốc 100: cả khu rừng chờ một cú bật tường.'},
 {name:'Hồ pha lê',color:'#98d9ef',sky:'#213e55',note:'Ít đường ngắm hơn, nhiều góc bắn hay hơn.'},
 {name:'Hẻm núi đỏ',color:'#efa18f',sky:'#4f343d',note:'Cắt những điểm nối để trứng đá rơi cùng chùm.'},
 {name:'Cánh đồng dương xỉ',color:'#bfe194',sky:'#31462c',note:'Bàn trứng dày hơn, cần chọn đúng thứ tự màu.'},
 {name:'Đỉnh băng xanh',color:'#b2d9fc',sky:'#2d3b5b',note:'Nhịp hạ hàng nhanh dần. Ngắm gọn, bắn chuẩn.'},
 {name:'Rừng sao băng',color:'#d2b8ff',sky:'#323251',note:'Đường bật tường mở lối vào các chùm phía sau.'},
 {name:'Sa mạc hóa thạch',color:'#f1d38e',sky:'#494031',note:'Giữ bình tĩnh trước những lớp trứng đá.'},
 {name:'Đảo san hô cổ',color:'#ffaac0',sky:'#46324b',note:'Một pha cắt chùm đẹp có thể cứu cả màn.'},
 {name:'Rừng cực quang',color:'#91eccd',sky:'#1a4148',note:'Sáu màu, ít trợ lực và nhịp rơi sát hơn.'},
 {name:'Thác trời',color:'#9fd3ff',sky:'#253a56',note:'Tận dụng đổi trứng trước mỗi lượt bắn.'},
 {name:'Tổ rồng huyền thoại',color:'#ffe0a1',sky:'#44394b',note:'Màn 200 đang chờ. Hãy giữ tổ an toàn!'}
];
export const maxLevels=mode=>mode==='daily'?5:CAMPAIGN_LEVELS;
export function validDate(date){return typeof date==='string'&&/^20\d\d-\d\d-\d\d$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function daySeed(date){let n=2166136261;for(const c of date)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function levelSpec(level=1,mode='journey',date=''){
 const difficulty=mode==='daily'?35+(daySeed(date)%120)+level*3:level,world=Math.min(19,Math.floor((difficulty-1)/10)),boss=mode==='daily'?level===5:level%10===0;
 const colors=mode==='daily'?6:difficulty<9?3:difficulty<23?4:difficulty<41?5:6;
 const rows=Math.min(11,3+Math.floor((difficulty-1)/24)+(boss?1:0));
 const riseEvery=mode==='relax'?0:Math.max(28,(difficulty<=5?90:difficulty<=20?65:difficulty<=50?55:difficulty<=100?45:difficulty<=150?38:32)-(boss?4:0));
 const powers=mode==='relax'?{rainbow:1,bomb:1}:mode==='daily'?{rainbow:level===1||level===5?1:0,bomb:level===3?1:0}:{rainbow:level<=10||level%5===0?1:0,bomb:level<=5||level%10===0?1:0};
 return {...WORLDS[world],world,difficulty,boss,rows,colors,riseEvery,powers,stones:difficulty<31?0:Math.min(12,2+Math.floor(difficulty/25)+(boss?2:0)),mix:Math.min(.66,.12+difficulty*.003),aimLength:mode==='relax'?2000:difficulty<31?1500:difficulty<81?850:difficulty<141?580:420,missLimit:mode==='relax'?0:difficulty<16?6:difficulty<51?5:difficulty<131?4:3,title:(boss?'Thử thách · ':'')+(mode==='daily'?'Tổ trứng hôm nay':WORLDS[world].name)};
}
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export const parity=(row,phase=0)=>(row+phase)%2;
export const rowSize=(row,phase=0)=>COLS-parity(row,phase);
export const validCell=(r,c,phase=0)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&r<ROWS&&c>=0&&c<rowSize(r,phase);
export const index=(r,c)=>r*COLS+c;
export function point(r,c,phase=0){return {x:RADIUS+parity(r,phase)*RADIUS+c*RADIUS*2,y:TOP+r*STEP};}
export function neighbors(r,c,phase=0){
 const shifted=parity(r,phase),cross=shifted?[c,c+1]:[c-1,c];
 return [[r,c-1],[r,c+1],...[r-1,r+1].flatMap(y=>cross.map(x=>[y,x]))].filter(([y,x])=>validCell(y,x,phase));
}
export function cells(board,phase=0){const result=[];for(let r=0;r<ROWS;r++)for(let c=0;c<rowSize(r,phase);c++){const color=board[index(r,c)];if(color)result.push({r,c,color,...point(r,c,phase)});}return result;}
export function colorsLeft(game){return [...new Set(game.board.filter(n=>n>0&&n<STONE))].sort((a,b)=>a-b);}
function random(game){let t=game.random=(game.random+0x6d2b79f5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function choose(game){const palette=colorsLeft(game);if(!palette.length)return 0;return palette[Math.floor(random(game)*palette.length)];}
export function createGame({mode='journey',level=1,seed=1,score=0,date=''}={}){
 if(!Object.hasOwn(MODES,mode)||!Number.isInteger(level)||level<1||level>maxLevels(mode)||mode==='daily'&&!validDate(date))throw new RangeError('Invalid bubble mode or stage');
 if(!Number.isSafeInteger(score)||score<0||score>999999999)throw new RangeError('Invalid score');
 const originSeed=mode==='daily'?daySeed(date):Number(seed)>>>0,spec=levelSpec(level,mode,date);
 const game={version:2,mode,date:mode==='daily'?date:'',level,seed:originSeed,random:(originSeed^Math.imul(level,2654435761))>>>0,board:Array(COLS*ROWS).fill(0),phase:0,current:0,next:0,score,shots:0,totalShots:0,totalMisses:0,misses:0,combo:0,bestCombo:0,rowsAdded:0,pressureTime:0,powers:{...spec.powers},status:'playing'};
 const offset=Math.floor(random(game)*spec.colors);
 for(let r=0;r<spec.rows;r++)for(let c=0;c<rowSize(r);c++){
  const edge=Math.min(c,rowSize(r)-1-c),cut=level>3&&r>spec.rows-2&&edge<(level%3);
  if(cut)continue;
  let color=1+((Math.floor(c/2)+r+offset+(worldPattern(spec.world,r,c)))%spec.colors);
  if(random(game)<spec.mix)color=1+Math.floor(random(game)*spec.colors);
  game.board[index(r,c)]=color;
  // Keep small targets rather than giant ready-made colour slabs.
  for(let n=0;n<spec.colors&&findCluster(game,r,c).length>5;n++)game.board[index(r,c)]=1+(game.board[index(r,c)]%spec.colors);
 }
 const rocks=cells(game.board).filter(t=>t.r>=2&&t.r<spec.rows-1&&t.c>0&&t.c<rowSize(t.r)-1);
 for(let i=0;i<spec.stones&&rocks.length;i++){const at=Math.floor(random(game)*rocks.length),[tile]=rocks.splice(at,1);game.board[index(tile.r,tile.c)]=STONE;}
 dropFloating(game);game.current=choose(game);game.next=choose(game);return game;
}
function worldPattern(world,r,c){return world%4===0?Math.floor(r/3):world%4===1?Math.floor((r+c)/3):world%4===2?(r%2?Math.floor(c/3):0):Math.floor((c+r*2)/4);}
export function findCluster(game,r,c){
 const color=game.board[index(r,c)];if(!color||!validCell(r,c,game.phase))return [];
 if(color===STONE)return [];
 const seen=new Set([index(r,c)]),stack=[[r,c]],result=[];
 while(stack.length){const [y,x]=stack.pop();result.push([y,x]);for(const [ny,nx]of neighbors(y,x,game.phase)){const key=index(ny,nx);if(!seen.has(key)&&game.board[key]===color){seen.add(key);stack.push([ny,nx]);}}}
 return result;
}
export function dropFloating(game){
 const seen=new Set(),stack=[];
 for(let c=0;c<rowSize(0,game.phase);c++)if(game.board[index(0,c)]){seen.add(index(0,c));stack.push([0,c]);}
 while(stack.length){const [r,c]=stack.pop();for(const [y,x]of neighbors(r,c,game.phase)){const key=index(y,x);if(!seen.has(key)&&game.board[key]){seen.add(key);stack.push([y,x]);}}}
 const fallen=[];for(const tile of cells(game.board,game.phase))if(!seen.has(index(tile.r,tile.c))){fallen.push(tile);game.board[index(tile.r,tile.c)]=0;}return fallen;
}
export function traceShot(game,angle=0){
 angle=clamp(Number.isFinite(angle)?angle:0,-MAX_ANGLE,MAX_ANGLE);
 let x=LAUNCHER.x,y=LAUNCHER.y,dx=Math.sin(angle),dy=-Math.cos(angle),distance=0;
 const points=[{x,y}],tiles=cells(game.board,game.phase);let target=null,bounces=0;
 for(let turn=0;turn<12;turn++){
  let time=(TOP-y)/dy,kind='ceiling',hit=null;
  const wall=Math.abs(dx)>.000001?((dx>0?WIDTH-RADIUS:RADIUS)-x)/dx:Infinity;
  if(wall>=0&&wall<time){time=wall;kind='wall';}
  for(const tile of tiles){
   const ox=x-tile.x,oy=y-tile.y,b=ox*dx+oy*dy,c=ox*ox+oy*oy-(RADIUS*2-.02)**2,discriminant=b*b-c;
   if(discriminant<0)continue;const t=-b-Math.sqrt(discriminant);
   if(t>.001&&t<=time+.001){time=t;kind='bubble';hit=tile;}
  }
  if(!Number.isFinite(time)||time<0)break;
  x+=dx*time;y+=dy*time;distance+=time;points.push({x,y});
  if(kind!=='wall'){target=hit;break;}
  bounces++;dx=-dx;x+=dx*.001;
 }
 const end=points.at(-1),candidates=target?neighbors(target.r,target.c,game.phase):Array.from({length:rowSize(0,game.phase)},(_,c)=>[0,c]);
 const free=candidates.filter(([r,c])=>!game.board[index(r,c)]).map(([r,c])=>({r,c,...point(r,c,game.phase)})).sort((a,b)=>Math.hypot(a.x-end.x,a.y-end.y)-Math.hypot(b.x-end.x,b.y-end.y));
 return {points,distance,target,bounces,angle,land:free[0]||null};
}
export function swap(game){if(game.status!=='playing')return false;[game.current,game.next]=[game.next,game.current];return true;}
function addRow(game){
 const palette=colorsLeft(game),old=game.board,phase=1-game.phase;let overflow=false;
 game.board=Array(COLS*ROWS).fill(0);
 for(let r=0;r<ROWS;r++)for(let c=0;c<rowSize(r,game.phase);c++)if(old[index(r,c)]){if(r===ROWS-1)overflow=true;else game.board[index(r+1,c)]=old[index(r,c)];}
 game.phase=phase;const bias=Math.floor(random(game)*palette.length);
 for(let c=0;c<rowSize(0,phase);c++)game.board[index(0,c)]=palette[(Math.floor(c/2)+bias+(random(game)<.35?1:0))%palette.length];
 game.rowsAdded++;return overflow;
}
function pressureRow(game){const overflow=addRow(game);game.misses=0;game.pressureTime=0;if(overflow||cells(game.board,game.phase).some(tile=>tile.y+RADIUS>=DANGER))game.status='lost';}
// Advance active foreground time only. The caller defers a fall until a flying
// egg has landed, so an already-computed ray never collides with a moved board.
export function tickGame(game,seconds,{defer=false}={}){
 if(game.status!=='playing'||game.mode==='relax'||!Number.isFinite(seconds)||seconds<0)return null;
 const interval=levelSpec(game.level,game.mode,game.date).riseEvery;
 game.pressureTime=Math.min(interval,(game.pressureTime||0)+Math.min(1,seconds));
 if(defer||game.pressureTime<interval)return null;
 pressureRow(game);return {rowAdded:true,lost:game.status==='lost'};
}
export function shoot(game,angle=0,power='normal'){
 if(game.status!=='playing'||!['normal','rainbow','bomb'].includes(power)||power!=='normal'&&!game.powers[power])return null;
 const path=traceShot(game,angle);if(!path.land){game.status='lost';return {...path,kind:'miss',popped:[],fallen:[],earned:0,rowAdded:false,stars:0};}
 const {r,c}=path.land,color=power==='rainbow'&&path.target?.color!==STONE?(path.target?.color||game.current):game.current;
 game.board[index(r,c)]=color;game.shots++;game.totalShots++;if(power!=='normal')game.powers[power]--;
 let popped=[];
 if(power==='bomb')popped=cells(game.board,game.phase).filter(tile=>Math.hypot(tile.x-path.land.x,tile.y-path.land.y)<=RADIUS*3.3);
 else{const cluster=findCluster(game,r,c);if(cluster.length>=3)popped=cluster.map(([y,x])=>({r:y,c:x,color:game.board[index(y,x)],...point(y,x,game.phase)}));}
 for(const tile of popped)game.board[index(tile.r,tile.c)]=0;
 const fallen=dropFloating(game),matched=popped.length>0;
 if(matched){game.combo++;game.bestCombo=Math.max(game.bestCombo,game.combo);game.misses=Math.max(0,game.misses-1);}
 else{game.combo=0;game.totalMisses++;game.misses++;}
 let earned=matched?(popped.length*10+fallen.length*20)*Math.min(5,game.combo)+(path.bounces?25*path.bounces:0):0;
 const spec=levelSpec(game.level,game.mode,game.date);let rowAdded=false,overflow=false;
 if(!game.board.some(Boolean)){
  const stars=game.totalMisses===0?3:game.totalMisses<=Math.max(2,Math.floor(game.shots/4))?2:1;
  earned+=300+stars*100;game.status=game.level===maxLevels(game.mode)?'won':'cleared';
 }else if(spec.missLimit&&game.misses>=spec.missLimit){rowAdded=true;pressureRow(game);}
 else if(!spec.missLimit)game.misses=0;
 if(overflow||cells(game.board,game.phase).some(tile=>tile.y+RADIUS>=DANGER))game.status='lost';
 game.score=Math.min(999999999,game.score+earned);
 const palette=colorsLeft(game);game.current=palette.includes(game.next)?game.next:choose(game);game.next=choose(game);
 return {...path,kind:power==='bomb'?'bomb':matched?'match':'miss',popped,fallen,earned,rowAdded,color,stars:['cleared','won'].includes(game.status)?game.totalMisses===0?3:game.totalMisses<=Math.max(2,Math.floor(game.shots/4))?2:1:0};
}
export function advance(game){
 if(game.status!=='cleared'||game.level>=maxLevels(game.mode))return null;
 const next=createGame({mode:game.mode,date:game.date,seed:game.seed,level:game.level+1,score:game.score});next.totalShots=game.totalShots;next.bestCombo=game.bestCombo;return next;
}
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function readSave(value){
 try{
  const g=structuredClone(value);if(!g||![1,2].includes(g.version)||!Object.hasOwn(MODES,g.mode)||!integer(g.level,1,maxLevels(g.mode))||g.mode==='daily'&&!validDate(g.date)||g.mode!=='daily'&&g.date!=='')return null;
  if(!integer(g.phase,0,1)||!integer(g.seed,0,4294967295)||!integer(g.random,0,4294967295)||!Array.isArray(g.board)||g.board.length!==COLS*ROWS||!['playing','cleared','won','lost'].includes(g.status))return null;
  const spec=levelSpec(g.level,g.mode,g.date);
  if(g.version===1){g.version=2;g.pressureTime=0;if(integer(g.misses,0,6))g.misses=Math.min(g.misses,Math.max(0,spec.missLimit-1));if(g.status==='won'&&g.mode!=='daily'&&g.level===60)g.status='cleared';}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!(integer(g.board[index(r,c)],0,spec.colors)||g.board[index(r,c)]===STONE&&spec.stones>0&&r>0)||c>=rowSize(r,g.phase)&&g.board[index(r,c)]!==0)return null;
  if(!integer(g.score,0,999999999)||!integer(g.shots,0,10000)||!integer(g.totalShots,g.shots,2000000)||!integer(g.totalMisses,0,g.shots)||!integer(g.misses,0,Math.max(0,spec.missLimit-1))||!integer(g.combo,0,g.shots)||!integer(g.bestCombo,g.combo,g.totalShots)||!integer(g.rowsAdded,0,10000)||!Number.isFinite(g.pressureTime)||g.pressureTime<0||g.pressureTime>spec.riseEvery||!g.powers||!integer(g.powers.rainbow,0,1)||!integer(g.powers.bomb,0,1))return null;
  const palette=colorsLeft(g);if(!integer(g.current,0,spec.colors)||!integer(g.next,0,spec.colors))return null;
  if(g.status==='playing'&&(!palette.includes(g.current)||!palette.includes(g.next)||cells(g.board,g.phase).some(tile=>tile.y+RADIUS>=DANGER)))return null;
  if(['cleared','won'].includes(g.status)&&(palette.length||g.status==='cleared'&&g.level>=maxLevels(g.mode)||g.status==='won'&&g.level!==maxLevels(g.mode)))return null;
  const probe=structuredClone(g);if(g.status==='playing'&&dropFloating(probe).length)return null;
  return g;
 }catch{return null;}
}
export function readProgress(value){
 const result={version:2,best:0,modes:{journey:{unlocked:1,stars:{}},relax:{unlocked:1,stars:{}}}};
 if(![1,2].includes(value?.version))return result;if(integer(value.best,0,999999999))result.best=value.best;
 for(const mode of ['journey','relax']){const old=value.modes?.[mode];if(!old)continue;const target=result.modes[mode];if(integer(old.unlocked,1,CAMPAIGN_LEVELS))target.unlocked=old.unlocked;for(const [key,n]of Object.entries(old.stars||{}))if(/^\d+$/.test(key)&&integer(Number(key),1,target.unlocked)&&integer(n,1,3))target.stars[Number(key)]=n;if(value.version===1&&target.unlocked===60&&target.stars[60])target.unlocked=61;}
 return result;
}
