import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {createBillingHandler,createWebhookHandler,BANK} from '../netlify/lib/ncn-billing-api.mjs';
import {createHandler,verifyIdentity} from '../netlify/lib/ncn-event-api.mjs';
import {withMemberVip,memberKey} from '../netlify/lib/ncn-membership.mjs';
import {memoryStore} from './fixtures/arcade-store.mjs';
const origin='https://ncn-donate.test',now=Date.parse('2026-11-01T04:00:00Z'),secret='ncn-fixture-only-secret-'.repeat(3);
const member={id:'member-test',email:'member@example.test',name:'Thành viên',admin:false,vip:false};
const request=(route,data)=>new Request(origin+'/.netlify/functions/ncn-billing?route='+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
const transaction=(extra={})=>({id:123,gateway:BANK.bank,accountNumber:BANK.account,transferType:'in',transferAmount:12345,content:'SEVQR NCN DONATE',transactionDate:'2026-11-01 11:00:00',referenceCode:'fixture-reference',...extra});
function receipt(data,key=secret){const body=JSON.stringify(data),stamp=String(now/1000);return new Request(origin+'/.netlify/functions/ncn-sepay-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-sepay-timestamp':stamp,'x-sepay-signature':'sha256='+createHmac('sha256',key).update(stamp+'.'+body).digest('hex')},body});}
function billing(user=member,store=memoryStore()){return createBillingHandler({production:()=>true,verify:async()=>user,store:()=>store,now:()=>now,config:()=>({enabled:false,secret:''})});}
function webhook(store){return createWebhookHandler({production:()=>true,store:()=>store,now:()=>now,config:()=>({secret})});}

