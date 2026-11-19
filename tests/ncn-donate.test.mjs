import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createBillingHandler,BANK,PLANS} from '../netlify/lib/ncn-billing-api.mjs';
import {createSePayRouter} from '../netlify/lib/ncn-sepay-router.mjs';
import {createHandler,verifyIdentity} from '../netlify/lib/ncn-event-api.mjs';
import {withMemberVip,memberKey} from '../netlify/lib/ncn-membership.mjs';
import {preparePublicTools} from '../netlify/lib/ncn-public-copy.mjs';
import {memoryStore} from './fixtures/arcade-store.mjs';
const origin='https://ncn-donate.test',now=Date.parse('2026-11-14T04:00:00Z'),secret='ncn-fixture-only-secret-'.repeat(3),day=86400000;
const member={id:'member-test',email:'member@example.test',name:'Thành viên',admin:false,vip:false};
const request=(route,data,cookie='',tool='billing')=>new Request(origin+'/.netlify/functions/ncn-'+tool+'?route='+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
const transaction=(extra={})=>({id:123,gateway:BANK.bank,accountNumber:BANK.account,transferType:'in',transferAmount:12345,content:'SEVQR NCN DONATE',transactionDate:'2026-11-14 11:00:00',referenceCode:'fixture-reference',...extra});
function receipt(data,key=secret){const body=JSON.stringify(data),stamp=String(now/1000);return new Request(origin+'/.netlify/functions/ncn-sepay-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-sepay-timestamp':stamp,'x-sepay-signature':'sha256='+createHmac('sha256',key).update(stamp+'.'+body).digest('hex')},body});}
function billing(user=member,store=memoryStore(),enabled=true){return createBillingHandler({production:()=>true,verify:async()=>user,store:()=>store,now:()=>now,config:()=>({enabled,secret})});}
function webhook(store){return createSePayRouter({production:()=>true,store:()=>store,now:()=>now,config:()=>({secret})});}
async function order(store,planId='vip30',quantity=1,user=member,requestId=randomUUID()){
 const response=await billing(user,store)(request('create-order',{planId,quantity,requestId}));assert.equal(response.status,201,await response.clone().text());return (await response.json()).order;
}
const product={code:'SP1',name:'Giá đã lưu',originalPrice:200,eventPrice:100};
async function tool(store,user=null,name='event'){
 const catalog=memoryStore();await catalog.setJSON('campaign-demo',{items:[product]});
 return createHandler({production:()=>true,verify:async()=>user,memberStore:()=>store,store:()=>catalog,now:()=>now,asset:async name=>name,print:items=>({html:'fixture',items})});
}
const printBody=(extra={})=>({items:[{...product,eventPrice:1,qty:1}],settings:{catalogueId:'demo'},requestId:randomUUID(),...extra});

