// Original NCN 8×8 block-placement puzzle. No DOM, timers or network.
export const SIZE=8,DAILY_MOVES=60,MODES=Object.freeze({classic:'Cổ điển',daily:'Hôm nay'});
const specs=[
 ['dot','Một ô',[[0,0]],4],['h2','Hai ô ngang',[[0,0],[1,0]],10],['h3','Ba ô ngang',[[0,0],[1,0],[2,0]],10],['h4','Bốn ô ngang',[[0,0],[1,0],[2,0],[3,0]],7],['h5','Năm ô ngang',[[0,0],[1,0],[2,0],[3,0],[4,0]],4],
 ['v2','Hai ô dọc',[[0,0],[0,1]],10],['v3','Ba ô dọc',[[0,0],[0,1],[0,2]],10],['v4','Bốn ô dọc',[[0,0],[0,1],[0,2],[0,3]],7],['v5','Năm ô dọc',[[0,0],[0,1],[0,2],[0,3],[0,4]],4],
 ['s2','Vuông 2 × 2',[[0,0],[1,0],[0,1],[1,1]],10],['s3','Vuông 3 × 3',[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],3],
 ['r23','Chữ nhật 2 × 3',[[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]],4],['r32','Chữ nhật 3 × 2',[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],4],
 ['c1','Góc ba ô',[[0,0],[0,1],[1,1]],8],['c2','Góc ba ô',[[0,0],[1,0],[0,1]],8],['c3','Góc ba ô',[[0,0],[1,0],[1,1]],8],['c4','Góc ba ô',[[1,0],[0,1],[1,1]],8],
 ['l1','Chữ L',[[0,0],[0,1],[0,2],[1,2]],6],['l2','Chữ L',[[0,0],[1,0],[2,0],[0,1]],6],['l3','Chữ L',[[0,0],[1,0],[1,1],[1,2]],6],['l4','Chữ L',[[2,0],[0,1],[1,1],[2,1]],6],
 ['t1','Chữ T',[[0,0],[1,0],[2,0],[1,1]],6],['t2','Chữ T',[[1,0],[0,1],[1,1],[1,2]],6],['t3','Chữ T',[[1,0],[0,1],[1,1],[2,1]],6],['t4','Chữ T',[[0,0],[0,1],[1,1],[0,2]],6],
 ['z1','Bậc thang',[[0,0],[1,0],[1,1],[2,1]],5],['z2','Bậc thang',[[1,0],[0,1],[1,1],[0,2]],5],['z3','Bậc thang',[[1,0],[2,0],[0,1],[1,1]],5],['z4','Bậc thang',[[0,0],[0,1],[1,1],[1,2]],5]
];
export const SHAPES=Object.freeze(Object.fromEntries(specs.map(([id,name,cells,weight],i)=>[id,Object.freeze({id,name,cells:Object.freeze(cells.map(c=>Object.freeze(c))),w:Math.max(...cells.map(c=>c[0]))+1,h:Math.max(...cells.map(c=>c[1]))+1,size:cells.length,color:i%6+1,weight})])));
export const shape=piece=>piece&&Object.hasOwn(SHAPES,piece.shape)?SHAPES[piece.shape]:null;
export function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0)||1;}
const dateOK=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function rand(g){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296;}
const piece=id=>({shape:id,color:SHAPES[id].color});
export function fits(board,p,row,col){const s=shape(p);return !!s&&Number.isInteger(row)&&Number.isInteger(col)&&row>=0&&col>=0&&row+s.h<=SIZE&&col+s.w<=SIZE&&s.cells.every(([x,y])=>board[(row+y)*SIZE+col+x]===0);}
export function positions(board,p){const s=shape(p),found=[];if(!s)return found;for(let r=0;r<=SIZE-s.h;r++)for(let c=0;c<=SIZE-s.w;c++)if(fits(board,p,r,c))found.push({r,c});return found;}
export function completed(board){return{rows:Array.from({length:SIZE},(_,r)=>r).filter(r=>board.slice(r*SIZE,r*SIZE+SIZE).every(Boolean)),cols:Array.from({length:SIZE},(_,c)=>c).filter(c=>Array.from({length:SIZE},(_,r)=>board[r*SIZE+c]).every(Boolean))};}
export function clearLines(board){const {rows,cols}=completed(board),indices=[...new Set([...rows.flatMap(r=>Array.from({length:SIZE},(_,c)=>r*SIZE+c)),...cols.flatMap(c=>Array.from({length:SIZE},(_,r)=>r*SIZE+c))])],cleared=indices.map(index=>({index,color:board[index]}));for(const i of indices)board[i]=0;return{rows,cols,cleared};}
function put(board,p,r,c){for(const [x,y]of shape(p).cells)board[(r+y)*SIZE+c+x]=p.color;}
function weighted(g,options){let n=rand(g)*options.reduce((a,s)=>a+s.weight,0);for(const s of options){n-=s.weight;if(n<0)return s;}return options.at(-1);}
function deal(g){
 if(g.deals===1)return['h3','h5','c1'].map(piece);
 const board=g.board.slice(),hand=[];
 for(let i=0;i<3;i++){
  // Classic deals have a witnessed legal order. Daily deals are a fixed
  // date-seeded sequence independent of a player's earlier placements.
  const options=Object.values(SHAPES).filter(s=>g.mode==='daily'||positions(board,piece(s.id)).length);
  const chosen=weighted(g,options.length?options:Object.values(SHAPES)),p=piece(chosen.id);hand.push(p);
  if(g.mode==='classic'){const legal=positions(board,p);if(legal.length){const pos=legal[Math.floor(rand(g)*legal.length)];put(board,p,pos.r,pos.c);clearLines(board);}}
 }
 return hand;
}
export function createGame({mode='classic',seed=1,date=''}={}){
 if(!Object.hasOwn(MODES,mode))mode='classic';if(mode==='daily'&&!dateOK(date))throw Error('A valid Vietnamese date is required for the daily puzzle.');seed=mode==='daily'?hash('blast:'+date):((seed>>>0)||1);
 const g={version:1,mode,date,seed,rng:seed,board:Array(64).fill(0),hand:[],deals:1,moves:0,score:0,placedCells:0,clearedCells:0,bonus:0,lines:0,clearTurns:0,combo:0,maxCombo:0,noClear:0,maxClear:0,perfects:0,hintsUsed:0,status:'playing'};g.hand=deal(g);return g;
}
export function preview(g,slot,r,c){if(!Number.isInteger(slot)||slot<0||slot>2||!fits(g.board,g.hand[slot],r,c))return null;const board=g.board.slice(),p=g.hand[slot];put(board,p,r,c);const event=clearLines(board);return{board,...event,slot,r,c,placed:shape(p).cells.map(([x,y])=>(r+y)*SIZE+c+x),color:p.color,count:event.rows.length+event.cols.length};}
export const hasMoves=g=>g.hand.some(p=>p&&positions(g.board,p).length>0);
export function place(g,slot,r,c){
 if(g.status!=='playing')return null;const event=preview(g,slot,r,c);if(!event)return null;const n=event.placed.length;g.board=event.board;g.hand[slot]=null;g.moves++;g.placedCells+=n;g.clearedCells+=event.cleared.length;
 let bonus=0;if(event.count){g.combo++;g.maxCombo=Math.max(g.maxCombo,g.combo);g.noClear=0;g.lines+=event.count;g.clearTurns++;g.maxClear=Math.max(g.maxClear,event.count);const multiplier=1+Math.min(4,Math.floor((g.combo-1)/2));bonus=(event.count*80+event.count*(event.count-1)*40)*multiplier;event.multiplier=multiplier;if(g.board.every(x=>x===0)){bonus+=300;g.perfects++;event.perfect=true;}}
 else{g.noClear=Math.min(3,g.noClear+1);if(g.noClear===3)g.combo=0;}
 g.bonus+=bonus;event.earned=n*5+bonus;g.score+=event.earned;event.combo=g.combo;
 if(g.mode==='daily'&&g.moves>=DAILY_MOVES)g.status='won';
 else{if(g.hand.every(p=>p===null)){g.deals++;g.hand=deal(g);event.dealt=true;}if(!hasMoves(g))g.status='lost';}
 return event;
}
export function hint(g){
 if(g.status!=='playing'||g.hintsUsed>=3)return null;let best=null,value=-Infinity;
 for(let slot=0;slot<3;slot++)for(const {r,c}of positions(g.board,g.hand[slot])){const p=preview(g,slot,r,c);let holes=0;for(let i=0;i<64;i++)if(!p.board[i]){const y=Math.floor(i/8),x=i%8,neighbours=[[y-1,x],[y+1,x],[y,x-1],[y,x+1]].filter(([r,c])=>r>=0&&r<8&&c>=0&&c<8);if(neighbours.every(([r,c])=>p.board[r*8+c]))holes++;}
  const room=g.hand.reduce((n,h,i)=>n+(h&&i!==slot?positions(p.board,h).length:0),0),score=p.count*10000+(p.board.every(x=>x===0)?1000:0)+room*2-holes*20+shape(g.hand[slot]).size-r*.01-c*.001;
  if(score>value){value=score;best={slot,r,c};}
 }return best;
}
export function useHint(g){const suggestion=hint(g);if(suggestion)g.hintsUsed++;return suggestion;}
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function readSave(raw){try{
 if(!raw||raw.version!==1||!Object.hasOwn(MODES,raw.mode)||raw.status!=='playing'||!int(raw.seed,1,4294967295)||!int(raw.rng,0,4294967295)||typeof raw.date!=='string'||raw.date.length>10||raw.mode==='daily'&&(!dateOK(raw.date)||raw.seed!==hash('blast:'+raw.date)))return null;
 if(!Array.isArray(raw.board)||raw.board.length!==64||raw.board.some(x=>!int(x,0,6))||!Array.isArray(raw.hand)||raw.hand.length!==3||raw.hand.some(p=>p!==null&&(!shape(p)||p.color!==shape(p).color)))return null;
 if(!int(raw.moves,0,raw.mode==='daily'?DAILY_MOVES-1:1000000)||raw.deals!==1+Math.floor(raw.moves/3)||raw.hand.filter(p=>p===null).length!==raw.moves%3)return null;
 if(!int(raw.score,0,999999999)||!int(raw.placedCells,raw.moves,raw.moves*9)||!int(raw.clearedCells,0,raw.placedCells)||!int(raw.bonus,0,raw.score)||raw.score!==raw.placedCells*5+raw.bonus||raw.board.filter(Boolean).length!==raw.placedCells-raw.clearedCells)return null;
 if(!int(raw.clearTurns,0,raw.moves)||!int(raw.lines,raw.clearTurns,raw.clearTurns*16)||!int(raw.combo,0,raw.clearTurns)||!int(raw.maxCombo,raw.combo,raw.clearTurns)||!int(raw.noClear,0,3)||raw.noClear===3&&raw.combo!==0||!int(raw.maxClear,0,16)||!int(raw.perfects,0,raw.clearTurns)||!int(raw.hintsUsed,0,3)||completed(raw.board).rows.length||completed(raw.board).cols.length||!hasMoves(raw))return null;
 if(raw.moves===0&&(raw.score||raw.board.some(Boolean)||raw.hand.some((p,i)=>p?.shape!==['h3','h5','c1'][i])))return null;
 const result={};for(const key of ['version','mode','date','seed','rng','board','hand','deals','moves','score','placedCells','clearedCells','bonus','lines','clearTurns','combo','maxCombo','noClear','maxClear','perfects','hintsUsed','status'])result[key]=structuredClone(raw[key]);result.ranked=raw.ranked===true;return result;
 }catch{return null;}}
