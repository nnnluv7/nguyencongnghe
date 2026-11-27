import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAndroidBridge} from '../public/assets/ncn-android/bridge.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const win=new EventTarget(),doc=new EventTarget(),messages=[],calls=[];win.top=win.self=win;doc.hidden=false;
 win.NCNAndroid={postMessage:value=>messages.push(JSON.parse(value))};let auth;
 const identity={ensureSession:async()=>({}),onAuthChange:handler=>{auth=handler;return()=>{};}};
 const fetcher=async(url,options)=>{
  const route=new URL(url,'https://ncn.test').searchParams.get('route');calls.push({route,data:options.body&&JSON.parse(options.body)});
  return Response.json(route==='status'?{admin:true,ready:true}:route==='register'?{registered:true,ready:true,secret:'f'.repeat(64)}:{revoked:true});
 };
 return {win,doc,messages,calls,identity,fetcher,auth:event=>auth(event)};
}
test('ordinary browser pages and subframes do not start Android requests',()=>{
 const win={top:1,self:1};let requested=false;
 assert.equal(mountAndroidBridge({win,doc:{},fetcher:()=>{requested=true;}}),undefined);assert.equal(requested,false);
 win.NCNAndroid={};win.self=2;assert.equal(mountAndroidBridge({win,doc:{},fetcher:()=>{requested=true;}}),undefined);assert.equal(requested,false);
});
test('the Android bridge verifies Admin on the server before enabling and binding a device',async()=>{
 const f=fixture(),controller=mountAndroidBridge(f);await flush();
 assert.deepEqual(f.calls.map(x=>x.route),['status']);assert.equal(f.messages[0].type,'enable');
 const generation=f.messages[0].generation;
 await f.win.NCNAndroid.onmessage({data:JSON.stringify({type:'token',generation,deviceId:'fixture',token:'fixture-token'})});
 assert.equal(f.calls[1].route,'register');assert.equal(f.messages[1].type,'bound');assert.equal(f.messages[1].generation,generation);controller.destroy();
});
test('logout disables native delivery immediately and rejects an old asynchronous token reply',async()=>{
 const f=fixture(),controller=mountAndroidBridge(f);await flush();const generation=f.messages[0].generation;
 await f.win.NCNAndroid.onmessage({data:JSON.stringify({type:'token',generation,deviceId:'fixture',token:'fixture-token'})});
 f.auth('logout');assert.equal(f.messages.at(-1).type,'disable');
 await f.win.NCNAndroid.onmessage({data:JSON.stringify({type:'token',generation,deviceId:'fixture',token:'stale'})});await flush();
 assert.equal(f.calls.filter(x=>x.route==='register').length,1);assert.equal(f.calls.at(-1).route,'revoke');controller.destroy();
});
test('a signed-in non-Admin cannot ask native code for a registration token',async()=>{
 const f=fixture();f.fetcher=async()=>Response.json({admin:false,signedIn:true,ready:true});const controller=mountAndroidBridge(f);await flush();
 assert.deepEqual(f.messages.map(x=>x.type),['disable']);controller.destroy();
});
