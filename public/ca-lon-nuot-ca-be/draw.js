import {WORLD,FISH,LEVELS,clamp,randomSource} from './core.js?v=20261026-mobile-3d-1';
const TAU=Math.PI*2;
export function cameraFocus(player,width,height,zoom,follow=false){
  if(follow||width<640)return {x:player.x,y:player.y};
  const vw=width/zoom,vh=height/zoom;
  return {x:vw>=WORLD.width?WORLD.width/2:clamp(player.x,vw/2,WORLD.width-vw/2),y:vh>=WORLD.height?WORLD.height/2:clamp(player.y,vh/2-25,WORLD.height-vh/2+20)};
}
export const SKINS={coral:{color:'#ffc36c',shade:'#ed7852',fin:'#4cbcc4'},aqua:{color:'#80f0e1',shade:'#2aa7bb',fin:'#ffca73'},violet:{color:'#c6b7ff',shade:'#8d76d3',fin:'#ffb28d'}};
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
function star(c,x,y,r,color){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,k=i%2?r*.43:r;c.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k);}c.closePath();c.fillStyle=color;c.fill();}
export class OceanPainter{
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.zoom=1;this.camera={x:800,y:500};this.level=-1;this.floor=null;this.background=null;this.sprites=new Map();this.reduced=false;this.skin='coral';}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr;this.zoom=Math.max(this.width/(this.width<640?740:this.width<1000?920:1140),this.height/1100);this.background=null;}
  reset(){this.camera={x:800,y:500};}
  point(x,y){return {x:(x-this.camera.x)*this.zoom+this.width/2,y:(y-this.camera.y)*this.zoom+this.height/2};}
  vector(x,y,p){const at=this.point(p.x,p.y),dx=(x-at.x)/this.zoom,dy=(y-at.y)/this.zoom,distance=Math.hypot(dx,dy);return {x:distance?dx/distance*Math.min(1,distance/65):0,y:distance?dy/distance*Math.min(1,distance/65):0};}
  makeScenery(level){
    const palette=LEVELS[level],doc=this.canvas.ownerDocument,rng=randomSource(774+level*234);this.level=level;this.background=null;
    const floor=doc.createElement('canvas');floor.width=1600;floor.height=270;const c=floor.getContext('2d');
    const sand=c.createLinearGradient(0,160,0,270);sand.addColorStop(0,palette.sand);sand.addColorStop(1,'#597d89');c.fillStyle=sand;c.beginPath();c.moveTo(0,205);
    for(let x=0;x<=1600;x+=40)c.lineTo(x,199+Math.sin(x*.009)*9+Math.sin(x*.025)*4);c.lineTo(1600,270);c.lineTo(0,270);c.closePath();c.fill();
    for(let i=0;i<180;i++){const x=rng()*1600,y=205+rng()*65;ellipse(c,x,y,1+rng()*2,.5+rng(),'#f3eed735');}
    for(let i=0;i<27;i++){
      const x=i*64+rng()*40,y=213+rng()*18,kind=i%3,height=45+rng()*95;
      c.lineCap='round';
      if(kind===0){
        for(let n=0;n<7;n++){const dx=(n-3)*9,h=height*(.55+rng()*.5);c.strokeStyle=['#277c78','#4c9f84','#75b99a'][n%3];c.lineWidth=3+rng()*4;c.beginPath();c.moveTo(x+dx*.3,y);c.bezierCurveTo(x+dx-18,y-h*.4,x+dx+20,y-h*.65,x+dx,y-h);c.stroke();}
      }else if(kind===1){
        const color=['#df8ba3','#b894ca','#e8a78f','#8bc7b6'][i%4];
        const branch=(bx,by,len,angle,depth)=>{const ex=bx+Math.cos(angle)*len,ey=by+Math.sin(angle)*len;c.strokeStyle=color;c.lineWidth=depth*2.1+1;c.beginPath();c.moveTo(bx,by);c.quadraticCurveTo(bx+Math.cos(angle-.2)*len*.6,by+Math.sin(angle-.2)*len*.6,ex,ey);c.stroke();if(depth>0){branch(ex,ey,len*.65,angle-.48,depth-1);branch(ex,ey,len*.68,angle+.5,depth-1);}else ellipse(c,ex,ey,2.4,2.6,'#ffddd1');};
        branch(x,y,height*.46,-Math.PI/2,3);
      }else{
        for(let n=0;n<5;n++){const dx=(n-2)*13,h=height*(.5+rng()*.45);c.fillStyle=['#419d9e','#51b1a4','#68c1ad'][n%3];c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+dx-24,y-h*.4,x+dx-10,y-h,x+dx,y-h);c.bezierCurveTo(x+dx+16,y-h*.5,x+dx+22,y-h*.3,x,y);c.fill();}
      }
      ellipse(c,x,y+4,22+rng()*20,9+rng()*9,['#6f9b9a','#729693','#83a9a0'][i%3]);
    }
    // A little shell and starfish belong to this ocean, drawn entirely as vectors.
    c.save();c.translate(1160,220);star(c,0,0,23,'#eaa98e');c.restore();
    c.save();c.translate(420,224);c.fillStyle='#e1c3b9';c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-52,-3,-40,-43,0,-20);c.bezierCurveTo(40,-43,52,-3,0,0);c.fill();c.strokeStyle='#a98089';c.lineWidth=1.3;for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(0,0);c.lineTo(i*10,-22+Math.abs(i)*2);c.stroke();}c.restore();this.floor=floor;
  }
  paint(ocean,time,dt=1/60){
    const c=this.c,w=this.width,h=this.height,z=this.zoom,p=ocean.player,demo=ocean.status==='ready';if(!c)return;
    if(this.level!==ocean.level)this.makeScenery(ocean.level);
    const palette=LEVELS[ocean.level],vh=h/z,focus=cameraFocus(p,w,h,z,this.follow),ease=1-Math.exp(-dt*6);
    this.camera.x+=(focus.x-this.camera.x)*ease;this.camera.y+=(focus.y-this.camera.y)*ease;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    if(!this.background){const bg=c.createLinearGradient(0,0,w*.15,h);bg.addColorStop(0,palette.sky);bg.addColorStop(.4,palette.water);bg.addColorStop(1,palette.deep);this.background=bg;}
    c.fillStyle=this.background;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<7;i++){const x=(i*.19-.2)*w+(this.reduced?0:Math.sin(time*.12+i)*18);const g=c.createLinearGradient(x,0,x+w*.18,h);g.addColorStop(0,'#c5ffff22');g.addColorStop(.8,'#a0ffff03');g.addColorStop(1,'#d1ffff00');c.fillStyle=g;c.beginPath();c.moveTo(x,0);c.lineTo(x+45,0);c.lineTo(x+w*.48,h);c.lineTo(x+w*.16,h);c.closePath();c.fill();}
    c.restore();
    // Distant shoals and suspended bubbles establish depth without busy particles.
    c.save();c.globalAlpha=.15;c.fillStyle='#0d5981';for(let i=0;i<18;i++){const x=((i*117+time*(i%2?4:-5))%(w+100)+w+100)%(w+100)-50,y=80+(i*53)%(Math.max(180,h*.5));c.beginPath();c.ellipse(x,y,8+(i%3)*2,3+(i%2),0,0,TAU);c.fill();c.beginPath();c.moveTo(x-7,y);c.lineTo(x-14,y-5);c.lineTo(x-14,y+5);c.closePath();c.fill();}c.restore();
    const bubbleCount=this.reduced?12:35;
    for(let i=0;i<bubbleCount;i++){const x=(i*117.71+Math.sin(time*.33+i)*9)%w,y=h-((i*49.3+(this.reduced?0:time*(5+i%4)))%(h+30)),r=1.5+i%4;c.strokeStyle='#d7ffff35';c.lineWidth=.8;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();ellipse(c,x-r*.25,y-r*.3,.7,.7,'#ecffff55');}
    c.save();c.translate(w/2-this.camera.x*z,h/2-this.camera.y*z);c.scale(z,z);
    // A foreground reef follows the camera gently, keeping the ocean grounded
    // on both wide monitors and portrait phones without adding collision walls.
    c.drawImage(this.floor,0,this.camera.y+vh/2-235,1600,270);
    for(const j of ocean.jellies)this.jelly(c,j,time);
    for(const item of ocean.items)this.item(c,item,time);
    const hintIds=new Set(ocean.fish.filter(f=>ocean.edible(f)&&Math.hypot(f.x-p.x,f.y-p.y)<280).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,6).map(f=>f.id));
    for(const f of [...ocean.fish].sort((a,b)=>a.size-b.size)){
      const at=this.point(f.x,f.y);if(at.x<-230*z||at.x>w+230*z||at.y<-130*z||at.y>h+130*z)continue;
      const edible=ocean.edible(f),distance=Math.hypot(f.x-p.x,f.y-p.y);
      c.save();c.translate(f.x,f.y+(demo?Math.sin(time+f.phase)*9:0));
      if(!demo&&(edible&&hintIds.has(f.id)||ocean.dangerous(f)&&distance<340)){c.strokeStyle=edible?'#b8ffbc85':'#ffb5b9a6';c.lineWidth=1.4/z;c.setLineDash(edible?[]:[3/z,4/z]);c.beginPath();c.ellipse(0,0,f.size*1.45+6,f.size*.95+6,0,0,TAU);c.stroke();c.setLineDash([]);}
      const angle=Math.atan2(Math.sin(f.angle),Math.abs(Math.cos(f.angle)))*.2*f.face;
      this.fish(c,{...FISH[f.tier],face:f.face,angle,size:f.size},time+f.phase);c.restore();
    }
    if(!demo){
      if(ocean.dashTime>0&&!this.reduced){c.strokeStyle='#d6fcff66';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(p.x-p.face*(p.size+15+i*12),p.y+(i-2)*9);c.lineTo(p.x-p.face*(p.size+38+i*12),p.y+(i-2)*9);c.stroke();}}
      c.save();c.translate(p.x,p.y);
      if(ocean.shield>0||ocean.safe>0){const r=p.size*1.55+8;const g=c.createRadialGradient(-r*.25,-r*.3,r*.15,0,0,r);g.addColorStop(0,'#d4fbff13');g.addColorStop(.8,'#d4fbff08');g.addColorStop(1,'#d4fbff45');c.fillStyle=g;c.strokeStyle=ocean.shield>0?'#c1ffffb0':'#ecffff75';c.lineWidth=1.6/z;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.stroke();}
      if(ocean.fever>0){c.strokeStyle='#ffe793';c.lineWidth=2/z;c.beginPath();c.ellipse(0,0,p.size*1.8,p.size*1.1,0,0,TAU);c.stroke();if(!this.reduced)for(let i=0;i<8;i++)star(c,Math.cos(time+i*TAU/8)*p.size*1.95,Math.sin(time+i*TAU/8)*p.size*1.3,3/z,'#fff2b4');}
      if(ocean.safe>0&&ocean.safe<2.7&&!this.reduced)c.globalAlpha=.68+Math.sin(time*8)*.2;
      this.fish(c,{...SKINS[this.skin],...p,player:true,bite:ocean.bite*4},time);c.restore();
      // A steady marker keeps your fish recognizable in the denser shoals.
      c.save();c.textAlign='center';c.font='800 '+Math.round(9/z)+'px system-ui';c.fillStyle='#f6ffff';c.strokeStyle='#0a527499';c.lineWidth=2/z;c.strokeText('BẠN',p.x,p.y-p.size-19/z);c.fillText('BẠN',p.x,p.y-p.size-19/z);c.beginPath();c.moveTo(p.x-3/z,p.y-p.size-14/z);c.lineTo(p.x+3/z,p.y-p.size-14/z);c.lineTo(p.x,p.y-p.size-10/z);c.fill();c.restore();
    }
    for(const e of ocean.effects){c.globalAlpha=clamp(e.life/.6,0,1);ellipse(c,e.x,e.y,e.size,e.size,e.color);}c.globalAlpha=1;
    for(const e of ocean.labels){c.save();c.globalAlpha=Math.min(1,e.life*2);c.font='800 '+Math.round(17/z)+'px system-ui';c.textAlign='center';c.lineWidth=3/z;c.strokeStyle='#0a52747a';c.fillStyle=e.color;c.strokeText(e.text,e.x,e.y);c.fillText(e.text,e.x,e.y);c.restore();}
    c.restore();
    if(demo){
      c.save();c.translate(w*.74,h*.44);const size=Math.min(w*.08,90);c.rotate(Math.sin(time*.6)*.04);this.fish(c,{...SKINS[this.skin],size,face:-1,angle:0,player:true},time);c.restore();
      c.save();c.translate(w*.83,h*.68);this.fish(c,{...FISH[0],size:Math.min(w*.023,23),face:-1,angle:0},time+1);c.restore();
    }
    const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#042c5938');shade.addColorStop(.18,'#042c5900');shade.addColorStop(.75,'#042c5900');shade.addColorStop(1,'#042c5930');c.fillStyle=shade;c.fillRect(0,0,w,h);
  }
  bodyPath(c,f){
    c.beginPath();
    if(f.shark){c.moveTo(-1.08,-.24);c.bezierCurveTo(-.68,-.77,.53,-.65,1.43,.035);c.bezierCurveTo(.83,.59,-.54,.64,-1.08,.25);}
    else if(f.body==='angel'){c.moveTo(-1,-.03);c.bezierCurveTo(-.6,-.65,-.23,-1.06,.36,-.61);c.bezierCurveTo(1.52,-.5,1.45,.48,.4,.68);c.bezierCurveTo(-.2,1.06,-.64,.62,-1,-.03);}
    else if(f.body==='disc')c.ellipse(.03,0,1.04,.87,0,0,TAU);
    else if(f.body==='long')c.ellipse(.03,0,1.28,.57,-.025,0,TAU);
    else c.ellipse(.02,0,1.16,.7,0,0,TAU);
    c.closePath();
  }
  bodySprite(f){
    const key=[f.color,f.shade,f.fin,f.body,f.pattern,!!f.player,!!f.shark].join(':');if(this.sprites.has(key))return this.sprites.get(key);
    const art=this.canvas.ownerDocument.createElement('canvas');art.width=384;art.height=320;const c=art.getContext('2d');c.translate(170,157);c.scale(96,96);c.lineJoin='round';
    // Rear fins sit behind the lit body; their translucent ribs suggest volume.
    c.fillStyle=f.fin;c.strokeStyle=f.shade;c.lineWidth=.035;c.beginPath();c.moveTo(-.74,-.26);c.bezierCurveTo(-.7,-.78,-.42,f.shark?-1.38:-1.1,.07,-.89);c.quadraticCurveTo(.28,-.5,.57,-.39);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#ffffff55';c.lineWidth=.018;for(let i=0;i<5;i++){c.beginPath();c.moveTo(-.52+i*.18,-.44);c.lineTo(-.43+i*.13,-.89+Math.abs(i-2)*.06);c.stroke();}
    c.fillStyle=f.fin;c.globalAlpha=.85;c.beginPath();c.moveTo(-.64,.34);c.quadraticCurveTo(-.41,1.04,.13,.91);c.lineTo(.45,.45);c.closePath();c.fill();c.globalAlpha=1;
    this.bodyPath(c,f);const light=c.createRadialGradient(-.36,-.4,.05,-.1,.02,1.52);light.addColorStop(0,'#fffce7');light.addColorStop(.15,f.color);light.addColorStop(.52,f.color);light.addColorStop(.82,f.shade);light.addColorStop(1,'#183e5b');c.fillStyle=light;c.fill();c.strokeStyle=f.player?'#fff1c8c9':'#153e596e';c.lineWidth=f.player ? .075 : .035;c.stroke();
    c.save();this.bodyPath(c,f);c.clip();
    // A blue rim shadow and warm belly make the rounded surface read at phone size.
    const rim=c.createLinearGradient(0,-.8,0,.9);rim.addColorStop(0,'#ffffff30');rim.addColorStop(.36,'#ffffff00');rim.addColorStop(.76,'#092d4900');rim.addColorStop(1,'#092d4970');c.fillStyle=rim;c.fillRect(-1.5,-1.4,3,2.8);
    ellipse(c,.17,.38,.85,.27,'#fff3cd29');
    const pattern=f.pattern||(f.player?'clown':f.shark?'gills':'scales');
    if(pattern==='clown'||pattern==='bands'){
      for(const x of [-.65,.05]){c.strokeStyle='#714f5880';c.lineWidth=.26;c.beginPath();c.moveTo(x-.08,-1);c.bezierCurveTo(x-.28,-.2,x+.24,.3,x+.02,1);c.stroke();c.strokeStyle=pattern==='clown'?'#fff9e9e6':'#66599f8a';c.lineWidth=.17;c.stroke();}
    }else if(pattern==='mask'||pattern==='tang'){
      c.fillStyle=pattern==='mask'?'#263852bb':'#234f9bba';c.beginPath();c.moveTo(.32,-.9);c.quadraticCurveTo(.56,.02,.38,.9);c.lineTo(.71,.85);c.quadraticCurveTo(.77,0,.64,-.9);c.closePath();c.fill();
      if(pattern==='tang'){c.strokeStyle='#182f6580';c.lineWidth=.12;c.beginPath();c.moveTo(-.92,-.12);c.bezierCurveTo(-.5,-.76,.15,-.58,.24,-.06);c.bezierCurveTo(.3,.48,-.55,.44,-.77,.15);c.stroke();}
    }else if(pattern==='ribbon'){
      for(let i=0;i<3;i++){c.strokeStyle=['#81f0e878','#e8e0ff78','#f6ecb778'][i];c.lineWidth=.1;c.beginPath();c.moveTo(-1.2,-.25+i*.24);c.bezierCurveTo(-.2,-.6+i*.24,.26,-.25+i*.2,1.05,-.17+i*.14);c.stroke();}
    }else if(pattern==='gills'){
      c.strokeStyle='#20496799';c.lineWidth=.045;for(let i=0;i<4;i++){c.beginPath();c.moveTo(.04-i*.13,-.24);c.quadraticCurveTo(-.07-i*.13,0,-.02-i*.13,.21);c.stroke();}
    }else{
      for(let row=0;row<3;row++)for(let col=0;col<5;col++){const x=-.74+col*.25+(row%2)*.09,y=-.3+row*.25;c.strokeStyle='#ffffff25';c.lineWidth=.022;c.beginPath();c.arc(x,y,.15,-.9,.9);c.stroke();if(pattern==='pearls')ellipse(c,x+.09,y-.02,.035,.035,'#fff8de99');}
    }
    const shine=c.createRadialGradient(-.28,-.38,.02,-.28,-.38,.84);shine.addColorStop(0,'#ffffff6b');shine.addColorStop(.38,'#ffffff20');shine.addColorStop(1,'#ffffff00');ellipse(c,-.21,-.35,.91,.34,shine);ellipse(c,-.47,-.43,.32,.065,'#ffffff38');c.restore();
    // Rounded wet eye with a dark iris, two reflections and an upper lid.
    const ex=f.shark ? .79 : .66,ey=f.shark?-.19:-.22,er=f.shark ? .155 : .24,eye=c.createRadialGradient(ex-.07,ey-.09,.01,ex,ey,er*1.2);eye.addColorStop(0,'#ffffff');eye.addColorStop(.55,'#f7ffff');eye.addColorStop(1,'#acc6d4');ellipse(c,ex,ey,er,er*1.09,eye);ellipse(c,ex+.065,ey+.014,er*.52,er*.68,'#14394e');ellipse(c,ex+.09,ey-.06,er*.21,er*.22,'#ffffff');ellipse(c,ex+.03,ey+.08,er*.07,er*.08,'#9de9f6');
    c.strokeStyle=f.shark?'#254d6c':'#925f5a70';c.lineWidth=.04;c.beginPath();c.moveTo(.91,.16);c.quadraticCurveTo(1.03,.28,1.16,.12);c.stroke();
    if(f.shark){c.fillStyle='#f8f8ea';for(let i=0;i<4;i++){c.beginPath();c.moveTo(.78+i*.1,.18);c.lineTo(.86+i*.1,.18);c.lineTo(.82+i*.1,.28);c.closePath();c.fill();}}
    if(this.sprites.size>=24)this.sprites.delete(this.sprites.keys().next().value);this.sprites.set(key,art);return art;
  }
  fish(c,f,t){
    c.save();c.scale(f.face||1,1);c.rotate(f.angle||0);c.scale(f.size,f.size);c.lineJoin='round';
    const motion=this.reduced?0:Math.sin(t*8)*.16;
    c.save();c.translate(-.92,.015);c.rotate(motion);c.scale(1,1-Math.abs(motion)*.4);c.fillStyle=f.fin;c.strokeStyle=f.shade;c.lineWidth=.04;c.beginPath();c.moveTo(.16,-.2);c.bezierCurveTo(-.32,-.29,-.67,-.72,-1.04,-.61);c.quadraticCurveTo(-.87,0,-1.04,.61);c.bezierCurveTo(-.65,.72,-.3,.28,.16,.2);c.closePath();c.fill();c.stroke();c.fillStyle='#ffffff20';c.beginPath();c.moveTo(-.08,-.06);c.lineTo(-.89,-.47);c.lineTo(-.79,.06);c.closePath();c.fill();c.strokeStyle='#fff7d569';c.lineWidth=.023;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(-.02,0);c.quadraticCurveTo(-.52,i*.13,-.87,i*.23);c.stroke();}c.restore();
    c.drawImage(this.bodySprite(f),-170/96,-157/96,4,320/96);
    c.save();c.translate(-.23,.24);c.rotate(this.reduced?-.12:Math.sin(t*6)*.16-.12);c.fillStyle=f.fin;c.strokeStyle='#fff6d06b';c.lineWidth=.025;c.beginPath();c.moveTo(.17,-.16);c.bezierCurveTo(-.21,-.29,-.79,.15,-.65,.55);c.bezierCurveTo(-.14,.64,.1,.19,.17,-.16);c.closePath();c.fill();c.stroke();c.strokeStyle=f.shade+'99';for(let i=0;i<3;i++){c.beginPath();c.moveTo(.05,-.06);c.quadraticCurveTo(-.22,.1,-.53+i*.1,.4);c.stroke();}c.restore();
    if(f.bite>0){ellipse(c,1.08,.12,.16,.08+Math.sin(clamp(f.bite,0,1)*Math.PI)*.16,'#663d45');ellipse(c,1.11,.2,.08,.035,'#f8b7a2');}
    c.restore();
  }
  jelly(c,j,time){c.save();c.translate(j.x,j.y+Math.sin(time+j.phase)*12);c.scale(j.size,j.size);const g=c.createRadialGradient(0,-.1,.1,0,0,1.5);g.addColorStop(0,'#f5beefbd');g.addColorStop(1,'#af8be911');c.fillStyle=g;c.beginPath();c.arc(0,0,1.65,0,TAU);c.fill();c.strokeStyle='#f5d0ffab';c.lineWidth=.05;for(let i=0;i<5;i++){const x=(i-2)*.34;c.beginPath();c.moveTo(x,.2);c.bezierCurveTo(x+Math.sin(time*1.7+i)*.3,.8,x-.25,1.5,x+Math.sin(time*1.5+i)*.3,1.9);c.stroke();}c.fillStyle='#d5a2eabb';c.beginPath();c.arc(0,0,1,Math.PI,0);c.quadraticCurveTo(.7,.43,.45,.15);c.quadraticCurveTo(0,.5,-.45,.15);c.quadraticCurveTo(-.7,.43,-1,0);c.fill();c.stroke();ellipse(c,-.3,-.35,.2,.09,'#fff4ff66');c.restore();}
  item(c,item,time){
    c.save();c.translate(item.x,item.y+Math.sin(time*2+item.phase)*7);c.fillStyle='#e8ffff13';c.strokeStyle='#d6ffff9a';c.lineWidth=1.2;c.beginPath();c.arc(0,0,24,0,TAU);c.fill();c.stroke();
    if(item.type==='shield'){c.fillStyle='#b4f8f5';c.beginPath();c.moveTo(0,-14);c.lineTo(12,-8);c.lineTo(10,6);c.quadraticCurveTo(4,14,0,16);c.quadraticCurveTo(-4,14,-10,6);c.lineTo(-12,-8);c.closePath();c.fill();c.strokeStyle='#1c91a4';c.lineWidth=2;c.beginPath();c.moveTo(-5,0);c.lineTo(-1,4);c.lineTo(6,-5);c.stroke();}
    else if(item.type==='heart'){c.fillStyle='#ffb2c7';c.beginPath();c.moveTo(0,12);c.bezierCurveTo(-23,-1,-12,-18,0,-7);c.bezierCurveTo(12,-18,23,-1,0,12);c.fill();}
    else{const g=c.createRadialGradient(-5,-6,1,0,0,14);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#fff7c7');g.addColorStop(1,'#d9b879');ellipse(c,0,0,13,13,g);star(c,17,-15,5,'#fff7c7');}
    c.restore();
  }
}
