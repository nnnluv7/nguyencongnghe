// A small original NCN mascot: real lit 3D geometry, rendered once into a
// transparent sprite. No model downloads, dependencies or per-frame contexts.
const SPRITE_WIDTH=320,SPRITE_HEIGHT=202,TAU=Math.PI*2;
const GREEN=[.24,.72,.45],LIGHT_GREEN=[.39,.85,.54],BELLY=[.96,.91,.65],DARK=[.055,.19,.15],ORANGE=[1,.63,.27];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const vertexShader=`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aPart;
uniform float uTime;
uniform float uAim;
uniform float uRecoil;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main(){
 vec3 p=aPosition,n=aNormal;
 if(aPart>0.5&&aPart<1.5){
  float a=uAim*.10-uRecoil*.035;
  mat2 r=mat2(cos(a),sin(a),-sin(a),cos(a));
  p.xy=r*(p.xy-vec2(-15.,24.))+vec2(-15.,24.);
  n.xy=r*n.xy;
 }
 if(aPart>1.5&&aPart<2.5){
  float a=sin(uTime*2.1)*.045;
  mat2 r=mat2(cos(a),sin(a),-sin(a),cos(a));
  p.xy=r*(p.xy-vec2(-44.,-23.))+vec2(-44.,-23.);
  n.xy=r*n.xy;
 }
 if(aPart>2.5){p.y-=uRecoil*3.;p.x-=uRecoil*2.;}
 p.y+=sin(uTime*1.8)*.45-uRecoil*1.7;
 float perspective=1.+p.z/650.;
 gl_Position=vec4(p.x*perspective/95.,(p.y-1.)*perspective/60.,-p.z/100.,1.);
 vPosition=p;vNormal=normalize(n);vColor=aColor;
}`;
const fragmentShader=`
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main(){
 vec3 n=normalize(vNormal);
 vec3 light=normalize(vec3(-.55,.85,1.3));
 vec3 view=normalize(vec3(-vPosition.x*.001,-vPosition.y*.001,1.));
 float diffuse=max(0.,dot(n,light));
 float sky=.5+.5*n.y;
 float spec=pow(max(0.,dot(n,normalize(light+view))),40.);
 float rim=pow(1.-max(0.,dot(n,view)),3.);
 vec3 color=vColor*(.37+.61*diffuse+.10*sky);
 color+=vec3(1.,.98,.88)*spec*.25;
 color+=vec3(.56,.84,.69)*rim*.10;
 gl_FragColor=vec4(color,1.);
}`;

