import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON} from '../public/assets/ncn-profile-request.js';

test('a slow response inside the photo deadline succeeds and its timer is cleared',async()=>{
 let signal;const value=await requestJSON('/fixture',{timeout:50,fetcher:async(url,options)=>{signal=options.signal;await new Promise(resolve=>setTimeout(resolve,10));return Response.json({saved:true});}});
 assert.deepEqual(value,{saved:true});await new Promise(resolve=>setTimeout(resolve,60));assert.equal(signal.aborted,false);
});
test('an expired request aborts and returns a retryable Vietnamese message instead of a raw timeout',async()=>{
 await assert.rejects(requestJSON('/fixture',{timeout:5,fetcher:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}),error=>error.retryable===true&&!/signal timed out|deadline exceeded/i.test(error.message)&&/Kết nối/.test(error.message));
});
test('a lost connection and a non-JSON gateway response remain safe to retry',async()=>{
 for(const fetcher of [async()=>{throw new TypeError('Failed to fetch');},async()=>new Response('<html>gateway detail</html>',{status:504})])await assert.rejects(requestJSON('/fixture',{fetcher}),error=>error.retryable===true&&!/gateway detail|Failed to fetch/.test(error.message));
});
test('validation and login failures keep their server message and are not automatically retried',async()=>{
 for(const status of [400,401,403,413,415])await assert.rejects(requestJSON('/fixture',{fetcher:async()=>Response.json({error:'Chọn ảnh hợp lệ.'},{status})}),error=>error.status===status&&error.retryable===false&&error.message==='Chọn ảnh hợp lệ.');
});
