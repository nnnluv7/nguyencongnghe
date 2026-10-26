export const VERSION=1,COLS=10,ROWS=20;
export const WORLDS=[
 {name:'Vườn kẹo',color:'#f69a69',sky:'#283e48',note:'Khởi đầu ngọt ngào'},
 {name:'Vịnh san hô',color:'#57cbbd',sky:'#123e50',note:'Lặn vào sắc xanh'},
 {name:'Mây tím',color:'#b8a0fa',sky:'#343456',note:'Nhẹ như một giấc mơ'},
 {name:'Nắng mật ong',color:'#f3cc5b',sky:'#4b3e33',note:'Gom từng tia nắng'},
 {name:'Rừng ngọc',color:'#8ed09a',sky:'#173d39',note:'Lối nhỏ qua tán lá'},
 {name:'Hoàng hôn đào',color:'#fa9eac',sky:'#50334b',note:'Một chiều đầy màu sắc'},
 {name:'Đảo pha lê',color:'#7bccef',sky:'#1b3b5a',note:'Lấp lánh dưới đại dương'},
 {name:'Dải ngân hà',color:'#aaa1ff',sky:'#292b50',note:'Chạm tới những vì sao'},
 {name:'Lửa cầu vồng',color:'#f69170',sky:'#4d2d40',note:'Giữ nhịp giữa sắc lửa'},
 {name:'Vũ trụ sắc màu',color:'#e5bd72',sky:'#243843',note:'Trăm màn, một hành trình'}
];
// Seven familiar shapes; rotations keep their square pivot so wall kicks are predictable.
const BASE=[null,[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[1,1],[1,1]],[[0,1,0],[1,1,1],[0,0,0]],[[1,0,0],[1,1,1],[0,0,0]],[[0,0,1],[1,1,1],[0,0,0]],[[0,1,1],[1,1,0],[0,0,0]],[[1,1,0],[0,1,1],[0,0,0]]];
const spin=m=>m[0].map((_,x)=>m.map(row=>row[x]).reverse());
export const SHAPES=BASE.map(m=>{if(!m)return null;const states=[m];for(let i=0;i<3;i++)states.push(spin(states.at(-1)));return states;});
const TITLES=['Bước chân đầu','Chạm sắc màu','Nhịp ghép đôi','Một đường sáng','Xoay điều kỳ diệu','Nối tầng mây','Gom những vì sao','Giữ nhịp liền tay','Chạm đường chân trời','Cánh cửa mới'];
export function levelSpec(level){if(!Number.isInteger(level)||level<1||level>100)throw Error('Invalid level');const world=Math.floor((level-1)/10);return {...WORLDS[world],level,world,title:TITLES[(level-1)%10],goal:4+world,interval:Math.max(140,850-(level-1)*7),initialRows:Math.min(4,Math.floor((level-1)/20))};}
function random(g){let n=g.seed;n^=n<<13;n^=n>>>17;n^=n<<5;g.seed=n>>>0;return g.seed/4294967296;}
function fillQueue(g){while(g.queue.length<7){const bag=[1,2,3,4,5,6,7];for(let i=6;i>0;i--){const j=Math.floor(random(g)*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}g.queue.push(...bag);}}
export function pieceCells(piece){if(!piece)return [];const m=SHAPES[piece.type]?.[piece.rotation];if(!m)return [];const out=[];for(let r=0;r<m.length;r++)for(let c=0;c<m.length;c++)if(m[r][c])out.push({x:piece.x+c,y:piece.y+r,type:piece.type});return out;}
export function fits(board,piece){return pieceCells(piece).length===4&&pieceCells(piece).every(({x,y})=>x>=0&&x<COLS&&y<ROWS&&(y<0||!board[y*COLS+x]));}
function spawn(g,type){if(!type){type=g.queue.shift();fillQueue(g);}g.active={type,rotation:0,x:Math.floor((COLS-SHAPES[type][0].length)/2),y:-1};if(!fits(g.board,g.active)){g.status='lost';g.active=null;}}
export function createGame({level=1,seed=Date.now()>>>0,score=0,totalLines=0}={}){
 const spec=levelSpec(level),g={version:VERSION,level,seed:(seed>>>0)||1,score,totalLines,stageLines:0,board:Array(COLS*ROWS).fill(0),queue:[],active:null,hold:0,holdUsed:false,combo:-1,maxClear:0,pieces:0,status:'playing'};
 for(let r=ROWS-spec.initialRows;r<ROWS;r++){const hole=Math.floor(random(g)*(COLS-2));for(let c=0;c<COLS;c++)if(c!==hole&&c!==hole+1)g.board[r*COLS+c]=1+Math.floor(random(g)*7);}
 fillQueue(g);spawn(g);return g;
}
export function move(g,dx,dy){if(g.status!=='playing'||!g.active)return false;const next={...g.active,x:g.active.x+dx,y:g.active.y+dy};if(!fits(g.board,next))return false;g.active=next;return true;}
export function rotate(g,direction=1){
 if(g.status!=='playing'||!g.active)return false;
 const next={...g.active,rotation:(g.active.rotation+(direction<0?3:1))%4};
 for(const [dx,dy]of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]]){const kicked={...next,x:next.x+dx,y:next.y+dy};if(fits(g.board,kicked)){g.active=kicked;return true;}}return false;
}
export function ghost(g){if(!g.active)return null;const p={...g.active};while(fits(g.board,{...p,y:p.y+1}))p.y++;return p;}
export function softDrop(g){if(!move(g,0,1))return false;g.score++;return true;}
export function hold(g){if(g.status!=='playing'||!g.active||g.holdUsed)return false;const old=g.active.type,kept=g.hold;g.hold=old;spawn(g,kept||undefined);g.holdUsed=true;return true;}
export function lock(g){
 if(g.status!=='playing'||!g.active)return null;
 if(fits(g.board,{...g.active,y:g.active.y+1}))return null;
 const cells=pieceCells(g.active);if(cells.some(c=>c.y<0)){g.status='lost';g.active=null;return {kind:'lost',rows:[],count:0,cells};}
 for(const {x,y,type}of cells)g.board[y*COLS+x]=type;
 const rows=[];for(let r=0;r<ROWS;r++)if(g.board.slice(r*COLS,(r+1)*COLS).every(Boolean))rows.push(r);
 const count=rows.length,keep=[];for(let r=0;r<ROWS;r++)if(!rows.includes(r))keep.push(...g.board.slice(r*COLS,(r+1)*COLS));g.board=[...Array(count*COLS).fill(0),...keep];
 g.pieces++;g.totalLines+=count;g.stageLines+=count;g.maxClear=Math.max(g.maxClear,count);g.combo=count?g.combo+1:-1;
 const earned=([0,100,300,500,800][count]+Math.max(0,g.combo)*50)*g.level;g.score+=earned;g.holdUsed=false;
 if(g.stageLines>=levelSpec(g.level).goal){g.status=g.level===100?'won':'cleared';g.active=null;g.score+=g.level*500;}
 else spawn(g);
 return {kind:g.status==='playing'?(count?'clear':'lock'):g.status,rows,count,cells,earned,stars:1+(g.maxClear>=2?1:0)+(g.maxClear>=4?1:0)};
}
export function hardDrop(g){if(g.status!=='playing'||!g.active)return null;const p=ghost(g);g.score+=(p.y-g.active.y)*2;g.active=p;return lock(g);}
export function advance(g){if(g.status!=='cleared')return null;return createGame({level:g.level+1,seed:g.seed,score:g.score,totalLines:g.totalLines});}
export function readSave(v){
 if(!v||v.version!==VERSION||!Number.isInteger(v.level)||v.level<1||v.level>100||!['playing','cleared','won'].includes(v.status))return null;
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!Array.isArray(v.board)||v.board.length!==COLS*ROWS||v.board.some(n=>!integer(n,0,7))||!Array.isArray(v.queue)||v.queue.length<5||v.queue.length>13||v.queue.some(n=>!integer(n,1,7)))return null;
 if(!integer(v.seed,1,4294967295)||!integer(v.score,0,1e9)||!integer(v.totalLines,0,1e6)||!integer(v.stageLines,0,20)||!integer(v.hold,0,7)||typeof v.holdUsed!=='boolean'||!integer(v.combo,-1,1000)||!integer(v.maxClear,0,4)||!integer(v.pieces,0,1e6))return null;
 if(v.status==='playing'){
  const p=v.active;if(!p||!integer(p.type,1,7)||!integer(p.rotation,0,3)||!integer(p.x,-4,COLS)||!integer(p.y,-4,ROWS)||!fits(v.board,p)||v.stageLines>=levelSpec(v.level).goal)return null;
 }else if(v.active!==null||v.stageLines<levelSpec(v.level).goal||v.status!==(v.level===100?'won':'cleared'))return null;
 return structuredClone(Object.fromEntries(['version','level','seed','score','totalLines','stageLines','board','queue','active','hold','holdUsed','combo','maxClear','pieces','status'].map(k=>[k,v[k]])));
}
export function readProgress(v){
 const out={version:VERSION,unlocked:1,best:0,stars:{}};if(!v||v.version!==VERSION)return out;
 if(Number.isInteger(v.unlocked))out.unlocked=Math.max(1,Math.min(100,v.unlocked));if(Number.isInteger(v.best))out.best=Math.max(0,Math.min(1e9,v.best));
 for(const [k,n]of Object.entries(v.stars||{}))if(/^\d{1,3}$/.test(k)&&Number(k)>=1&&Number(k)<=100&&Number.isInteger(n)&&n>=1&&n<=3)out.stars[k]=n;return out;
}