function geometry(){
 const data=[];
 const add=(p,n,color,part)=>data.push(...p,...n,...color,part);
 function ellipsoid(center,size,color,part=0,angle=0,slices=20,stacks=12){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const point=(u,v)=>{
   const longitude=u*TAU,latitude=v*Math.PI,x=Math.sin(latitude)*Math.cos(longitude),y=Math.cos(latitude),z=Math.sin(latitude)*Math.sin(longitude);
   const px=x*size[0],py=y*size[1],nx=x/size[0],ny=y/size[1],nz=z/size[2],len=Math.hypot(nx,ny,nz);
   return {p:[center[0]+px*ca-py*sa,center[1]+px*sa+py*ca,center[2]+z*size[2]],n:[(nx*ca-ny*sa)/len,(nx*sa+ny*ca)/len,nz/len]};
  };
  for(let v=0;v<stacks;v++)for(let u=0;u<slices;u++){
   const a=point(u/slices,v/stacks),b=point((u+1)/slices,v/stacks),c=point((u+1)/slices,(v+1)/stacks),d=point(u/slices,(v+1)/stacks);
   for(const p of [a,b,c,a,c,d])add(p.p,p.n,color,part);
  }
 }
 function triangle(a,b,c,color,part=0){
  const ab=b.map((n,i)=>n-a[i]),ac=c.map((n,i)=>n-a[i]);
  const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...n)||1;
  for(const p of [a,b,c])add(p,n.map(x=>x/len),color,part);
 }
 function fin(x,y,z,w,h,color=ORANGE,part=0){
  const a=[x,y+h/2,z],b=[x+w,y-h/2,z-4],c=[x+w,y-h/2,z+4],tip=[x-w*.4,y+h*.5,z];
  triangle(tip,b,c,color,part);triangle(tip,a,b,color,part);triangle(tip,c,a,color,part);triangle(a,c,b,color,part);
 }
 // Tapered, curved tail. Its broad base sits behind the torso.
 const tail=[[-42,-20,-10,12],[-52,-27,-12,11],[-65,-30,-11,8],[-77,-26,-8,4.5],[-87,-15,-3,.4]];
 for(let i=0;i<tail.length-1;i++)for(let j=0;j<16;j++){
  const ring=(k,t)=>{const [x,y,z,r]=tail[k];return [x,y+Math.cos(t)*r,z+Math.sin(t)*r];};
  const t=j*TAU/16,next=(j+1)*TAU/16,a=ring(i,t),b=ring(i,next),c=ring(i+1,next),d=ring(i+1,t);
  triangle(a,b,c,GREEN,2);triangle(a,c,d,GREEN,2);
 }
 for(const [x,y,w,h]of [[-43,35,9,15],[-49,18,9,16],[-52,0,8,15],[-56,-17,8,12],[-69,-24,6,10]])fin(x,y,-10,w,h,ORANGE,x<-55?2:0);
 // Feet, rounded body, cream belly, and a neck with a real silhouette.
 ellipsoid([-39,-46,10],[20,10,15],GREEN);
 ellipsoid([-6,-47,13],[19,10,15],LIGHT_GREEN);
 ellipsoid([-25,-20,0],[29,36,23],GREEN,0,-.10);
 ellipsoid([-15,-21,21],[20,29,6],BELLY,0,-.10);
 ellipsoid([-22,9,5],[19,27,18],LIGHT_GREEN,0,-.12);
 for(const x of [-48,-40,-32,-14,-6,2])ellipsoid([x,-46,24],[3.5,2.3,4],[.97,.96,.83],0,0,10,6);
 // Far arm is drawn as geometry behind the egg; nearer arm has four fingers.
 ellipsoid([15,-8,14],[11,16,9],GREEN,3,-.65);
 ellipsoid([21,-6,26],[10,8,8],LIGHT_GREEN,3,.2);
 ellipsoid([-25,-5,23],[11,17,10],GREEN,3,.55);
 ellipsoid([-19,-7,34],[12,8,8],LIGHT_GREEN,3,.15);
 for(let i=0;i<3;i++)ellipsoid([-12+i*4,-5+i*.8,38],[3.3,4.5,2.8],LIGHT_GREEN,3,-.25,12,8);
 // Broad head and pear-shaped muzzle create a dinosaur rather than a sphere.
 ellipsoid([-16,31,7],[30,28,23],LIGHT_GREEN,1,-.10);
 ellipsoid([6,25,25],[24,17,16],LIGHT_GREEN,1,-.16);
 ellipsoid([6,14,28],[21,9,13],BELLY,1,-.10);
 ellipsoid([-21,24,28],[6.8,4.4,2.1],[1,.66,.47],1,-.15,14,8);
 ellipsoid([24,22,32],[4.2,3.2,1.1],[1,.71,.5],1,0,14,8);
 // Large separate eyes, dark pupils, and small geometric highlight dots.
 for(const [x,y,z,s]of [[-29,43,22,1],[-6,43,28,.96]]){
  ellipsoid([x,y,z],[9*s,12*s,8*s],[.98,.99,.92],1,-.10);
  ellipsoid([x+2,y+1,z+6.8],[4.5*s,6.7*s,3.5*s],DARK,1,-.10,16,10);
  ellipsoid([x+1,y+4.4,z+9.8],[1.5,2.1,.9],[1,1,1],1,0,10,8);
  ellipsoid([x+4,y-1,z+9.8],[.7,.9,.5],[.65,.89,.72],1,0,8,6);
  ellipsoid([x-1,y+10,z-1],[10,4.4,7],GREEN,1,-.1,16,8);
 }
 // Nostril dimples and a short curved smile on the rounded muzzle.
 ellipsoid([3,30,39.7],[1.5,1.1,.8],DARK,1,-.2,12,8);
 ellipsoid([18,27,37.8],[1.4,1,.7],DARK,1,-.2,12,8);
 for(let i=0;i<12;i++){
  const t=i/11,x=-4+t*24,y=16-Math.sin(t*Math.PI)*2.7;
  ellipsoid([x,y,39.5-Math.abs(t-.45)*3],[1.25,.65,.7],[.12,.36,.23],1,-.2,8,6);
 }
 return new Float32Array(data);
}

function webglSprite(doc){
 const canvas=doc.createElement('canvas');canvas.width=SPRITE_WIDTH;canvas.height=SPRITE_HEIGHT;
 let gl,program,buffer,active=true;
 try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl)return null;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;};
  const vert=compile(gl.VERTEX_SHADER,vertexShader),frag=compile(gl.FRAGMENT_SHADER,fragmentShader);if(!vert||!frag){if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag);return null;}
  program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const mesh=geometry();gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
  const stride=10*4;for(const [name,size,offset]of [['aPosition',3,0],['aNormal',3,12],['aColor',3,24],['aPart',1,36]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride,offset);}
  const uniforms=Object.fromEntries(['uTime','uAim','uRecoil'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);gl.viewport(0,0,SPRITE_WIDTH,SPRITE_HEIGHT);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;});
  return {
   canvas,get active(){return active&&!gl.isContextLost();},
   render(time,angle,recoil){if(!active||gl.isContextLost())return false;gl.useProgram(program);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uAim,angle);gl.uniform1f(uniforms.uRecoil,recoil);gl.drawArrays(gl.TRIANGLES,0,mesh.length/10);return true;},
   dispose(){active=false;gl.deleteBuffer(buffer);gl.deleteProgram(program);}
  };
 }catch{if(gl&&buffer)gl.deleteBuffer(buffer);if(gl&&program)gl.deleteProgram(program);return null;}
}

