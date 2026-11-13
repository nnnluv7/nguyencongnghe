import {createHash} from 'node:crypto';
import {BANK,createWebhookHandler,parseTransaction,verifySePaySignature} from './ncn-billing-api.mjs';
import {readBytes} from './ncn-audio-api.mjs';
import {audioCodes,failAudio,settleAudioOrder} from './ncn-audio-orders.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers});

async function identifyReceipt(store,tx,code){
 const key='receipt-'+tx.id,fingerprint=hash(JSON.stringify(tx));
 const saved=await store.setJSON(key,{code,fingerprint},{onlyIfNew:true});
 if(saved.modified)return;
 const prior=await store.get(key,{type:'json'});
 if(!prior)failAudio(503,'Chưa đọc được giao dịch. Vui lòng thử lại.');
 if(prior.fingerprint!==fingerprint)failAudio(409,'Mã giao dịch đã có dữ liệu khác.');
}

async function reserveReference(store,tx){
 if(!tx.reference)return true;
 const key='reference-'+hash(tx.account+'|'+tx.reference),transactionId='audio:'+tx.id;
 const saved=await store.setJSON(key,{transactionId},{onlyIfNew:true});
 if(saved.modified)return true;
 const prior=await store.get(key,{type:'json'});
 if(!prior)failAudio(503,'Chưa đọc được mã tham chiếu. Vui lòng thử lại.');
 return prior.transactionId===transactionId;
}

export function createSePayRouter(deps){
 const legacy=createWebhookHandler(deps),bank=deps.bank||BANK;
 return async req=>{
  if(!deps.production()||req.method!=='POST'||!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return legacy(req);
  try{
   const now=deps.now?.()??Date.now(),bytes=await readBytes(req,65536);
   verifySePaySignature(req,bytes,deps.config().secret,now);
   let payload;
   try{payload=JSON.parse(bytes.toString('utf8'));}catch{failAudio(400,'Dữ liệu không hợp lệ.');}
   const codes=typeof payload?.content==='string'?audioCodes(payload.content):[];
   if(!codes.length||payload.id===0||payload.id==='0')return legacy(new Request(req,{body:bytes}));
   const tx=parseTransaction(payload);
   if(tx.direction!=='in'||tx.bank.toLowerCase()!==bank.bank.toLowerCase()||tx.account!==bank.account)return reply({success:true});
   const ledger=deps.store(),store=deps.audioStore(),code=codes[0];
   await identifyReceipt(store,tx,code);
   if(codes.length!==1||/\bNCN[A-F0-9]{20}\b/i.test(tx.content)||!(await reserveReference(ledger,tx)))return reply({success:true,review:true});
   const result=await settleAudioOrder(store,code,tx,now);
   return reply({success:true,...(result.state==='review'?{review:true}:{})});
  }catch(error){
   return reply({success:false,error:error.status?error.message:'Chưa ghi nhận được giao dịch. Hệ thống sẽ thử lại.'},error.status||503);
  }
 };
}
