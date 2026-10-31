import {WIDTH,HEIGHT,PIVOT,REST,tip,region,random,hash} from './core.js?v=20261031-classic-200-1';
const PALETTES=[['#dba75d','#bc7b2a','#a8611b'],['#d8a05a','#b67527','#9d591b'],['#db9961','#b66b34','#934b25'],['#ce9a65','#a66d37','#86502b'],['#dcb268','#ba8834','#946223'],['#c6a377','#9b774d','#795538'],['#c2ae90','#977d5d','#715842'],['#bd9869','#986a37','#76491f'],['#c18d64','#9e5c36','#733a25'],['#bc8d54','#98642d','#6e431e']];
export function createRenderer(canvas){
 const ctx=canvas.getContext('2d'),land=document.createElement('canvas');land.width=WIDTH;land.height=HEIGHT;let cache='',effects=[],last=0;
 function path(points,fill,stroke='#51311d',width=3,c=ctx){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
 function ellipse(x,y,rx,ry,fill,stroke,width=3,c=ctx){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
 function line(points,color,width=3,c=ctx){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
 function text(value,x,y,size,color='#54341e',align='left',c=ctx){c.fillStyle=color;c.font=`800 ${size}px "Arial",sans-serif`;c.textAlign=align;c.fillText(value,x,y);}
 function background(g){
 const key=g.seed+':'+g.level;if(cache===key)return;cache=key;const c=land.getContext('2d'),p=PALETTES[region(g.level)],r=random(hash(key));
 c.clearRect(0,0,WIDTH,HEIGHT);
 const earth=c.createLinearGradient(0,120,0,HEIGHT);earth.addColorStop(0,p[0]);earth.addColorStop(.55,p[1]);earth.addColorStop(1,p[2]);c.fillStyle=earth;c.fillRect(0,115,WIDTH,HEIGHT-115);
 const layer=(base,amp,color,phase)=>{c.beginPath();c.moveTo(0,base);for(let x=0;x<=WIDTH+24;x+=24)c.lineTo(x,base+Math.sin(x*.008+phase)*amp+Math.sin(x*.019+phase)*amp*.28);c.lineTo(WIDTH,HEIGHT);c.lineTo(0,HEIGHT);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#ffe5a54a';c.lineWidth=1.7;c.stroke();};
 layer(263,22,p[1],.5+region(g.level)*.3);layer(523,24,p[0],2+region(g.level)*.2);
 c.globalAlpha=.07;for(let i=0;i<170;i++){const x=r()*WIDTH,y=150+r()*450;ellipse(x,y,1+r()*2,.5+r(),i%2?'#fff7c9':'#583315',null,0,c);}c.globalAlpha=1;
 const shade=c.createLinearGradient(0,120,WIDTH,HEIGHT);shade.addColorStop(0,'#fff1b31c');shade.addColorStop(.5,'#00000000');shade.addColorStop(1,'#4d260d22');c.fillStyle=shade;c.fillRect(0,120,WIDTH,HEIGHT-120);
 const hud=c.createLinearGradient(0,0,0,120);hud.addColorStop(0,'#ffe97a');hud.addColorStop(.4,'#ffdb42');hud.addColorStop(1,'#edb629');c.fillStyle=hud;c.fillRect(0,0,WIDTH,120);
 c.save();c.shadowColor='#71480844';c.shadowBlur=10;c.shadowOffsetY=3;c.beginPath();c.arc(PIVOT.x,112,109,Math.PI,0);c.closePath();const blue=c.createLinearGradient(0,4,0,112);blue.addColorStop(0,'#244b99');blue.addColorStop(1,'#142f70');c.fillStyle=blue;c.fill();c.strokeStyle='#e7a827';c.lineWidth=4;c.stroke();c.restore();
 const beam=c.createLinearGradient(0,116,0,132);beam.addColorStop(0,'#f6cb78');beam.addColorStop(.25,'#d29445');beam.addColorStop(1,'#945b26');c.fillStyle=beam;c.fillRect(0,116,WIDTH,15);line([[0,117],[WIDTH,117]],'#ffedb5',2,c);line([[0,131],[WIDTH,131]],'#8a521e',2,c);
 }
 function nugget(o,x,y){const r=o.r;ctx.save();ctx.translate(x,y);ctx.rotate((o.id%5-2)*.09);ctx.beginPath();const points=[];for(let i=0;i<9;i++){const a=i*Math.PI*2/9,k=.9+Math.sin(i*3.7+o.id)*.12;points.push([Math.cos(a)*r*k,Math.sin(a)*r*k]);}const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let m=mid(points[8],points[0]);ctx.moveTo(...m);for(let i=0;i<9;i++){m=mid(points[i],points[(i+1)%9]);ctx.quadraticCurveTo(...points[i],...m);}ctx.closePath();const glow=ctx.createRadialGradient(-r*.32,-r*.4,1,0,0,r*1.1);glow.addColorStop(0,'#ffffa9');glow.addColorStop(.23,'#fff345');glow.addColorStop(.62,'#efc316');glow.addColorStop(1,'#be850b');ctx.fillStyle=glow;ctx.fill();ctx.lineWidth=Math.max(1.5,r*.055);ctx.strokeStyle='#896313';ctx.stroke();ctx.save();ctx.clip();line([[-r*.6,-r*.27],[-r*.44,-r*.58],[-r*.08,-r*.66]],'#fffbc6b3',Math.max(1.5,r*.07));ctx.restore();ctx.restore();}
 function stone(o,x,y){const r=o.r;path([[x-r,y-r*.3],[x-r*.6,y-r*.85],[x+r*.25,y-r],[x+r,y-r*.1],[x+r*.7,y+r*.7],[x-r*.3,y+r]],'#8c9497','#535b61',3);path([[x-r*.6,y-r*.85],[x+r*.25,y-r],[x+r*.25,y-r*.2],[x-r*.3,y+r*.1]],'#bec6c8',null);path([[x+r*.25,y-r*.2],[x+r,y-r*.1],[x+r*.7,y+r*.7],[x-r*.3,y+r]],'#717a80',null);line([[x-r*.3,y-r*.3],[x+r*.1,y-r*.2],[x+r*.2,y+r*.3]],'#6a7377',2);}
 function diamond(x,y,r){path([[x-r,y-r*.35],[x-r*.48,y-r*.8],[x+r*.48,y-r*.8],[x+r,y-r*.35],[x,y+r]],'#b4eeeb','#234f50',2.5);path([[x-r,y-r*.35],[x,y+r],[x-r*.28,y-r*.35]],'#43bbb8',null);path([[x+r,y-r*.35],[x,y+r],[x+r*.28,y-r*.35]],'#6bd6d0',null);line([[x-r,y-r*.35],[x+r,y-r*.35]],'#f5ffff',2);line([[x-r*.48,y-r*.8],[x-r*.28,y-r*.35],[x,y+r],[x+r*.28,y-r*.35],[x+r*.48,y-r*.8]],'#efffff',1.5);}
 function bag(o,x,y){const r=o.r;path([[x-r*.4,y-r*.62],[x-r*.6,y-r],[x+r*.5,y-r],[x+r*.3,y-r*.58],[x+r*.8,y+r*.2],[x+r*.6,y+r*.9],[x-r*.6,y+r*.9],[x-r*.9,y+r*.2]],'#cfb17c','#5c4026',2.5);line([[x-r*.45,y-r*.55],[x+r*.45,y-r*.55]],'#80552b',4);text('?',x,y+r*.54,r*1.28,'#dc581f','center');}
 function mole(o,x,y,t){const r=o.r;ellipse(x,y,r*1.25,r*.8,'#76553c','#342b24',2.5);ellipse(x+r*.8,y-r*.1,r*.65,r*.58,'#a77d56','#342b24',2);ellipse(x+r*1.3,y+r*.04,4,3,'#49302c');ellipse(x+r*.86,y-r*.28,2,2,'#201d18');ellipse(x-r*.45,y+r*.73,5,3,'#b18a61');ellipse(x+r*.42,y+r*.73+Math.sin(t*14)*2,5,3,'#b18a61');line([[x-r*1.14,y],[x-r*1.5,y-r*.23]],'#543c2d',3);if(o.diamond)diamond(x-r*.32,y-r*.63,9);}
 function tnt(o,x,y){const r=o.r;path([[x-r*.75,y-r],[x+r*.75,y-r],[x+r*.75,y+r],[x-r*.75,y+r]],'#ad3a25','#442c1b',3);for(const yy of [-.58,.58])line([[x-r*.78,y+r*yy],[x+r*.78,y+r*yy]],'#5e3824',6);text('TNT',x,y+5,13,'#ffe3a1','center');line([[x+3,y-r],[x+3,y-r-8],[x+10,y-r-12]],'#352b22',2);}
 function item(o,x=o.x,y=o.y,t=0){if(o.kind==='gold')nugget(o,x,y);else if(o.kind==='rock')stone(o,x,y);else if(o.kind==='diamond')diamond(x,y,o.r);else if(o.kind==='bag')bag(o,x,y);else if(o.kind==='mole')mole(o,x,y,t);else tnt(o,x,y);}
 function miner(g,t){
 const pulling=g.hook.state==='in',wave=pulling?Math.sin(t*15)*5:Math.sin(t*2)*.5;
 // Silver hair, a generous nose, brown clothes and a hand-cranked winch:
 // the familiar classic silhouette, redrawn with clean curves and warm light.
 ellipse(522,110,35,6,'#091b474d');
 path([[511,79],[539,78],[548,100],[537,108],[520,97],[505,99]],'#96582e','#51341f',2);
 path([[520,93],[543,94],[548,109],[536,113],[524,102],[510,106],[503,100]],'#8a572f','#4d321f',2);
 ellipse(542,112,15,5,'#5b3822','#352617',2);ellipse(509,107,14,5,'#694329','#352617',2);
 const coat=ctx.createLinearGradient(508,63,542,97);coat.addColorStop(0,'#cf9452');coat.addColorStop(1,'#87502b');
 path([[511,60],[532,61],[543,85],[537,97],[510,92],[502,76]],coat,'#684327',2.2);line([[521,68],[526,89]],'#e1ad65',2);
 path([[508,69],[501,81],[481,83+wave],[479,91+wave],[505,91],[519,78]],'#a96f37','#5f3e23',2);ellipse(480,87+wave,7,6,'#f1c58e','#a16d42',1.6);
 const skin=ctx.createLinearGradient(500,25,531,67);skin.addColorStop(0,'#ffddb1');skin.addColorStop(1,'#dfa773');ellipse(518,43,20,23,skin,'#8f6543',2);
 path([[499,39],[497,28],[503,17],[516,12],[531,16],[540,25],[537,42],[530,34],[524,24],[510,22],[504,33]],'#d9dce0','#778492',1.7);
 line([[503,25],[515,18],[528,21]],'#f5f5ef',3);line([[531,24],[534,34]],'#aab4bd',2.5);
 ellipse(506,39,6,7,'#ffffed','#8c7457',1);ellipse(504,40,2.6,3.7,'#25374a');ellipse(503,38.5,1,1.3,'#ffffff');line([[498,30],[509,29]],'#81909e',3);
 ellipse(495,48,12,9,skin,'#a7744c',1.5);ellipse(491,45,4,2,'#ffe6bd');
 path([[500,51],[510,54],[526,49],[533,57],[527,69],[516,78],[505,72],[497,61]],'#e0e4e4','#87929b',1.6);line([[509,64],[516,69],[525,59]],'#f6f6ee',2.4);ellipse(501,53,8,3.7,'#f3f1e5');ellipse(511,53,7,3.7,'#f3f1e5');line([[502,59],[508,60]],'#926c4a',1.5);
 path([[456,90],[465,88],[456,115],[448,115]],'#8c6945','#4c3928',2);path([[487,89],[494,90],[505,115],[497,115]],'#8c6945','#4c3928',2);
 ellipse(475,88,21,21,'#74502d','#392d22',3);ellipse(475,88,16,16,'#b7884b','#604424',2);ellipse(475,88,7,7,'#5b3b23');
 const a=pulling?t*8:0;for(let i=0;i<5;i++)line([[475,88],[475+Math.cos(a+i*Math.PI*2/5)*16,88+Math.sin(a+i*Math.PI*2/5)*16]],'#604426',2.5);
 line([[475,88],[482,81+wave]],'#3a2e23',3);line([[480,108],[480,116]],'#4c402e',3);
 }
 function claw(g,t){const h=g.hook,p=tip(h);line([[PIVOT.x,PIVOT.y],[p.x,p.y]],'#3b2b1d',3);line([[PIVOT.x+1,PIVOT.y],[p.x+1,p.y]],'#dec08a',1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-h.angle);const closed=h.item!==null;line([[0,-8],[0,5]],'#45423b',6);for(const side of [-1,1]){line([[0,0],[side*(closed?10:17),9],[side*(closed?11:23),20],[side*(closed?5:13),29]],'#322e27',6);line([[0,-1],[side*(closed?10:17),8],[side*(closed?11:23),19],[side*(closed?5:13),28]],'#b9b6a0',3);}ellipse(0,0,4,4,'#d1c8a8','#4f4739',2);ctx.restore();if(h.item!==null){const o=g.items.find(o=>o.id===h.item);if(o)item(o,p.x,p.y+o.r+17,t);}}
 function effect(event,reduced=false){if(event.type==='bank')effects.push({...event,age:0,life:1.3});if(event.type==='blast')effects.push({...event,age:0,life:reduced?.2:.65});}
 function draw(g,{dt=0,reduced=false,active=false}={}){background(g);const r=canvas.width/WIDTH;ctx.setTransform(r,0,0,r,0,0);ctx.drawImage(land,0,0);const t=reduced?0:g.elapsed;
 for(const o of g.items)if(o.active){ctx.globalAlpha=.16;ellipse(o.x+3,o.y+o.r*.65,o.r*.8,o.r*.3,'#633b17');ctx.globalAlpha=1;item(o,o.x,o.y,t);if(!reduced&&(o.kind==='diamond'||o.kind==='gold'&&o.value>=500)){const flicker=Math.sin(t*2+o.id*1.7);if(flicker>.72){const x=o.x+o.r*.3,y=o.y-o.r*.7;line([[x-5,y],[x+5,y]],'#fff9cd',2);line([[x,y-5],[x,y+5]],'#fff9cd',2);}}}
 claw(g,t);miner(g,t);if(g.boosts.strength)text('ϟ',552,88,20,'#fff4ad');
 if(active&&g.hook.state==='swing'){ctx.globalAlpha=.5;const p=tip({...g.hook,length:REST+26});ellipse(p.x,p.y,2,2,'#fff7ce');ctx.globalAlpha=1;}
 for(const e of effects){e.age+=dt;const f=e.age/e.life;ctx.save();ctx.globalAlpha=Math.max(0,1-f);if(e.type==='bank'){text(e.reward||(e.value?'+'+e.value.toLocaleString('vi-VN'):'Túi rỗng'),PIVOT.x+66,PIVOT.y-25-f*25,24,'#fff9b5');}else{const rad=12+f*100;ellipse(e.x,e.y,rad,rad*.8,'#ffc951');ellipse(e.x,e.y,rad*.56,rad*.48,'#fff0b1');if(!reduced)for(let i=0;i<10;i++){const a=i*.628;ellipse(e.x+Math.cos(a)*rad*1.5,e.y+Math.sin(a)*rad*1.2,5,5,i%2?'#7a4426':'#fcca5b');}}ctx.restore();}effects=effects.filter(e=>e.age<e.life);last=g.level;
 }
 function resize(){const width=canvas.getBoundingClientRect().width||WIDTH,dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(1,Math.round(width*dpr)),h=Math.round(w*HEIGHT/WIDTH);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
 return{draw,resize,effect,reset(){cache='';effects=[];},get animating(){return effects.length>0;}};
}
