import {ensureSession,onAuthChange} from '../ncn-identity-client.js';

export function mountAndroidBridge({win=window,doc=document,fetcher=fetch,identity={ensureSession,onAuthChange}}={}){
 const bridge=win.NCNAndroid;if(!bridge||win.top!==win.self)return;
 let generation=0,closed=false,revocation=null,pending=null;
 const send=value=>bridge.postMessage(JSON.stringify(value));
 async function api(route,data,signal){
  const response=await fetcher('/.netlify/functions/ncn-push?route='+route,{credentials:'same-origin',cache:'no-store',signal:signal||AbortSignal.timeout(15000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Chưa kết nối được thông báo.');return result;
 }
 function disable(){
  ++generation;pending?.abort();pending=null;send({type:'disable'});
  if(revocation){api('revoke',revocation).catch(()=>{});revocation=null;}
 }
 async function sync(){
  const current=++generation;pending?.abort();pending=new AbortController();
  try{
   await identity.ensureSession();if(closed||current!==generation)return;
   const result=await api('status',null,pending.signal);if(closed||current!==generation)return;
   if(!result.admin){disable();return;}
   send({type:'enable',generation:current});
  }catch{if(!closed&&current===generation)send({type:'unavailable'});}
 }
 bridge.onmessage=async event=>{
  let message;try{message=JSON.parse(event.data);}catch{return;}
  if(message.type!=='token'||message.generation!==generation||closed)return;
  const current=generation;
  try{
   const result=await api('register',{deviceId:message.deviceId,token:message.token},pending?.signal);
   if(closed||current!==generation)return;
   revocation={deviceId:message.deviceId,secret:result.secret};
   send({type:'bound',...revocation,generation:current,ready:result.ready});
  }catch{if(current===generation&&!closed)send({type:'unavailable'});}
 };
 const off=identity.onAuthChange(event=>event==='logout'?disable():sync());
 const visible=()=>{if(!doc.hidden)sync();};
 const signedOut=()=>disable();
 doc.addEventListener('visibilitychange',visible);doc.addEventListener('ncn-account-signed-out',signedOut);
 win.addEventListener('pageshow',visible);sync();
 return {destroy(){closed=true;pending?.abort();off();bridge.onmessage=null;doc.removeEventListener('visibilitychange',visible);doc.removeEventListener('ncn-account-signed-out',signedOut);win.removeEventListener('pageshow',visible);}};
}
