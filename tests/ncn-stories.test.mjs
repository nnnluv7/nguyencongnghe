import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createStoriesHandler,cleanupStories,storyAuthorKey} from '../netlify/lib/ncn-stories-api.mjs';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const origin='https://ncn-stories.test',member={id:'member',name:'Thành viên thử',email:'member@example.test',vip:false,admin:false},other={...member,id:'other'},admin={...member,id:'admin',admin:true};
const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#427eb0'}}).jpeg().withExif({IFD0:{Copyright:'private-metadata'}}).toBuffer();
function fixture(){const store=memoryStories();let now=Date.parse('2026-10-25T05:00:00Z');const handler=createStoriesHandler({production:()=>true,store:()=>store,verify:async req=>({member,other,admin})[req.headers.get('x-fixture-user')]||null,now:()=>now});return {store,handler,advance:delta=>now+=delta};}
const input=(overrides={})=>({requestId:randomUUID(),caption:'Khoảnh khắc NCN',image:jpeg.toString('base64'),...overrides});
async function call(f,route,data,user='member',headers={}){const response=await f.handler(new Request(origin+'/?route='+route,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','x-fixture-user':user,...headers},...(data?{body:JSON.stringify(data)}:{})}));return {status:response.status,body:await response.json()};}

test('a confirmed ordinary member can publish, public readers receive no email or storage pointers',async()=>{
  const f=fixture(),saved=await call(f,'create',input());assert.equal(saved.status,201);assert.equal(saved.body.item.name,member.name);
  const list=await call(f,'list');assert.equal(list.body.items.length,1);assert.deepEqual(list.body.items[0],saved.body.item);
  const json=JSON.stringify(list.body);for(const value of ['email','owner','imageKey','thumbKey','member@example.test'])assert.equal(json.includes(value),false);
  assert.equal(list.body.items[0].authorKey,storyAuthorKey(member.id));
});
test('guests, cross-origin requests and forged Admin fields cannot upload or delete',async()=>{
  const f=fixture();assert.equal((await call(f,'create',input(),'')).status,401);
  assert.equal((await call(f,'create',input(),'member',{Origin:'https://other.test'})).status,403);
  const saved=await call(f,'create',input()),id=saved.body.item.id;
  assert.equal((await call(f,'delete',{id,admin:true,owner:other.id},'other')).status,403);
  assert.equal((await call(f,'list')).body.items.length,1);
});
test('image endpoint serves re-encoded JPEG pixels with stripped metadata and safe headers',async()=>{
  const f=fixture(),saved=await call(f,'create',input()),id=saved.body.item.id;
  for(const size of ['full','thumb']){
    const res=await f.handler(new Request(origin+'/?route=image&id='+id+'&size='+size));assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/jpeg');assert.equal(res.headers.get('x-content-type-options'),'nosniff');
    const meta=await sharp(Buffer.from(await res.arrayBuffer())).metadata();assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.equal(meta.format,'jpeg');if(size==='thumb')assert.equal(meta.width,300);
  }
});
test('invalid payloads, SVG and oversized images cannot enter the public rail',async()=>{
  const f=fixture();
  for(const data of [input({requestId:'../bad'}),input({caption:'x'.repeat(181)}),input({caption:'line\nbreak'}),input({image:'abc'}),input({image:Buffer.from('<svg/>').toString('base64')}),input({image:Buffer.alloc(2*1024*1024+1).toString('base64')})])assert.ok((await call(f,'create',data)).status>=400);
  assert.equal((await call(f,'list')).body.items.length,0);assert.equal(f.store.entries.size,0);
});
test('owner deletion removes full image and thumbnail and cannot replay the original upload',async()=>{
  const f=fixture(),data=input(),saved=await call(f,'create',data),id=saved.body.item.id;
  assert.equal((await call(f,'delete',{id})).status,200);assert.equal((await call(f,'list')).body.items.length,0);
  assert.equal([...f.store.entries.keys()].filter(x=>x.startsWith('image-')).length,0);
  assert.equal((await f.handler(new Request(origin+'/?route=image&id='+id))).status,404);
  assert.equal((await call(f,'create',data)).status,409);assert.equal((await call(f,'delete',{id})).status,200);
});
test('Admin can moderate another member photo without requiring VIP for posting',async()=>{
  const f=fixture(),saved=await call(f,'create',input());assert.equal((await call(f,'delete',{id:saved.body.item.id},'admin')).status,200);assert.equal((await call(f,'list')).body.items.length,0);
});
test('lost upload responses and concurrent identical requests publish one Story',async()=>{
  const f=fixture(),data=input(),results=await Promise.all([call(f,'create',data),call(f,'create',data)]);
  assert.ok(results.every(x=>x.status<300));assert.equal(results[0].body.item.id,results[1].body.item.id);
  assert.equal((await call(f,'list')).body.items.length,1);assert.equal([...f.store.entries.keys()].filter(x=>x.startsWith('image-')).length,2);
  const again=await call(f,'create',data);assert.equal(again.status,200);assert.equal(again.body.item.id,results[0].body.item.id);
});
test('simultaneous different member uploads preserve both stories',async()=>{
  const f=fixture(),results=await Promise.all([call(f,'create',input()),call(f,'create',input(),'other')]);assert.ok(results.every(x=>x.status===201));assert.equal((await call(f,'list')).body.items.length,2);
});
test('daily quota survives owner deletion and opens again after 24 hours',async()=>{
  const f=fixture();for(let i=0;i<5;i++){const saved=await call(f,'create',input());assert.equal(saved.status,201);await call(f,'delete',{id:saved.body.item.id});}
  assert.equal((await call(f,'create',input())).status,429);f.advance(86400001);assert.equal((await call(f,'create',input())).status,201);
});
test('stories expire exactly after 24 hours and cleanup removes their images and old orphan bytes',async()=>{
  const f=fixture(),saved=await call(f,'create',input());f.advance(86400000-1);assert.equal((await call(f,'list')).body.items.length,1);f.advance(1);assert.equal((await call(f,'list')).body.items.length,0);assert.equal((await f.handler(new Request(origin+'/?route=image&id='+saved.body.item.id))).status,404);assert.equal((await call(f,'create',input({requestId:'not-a-uuid'}))).status,400);
  await f.store.set('image-old-orphan',new Uint8Array([1]),{metadata:{createdAt:'2026-10-20T00:00:00Z'}});await f.store.set('image-new-inflight',new Uint8Array([2]),{metadata:{createdAt:'2026-10-28T04:59:00Z'}});
  await cleanupStories(f.store,Date.parse('2026-10-28T05:00:00Z'));assert.equal(f.store.entries.has('image-old-orphan'),false);assert.equal(f.store.entries.has('image-new-inflight'),true);
  assert.equal((await call(f,'list')).body.items.length,0);assert.equal(f.store.entries.get('index').data.items.length,0);assert.equal([...f.store.entries.keys()].filter(x=>x.includes(saved.body.item.id)&&x.startsWith('image-')).length,0);
});
test('interrupted deletion hides the photo immediately and scheduled cleanup completes it',async()=>{
  const f=fixture(),saved=await call(f,'create',input()),id=saved.body.item.id;f.store.failDelete=true;
  assert.equal((await call(f,'delete',{id})).status,503);assert.equal((await call(f,'list')).body.items.length,0);assert.equal((await f.handler(new Request(origin+'/?route=image&id='+id))).status,404);
  await cleanupStories(f.store);assert.equal(f.store.entries.get('index').data.items.length,0);assert.equal([...f.store.entries.keys()].some(x=>x.startsWith('image-')),false);
});
test('public author fallback never uses an email address as its name',async()=>{
  const f=fixture(),handler=createStoriesHandler({production:()=>true,store:()=>f.store,verify:async()=>({...member,name:member.email})});f.handler=handler;const saved=await call(f,'create',input());assert.equal(saved.body.item.name,'Thành viên NCN');
});
test('preview deployment is read-only and method or malformed identifiers do not mutate data',async()=>{
  const f=fixture(),handler=createStoriesHandler({production:()=>false});assert.deepEqual(await (await handler(new Request(origin))).json(),{items:[]});assert.equal((await handler(new Request(origin,{method:'POST',headers:{Origin:origin}}))).status,503);
  assert.equal((await f.handler(new Request(origin,{method:'PUT'}))).status,405);assert.equal((await call(f,'delete',{id:'../../index'})).status,400);
});