test('public plans show exactly 29,000/30 days and 49,000/60 days without opening Identity or storage',async()=>{
 const handler=createBillingHandler({production:()=>true,verify:()=>{throw Error('Must not verify');},store:()=>{throw Error('Must not open store');},now:()=>now,config:()=>({enabled:true,secret})});
 const result=await (await handler(request('plans'))).json();assert.deepEqual(result.plans,PLANS);assert.equal(result.enabled,true);
 assert.deepEqual(PLANS.map(p=>[p.amount,p.days]),[[29000,30],[49000,60]]);
});
test('order creation requires login and configured SePay, ignores client price/role claims and is idempotent',async()=>{
 const store=memoryStore();assert.equal((await billing(null,store)(request('create-order',{planId:'vip30',requestId:randomUUID()}))).status,401);
 assert.equal((await billing(member,store,false)(request('create-order',{planId:'vip30',requestId:randomUUID()}))).status,503);
 assert.equal([...store.entries.keys()].some(k=>k.startsWith('order-')),false);
 const requestId=randomUUID(),data={planId:'vip30',requestId,quantity:1,amount:1,days:9999,admin:true,userId:'someone-else'};
 const first=await (await billing(member,store)(request('create-order',data))).json(),second=await (await billing(member,store)(request('create-order',data))).json();
 assert.equal(first.order.id,second.order.id);assert.equal(first.order.amount,29000);assert.equal(first.order.days,30);
 assert.equal(first.order.description,'SEVQR '+first.order.id);
 const qr=new URL(first.order.qrUrl);
 assert.equal(qr.searchParams.get('des'),first.order.description);
 assert.equal(qr.searchParams.get('amount'),'29000');
 assert.equal((await store.get('order-'+first.order.id)).userId,member.id);
 assert.equal((await billing(member,store)(request('create-order',{...data,planId:'vip60'}))).status,409);
 assert.equal((await billing(member,store)(request('create-order',{...data,requestId:randomUUID(),quantity:-1}))).status,400);
 assert.equal((await billing({...member,id:'other'},store)(request('order&id='+first.order.id))).status,404);
 assert.equal((await billing(member,store)(request('admin'))).status,403);
});
test('existing Donate orders return a SePay-compatible memo and still match their original order',async()=>{
 const store=memoryStore(),requestId=randomUUID(),o=await order(store,'vip30',1,member,requestId);
 const original=await store.get('order-'+o.id);
 await store.setJSON('order-'+o.id,{...original,description:'NCN '+o.id});
 const restored=await (await billing(member,store)(request('order&id='+o.id))).json();
 assert.equal(restored.order.id,o.id);
 assert.equal(restored.order.description,'SEVQR '+o.id);
 assert.equal(new URL(restored.order.qrUrl).searchParams.get('des'),restored.order.description);
 const retried=await order(store,'vip30',1,member,requestId);
 assert.equal(retried.description,restored.order.description);
 const response=await webhook(store)(receipt(transaction({content:restored.order.description,transferAmount:o.amount})));
 assert.equal(response.status,200);
 const paid=await (await billing(member,store)(request('order&id='+o.id))).json();
 assert.equal(paid.order.status,'paid');
 assert.equal(paid.user.vipSource,'payment');
});
test('confirmed SePay receipts grant both tools, extend the remaining term and never apply twice',async()=>{
 const store=memoryStore(),first=await order(store),handle=webhook(store);
 const data=transaction({content:first.description,transferAmount:29000});assert.equal((await handle(receipt(data))).status,200);
 let m=await store.get(memberKey(member.id));assert.equal(Date.parse(m.expiresAt),now+30*day);
 await handle(receipt(data));assert.deepEqual(await store.get(memberKey(member.id)),m);
 const second=await order(store,'vip60');await handle(receipt(transaction({id:124,referenceCode:'second',content:second.description,transferAmount:49000})));
 m=await store.get(memberKey(member.id));assert.equal(Date.parse(m.expiresAt),now+90*day);assert.equal(Object.keys(m.grants).length,2);
 const current=await (await billing(member,store)(request('me'))).json();assert.equal(current.user.vip,true);assert.equal(current.user.vipSource,'payment');
 for(const name of ['event','gvgs'])assert.equal((await (await tool(store,member,name))(request('app',undefined,'',name))).status,200);
 const third=await order(store,'vip60',2);assert.equal(third.amount,98000);assert.equal(third.days,120);
 await handle(receipt(transaction({id:125,referenceCode:'third',content:third.description,transferAmount:98000})));
 assert.equal(Date.parse((await store.get(memberKey(member.id))).expiresAt),now+210*day);
});
test('wrong amount, recipient, signatures, duplicate references and altered receipts cannot grant VIP',async()=>{
 const store=memoryStore(),o=await order(store),handle=webhook(store);
 const good=transaction({content:o.description,transferAmount:o.amount});
 assert.equal((await handle(receipt(good,'wrong-fixture-secret'))).status,401);
 await handle(receipt({...good,accountNumber:'different'}));assert.equal((await store.get(memberKey(member.id))).expiresAt,null);
 await handle(receipt({...good,transferAmount:1}));assert.equal((await store.get(memberKey(member.id))).expiresAt,null);
 assert.equal((await handle(receipt(good))).status,409);
 const next=await order(store,'vip60');await handle(receipt(transaction({id:124,referenceCode:'real-ref',content:next.description,transferAmount:next.amount})));
 const before=await store.get(memberKey(member.id));
 const other=await order(store);await handle(receipt(transaction({id:125,referenceCode:'real-ref',content:other.description,transferAmount:other.amount})));
 assert.equal((await store.get(memberKey(member.id))).expiresAt,before.expiresAt);
 assert.equal((await store.get('txn-'+String(125).padStart(20,'0'))).status,'review');
});
test('expired membership starts at settlement; blocked accounts cannot order or access trials',async()=>{
 const store=memoryStore();await store.setJSON(memberKey(member.id),{userId:member.id,email:member.email,expiresAt:new Date(now-day).toISOString(),grants:{},requests:{}});
 const o=await order(store);await webhook(store)(receipt(transaction({content:o.description,transferAmount:o.amount})));
 assert.equal(Date.parse((await store.get(memberKey(member.id))).expiresAt),now+30*day);
 const record=await store.get(memberKey(member.id));await store.setJSON(memberKey(member.id),{...record,blocked:true});
 assert.equal((await billing(member,store)(request('create-order',{planId:'vip30',requestId:randomUUID()}))).status,403);
 assert.equal((await (await tool(store,member))(request('app',undefined,'','event'))).status,403);
});
test('guests get three successful prints shared across tools, with no charge for reads, invalid prints or retries',async()=>{
 const store=memoryStore(),event=await tool(store),gvgs=await tool(store,null,'gvgs');
 const me=await event(request('me',undefined,'','event')),cookie=me.headers.get('set-cookie').split(';')[0];assert.match(me.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 for(const route of ['app','asset&name=core','catalogues','catalogue&id=demo'])assert.equal((await event(request(route,undefined,cookie,'event'))).status,200);
 assert.equal((await event(request('print',printBody({items:[]}),cookie,'event'))).status,400);
 const data=printBody(),first=await event(request('print',data,cookie,'event'));assert.equal(first.status,200);assert.equal((await first.json()).trial.remaining,2);
 const retry=await event(request('print',data,cookie,'event'));assert.equal(retry.status,200);assert.equal((await retry.json()).trial.remaining,2);
 assert.equal((await event(request('print',{...data,items:[{...product,qty:2}]},cookie,'event'))).status,409);
 assert.equal((await gvgs(request('print',printBody(),cookie,'gvgs'))).status,200);
 const last=await event(request('print',printBody(),cookie,'event'));assert.equal((await last.json()).trial.remaining,0);
 assert.equal((await gvgs(request('print',printBody(),cookie,'gvgs'))).status,403);
 assert.equal((await event(request('app',undefined,cookie,'event'))).status,403);
 for(const route of ['asset&name=bridge','publish','delete'])assert.equal((await event(request(route,route==='asset&name=bridge'?undefined:{admin:true},cookie,'event'))).status,403);
});
test('sign-up carries guest usage; a confirmed ordinary account keeps its limit on another browser',async()=>{
 const store=memoryStore(),guest=await tool(store),logged=await tool(store,member);
 const res=await guest(request('me',undefined,'','event')),cookie=res.headers.get('set-cookie').split(';')[0];
 await guest(request('print',printBody(),cookie,'event'));await guest(request('print',printBody(),cookie,'event'));
 const me=await (await billing(member,store)(request('me',undefined,cookie))).json();assert.equal(me.user.trial.remaining,1);assert.equal(me.user.vip,false);
 await logged(request('print',printBody(),cookie,'event'));
 const otherBrowser=await logged(request('me',undefined,'','event'));assert.equal((await otherBrowser.json()).trial.remaining,0);
});
test('concurrent prints across tools and browsers cannot exceed three per account',async()=>{
 const store=memoryStore(),event=await tool(store,member),gvgs=await tool(store,member,'gvgs');
 const requests=Array.from({length:12},(_,i)=>(i%2?event:gvgs)(request('print',printBody(),'ncn_vip_trial='+randomUUID(),i%2?'event':'gvgs')));
 const responses=await Promise.all(requests);assert.equal(responses.filter(r=>r.status===200).length,3);assert.ok(responses.every(r=>[200,403].includes(r.status)));
});
test('Identity metadata never grants admin; manual VIP and Admin keep unlimited access',async()=>{
 const req=new Request(origin,{headers:{Cookie:'nf_jwt=fixture'}}),raw={id:member.id,email:member.email,confirmed_at:'2026-10-01',user_metadata:{roles:['admin'],admin:true},app_metadata:{roles:[]}};
 const verified=await verifyIdentity(req,{url:origin},async()=>Response.json(raw));assert.equal(withMemberVip(verified).vip,false);assert.equal(verified.admin,false);
 for(const user of [{...member,vip:true},{...member,admin:true}]){
  const handler=await tool(memoryStore(),user);for(let i=0;i<5;i++)assert.equal((await handler(request('print',printBody(),'', 'event'))).status,200);
 }
});
test('unassigned optional donations stay separate from membership and signed receipts are deduplicated',async()=>{
 const store=memoryStore(),handle=webhook(store),data=transaction();await handle(receipt(data));await handle(receipt(data));
 assert.equal((await store.get('txn-'+String(123).padStart(20,'0'))).status,'donated');assert.equal([...store.entries.keys()].some(k=>k.startsWith('member-')),false);
 assert.equal((await handle(receipt({...data,transferAmount:5}))).status,409);
});
test('Donate has branded terms and prices, all public shells link to it and assets stay server protected',async()=>{
 const html=await readFile('public/donate/index.html','utf8');assert.doesNotMatch(html,/mientay2\.pro|160439|9216/i);
 for(const text of ['29.000đ','49.000đ','30 ngày VIP','60 ngày VIP','3 lượt dùng thử chung','id="reg"','id="donate-form"','id="donate-qr"'])assert.ok(html.includes(text),text);
 const home=preparePublicTools(await readFile('public/index.html','utf8'));assert.match(home,/href="\/donate\/#reg"/);assert.match(home,/ncn-footer-donate/);
 const css=await readFile('public/assets/ncn-theme/site.css','utf8');assert.doesNotMatch(css,/html:not\(\[data-ncn-vip-access/);
});
