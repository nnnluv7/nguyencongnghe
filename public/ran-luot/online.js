import {Arena,SKINS,wrap} from './core.js?v=20261025-snake-1';
const endpoint='/.netlify/functions/ncn-arcade?route=';
export async function arcadeAPI(route,{method='GET',data}={}){
 const r=await fetch(endpoint+route,{method,credentials:'same-origin',cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(data||{})}:{}),signal:AbortSignal.timeout(12000)}),value=await r.json();if(!r.ok)throw Object.assign(new Error(value.error||'Chưa kết nối được đấu trường.'),{status:r.status});return value;
}
const unpack=row=>({id:row[0],x:row[1],y:row[2],value:row[3],type:row[4],hue:row[5]});
export class OnlineArena {
 constructor(socket,onEvent=()=>{}){
  this.socket=socket;this.onEvent=onEvent;this.remote=true;this.status='connecting';this.radius=1450;this.food=[];this.pickups=[];this.bots=[];this.foodMap=new Map();this.seq=0;this.sinceInput=1;this.targets=new Map();this.elapsed=0;this.mode='online';this.recorded=null;this.maxCombo=1;
  this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});this.connectTimer=setTimeout(()=>{this.reject(Error('Chưa vào được phòng. Vui lòng thử lại.'));socket.close();},12000);
  socket.addEventListener('message',event=>{try{this.receive(JSON.parse(event.data));}catch{this.reject(Error('Không đọc được dữ liệu đấu trường.'));socket.close();}});
  socket.addEventListener('close',()=>{clearTimeout(this.connectTimer);if(this.status==='connecting')this.reject(Error('Chưa kết nối được phòng.'));else if(this.status!=='over'){this.status='over';this.reason='disconnect';this.recorded=false;this.onEvent({type:'over',reason:'disconnect',x:this.player?.x||0,y:this.player?.y||0});}});
  socket.addEventListener('error',()=>{if(this.status==='connecting')this.reject(Error('Chưa kết nối được phòng.'));});
 }
 receive(message){
  if(message.type==='error'){this.reject(Error(message.message||'Không vào được phòng.'));return;}
  if(message.type==='effect'){this.onEvent(message.event);return;}
  if(message.type==='record'){this.recorded=!!message.recorded;this.onEvent({type:'record',recorded:this.recorded});this.socket.close();return;}
  if(message.type==='over'){
   const {score,kills,elapsed,maxCombo,reason,recorded}=message;Object.assign(this,{score,kills,elapsed,maxCombo,reason,recorded,status:'over'});this.onEvent({type:'over',reason,x:this.player?.x||0,y:this.player?.y||0});return;
  }
  if(message.type!=='state'||this.status==='over')return;
  this.radius=message.radius;this.event=message.event;this.pickups=message.pickups;Object.assign(this,message.stats);
  if(message.food.full){this.foodMap=new Map(message.food.full.map(row=>[row[0],unpack(row)]));}
  else{for(const row of message.food.added)this.foodMap.set(row[0],unpack(row));for(const row of message.food.moved||[])if(this.foodMap.has(row[0]))this.foodMap.set(row[0],unpack(row));for(const id of message.food.removed)this.foodMap.delete(id);}
  this.food=[...this.foodMap.values()];const existing=new Map([...(this.player?[this.player]:[]),...this.bots].map(s=>[s.id,s])),snakes=[];
  for(const s of message.snakes){const target={...s,points:s.points.map(p=>({x:p[0],y:p[1]})),skin:SKINS.find(k=>k.id===s.skin)||SKINS[0],player:s.id===message.you,alive:true};const view=existing.get(s.id)||structuredClone(target);Object.assign(view,{mass:target.mass,skin:target.skin,name:target.name,player:target.player,alive:true,safe:target.safe,shield:target.shield,magnet:target.magnet,phase:target.phase,boosting:target.boosting});view.target=target;snakes.push(view);}
  this.player=snakes.find(s=>s.player);this.bots=snakes.filter(s=>!s.player);if(this.player&&this.status==='connecting'){this.status='playing';clearTimeout(this.connectTimer);this.resolve(this);}
 }
 size(s){return Arena.prototype.size(s);}
 step(dt,input){
  if(this.status!=='playing')return;const k=1-Math.exp(-dt*20);
  for(const s of [this.player,...this.bots]){const t=s.target;s.x+=(t.x-s.x)*k;s.y+=(t.y-s.y)*k;s.angle+=wrap(t.angle-s.angle)*k;s.points=t.points.map((q,i)=>{const old=s.points[i]||q;return {x:old.x+(q.x-old.x)*k,y:old.y+(q.y-old.y)*k};});}
  this.sinceInput+=dt;if(this.sinceInput>=.05&&this.socket.readyState===1){this.sinceInput=0;this.socket.send(JSON.stringify({type:'input',seq:++this.seq,angle:input.angle,boost:!!input.boost,phase:!!this.pendingPhase}));this.pendingPhase=false;}
 }
 phaseDash(){if(this.status!=='playing'||this.cooldown>0)return false;this.pendingPhase=true;this.cooldown=.2;return true;}
 pause(){if(this.status==='playing'&&this.socket.readyState===1){this.status='ending';this.socket.send(JSON.stringify({type:'leave'}));this.endingTimer=setTimeout(()=>{if(this.status==='ending')this.socket.close();},8000);}}
 close(){clearTimeout(this.connectTimer);clearTimeout(this.endingTimer);this.socket.close();}
}
export async function joinOnline({room='public',skin='mint',onEvent}={}){
 const cfg=await arcadeAPI('config');if(!cfg.ready)throw Error('Đấu trường online chưa mở.');
 const warm=new URL('/health',cfg.websocketURL);warm.protocol=warm.protocol==='wss:'?'https:':'http:';
 if(warm.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Kết nối đấu trường chưa an toàn.');
 // The free host can take a minute to wake. Obtain the short-lived join ticket
 // afterwards so the ticket cannot expire during that cold start.
 const healthy=await fetch(warm,{credentials:'omit',signal:AbortSignal.timeout(75000)});if(!healthy.ok)throw Error('Đấu trường đang bận. Vui lòng thử lại.');
 const entry=await arcadeAPI('ticket',{method:'POST',data:{room,skin}}),socket=new WebSocket(entry.websocketURL),game=new OnlineArena(socket,onEvent);
 socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'join',ticket:entry.ticket})),{once:true});await game.ready;return game;
}