test('the retired donation endpoint returns 410 without Identity, storage or writes',async()=>{
 const handler=createBillingHandler({production:()=>true,verify:()=>{throw Error('Must not verify');},store:()=>{throw Error('Must not open store');},now:()=>now,config:()=>({})});
 for(const amount of ['', '1','12345','0','-2','abc'])assert.equal((await handler(request('donation'+(amount?'&amount='+amount:'')))).status,410);
});
test('the current account does not depend on an expired, blocked, or unavailable historical payment ledger',async()=>{
 const handler=createBillingHandler({production:()=>true,verify:async()=>member,store:()=>{throw Error('Ledger offline');},now:()=>now,config:()=>({})});
 const response=await handler(request('me'));assert.equal(response.status,200);const {user}=await response.json();assert.equal(user.vip,false);assert.equal(user.vipSource,'none');assert.equal(user.admin,false);assert.equal(user.vipExpiresAt,null);
 assert.equal(withMemberVip({...member,vip:true}).vipSource,'manual');assert.equal(withMemberVip({...member,admin:true}).vipSource,'admin');
 for(const vipSource of ['account','payment'])assert.equal(withMemberVip({...member,vip:true,vipSource}).vip,false);
 assert.equal(withMemberVip(null),null);assert.equal(withMemberVip({...member,paidVipBlocked:true,vipExpiresAt:'2025-01-01'}).paidVipBlocked,false);
 assert.equal((await (await billing(null)(request('me'))).json()).user,null);
});
test('old plan creation is retired without writes, while authenticated receipt history remains private',async()=>{
 const store=memoryStore(),handler=billing(member,store);
 assert.equal((await handler(request('create-order',{planId:'vip30',amount:1,admin:true}))).status,410);assert.equal(store.entries.size,0);
 assert.deepEqual((await (await handler(request('plans'))).json()).plans,[]);
 for(const route of ['orders','admin','admin-order&id=NCNAAAAAAAAAAAAAAAAAAAA'])assert.equal((await billing(null,store)(request(route))).status,401);
 assert.equal((await handler(request('admin'))).status,403);
});
test('only Netlify VIP and ADMIN roles can open Event and GVGS; ordinary accounts and paid history cannot unlock assets or print',async()=>{
 for(const tool of ['event','gvgs']){
  const store=memoryStore(),product={code:'SP1',name:'Giá đã lưu',originalPrice:200,eventPrice:100};await store.setJSON('campaign-demo',{items:[product]});
  for(const user of [member,{...member,vip:true,vipExpiresAt:'2025-01-01'},{...member,vip:true,vipSource:'payment'},{...member,admin:true},null]){
   const permitted=!!(user&&(user.admin||user.vip&&user.vipSource!=='payment'));
   const handler=createHandler({production:()=>true,verify:async()=>user,store:()=>{assert.ok(permitted,'Unauthorized requests must not read private data');return store;},asset:async name=>name,print:items=>({html:'fixture',items})});
   const call=(route,data)=>handler(new Request(origin+'/.netlify/functions/ncn-'+tool+'?route='+route,{method:data?'POST':'GET',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}));
   const status=permitted?200:user?403:401;
   for(const route of ['app','asset&name=core','asset&name=ui','catalogues','catalogue&id=demo'])assert.equal((await call(route)).status,status,tool+' '+route);
   const response=await call('print',{items:[{...product,eventPrice:1,qty:1}],settings:{catalogueId:'demo'}});assert.equal(response.status,status);if(permitted&&!user.admin)assert.equal((await response.json()).items[0].eventPrice,100);
   assert.equal((await call('asset&name=bridge')).status,user?.admin?200:user?403:401);
   if(!user?.admin){assert.equal((await call('publish',{admin:true})).status,user?403:401);assert.equal((await call('delete',{admin:true})).status,user?403:401);}
  }
 }
});
test('donation access never bypasses Identity email confirmation, bans, invalid sessions or ADMIN roles',async()=>{
 const req=new Request(origin,{headers:{Cookie:'nf_jwt=fixture'}}),raw={id:member.id,email:member.email,confirmed_at:'2026-10-01',user_metadata:{roles:['admin'],admin:true},app_metadata:{roles:[]}};
 const verify=value=>verifyIdentity(req,{url:origin},async()=>Response.json(value));
 const user=withMemberVip(await verify(raw));assert.equal(user.vip,false);assert.equal(user.admin,false);
 assert.equal(withMemberVip(await verify({...raw,app_metadata:{roles:['vip']}})).vipSource,'manual');
 assert.equal(withMemberVip(await verify({...raw,app_metadata:{roles:['admin']}})).vipSource,'admin');
 assert.equal(withMemberVip(await verify({...raw,confirmed_at:null})),null);assert.equal(withMemberVip(await verify({...raw,banned_until:'2099-01-01'})),null);
 assert.equal(await verifyIdentity(new Request(origin),{url:origin}),null);
 assert.equal(await verifyIdentity(req,{url:origin},async()=>new Response('',{status:401})),null);
});
test('signed donations are recorded at the actual received amount once and never create membership grants',async()=>{
 const store=memoryStore(),handle=webhook(store),data=transaction();assert.equal((await handle(receipt(data))).status,200);const record=await store.get('txn-'+String(data.id).padStart(20,'0'));assert.equal(record.status,'donated');assert.equal(record.transaction.amount,12345);assert.equal(record.orderId,null);
 assert.equal([...store.entries.keys()].some(k=>k.startsWith('member-')||k.startsWith('order-')),false);
 const version=store.entries.get('txn-'+String(data.id).padStart(20,'0')).etag;assert.equal((await handle(receipt(data))).status,200);assert.equal(store.entries.get('txn-'+String(data.id).padStart(20,'0')).etag,version);
 assert.equal((await handle(receipt({...data,transferAmount:5}))).status,409);
});
test('duplicate bank references, invalid signatures and the wrong receiving account never count as new donations',async()=>{
 const store=memoryStore(),handle=webhook(store);assert.equal((await handle(receipt(transaction(),'wrong-fixture-secret'))).status,401);assert.equal(store.entries.size,0);
 await handle(receipt(transaction({accountNumber:'different'})));assert.equal(store.entries.size,0);
 await handle(receipt(transaction()));await handle(receipt(transaction({id:124})));assert.equal((await store.get('txn-'+String(124).padStart(20,'0'))).status,'review');assert.equal([...store.entries.values()].filter(x=>x.data.status==='donated').length,1);
});
test('a previously issued paid order can still settle idempotently and its history is preserved',async()=>{
 const store=memoryStore(),id='NCNAAAAAAAAAAAAAAAAAAAA',order={id,userId:member.id,userEmail:member.email,name:'VIP 30 ngày',planId:'vip30',amount:30000,days:30,createdAt:new Date(now-600000).toISOString(),expiresAt:new Date(now+600000).toISOString(),bankAccount:BANK.account,bankName:BANK.bank,payeeName:BANK.name,description:'SEVQR '+id,status:'pending'};
 await store.setJSON('order-'+id,order);const handle=webhook(store),data=transaction({content:order.description,transferAmount:30000});await handle(receipt(data));const ledger=await store.get(memberKey(member.id));assert.equal(Object.keys(ledger.grants).length,1);await handle(receipt(data));assert.deepEqual(await store.get(memberKey(member.id)),ledger);
 const response=await billing(member,store)(request('orders'));assert.equal((await response.json()).orders[0].status,'paid');assert.equal((await billing({...member,id:'other'},store)(request('order&id='+id))).status,404);
});
test('a recorded donation cannot be reused to reconcile a legacy order',async()=>{
 const store=memoryStore();await webhook(store)(receipt(transaction()));const response=await billing({...member,admin:true},store)(request('reconcile',{transactionId:'123',orderId:'NCNAAAAAAAAAAAAAAAAAAAA'}));assert.equal(response.status,409);assert.equal([...store.entries.keys()].some(k=>k.startsWith('member-')),false);
});
test('an interrupted donation receipt cannot be reassigned before its final status is saved',async()=>{
 const store=memoryStore(),original=store.setJSON.bind(store);store.setJSON=async(key,value,options)=>{if(value?.status==='donated')throw Error('Fixture write interruption');return original(key,value,options);};
 assert.equal((await webhook(store)(receipt(transaction()))).status,503);store.setJSON=original;
 assert.equal((await store.get('txn-'+String(123).padStart(20,'0'))).status,'received');
 const response=await billing({...member,admin:true},store)(request('reconcile',{transactionId:'123',orderId:'NCNAAAAAAAAAAAAAAAAAAAA'}));assert.equal(response.status,409);
 await webhook(store)(receipt(transaction()));assert.equal((await store.get('txn-'+String(123).padStart(20,'0'))).status,'donated');assert.equal([...store.entries.keys()].some(k=>k.startsWith('member-')),false);
});
test('all static shells remove donation cards, menu entries, account links and footer invitations',async()=>{
 const files=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?files(dir+'/'+entry.name):entry.name.endsWith('.html')?[dir+'/'+entry.name]:[]))).flat();
 for(const path of [...await files('public'),'netlify/lib/ncn-library/article-shell.html']){
  const html=await readFile(path,'utf8');const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');assert.doesNotMatch(text,/donate|ủng hộ NCN/i,path);assert.equal((html.match(/class="ncn-footer-donate"/g)||[]).length,0,path);assert.equal(/class="ncn-top-vip"/.test(html),false,path+' toolbar');assert.equal((html.match(/class="ncn-nav-link ncn-donate-button"/g)||[]).length,0,path+' removed Donate menu entry');assert.equal(/href="\/premium\/"|data-ncn-pin="vip"|id="donate-form"|id="donate-qr"/.test(html),false,path);assert.equal(/Nâng cấp VIP|Nâng cấp <b>VIP|Mua \/ gia hạn VIP|Đăng ký \/ gia hạn VIP|30\.000đ\/30 ngày/.test(html),false,path);
 }
});
