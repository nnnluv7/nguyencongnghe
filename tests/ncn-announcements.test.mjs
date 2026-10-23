import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnnouncementsHandler} from '../netlify/lib/ncn-announcements-api.mjs';
import {verifyIdentity} from '../netlify/lib/ncn-event-api.mjs';

const origin='https://nguyencongnghe.com',admin={id:'admin',admin:true};
function memory(){
  let record=null,counter=0;
  return {beforeWrite:null,get:async()=>structuredClone(record?.data??null),getWithMetadata:async()=>structuredClone(record),async setJSON(key,data,options){
    if(this.beforeWrite){const run=this.beforeWrite;this.beforeWrite=null;await run();}
    if(options.onlyIfNew&&record||options.onlyIfMatch&&record?.etag!==options.onlyIfMatch)return {modified:false};
    record={data:structuredClone(data),etag:String(++counter)};return {modified:true};
  },force(data){record={data,etag:String(++counter)};}};
}
function handler(store,user=admin,production=true){return createAnnouncementsHandler({store:()=>store,verify:async()=>user,production:()=>production});}
async function call(handle,route,data,options={}){
  const method=options.method||(data===undefined?'GET':'POST');
  const response=await handle(new Request(origin+'/.netlify/functions/ncn-announcements?route='+route,{method,headers:{origin:options.origin??origin,'content-type':options.type??'application/json'},...(method==='POST'?{body:JSON.stringify(data)}:{})}));
  return {status:response.status,headers:response.headers,body:await response.json()};
}
const add=(handle,text,version=null)=>call(handle,'add',{text,version});
test('Admin adds shared notices; public list includes only id and plain text',async()=>{
  const store=memory(),h=handler(store),first=await add(h,'  Thông báo\n mới  ');
  assert.equal(first.status,200);assert.equal(first.body.items[0].text,'Thông báo mới');
  assert.equal((await add(h,'Thông báo thứ hai',first.body.version)).status,200);
  const publicH=createAnnouncementsHandler({store:()=>store,production:()=>true,verify:()=>{throw Error('public read must not require Identity');}});
  const result=await call(publicH,'list');assert.equal(result.status,200);assert.equal(result.body.items.length,2);
  assert.deepEqual(Object.keys(result.body.items[0]).sort(),['id','text']);assert.equal(result.headers.get('cache-control'),'no-store');
});
test('deleting the last notice removes its text and leaves an empty public list',async()=>{
  const store=memory(),h=handler(store),first=await add(h,'Bảo trì tối nay');
  const removed=await call(h,'delete',{id:first.body.items[0].id,version:first.body.version});assert.equal(removed.status,200);
  assert.deepEqual((await call(handler(store,null),'list')).body.items,[]);
  assert.equal(JSON.stringify(await store.get()).includes('Bảo trì'),false);
  assert.equal((await add(h,'Thông báo mới',removed.body.version)).status,200);
});
test('guests, VIP and forged browser roles cannot add, remove or manage notices',async()=>{
  const store=memory(),saved=await add(handler(store),'Thông báo');
  for(const [user,status] of [[null,401],[{id:'vip',vip:true},403],[{id:'member',user_metadata:{roles:['admin']}},403]]){
    const h=handler(store,user);
    assert.equal((await call(h,'me')).body.admin,false);
    for(const [route,data] of [['manage',undefined],['add',{text:'Giả',version:saved.body.version,admin:true}],['delete',{id:saved.body.items[0].id,version:saved.body.version,roles:['admin']}]])assert.equal((await call(h,route,data)).status,status);
  }
  assert.equal((await store.get()).items.length,1);
});
test('fresh Identity ignores user_metadata and rejects expired or unconfirmed sessions',async()=>{
  const req=new Request(origin,{headers:{cookie:'nf_jwt=header.payload.signature'}}),config={url:origin+'/.netlify/identity'};
  const account={id:'u1',email:'test@example.com',confirmed_at:'2026-01-01',app_metadata:{roles:['vip']},user_metadata:{roles:['admin'],admin:true}};
  const user=await verifyIdentity(req,config,async()=>Response.json(account));assert.equal(user.admin,false);
  assert.equal(await verifyIdentity(req,config,async()=>new Response('',{status:401})),null);
  assert.equal(await verifyIdentity(req,config,async()=>Response.json({...account,confirmed_at:null})),null);
});
test('cross-origin mutations cannot change the shared list',async()=>{
  const store=memory(),h=handler(store),saved=await add(h,'Thông báo');
  for(const route of ['add','delete'])assert.equal((await call(h,route,{text:'Giả',id:saved.body.items[0].id,version:saved.body.version},{origin:'https://other.example'})).status,403);
  assert.equal((await store.get()).version,saved.body.version);
});
test('stale edits cannot overwrite or delete a newer notice',async()=>{
  const store=memory(),h=handler(store),first=await add(h,'Một'),second=await add(h,'Hai',first.body.version);
  assert.equal((await add(h,'Cũ',first.body.version)).status,409);
  assert.equal((await call(h,'delete',{id:first.body.items[0].id,version:first.body.version})).status,409);
  assert.deepEqual((await store.get()).items,second.body.items);
});
test('atomic writes protect simultaneous adds and deletes',async()=>{
  const store=memory(),h=handler(store),first=await add(h,'Một');
  const newer={version:'newer',items:[{id:'other',text:'Mới hơn'}]};
  store.beforeWrite=async()=>store.force(newer);
  assert.equal((await call(h,'delete',{id:first.body.items[0].id,version:first.body.version})).status,409);
  assert.deepEqual(await store.get(),newer);
  const empty=memory();empty.beforeWrite=async()=>empty.force(newer);
  assert.equal((await add(handler(empty),'Đầu tiên')).status,409);assert.deepEqual(await empty.get(),newer);
});
test('invalid, empty and oversized content are rejected without writes',async()=>{
  const store=memory(),h=handler(store);
  for(const data of [null,[],{text:''},{text:'   ',version:null},{text:'x'.repeat(501),version:null},{text:'a\u0000b',version:null},{text:23,version:null}])assert.ok([400,409].includes((await call(h,'add',data)).status));
  assert.equal((await call(h,'add',{text:'x'.repeat(9000),version:null})).status,413);
  assert.equal((await call(h,'add',{text:'Thông báo',version:null},{type:'text/plain'})).status,415);
  assert.equal(await store.get(),null);
  assert.equal((await add(h,'x'.repeat(500))).status,200);
});
test('ten-notice limit is freed by deletion; unknown IDs do not delete others',async()=>{
  const h=handler(memory());let saved={version:null};
  for(let i=0;i<10;i++){const result=await add(h,'Thông báo '+i,saved.version);assert.equal(result.status,200);saved=result.body;}
  assert.equal((await add(h,'Dư',saved.version)).status,400);
  assert.equal((await call(h,'delete',{id:'unknown',version:saved.version})).status,404);
  const deleted=await call(h,'delete',{id:saved.items[0].id,version:saved.version});assert.equal(deleted.status,200);
  assert.equal((await add(h,'Thay thế',deleted.body.version)).status,200);
});
test('preview environments cannot mutate production notices and failures are contained',async()=>{
  const store=memory();assert.equal((await add(handler(store,admin,false),'Preview')).status,503);assert.equal(await store.get(),null);
  assert.equal((await call(handler(store),'list',undefined,{method:'PUT'})).status,405);
  assert.equal((await call(handler(store),'delete')).status,404);
  const broken=createAnnouncementsHandler({production:()=>true,store:()=>{throw Error('private credentials');}});
  const failure=await call(broken,'list');assert.equal(failure.status,503);assert.equal(failure.body.error.includes('credentials'),false);
});
