import {WIDTH,HEIGHT,PIVOT,REST,tip,region,random,hash} from './core.js?v=20261029-gold-1';
const PALETTES=[['#f6daa0','#c89048','#a46b36','#85502d','#58331f'],['#f3c998','#b77b4c','#955b37','#70472b','#483024'],['#e9d4b2','#a18d64','#797454','#5c5b43','#333c32'],['#dfc3b1','#a37b77','#815557','#603f49','#3c2934'],['#d5d5df','#8b8a9a','#6a667b','#4e4c65','#2e3045']];
export function createRenderer(canvas){
 const ctx=canvas.getContext('2d'),land=document.createElement('canvas');land.width=WIDTH;land.height=HEIGHT;let cache='',effects=[],last=0;
 function path(points,fill,stroke='#51311d',width=3,c=ctx){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
 function ellipse(x,y,rx,ry,fill,stroke,width=3,c=ctx){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
 function line(points,color,width=3,c=ctx){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
 function text(value,x,y,size,color='#54341e',align='left',c=ctx){c.fillStyle=color;c.font=`800 ${size}px "Arial",sans-serif`;c.textAlign=align;c.fillText(value,x,y);}
 function background(g){
 const key=g.seed+':'+g.level;if(cache===key)return;cache=key;const c=land.getContext('2d'),p=PALETTES[region(g.level)],r=random(hash(key));
 c.clearRect(0,0,WIDTH,HEIGHT);const sky=c.createLinearGradient(0,0,0,175);sky.addColorStop(0,'#ffe9b8');sky.addColorStop(1,p[0]);c.fillStyle=sky;c.fillRect(0,0,WIDTH,180);
 ellipse(822,51,33,33,'#fff3cd',null,0,c);path([[0,145],[0,101],[93,112],[139,61],[177,119],[224,90],[317,155]],'#dcb978',null,0,c);path([[595,166],[683,84],[718,113],[762,64],[790,91],[852,111],[906,82],[960,111],[960,174]],'#d4af6d',null,0,c);
 function cactus(x,y,s){line([[x,y],[x,y-45*s]],'#7d8c4e',8*s,c);line([[x,y-19*s],[x-15*s,y-19*s],[x-15*s,y-34*s]],'#7d8c4e',6*s,c);line([[x,y-28*s],[x+12*s,y-28*s],[x+12*s,y-43*s]],'#7d8c4e',5*s,c);}
 cactus(92,164,.7);cactus(878,168,.85);
 const soil=c.createLinearGradient(0,170,0,HEIGHT);soil.addColorStop(0,p[1]);soil.addColorStop(.3,p[2]);soil.addColorStop(1,p[4]);c.fillStyle=soil;c.fillRect(0,171,WIDTH,HEIGHT-171);
 const ridge=[[0,174]];for(let x=0;x<=WIDTH;x+=24)ridge.push([x,168+r()*9]);ridge.push([WIDTH,190],[0,190]);path(ridge,'#d2a568','#6c4328',3,c);
 c.globalAlpha=.2;for(let i=0;i<560;i++){const x=r()*WIDTH,y=193+r()*407;ellipse(x,y,1+r()*2,.7+r(),i%2?'#fbe0a2':'#20160e',null,0,c);}for(let i=0;i<18;i++){const x=r()*WIDTH,y=220+r()*360;line([[x,y],[x+18,y+6],[x+40,y+3]],'#ead2a2',1,c);}c.globalAlpha=1;
 c.save();c.translate(28,37);c.rotate(-.04);path([[-8,-23],[192,-23],[187,25],[-5,25]],'#e9c58c','#936237',2,c);text('MỎ VÀNG',91,0,24,'#6b4023','center',c);text('MIỀN TÂY · '+String(g.level).padStart(2,'0'),91,17,9,'#885b34','center',c);c.restore();
 path([[728,150],[756,129],[791,143],[810,168],[728,168]],'#b28b55',null,0,c);
 }
 function nugget(o,x,y){const r=o.r;ctx.save();ctx.translate(x,y);ctx.rotate((o.id%5-2)*.12);path([[-.85*r,-.4*r],[-.36*r,-.89*r],[.38*r,-.91*r],[.92*r,-.35*r],[.81*r,.49*r],[.16*r,.91*r],[-.65*r,.73*r],[-.98*r,.15*r]],'#e8a51d','#53351b',2.8);path([[-.85*r,-.4*r],[-.36*r,-.89*r],[.38*r,-.91*r],[.1*r,-.19*r],[-.38*r,.12*r]],'#ffe68b',null);path([[.1*r,-.19*r],[.38*r,-.91*r],[.92*r,-.35*r],[.81*r,.49*r],[.43*r,.2*r]],'#f4c13e',null);path([[-.65*r,.73*r],[-.38*r,.12*r],[.1*r,-.19*r],[.43*r,.2*r],[.16*r,.91*r]],'#f3b731',null);line([[-.6*r,-.3*r],[-.3*r,-.57*r],[.13*r,-.63*r]],'#fff1a7',Math.max(1,r*.08));ctx.restore();}
 function stone(o,x,y){const r=o.r;path([[x-r,y-r*.3],[x-r*.6,y-r*.85],[x+r*.25,y-r],[x+r,y-r*.1],[x+r*.7,y+r*.7],[x-r*.3,y+r]],'#8d8980','#423d35',3);path([[x-r*.6,y-r*.85],[x+r*.25,y-r],[x+r*.25,y-r*.2],[x-r*.3,y+r*.1]],'#b8b4a7',null);path([[x+r*.25,y-r*.2],[x+r,y-r*.1],[x+r*.7,y+r*.7],[x-r*.3,y+r]],'#6e6d66',null);line([[x-r*.3,y-r*.3],[x+r*.1,y-r*.2],[x+r*.2,y+r*.3]],'#55534d',2);}
 function diamond(x,y,r){path([[x-r,y-r*.35],[x-r*.48,y-r*.8],[x+r*.48,y-r*.8],[x+r,y-r*.35],[x,y+r]],'#b4eeeb','#234f50',2.5);path([[x-r,y-r*.35],[x,y+r],[x-r*.28,y-r*.35]],'#43bbb8',null);path([[x+r,y-r*.35],[x,y+r],[x+r*.28,y-r*.35]],'#6bd6d0',null);line([[x-r,y-r*.35],[x+r,y-r*.35]],'#f5ffff',2);line([[x-r*.48,y-r*.8],[x-r*.28,y-r*.35],[x,y+r],[x+r*.28,y-r*.35],[x+r*.48,y-r*.8]],'#efffff',1.5);}
 function bag(o,x,y){const r=o.r;path([[x-r*.4,y-r*.62],[x-r*.6,y-r],[x+r*.5,y-r],[x+r*.3,y-r*.58],[x+r*.8,y+r*.2],[x+r*.6,y+r*.9],[x-r*.6,y+r*.9],[x-r*.9,y+r*.2]],'#cfb17c','#5c4026',2.5);line([[x-r*.45,y-r*.55],[x+r*.45,y-r*.55]],'#80552b',4);text('?',x,y+r*.54,r*1.28,'#654323','center');}
 function mole(o,x,y,t){const r=o.r;ellipse(x,y,r*1.25,r*.8,'#76553c','#342b24',2.5);ellipse(x+r*.8,y-r*.1,r*.65,r*.58,'#a77d56','#342b24',2);ellipse(x+r*1.3,y+r*.04,4,3,'#49302c');ellipse(x+r*.86,y-r*.28,2,2,'#201d18');ellipse(x-r*.45,y+r*.73,5,3,'#b18a61');ellipse(x+r*.42,y+r*.73+Math.sin(t*14)*2,5,3,'#b18a61');line([[x-r*1.14,y],[x-r*1.5,y-r*.23]],'#543c2d',3);if(o.diamond)diamond(x-r*.32,y-r*.63,9);}
 function tnt(o,x,y){const r=o.r;path([[x-r*.75,y-r],[x+r*.75,y-r],[x+r*.75,y+r],[x-r*.75,y+r]],'#ad3a25','#442c1b',3);for(const yy of [-.58,.58])line([[x-r*.78,y+r*yy],[x+r*.78,y+r*yy]],'#5e3824',6);text('TNT',x,y+5,13,'#ffe3a1','center');line([[x+3,y-r],[x+3,y-r-8],[x+10,y-r-12]],'#352b22',2);}
 function item(o,x=o.x,y=o.y,t=0){if(o.kind==='gold')nugget(o,x,y);else if(o.kind==='rock')stone(o,x,y);else if(o.kind==='diamond')diamond(x,y,o.r);else if(o.kind==='bag')bag(o,x,y);else if(o.kind==='mole')mole(o,x,y,t);else tnt(o,x,y);}
 function miner(g,t){
 const pulling=g.hook.state==='in',wave=pulling?Math.sin(t*15):Math.sin(t*2)*.15;
 // Wooden winch, boots, denim overalls, white beard and broad felt hat.
 path([[422,113],[440,113],[438,154],[416,154]],'#304d61','#3f3126');path([[445,113],[462,113],[470,151],[449,154]],'#35576c','#3f3126');ellipse(424,154,17,6,'#493324','#32251c');ellipse(462,154,17,6,'#493324','#32251c');
 path([[417,72],[454,72],[465,111],[449,126],[417,116]],'#b76d39','#50311e');path([[422,78],[429,79],[428,99],[448,98],[448,77],[454,78],[459,120],[420,120]],'#42738b','#263f4a',2.5);ellipse(439,106,3,3,'#dab87c');
 ellipse(439,58,21,25,'#edb279','#5c3924',2.5);ellipse(460,63,8,6,'#edb279','#5c3924',2);path([[419,60],[428,67],[438,62],[448,68],[459,62],[457,82],[450,94],[437,101],[425,90],[418,73]],'#f2ecd5','#8a775d',2);ellipse(446,57,2.4,3,'#3e3224');line([[439,50],[450,49]],'#76512c',3);line([[439,73],[449,73]],'#b18158',2);
 path([[413,43],[419,25],[450,24],[460,43]],'#9d6b35','#50381f',3);path([[407,43],[417,38],[454,37],[472,44],[471,50],[407,50]],'#c69954','#61411f',3);line([[420,36],[454,35]],'#6e4928',5);
 line([[452,81],[465,88+wave*5],[481,91+wave*9]],'#5c3822',15);line([[452,80],[466,87+wave*5],[481,90+wave*9]],'#edb77e',10);ellipse(483,91+wave*9,7,7,'#f0be83','#6d4225',2);
 path([[475,100],[484,99],[471,164],[460,164]],'#956232','#4b331e',3);path([[502,100],[510,100],[521,164],[510,164]],'#956232','#4b331e',3);
 ellipse(493,107,23,23,'#8d582e','#4c341e',4);ellipse(493,107,15,15,'#c5924e','#5d3c22',3);ellipse(493,107,5,5,'#4e3521');
 const a=pulling?t*7:0;for(let i=0;i<4;i++)line([[493,107],[493+Math.cos(a+i*Math.PI/2)*17,107+Math.sin(a+i*Math.PI/2)*17]],'#5b3d21',3);
 line([[493,107],[481,94+wave*9]],'#4e3420',4);
 }
 function claw(g,t){const h=g.hook,p=tip(h);line([[PIVOT.x,PIVOT.y],[p.x,p.y]],'#3b2b1d',3);line([[PIVOT.x+1,PIVOT.y],[p.x+1,p.y]],'#dec08a',1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-h.angle);const closed=h.item!==null;line([[0,-8],[0,5]],'#45423b',6);for(const side of [-1,1]){line([[0,0],[side*(closed?10:17),9],[side*(closed?11:23),20],[side*(closed?5:13),29]],'#322e27',6);line([[0,-1],[side*(closed?10:17),8],[side*(closed?11:23),19],[side*(closed?5:13),28]],'#b9b6a0',3);}ellipse(0,0,4,4,'#d1c8a8','#4f4739',2);ctx.restore();if(h.item!==null){const o=g.items.find(o=>o.id===h.item);if(o)item(o,p.x,p.y+o.r+17,t);}}
 function effect(event,reduced=false){if(event.type==='bank')effects.push({...event,age:0,life:1.3});if(event.type==='blast')effects.push({...event,age:0,life:reduced?.2:.65});}
 function draw(g,{dt=0,reduced=false,active=false}={}){background(g);const r=canvas.width/WIDTH;ctx.setTransform(r,0,0,r,0,0);ctx.drawImage(land,0,0);const t=reduced?0:g.elapsed;
 for(const o of g.items)if(o.active){item(o,o.x,o.y,t);if(!reduced&&(o.kind==='diamond'||o.kind==='gold'&&o.value>=500)){const flicker=Math.sin(t*2+o.id*1.7);if(flicker>.72){const x=o.x+o.r*.3,y=o.y-o.r*.7;line([[x-5,y],[x+5,y]],'#fff9cd',2);line([[x,y-5],[x,y+5]],'#fff9cd',2);}}}
 claw(g,t);miner(g,t);if(g.boosts.strength)text('ϟ',394,91,25,'#fff4ad');
 if(active&&g.hook.state==='swing'){ctx.globalAlpha=.5;const p=tip({...g.hook,length:REST+26});ellipse(p.x,p.y,2,2,'#fff7ce');ctx.globalAlpha=1;}
 for(const e of effects){e.age+=dt;const f=e.age/e.life;ctx.save();ctx.globalAlpha=Math.max(0,1-f);if(e.type==='bank'){text(e.reward||(e.value?'+'+e.value.toLocaleString('vi-VN'):'Túi rỗng'),PIVOT.x+66,PIVOT.y-25-f*25,24,'#fff9b5');}else{const rad=12+f*100;ellipse(e.x,e.y,rad,rad*.8,'#ffc951');ellipse(e.x,e.y,rad*.56,rad*.48,'#fff0b1');if(!reduced)for(let i=0;i<10;i++){const a=i*.628;ellipse(e.x+Math.cos(a)*rad*1.5,e.y+Math.sin(a)*rad*1.2,5,5,i%2?'#7a4426':'#fcca5b');}}ctx.restore();}effects=effects.filter(e=>e.age<e.life);last=g.level;
 }
 function resize(){const width=canvas.getBoundingClientRect().width||WIDTH,dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.round(canvas.width*HEIGHT/WIDTH);}
 return{draw,resize,effect,reset(){cache='';effects=[];},get animating(){return effects.length>0;}};
}
