import {WORLD,FISH,LEVELS,clamp,randomSource} from './core.js';
const TAU=Math.PI*2;
export const SKINS={coral:{color:'#ffc36c',shade:'#ed7852',fin:'#4cbcc4'},aqua:{color:'#80f0e1',shade:'#2aa7bb',fin:'#ffca73'},violet:{color:'#c6b7ff',shade:'#8d76d3',fin:'#ffb28d'}};
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
function star(c,x,y,r,color){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,k=i%2?r*.43:r;c.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k);}c.closePath();c.fillStyle=color;c.fill();}
export class OceanPainter{
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.zoom=1;this.camera={x:800,y:500};this.level=-1;this.floor=null;this.background=null;this.reduced=false;this.skin='coral';}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr;this.zoom=Math.max(this.width/(this.width<640?610:this.width<1000?920:1140),this.height/1100);this.background=null;}
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
    const palette=LEVELS[ocean.level],vw=w/z,vh=h/z,aimX=clamp(p.x,vw/2,WORLD.width-vw/2),aimY=clamp(p.y,vh/2-25,WORLD.height-vh/2+20),ease=1-Math.exp(-dt*6);
    this.camera.x+=(aimX-this.camera.x)*ease;this.camera.y+=(aimY-this.camera.y)*ease;
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
    const playerPoint=this.point(p.x,p.y);let hints=0;
    for(const f of [...ocean.fish].sort((a,b)=>a.size-b.size)){
      const at=this.point(f.x,f.y);if(at.x<-230*z||at.x>w+230*z||at.y<-130*z||at.y>h+130*z)continue;
      const edible=ocean.edible(f),distance=Math.hypot(f.x-p.x,f.y-p.y);
      c.save();c.translate(f.x,f.y+(demo?Math.sin(time+f.phase)*9:0));
      if(!demo&&distance<240&&hints<8){c.strokeStyle=edible?'#b8ffbc73':'#ffb5b950';c.lineWidth=1.4/z;c.setLineDash(edible?[]:[3/z,4/z]);c.beginPath();c.ellipse(0,0,f.size*1.45+6,f.size*.95+6,0,0,TAU);c.stroke();c.setLineDash([]);hints++;}
      const angle=Math.atan2(Math.sin(f.angle),Math.abs(Math.cos(f.angle)))*.2*f.face;
      this.fish(c,{...FISH[f.tier],face:f.face,angle,size:f.size},time+f.phase);c.restore();
    }
    if(!demo){
      if(ocean.dashTime>0&&!this.reduced){c.strokeStyle='#d6fcff66';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(p.x-p.face*(p.size+15+i*12),p.y+(i-2)*9);c.lineTo(p.x-p.face*(p.size+38+i*12),p.y+(i-2)*9);c.stroke();}}
      c.save();c.translate(p.x,p.y);
      if(ocean.shield>0||ocean.safe>0){const r=p.size*1.55+8;const g=c.createRadialGradient(-r*.25,-r*.3,r*.15,0,0,r);g.addColorStop(0,'#d4fbff13');g.addColorStop(.8,'#d4fbff08');g.addColorStop(1,'#d4fbff45');c.fillStyle=g;c.strokeStyle=ocean.shield>0?'#c1ffffb0':'#ecffff75';c.lineWidth=1.6/z;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.stroke();}
      if(ocean.fever>0){c.strokeStyle='#ffe793';c.lineWidth=2/z;c.beginPath();c.ellipse(0,0,p.size*1.8,p.size*1.1,0,0,TAU);c.stroke();if(!this.reduced)for(let i=0;i<8;i++)star(c,Math.cos(time+i*TAU/8)*p.size*1.95,Math.sin(time+i*TAU/8)*p.size*1.3,3/z,'#fff2b4');}
      if(ocean.safe>0&&ocean.safe<2.7&&!this.reduced)c.globalAlpha=.68+Math.sin(time*8)*.2;
      this.fish(c,{...SKINS[this.skin],...p,player:true},time);c.restore();
      // The player cue fades after the first few seconds; it never covers the fish.
      if(ocean.elapsed<6){c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#f6ffff';c.fillText('BẠN',p.x,p.y-p.size-27);c.beginPath();c.moveTo(p.x-4,p.y-p.size-21);c.lineTo(p.x+4,p.y-p.size-21);c.lineTo(p.x,p.y-p.size-16);c.fill();c.restore();}
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
  fish(c,f,t){
    c.save();c.scale(f.face||1,1);c.rotate(f.angle||0);c.scale(f.size,f.size);
    const color=f.color,fin=f.fin,shade=f.shade,shark=f.shark;
    c.lineJoin='round';c.lineWidth=.045;c.strokeStyle=shark?'#244a6b':'#184f6e88';
    c.save();c.translate(-.8,0);c.rotate(Math.sin(t*9)*.13);c.fillStyle=fin;c.beginPath();c.moveTo(.06,-.25);c.bezierCurveTo(-.4,-.35,-.78,-.76,-1.14,-.65);c.quadraticCurveTo(-.99,0,-1.14,.65);c.bezierCurveTo(-.78,.77,-.4,.35,.06,.25);c.closePath();c.fill();c.stroke();c.strokeStyle='#ffffff42';c.lineWidth=.02;for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(-.02,0);c.lineTo(-.88,j*.36);c.stroke();}c.restore();
    c.fillStyle=fin;c.beginPath();c.moveTo(-.55,-.38);c.quadraticCurveTo(-.1,shark?-1.2:-.96,.32,-.5);c.closePath();c.fill();c.stroke();
    const g=c.createLinearGradient(0,-.65,0,.65);g.addColorStop(0,color);g.addColorStop(.55,color);g.addColorStop(1,shade);c.fillStyle=g;c.beginPath();
    if(shark){c.moveTo(-1,-.28);c.bezierCurveTo(-.5,-.85,.7,-.55,1.38,.03);c.bezierCurveTo(.7,.62,-.5,.63,-1,.28);c.closePath();}else c.ellipse(0,0,1.16,.66,0,0,TAU);
    c.fill();c.stroke();
    c.fillStyle='#fff4cb33';c.beginPath();c.ellipse(.14,.3,.78,.23,-.05,0,TAU);c.fill();
    if(!f.player&&!shark){c.strokeStyle='#ffffff4f';c.lineWidth=.08;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-.55+i*.3,-.48);c.quadraticCurveTo(-.7+i*.3,0,-.5+i*.3,.44);c.stroke();}}
    c.save();c.translate(-.24,.2);c.rotate(Math.sin(t*7)*.13);c.fillStyle=fin;c.beginPath();c.moveTo(0,-.15);c.bezierCurveTo(-.6,.02,-.5,.7,.1,.31);c.closePath();c.fill();c.strokeStyle='#ffffff42';c.lineWidth=.025;c.stroke();c.restore();
    if(shark){c.strokeStyle='#385f7c';c.lineWidth=.035;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-.1-i*.12,-.16);c.lineTo(-.13-i*.12,.13);c.stroke();}}
    ellipse(c,.64,-.19,.26,.29,'#faffff');ellipse(c,.73,-.15,.115,.17,'#163c57');ellipse(c,.765,-.21,.04,.05,'#ffffff');
    c.strokeStyle='#9a5d5980';c.lineWidth=.04;c.beginPath();c.moveTo(1.03,.15);c.quadraticCurveTo(.93,.29,.78,.22);c.stroke();
    if(shark){c.fillStyle='#fff';for(let i=0;i<3;i++){c.beginPath();c.moveTo(.83+i*.1,.2);c.lineTo(.92+i*.1,.19);c.lineTo(.88+i*.1,.3);c.closePath();c.fill();}}
    else ellipse(c,.62,.2,.11,.065,'#ffb5a15c');
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
