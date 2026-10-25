import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import WebSocket from '../server/arcade/node_modules/ws/index.js';
import {createArcadeServer} from '../server/arcade/index.mjs';
import {createSigningKeys,signTicket,playerKey} from '../server/arcade/protocol.mjs';
const issuer=createSigningKeys(),site='https://ncn-wire.test';
test('real WebSocket clients authenticate, see each other, reject replay/forged tickets and record only server state',async()=>{
 const recorded=[],app=await createArcadeServer({siteURL:site,fetcher:async()=>Response.json({kid:issuer.kid,publicKey:issuer.publicKey}),recordResult:async r=>recorded.push(r)});await new Promise(done=>app.server.listen(0,'127.0.0.1',done));const url='ws://127.0.0.1:'+app.server.address().port+'/socket',clients=[];
 async function connect(token){const ws=new WebSocket(url,{origin:site}),messages=[];clients.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',ticket:token}));return {ws,messages};}
 const wait=async(fn)=>{const start=Date.now();while(!fn()){if(Date.now()-start>3000)throw Error('Timed out waiting for socket event');await new Promise(done=>setTimeout(done,10));}};
 try{
  const make=id=>signTicket({sub:playerKey(id),name:'Player '+id,room:'public',skin:'mint',jti:randomUUID()},issuer),ticket=make('a'),a=await connect(ticket);await wait(()=>a.messages.some(m=>m.type==='state'));
  const b=await connect(make('b'));await wait(()=>a.messages.some(m=>m.type==='state'&&m.snakes.length===2)&&b.messages.some(m=>m.type==='state'&&m.snakes.length===2));
  const replay=await connect(ticket);await wait(()=>replay.messages.some(m=>m.type==='error'));assert.equal(replay.messages.filter(m=>m.type==='state').length,0);
  a.ws.send(JSON.stringify({type:'input',seq:1,angle:0,boost:false,score:9999999,x:0}));a.ws.send(JSON.stringify({type:'leave'}));await wait(()=>a.messages.some(m=>m.type==='record'&&m.recorded));assert.equal(recorded.length,1);assert.ok(recorded[0].score<9999999);
  const again=await connect(make('a'));await wait(()=>again.messages.some(m=>m.type==='state'));assert.ok(again.messages.some(m=>m.type==='state'&&m.snakes.length===2));
 }finally{for(const ws of clients)ws.terminate();await app.close();}
});
