import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {Room} from './room.mjs';
import {createSigningKeys,validPublicKeys,verifyTicket,signRecord} from './protocol.mjs';

export async function createArcadeServer({siteURL='https://nguyencongnghe.com',keys=createSigningKeys(),fetcher=fetch,now=Date.now,local=false,recordResult=null}={}){
 const site=new URL(siteURL);if(!local&&site.protocol!=='https:')throw Error('SITE_URL must use HTTPS');
 const rooms=new Map(),usedTickets=new Map(),ipLimits=new Map();let authKeys=null,keyUntil=0,pendingKeys=null;
 const publicKeys=async()=>{
  if(authKeys&&now()<keyUntil)return authKeys;if(pendingKeys)return pendingKeys;
  pendingKeys=(async()=>{const r=await fetcher(new URL('/.netlify/functions/ncn-arcade?route=keys',site),{redirect:'error',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Dịch vụ đăng nhập chưa sẵn sàng.');const raw=await r.text();if(raw.length>2000)throw Error('Invalid key');const value=JSON.parse(raw);if(!validPublicKeys(value))throw Error('Invalid key');authKeys=value;keyUntil=now()+300000;return value;})();try{return await pendingKeys;}finally{pendingKeys=null;}
 };
 const record=recordResult||(async result=>{
  const body=JSON.stringify(result);let error;
  for(let i=0;i<3;i++){try{const signed=signRecord(body,keys,now()),r=await fetcher(new URL('/.netlify/functions/ncn-arcade?route=record',site),{method:'POST',headers:{'Content-Type':'application/json','X-NCN-Time':signed.timestamp,'X-NCN-Key':signed.kid,'X-NCN-Signature':signed.signature},body,redirect:'error',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Record rejected');return;}catch(e){error=e;if(i<2)await new Promise(done=>setTimeout(done,1500*(i+1)));}}throw error;
 });
 const server=createServer((req,res)=>{
  const cors=req.headers.origin===site.origin?{'Access-Control-Allow-Origin':site.origin,'Vary':'Origin'}:{};
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method!=='GET'||!['/health','/keys'].includes(path)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...cors});res.end(JSON.stringify(path==='/keys'?{kid:keys.kid,publicKey:keys.publicKey}:{ok:true,game:'ncn-snake-v1'}));
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const ip=req.socket.remoteAddress||'unknown',old=ipLimits.get(ip),limit=now()-(old?.at||0)<60000?old:{at:now(),count:0};limit.count++;ipLimits.set(ip,limit);
  if(req.headers.origin!==site.origin||new URL(req.url,'http://localhost').pathname!=='/socket'||wss.clients.size>=256||limit.count>80){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 const sockets=new Map();
 wss.on('connection',ws=>{
  let claims=null,room=null,joining=false,finished=false,messages=0,windowAt=now();ws.alive=true;
  const send=data=>{if(ws.readyState!==1)return;if(data.type==='over'){finished=true;if(sockets.get(data.sub)===ws)sockets.delete(data.sub);}if(ws.bufferedAmount>512000){ws.close(1013,'Kết nối chậm. Vui lòng vào lại.');return;}ws.send(JSON.stringify(data));};
  const deadline=setTimeout(()=>{if(!claims)ws.close(1008,'Cần đăng nhập.');},7000);
  ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
  ws.on('message',async raw=>{
   if(finished)return;
   try{
    if(now()-windowAt>1000){messages=0;windowAt=now();}if(++messages>40)throw Error('Gửi lệnh quá nhanh.');
    const msg=JSON.parse(raw.toString());if(!msg||typeof msg!=='object')throw Error('Dữ liệu không hợp lệ.');
    if(!claims){
     if(joining||msg.type!=='join')throw Error('Cần đăng nhập.');joining=true;
     const next=verifyTicket(msg.ticket,await publicKeys(),now());if(usedTickets.has(next.jti))throw Error('Vé vào phòng đã được sử dụng.');
     if(sockets.has(next.sub))throw Error('Tài khoản đang chơi trên thiết bị khác.');
     if(!rooms.has(next.room)){if(rooms.size>=16)throw Error('Đấu trường đang đông. Thử lại sau.');rooms.set(next.room,new Room(next.room,{now,onFinish:record}));}
     room=rooms.get(next.room);room.add(next,send);claims=next;usedTickets.set(next.jti,next.exp*1000);sockets.set(next.sub,ws);clearTimeout(deadline);send({type:'welcome',room:next.room});room.broadcast();return;
    }
    if(msg.type==='input')room.input(claims.sub,msg);
    else if(msg.type==='leave'){room.finish(claims.sub,'leave');}
    else throw Error('Lệnh không hợp lệ.');
   }catch(error){send({type:'error',message:error.message==='Invalid ticket'?'Phiên vào phòng hết hạn. Vui lòng vào lại.':error.message});ws.close(1008,'Không thể vào phòng.');}
  });
  ws.on('close',()=>{clearTimeout(deadline);if(claims){room?.finish(claims.sub,'disconnect');if(sockets.get(claims.sub)===ws)sockets.delete(claims.sub);}});
 });
 let ticks=0,last=performance.now(),lag=0;
 const timer=setInterval(()=>{const current=performance.now();lag+=Math.min(.2,(current-last)/1000);last=current;let count=0;while(lag>=1/30&&count++<6){for(const room of rooms.values())room.tick(1/30);lag-=1/30;}if(++ticks%3===0)for(const room of rooms.values())room.broadcast();},1000/30);
 const housekeeping=setInterval(()=>{for(const [id,room]of rooms)if(!room.players.size)rooms.delete(id);for(const [id,expiry]of usedTickets)if(expiry<now())usedTickets.delete(id);for(const [id,limit]of ipLimits)if(now()-limit.at>60000)ipLimits.delete(id);for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
 async function close(){clearInterval(timer);clearInterval(housekeeping);for(const room of rooms.values())for(const id of [...room.players.keys()])room.finish(id,'shutdown');for(const ws of wss.clients)ws.close(1012,'Máy chủ đang cập nhật.');await new Promise(resolve=>server.close(resolve));wss.close();}
 return {server,rooms,keys,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const app=await createArcadeServer({siteURL:process.env.NCN_SITE_URL||'https://nguyencongnghe.com'});app.server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('NCN arcade server ready'));let stopping=false;process.on('SIGTERM',async()=>{if(stopping)return;stopping=true;setTimeout(()=>process.exit(1),25000).unref();await app.close();process.exit(0);});}
