// Pure Onet rules. The one-cell empty frame is part of the playing field.
import {CAMPAIGN_LEVEL_COUNT} from '../assets/ncn-arcade/campaign.js';

export const VERSION=1;
export const SPECIES=['Pikachu','Bulbasaur','Charmander','Squirtle','Jigglypuff','Meowth','Psyduck','Eevee','Snorlax','Gengar','Oddish','Vulpix','Slowpoke','Poliwag','Mew','Togepi','Chikorita','Cyndaquil','Totodile','Pichu'];
export const GRAVITY_LABELS={none:'Giữ nguyên vị trí',down:'Ô dồn xuống ↓',left:'Ô dồn sang trái ←',up:'Ô dồn lên trên ↑',right:'Ô dồn sang phải →','horizontal-in':'Dồn vào giữa → ←','horizontal-out':'Tách sang hai bên ← →','vertical-in':'Dồn giữa theo cột ↓ ↑','vertical-out':'Tách lên và xuống ↑ ↓','zigzag-rows':'Hàng chẵn lẻ đổi hướng ⇄','zigzag-columns':'Cột chẵn lẻ đổi hướng ⇅',cycle:'Đổi hướng sau mỗi cặp ↻'};
const opening=[
 {name:'Ngày đầu gặp lại',gravity:'none'},{name:'Rơi về tuổi thơ',gravity:'down'},{name:'Nghiêng một chút',gravity:'left'},{name:'Ngược dòng ký ức',gravity:'up'},{name:'Một lần nữa thôi',gravity:'right'},
 {name:'Hẹn nhau ở giữa',gravity:'horizontal-in'},{name:'Hai phía sân trường',gravity:'horizontal-out'},{name:'Những hàng ghế nhỏ',gravity:'zigzag-rows'},{name:'Chạm vào khoảng giữa',gravity:'vertical-in'},{name:'Chiếc chong chóng',gravity:'cycle'},
 {name:'Hè về bên cửa sổ',gravity:'down'},{name:'Cánh diều ngược gió',gravity:'up'},{name:'Hai đầu con phố',gravity:'vertical-out'},{name:'Lối đi zíc zắc',gravity:'zigzag-columns'},{name:'Hội bạn tụ họp',gravity:'horizontal-in'},
 {name:'Tiệm game đầu ngõ',gravity:'right'},{name:'Đổi chỗ cho nhau',gravity:'zigzag-rows'},{name:'Tách đôi bí mật',gravity:'horizontal-out'},{name:'Chuyến tàu ký ức',gravity:'vertical-in'},{name:'Bốn mùa xoay vòng',gravity:'cycle'},
 {name:'Những người bạn cũ',gravity:'left'},{name:'Dòng sông hai ngả',gravity:'vertical-out'},{name:'Trò chơi ô ăn quan',gravity:'zigzag-columns'},{name:'Gom đầy một mùa hè',gravity:'horizontal-in'},{name:'Đường về hai phía',gravity:'horizontal-out'},
 {name:'Đi tìm mảnh ghép',gravity:'zigzag-rows'},{name:'Gặp nhau giữa trời',gravity:'vertical-in'},{name:'Bậc thang cầu vồng',gravity:'zigzag-columns'},{name:'Bầu trời rộng mở',gravity:'vertical-out'},{name:'Tuổi thơ không khép lại',gravity:'cycle'}
];
const chapters=['Sân trường mùa hè','Ngã rẽ nhỏ','Chuyến xe chiều','Lối qua vườn','Những vòng xoay','Ngày hội nối thú','Hẹn lại tuổi thơ'];
const advanced=['down','vertical-in','right','horizontal-out','up','vertical-out','zigzag-rows','zigzag-columns','horizontal-in'];
export const LEVELS=[...opening,...Array.from({length:CAMPAIGN_LEVEL_COUNT-opening.length},(_,i)=>{
 const chapter=Math.floor(i/10),stage=i%10;
 return {name:chapters[chapter]+' · Màn '+(opening.length+i+1),gravity:stage===9||chapter>=4&&stage===4?'cycle':advanced[(stage+chapter*2)%advanced.length]};
})];
export function stageRules(level,mode='classic'){
 if(mode==='daily')return {rows:8,cols:10,species:SPECIES.length,time:360,hints:3,shuffles:3};
 const classic=mode==='classic';
 return {
  rows:level>=70?10:8,cols:level>=40?12:10,
  species:Math.min(SPECIES.length,12+Math.floor(level/10)),
  time:classic?360-5*Math.floor(level/5):360,
  hints:classic&&level>=65?1:classic&&level>=25?2:3,
  shuffles:classic&&level>=80?1:classic&&level>=40?2:3
 };
}
export const vietnamDate=(date=new Date())=>new Date(+date+7*3600000).toISOString().slice(0,10);
export function seededRandom(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function shuffled(values,rng=Math.random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const same=(a,b)=>a.r===b.r&&a.c===b.c;
export const remaining=board=>board.cells.reduce((n,x)=>n+(x>0),0);
export function compactPath(path){const out=[];for(const p of path){if(out.length&&same(out.at(-1),p))continue;out.push(p);while(out.length>=3){const [a,b,c]=out.slice(-3);if(a.r===b.r&&b.r===c.r||a.c===b.c&&b.c===c.c)out.splice(out.length-2,1);else break;}}return out;}
export function findPath(board,first,second,{geometryOnly=false}={}){
 const {rows,cols,cells}=board;if(!Number.isInteger(first)||!Number.isInteger(second)||first===second||first<0||second<0||first>=cells.length||second>=cells.length||!cells[first]||!cells[second]||!geometryOnly&&cells[first]!==cells[second])return null;
 const a={r:Math.floor(first/cols),c:first%cols},b={r:Math.floor(second/cols),c:second%cols};
 const open=p=>p.r>=-1&&p.r<=rows&&p.c>=-1&&p.c<=cols&&(same(p,a)||same(p,b)||p.r===-1||p.r===rows||p.c===-1||p.c===cols||!cells[p.r*cols+p.c]);
 const clear=(p,q)=>{if(p.r!==q.r&&p.c!==q.c)return false;const dr=Math.sign(q.r-p.r),dc=Math.sign(q.c-p.c);let r=p.r,c=p.c;for(let n=0;n<=rows+cols+2;n++){if(!open({r,c}))return false;if(r===q.r&&c===q.c)return true;r+=dr;c+=dc;}return false;};
 if(clear(a,b))return [a,b];
 for(const corner of [{r:a.r,c:b.c},{r:b.r,c:a.c}])if(clear(a,corner)&&clear(corner,b))return [a,corner,b];
 let best=null,distance=Infinity;
 function consider(first,second,length){
  if(length<distance&&clear(a,first)&&clear(first,second)&&clear(second,b)){
   best=compactPath([a,first,second,b]);distance=length;
  }
 }
 for(let r=-1;r<=rows;r++)consider({r,c:a.c},{r,c:b.c},Math.abs(a.r-r)+Math.abs(b.r-r)+Math.abs(a.c-b.c));
 for(let c=-1;c<=cols;c++)consider({r:a.r,c},{r:b.r,c},Math.abs(a.c-c)+Math.abs(b.c-c)+Math.abs(a.r-b.r));
 return best;
}
export function findMatch(board){const groups=new Map();for(let i=0;i<board.cells.length;i++){const type=board.cells[i];if(!type)continue;const previous=groups.get(type)||[];for(const j of previous){const path=findPath(board,j,i);if(path)return {first:j,second:i,path};}previous.push(i);groups.set(type,previous);}return null;}
export function reshuffle(board,rng=Math.random){
 const indices=board.cells.flatMap((v,i)=>v?[i]:[]),values=indices.map(i=>board.cells[i]),next={...board,cells:board.cells.slice()};if(indices.length<2)return next;
 for(let attempt=0;attempt<24;attempt++){const mixed=shuffled(values,rng);indices.forEach((i,k)=>next.cells[i]=mixed[k]);if(findMatch(next))return next;}
 // Force one geometrically reachable pair while preserving every tile count.
 let positions;for(let i=0;i<indices.length&&!positions;i++)for(let j=i+1;j<indices.length;j++)if(findPath(next,indices[i],indices[j],{geometryOnly:true})){positions=[indices[i],indices[j]];break;}
 if(positions){const [a,b]=positions,type=next.cells[a],source=indices.find(i=>i!==a&&next.cells[i]===type);if(source!==undefined)[next.cells[b],next.cells[source]]=[next.cells[source],next.cells[b]];}
 return next;
}
export function createBoard({rows=8,cols=10,species=SPECIES.length,rng=Math.random}={}){
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<2||cols<2||rows*cols>160||rows*cols%2)throw Error('Invalid board size');
 if(!Number.isInteger(species)||species<1||species>SPECIES.length)throw Error('Invalid species count');
 const cells=[];for(let i=0;i<rows*cols/2;i++){const type=i%species+1;cells.push(type,type);}
 return reshuffle({rows,cols,cells},rng);
}
export function collapse(board,direction='none'){
 const out={...board,cells:board.cells.slice()}, {rows,cols}=board;
 if(direction==='cycle')direction=['down','left','up','right'][Math.floor((cellsLength(board)-remaining(board))/2)%4];
 if(!Object.hasOwn(GRAVITY_LABELS,direction)||direction==='none')return out;
 const vertical=['down','up','vertical-in','vertical-out','zigzag-columns'].includes(direction);
 function pack(indices,toEnd){const values=indices.map(i=>board.cells[i]).filter(Boolean),empty=Array(indices.length-values.length).fill(0),next=toEnd?[...empty,...values]:[...values,...empty];indices.forEach((i,k)=>out.cells[i]=next[k]);}
 for(let line=0;line<(vertical?cols:rows);line++){
  const indices=Array.from({length:vertical?rows:cols},(_,i)=>vertical?i*cols+line:line*cols+i);
  if(direction.endsWith('-in')||direction.endsWith('-out')){const middle=Math.floor(indices.length/2),inward=direction.endsWith('-in');pack(indices.slice(0,middle),inward);pack(indices.slice(middle),!inward);}
  else pack(indices,direction==='down'||direction==='right'||direction.startsWith('zigzag-')&&line%2===1);
 }return out;
}
const cellsLength=board=>board.rows*board.cols;
export function removePair(board,a,b,gravity='none'){if(!findPath(board,a,b))return null;const next={...board,cells:board.cells.slice()};next.cells[a]=next.cells[b]=0;return collapse(next,gravity);}
export function validBoard(board){if(!board||!Number.isInteger(board.rows)||!Number.isInteger(board.cols)||board.rows<2||board.rows>12||board.cols<2||board.cols>12||board.rows*board.cols>160||!Array.isArray(board.cells)||board.cells.length!==board.rows*board.cols)return false;const counts=new Map();for(const v of board.cells){if(!Number.isInteger(v)||v<0||v>SPECIES.length)return false;if(v)counts.set(v,(counts.get(v)||0)+1);}return [...counts.values()].every(n=>n%2===0);}
export function readSave(value){
 try{const s=typeof value==='string'?JSON.parse(value):value;if(s?.version!==VERSION||!['classic','relax','daily'].includes(s.mode)||!validBoard(s.board)||!remaining(s.board)||!Number.isInteger(s.level)||s.level<0||s.level>=LEVELS.length||!Number.isFinite(s.time)||s.time<=0||s.time>360||!Number.isFinite(s.score)||s.score<0||s.score>10000000||!Number.isInteger(s.hints)||s.hints<0||s.hints>3||!Number.isInteger(s.shuffles)||s.shuffles<0||s.shuffles>3||!/^\d{4}-\d{2}-\d{2}$/.test(s.date))return null;return {version:VERSION,mode:s.mode,board:structuredClone(s.board),level:s.level,time:s.time,score:Math.floor(s.score),hints:s.hints,shuffles:s.shuffles,date:s.date};}catch{return null;}
}
