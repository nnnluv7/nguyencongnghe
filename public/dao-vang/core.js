// Original NCN implementation of the classic timed claw-mining rules.
export const WIDTH=960,HEIGHT=600,PIVOT=Object.freeze({x:480,y:112}),REST=36,SWING=1.26;
export const MODES=Object.freeze({classic:'Cổ điển',daily:'Hôm nay'});
export const GOODS=Object.freeze({
 dynamite:{name:'Thuốc nổ',icon:'✹',note:'Phá vật đang kéo. Giữ lại qua các màn.'},
 strength:{name:'Nước tăng lực',icon:'ϟ',note:'Kéo nhanh hơn 85% trong màn kế tiếp.'},
 luck:{name:'Cỏ may mắn',icon:'♧',note:'Túi bí ẩn có nhiều tiền hơn ở màn kế tiếp.'},
 rocks:{name:'Sách về đá',icon:'▰',note:'Đá bán gấp 3 giá trong màn kế tiếp.'},
 polish:{name:'Đánh bóng kim cương',icon:'◇',note:'Kim cương thêm 50% giá trong màn kế tiếp.'}
});
const kinds=new Set(['gold','rock','diamond','bag','mole','tnt']);
export function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function random(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const STAGE_COUNT=200;
export const maxLevels=mode=>mode==='daily'?5:STAGE_COUNT;
export const REGIONS=Object.freeze(['Mỏ khởi đầu','Hẻm đá vàng','Đất đỏ miền Tây','Mỏ đồng cổ','Thung lũng hổ phách','Hầm đá xám','Mỏ kim cương','Mạch vàng sâu','Lòng núi lửa','Kho báu huyền thoại']);
export function difficulty(level){const t=Math.max(0,Math.min(1,(level-1)/(STAGE_COUNT-1)));return{chapter:Math.floor((level-1)/10)+1,time:60-Math.floor(t*15),swing:.7+t*.5,resistance:1+t*.45,value:1+t*1.6,rocks:3+Math.floor(t*7),tnt:level>=3?1+Math.floor(t*3):0,moles:level>=4?1+Math.floor((level-4)/44):0,moleSpeed:1.4+t*1.1,moleRange:26+t*32,tier:level>150?'Bậc thầy':level>100?'Rất khó':level>50?'Khó':level>20?'Thử thách':'Làm quen'};}
export function quota(level){if(level<=4)return[650,545,815,1085][level-1];const t=(level-4)/(STAGE_COUNT-4);return 1085+Math.round((level-4)*24+3500*Math.pow(t,1.5));}
export function target(level,banked){if(banked!==undefined)return banked+quota(level);let value=0;for(let i=1;i<=level;i++)value+=quota(i);return value;}
function legacyTarget(level){let n=650;for(let i=2;i<=level;i++)n+=Math.min(4000,545+(i-2)*270);return n;}
export function region(level){return Math.min(9,Math.floor((level-1)/20));}
export const stageTime=g=>g.version===1?60:difficulty(g.level).time;
export const stageEarned=g=>g.score-(g.startScore||0);
export const stageGoal=g=>g.goal-(g.startMoney||0);
const ore=(id,kind,x,y,r,value,mass,extra={})=>({id,kind,x,y,r,value,mass,active:true,...extra});
export function mine(seed,level=1){
 if(level===1)return[
  ore(1,'gold',480,287,27,250,2),ore(2,'gold',188,452,47,500,4.9),ore(3,'gold',743,491,47,500,4.9),
  ore(4,'gold',299,276,15,100,.65),ore(5,'gold',661,266,11,50,.38),ore(6,'gold',569,471,15,100,.65),
  ore(7,'rock',360,403,32,20,5.8),ore(8,'rock',801,323,25,15,4.2),ore(9,'bag',557,376,19,0,1.1),ore(10,'rock',114,296,23,11,3.7)
 ];
 const rng=random(hash(seed+':mine:'+level)),d=difficulty(level),list=[],routes=[],scale=n=>Math.round(n*d.value/5)*5;
 const blocks=(o,end)=>{const dx=end.x-PIVOT.x,dy=end.y-PIVOT.y,t=((o.x-PIVOT.x)*dx+(o.y-PIVOT.y)*dy)/(dx*dx+dy*dy);return t>0&&t<1&&Math.hypot(o.x-PIVOT.x-dx*t,o.y-PIVOT.y-dy*t)<o.r+11;};
 function place(kind,r,value,mass,extra={},depth=0,clear=false){for(let k=0;k<700;k++){const top=Math.max(195+r,depth),y=top+rng()*(578-r-top),spread=Math.min(444-r,(y-PIVOT.y)*Math.tan(SWING)-r-12),x=PIVOT.x+(rng()*2-1)*spread,o=ore(list.length+1,kind,x,y,r,value,mass,extra);if(list.some(a=>Math.hypot(a.x-x,a.y-y)<a.r+r+10)||routes.some(end=>blocks(o,end))||clear&&list.some(a=>blocks(a,o)))continue;list.push(o);if(clear)routes.push(o);return true;}return false;}
 // Keep several precise opening rays clear. Challenge comes from timing,
 // heavy ore and hazards, rather than a random mine with no workable route.
 for(let i=0;i<3;i++){const giant=level>=51&&i===0;place('gold',giant?50:42,scale(giant?850:500),giant?7.2:4.9,{},350,true);}
 const gems=level>=3?1+Math.floor((level-3)/45):0;
 for(let i=0;i<Math.min(3,gems);i++)place('diamond',13,scale(600),.65,{},level>=51?385:290,true);
 for(let i=3;i<8;i++)place('gold',i<6?25:15,scale(i<6?250:100),i<6?2:.65);
 for(let i=3;i<gems;i++)place('diamond',13,scale(600),.65,{},level>=51?385:290);
 for(let i=0;i<(level>=51?2:1);i++)place('bag',19,0,1.1,{},level>=51?340:0);
 for(let i=0;i<d.moles;i++)place('mole',18,scale(i%2===0?600:5),.7,{diamond:i%2===0,home:0,phase:rng()*6.28},300);
 for(let i=0;i<d.tnt;i++)place('tnt',23,0,1.2,{},300);
 for(let i=0;i<d.rocks;i++)place('rock',20+rng()*12,Math.floor(8+rng()*18),3.5+rng()*2.5);
 for(const o of list)if(o.kind==='mole')o.home=o.x;
 return list;
}
const boosts=()=>({strength:false,luck:false,rocks:false,polish:false});
const hook=()=>({angle:-.48,dir:1,length:REST,state:'swing',item:null});
export function createGame({mode='classic',seed=1,date=''}={}){
 if(!Object.hasOwn(MODES,mode))mode='classic';seed=mode==='daily'?hash('gold:'+date):((seed>>>0)||1);
 return {version:2,mode,seed,date,level:1,goal:target(1),startMoney:0,startScore:0,money:0,score:0,spent:0,time:60,elapsed:0,status:'playing',dynamite:1,boosts:boosts(),nextBoosts:boosts(),bought:[],hook:hook(),items:mine(seed,1)};
}
export function tip(h){return{x:PIVOT.x+Math.sin(h.angle)*h.length,y:PIVOT.y+Math.cos(h.angle)*h.length};}
export function reach(angle){const sx=Math.sin(angle),cy=Math.cos(angle);return Math.min((HEIGHT-17-PIVOT.y)/cy,sx>0?(WIDTH-17-PIVOT.x)/sx:sx<0?(17-PIVOT.x)/sx:Infinity);}
export function contact(a,b,item,extra=7){
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-item.x,fy=a.y-item.y,r=item.r+extra,A=dx*dx+dy*dy;
 if(fx*fx+fy*fy<=r*r)return 0;if(!A)return null;const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r,d=B*B-4*A*C;if(d<0)return null;const t=(-B-Math.sqrt(d))/(2*A);return t>=0&&t<=1?t:null;
}
export function drop(g){if(g.status!=='playing'||g.hook.state!=='swing')return false;g.hook.state='out';return true;}
export function dynamite(g){if(g.status!=='playing'||g.hook.state!=='in'||g.hook.item===null||g.dynamite<=0)return null;const item=g.items.find(o=>o.id===g.hook.item);if(!item)return null;const p=tip(g.hook);g.dynamite--;g.hook.item=null;return{type:'blast',x:p.x,y:p.y,ids:[item.id]};}
function detonate(g,start,events){const queue=[start],ids=[];while(queue.length){const item=queue.shift();if(!item.active)continue;item.active=false;ids.push(item.id);for(const o of g.items)if(o.active&&Math.hypot(o.x-item.x,o.y-item.y)<135+o.r){if(o.kind==='tnt')queue.push(o);else{o.active=false;ids.push(o.id);}}}events.push({type:'blast',x:start.x,y:start.y,ids});}
function bank(g,events){const h=g.hook,item=g.items.find(o=>o.id===h.item);let value=0,reward='';if(item){
 value=item.value;
 if(item.kind==='bag'){const r=random(hash(g.seed+':bag:'+g.level+':'+item.id));const roll=r();if(roll<.16&&g.dynamite<9){g.dynamite++;reward='Thuốc nổ +1';}else if(roll<.28){g.boosts.strength=true;reward='Tăng lực!';}else{value=Math.round((50+Math.floor(r()*451))*difficulty(g.level).value);if(g.boosts.luck)value*=2;}}
 if(item.kind==='rock'&&g.boosts.rocks)value*=3;
 if((item.kind==='diamond'||item.kind==='mole'&&item.diamond)&&g.boosts.polish)value=Math.floor(value*1.5);
 g.money+=value;g.score+=value;events.push({type:'bank',value,reward,kind:item.kind,x:PIVOT.x,y:PIVOT.y});
 }h.item=null;h.length=REST;h.state='swing';
}
export function endStage(g){if(g.status!=='playing')return g.status;g.hook.item=null;g.hook.state='swing';g.hook.length=REST;if(g.money<g.goal)g.status='lost';else g.status=g.level>=maxLevels(g.mode)?'won':'shop';return g.status;}
export function step(g,seconds){
 const events=[];if(g.status!=='playing'||!Number.isFinite(seconds)||seconds<=0)return events;let left=Math.min(seconds,60);
 while(left>1e-8&&g.status==='playing'){
  const dt=Math.min(.025,left,g.time),d=difficulty(g.level);if(dt<=1e-8){g.time=0;endStage(g);break;}left-=dt;const h=g.hook;
  for(const o of g.items)if(o.active&&o.kind==='mole'){const nx=Math.max(o.r+5,Math.min(WIDTH-o.r-5,o.home+Math.sin(g.elapsed*(g.version===1?1.4:d.moleSpeed)+o.phase)*(g.version===1?26:d.moleRange)));if(!g.items.some(a=>a!==o&&a.active&&Math.hypot(a.x-nx,a.y-o.y)<a.r+o.r+5))o.x=nx;}
  if(h.state==='swing'){h.angle+=h.dir*(g.version===1?.7:d.swing)*dt;if(Math.abs(h.angle)>=SWING){h.angle=Math.sign(h.angle)*SWING;h.dir=-Math.sign(h.angle);}}
  else if(h.state==='out'){
   const before=h.length,a=tip(h),length=Math.min(reach(h.angle),h.length+650*dt),b=tip({...h,length});let hit=null,first=Infinity;
   for(const item of g.items)if(item.active){const t=contact(a,b,item);if(t!==null&&t<first){hit=item;first=t;}}
   h.length=length;
   if(hit){h.length=before+(length-before)*first;h.state='in';if(hit.kind==='tnt')detonate(g,hit,events);else{hit.active=false;h.item=hit.id;events.push({type:'catch',kind:hit.kind});}}
   else if(length>=reach(h.angle)-.01)h.state='in';
  }else{
   const item=g.items.find(o=>o.id===h.item),speed=(item?Math.max(50,450/(.5+item.mass)):670)*(g.boosts.strength?1.85:1)/(g.version===1?1:d.resistance);h.length=Math.max(REST,h.length-speed*dt);if(h.length<=REST)bank(g,events);
  }
  g.time=Math.max(0,g.time-dt);g.elapsed=Math.min(stageTime(g),g.elapsed+dt);
  if(g.time<=1e-7){g.time=0;endStage(g);events.push({type:'end',status:g.status});}
  else if(h.state==='swing'&&!g.items.some(o=>o.active)){endStage(g);events.push({type:'end',status:g.status});}
 }
 return events;
}
export function shop(g){const r=random(hash(g.seed+':shop:'+g.level));return Object.entries(GOODS).map(([id,good])=>({...good,id,price:Math.round((1+(g.level-1)/199*.8)*({dynamite:70,strength:125,luck:90,rocks:45,polish:150}[id]+r()*({dynamite:75,strength:190,luck:130,rocks:100,polish:230}[id]))/5)*5}));}
export function buy(g,id){if(g.status!=='shop'||!Object.hasOwn(GOODS,id)||id==='dynamite'&&g.dynamite>=9||id!=='dynamite'&&g.bought.includes(id))return false;const offer=shop(g).find(o=>o.id===id);if(g.money<offer.price)return false;g.money-=offer.price;g.spent+=offer.price;if(id==='dynamite')g.dynamite++;else{g.nextBoosts[id]=true;g.bought.push(id);}return true;}
export function advance(g){if(g.status!=='shop'||g.level>=maxLevels(g.mode))return null;const n=structuredClone(g);n.version=2;n.level++;n.startMoney=n.money;n.startScore=n.score;n.goal=target(n.level,n.startMoney);n.status='playing';n.time=difficulty(n.level).time;n.elapsed=0;n.boosts={...n.nextBoosts};n.nextBoosts=boosts();n.bought=[];n.hook=hook();n.items=mine(n.seed,n.level);return n;}
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max,number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
export function readSave(raw){try{
 if(!raw||![1,2].includes(raw.version)||!Object.hasOwn(MODES,raw.mode)||!integer(raw.seed,1,4294967295)||!integer(raw.level,1,raw.version===1?Math.min(100,maxLevels(raw.mode)):maxLevels(raw.mode))||raw.goal!==(raw.version===1?legacyTarget(raw.level):target(raw.level,raw.startMoney))||!['playing','shop'].includes(raw.status))return null;
 if(typeof raw.date!=='string'||raw.date.length>10||raw.mode==='daily'&&(!/^20\d\d-\d\d-\d\d$/.test(raw.date)||new Date(raw.date).toISOString().slice(0,10)!==raw.date||raw.seed!==hash('gold:'+raw.date)))return null;
 if(!integer(raw.money,0,1000000000)||!integer(raw.score,0,1000000000)||!integer(raw.spent,0,1000000000)||raw.score!==raw.money+raw.spent||!number(raw.time,0,stageTime(raw))||!number(raw.elapsed,0,stageTime(raw))||Math.abs(raw.time+raw.elapsed-stageTime(raw))>.001||raw.status==='playing'&&raw.time<=0||raw.status==='shop'&&raw.score<raw.goal||!integer(raw.dynamite,0,9))return null;
 if(raw.version===2&&(!integer(raw.startMoney,0,raw.money+raw.spent)||!integer(raw.startScore,raw.startMoney,raw.score)||raw.startScore-raw.startMoney>raw.spent||raw.status==='playing'&&raw.startScore-raw.startMoney!==raw.spent||raw.status==='shop'&&stageEarned(raw)<quota(raw.level)))return null;
 for(const b of [raw.boosts,raw.nextBoosts])if(!b||Object.keys(b).length!==4||Object.keys(boosts()).some(k=>typeof b[k]!=='boolean'))return null;
 if(!Array.isArray(raw.bought)||new Set(raw.bought).size!==raw.bought.length||raw.bought.some(k=>!Object.hasOwn(raw.nextBoosts,k)||!raw.nextBoosts[k]))return null;
 const h=raw.hook;if(!h||!number(h.angle,-SWING,SWING)||![1,-1].includes(h.dir)||!['swing','out','in'].includes(h.state)||!number(h.length,REST,reach(h.angle)+.1)||h.state==='swing'&&h.length!==REST)return null;
 if(!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>40||new Set(raw.items.map(o=>o.id)).size!==raw.items.length)return null;
 for(const o of raw.items)if(!integer(o.id,1,50)||!kinds.has(o.kind)||!number(o.x,0,WIDTH)||!number(o.y,170,HEIGHT)||!number(o.r,8,60)||!integer(o.value,0,raw.version===1?2000:5000)||!number(o.mass,.1,10)||typeof o.active!=='boolean'||o.kind==='mole'&&(!number(o.home,0,WIDTH)||!number(o.phase,0,7)||typeof o.diamond!=='boolean'))return null;
 if(h.item!==null&&(h.state!=='in'||!raw.items.some(o=>o.id===h.item&&!o.active&&o.kind!=='tnt')))return null;
 if(raw.status==='shop'&&(h.item!==null||h.state!=='swing'))return null;
 return structuredClone({...raw,ranked:raw.ranked===true});
 }catch{return null;}}