function fallbackSprite(doc){
 const canvas=doc.createElement('canvas');canvas.width=SPRITE_WIDTH;canvas.height=SPRITE_HEIGHT;const c=canvas.getContext('2d');
 function shape(x,y,rx,ry,a,bright,shade){const g=c.createRadialGradient(x-rx*.4,y-ry*.55,1,x+rx*.35,y+ry*.35,Math.max(rx,ry)*1.4);g.addColorStop(0,bright);g.addColorStop(1,shade);c.fillStyle=g;c.beginPath();c.ellipse(x,y,rx,ry,a,0,TAU);c.fill();}
 return {canvas,render(time,angle,recoil){
  if(!c)return;c.setTransform(SPRITE_WIDTH/190,0,0,SPRITE_HEIGHT/120,SPRITE_WIDTH/2,SPRITE_HEIGHT*62/120);c.clearRect(-95,-62,190,120);c.save();c.translate(0,Math.sin(time*1.8)*.45+recoil*1.7);
  c.fillStyle='#267c4e';c.beginPath();c.moveTo(-42,15);c.bezierCurveTo(-64,38,-80,31,-89,12);c.bezierCurveTo(-76,23,-64,16,-51,5);c.closePath();c.fill();
  for(const [x,y]of [[-46,-34],[-51,-16],[-53,2],[-60,19]]){c.fillStyle='#ffa23d';c.beginPath();c.moveTo(x,y-8);c.lineTo(x-9,y-3);c.lineTo(x+5,y+9);c.closePath();c.fill();}
  shape(-39,46,20,10,0,'#66d477','#247a4c');shape(-6,47,19,10,0,'#8be58c','#247a4c');shape(-25,20,29,36,.1,'#75df83','#22774b');shape(-15,22,20,29,.1,'#fff6be','#d6c87d');shape(-22,-9,19,27,.12,'#86e897','#2a8e53');
  c.save();c.translate(-15,-24);c.rotate(-angle*.1+recoil*.035);c.translate(15,24);
  shape(-16,-31,30,28,.1,'#9defa6','#339e5c');shape(6,-25,24,17,.16,'#9cef9e','#399554');shape(6,-14,21,9,.1,'#fff6be','#cbbb79');shape(-21,-24,6.8,4.4,.15,'#ffbb8b','#ee8b65');
  for(const [x,y,z]of [[-29,-43,1],[-6,-43,.96]]){shape(x,y,9*z,12*z,.1,'#fffef2','#d9e7c4');shape(x+2,y-1,4.5*z,6.7*z,.1,'#164f3a','#0c271f');c.fillStyle='#fff';c.beginPath();c.ellipse(x+1,y-4.4,1.5,2.1,0,0,TAU);c.fill();}
  c.strokeStyle='#255d35';c.lineWidth=1.1;c.lineCap='round';c.beginPath();c.moveTo(-4,-16);c.quadraticCurveTo(8,-10,20,-16);c.stroke();for(const [x,y]of [[3,-30],[18,-27]])shape(x,y,1.5,1.1,.2,'#285d35','#143e2c');c.restore();
  shape(19,6+recoil*3,10,8,-.2,'#94e99c','#338b52');shape(-19,7+recoil*3,12,8,-.15,'#94e99c','#338b52');
  for(const x of [-48,-40,-32,-14,-6,2])shape(x,47,3.2,2.1,0,'#fff9d9','#e4dfaf');c.restore();
 }};
}

/** x/y: loaded egg centre in game units; time: seconds; recoil: 0..1. */
export function createDinosaur(doc){
 let disposed=false,last=null,gl=webglSprite(doc),fallback=null;
 return {
  get kind(){return gl?.active?'webgl':'canvas';},
  draw(ctx,{x=0,y=0,angle=0,time=0,recoil=0,reduced=false}={}){
   if(disposed||!ctx)return;
   const aim=clamp(Number.isFinite(angle)?angle:0,-1.34,1.34),t=reduced?0:Number.isFinite(time)?time:0,kick=reduced?0:clamp(Number.isFinite(recoil)?recoil:0,0,1);
   const sprite=gl?.active?gl:(fallback??=fallbackSprite(doc));
   if(!last||last.sprite!==sprite||Math.abs(t-last.time)>=1/24||Math.abs(aim-last.aim)>.025||Math.abs(kick-last.kick)>.08){
    let rendered=true;try{rendered=sprite.render(t,aim,kick)!==false;}catch{rendered=false;}
    if(!rendered){gl?.dispose();gl=null;fallback??=fallbackSprite(doc);fallback.render(t,aim,kick);last={sprite:fallback,time:t,aim,kick};}
    else last={sprite,time:t,aim,kick};
   }
   ctx.save();ctx.drawImage(last.sprite.canvas,x-95,y-62,190,120);ctx.restore();
  },
  dispose(){if(disposed)return;disposed=true;gl?.dispose();gl=null;fallback=null;last=null;}
 };
}
