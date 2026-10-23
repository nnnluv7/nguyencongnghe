import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/lib/ncn-event-api.mjs';

const origin='https://nguyencongnghe.com';
const admin={id:'admin',admin:true,vip:true},vip={id:'vip',admin:false,vip:true};
const product={code:'SP001',name:'Sản phẩm thử',originalPrice:200000,eventPrice:150000};
const clone=value=>value==null?value:structuredClone(value);
function memoryStore(){
  const entries=new Map();let counter=0;
  return {
    entries,beforeWrite:null,
    async get(key){return clone(entries.get(key)?.data??null);},
    async getWithMetadata(key){return clone(entries.get(key)??null);},
    async list({prefix}){return {blobs:[...entries.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))};},
    async setJSON(key,data,options={}){
      if(this.beforeWrite){const callback=this.beforeWrite;this.beforeWrite=null;await callback();}
      const old=entries.get(key);
      if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
      const etag='"'+(++counter)+'"';entries.set(key,{data:clone(data),etag});return {modified:true,etag};
    }
  };
}
function endpoint(tool,store,user=admin,production=true){
  return createHandler({production:()=>production,verify:async()=>user,store:()=>store,print:()=>({html:'print',labels:1,pages:1})});
}
function request(tool,route,data,options={}){
  const method=options.method||(data===undefined?'GET':'POST');
  const headers={origin:options.origin??origin,'content-type':'application/json'};
  return new Request(origin+'/.netlify/functions/ncn-'+tool+'?route='+route,{method,headers,...(method==='POST'?{body:JSON.stringify(data)}:{})});
}
async function call(handler,tool,route,data,options){const response=await handler(request(tool,route,data,options));return {status:response.status,body:await response.json()};}
async function publish(handler,tool,id='test',version=null){
  const result=await call(handler,tool,'publish',{id,name:'Bảng '+id,items:[product],version});assert.equal(result.status,200);return result.body;
}

for(const tool of ['event','gvgs']){
  test(tool+': ADMIN can publish, delete and recreate a catalogue',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store);
    const saved=await publish(handler,tool),other=await publish(handler,tool,'other');
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:saved.version})).status,200);
    assert.deepEqual((await call(handler,tool,'catalogues')).body.catalogues.map(p=>p.id),[other.id]);
    assert.equal((await call(handler,tool,'catalogue&id=test')).status,404);
    const marker=await store.get('campaign-test');
    assert.equal(marker.deleted,true);assert.equal('items' in marker,false);assert.equal('name' in marker,false);
    const stale=await call(handler,tool,'publish',{id:saved.id,name:'Stale',items:[product],version:saved.version});
    assert.equal(stale.status,409);
    const recreated=await publish(handler,tool);
    assert.notEqual(recreated.version,saved.version);
    assert.equal((await call(handler,tool,'catalogue&id=test')).status,200);
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:saved.version})).status,409);
  });
  test(tool+': guest, expired member and VIP cannot delete or forge ADMIN',async()=>{
    const store=memoryStore(),saved=await publish(endpoint(tool,store),tool);
    for(const [user,status] of [[null,401],[{id:'expired'},403],[vip,403]]){
      const result=await call(endpoint(tool,store,user),tool,'delete',{id:saved.id,version:saved.version,user:admin,admin:true});
      assert.equal(result.status,status);assert.equal((await store.get('campaign-test')).version,saved.version);
    }
  });
  test(tool+': cross-origin requests and invalid delete inputs leave data intact',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store),saved=await publish(handler,tool);
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:saved.version},{origin:'https://other.example'})).status,403);
    assert.equal((await call(handler,tool,'delete')).status,404);
    for(const data of [{id:'../test',version:saved.version},{id:saved.id},null,[]]){
      assert.equal((await call(handler,tool,'delete',data)).status,400);
    }
    assert.equal((await store.get('campaign-test')).version,saved.version);
  });
  test(tool+': stale versions and concurrent saves prevent deletion',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store),saved=await publish(handler,tool);
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:'stale'})).status,409);
    store.beforeWrite=async()=>{await store.setJSON('campaign-test',{...await store.get('campaign-test'),version:'newer-save'});};
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:saved.version})).status,409);
    assert.equal((await store.get('campaign-test')).version,'newer-save');
    assert.deepEqual((await store.get('campaign-test')).items,[product]);
  });
  test(tool+': deleted catalogues cannot be printed by VIP or ADMIN from stale history',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store),saved=await publish(handler,tool);
    await call(handler,tool,'delete',{id:saved.id,version:saved.version});
    for(const user of [admin,vip]){
      const result=await call(endpoint(tool,store,user),tool,'print',{items:[{...product,qty:1}],settings:{catalogueId:saved.id}});
      assert.equal(result.status,404);
    }
    assert.equal((await call(handler,tool,'delete',{id:saved.id,version:saved.version})).status,404);
  });
  test(tool+': deleting a catalogue frees one of the twenty programme slots',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store);
    const saved=await publish(handler,tool);
    for(let i=1;i<20;i++)await publish(handler,tool,'campaign-'+i);
    const extra={id:'extra',name:'Extra',items:[product]};
    assert.equal((await call(handler,tool,'publish',extra)).status,400);
    await call(handler,tool,'delete',{id:saved.id,version:saved.version});
    assert.equal((await call(handler,tool,'publish',extra)).status,200);
    assert.equal((await call(handler,tool,'catalogues')).body.catalogues.length,20);
  });
  test(tool+': non-production handlers do not change the catalogue store',async()=>{
    const store=memoryStore(),handler=endpoint(tool,store,admin,false);
    assert.equal((await call(handler,tool,'delete',{id:'test',version:'test'})).status,503);
    assert.equal(store.entries.size,0);
  });
}
test('Event and GVGS catalogue changes remain isolated',async()=>{
  const eventStore=memoryStore(),gvgsStore=memoryStore();
  const event=endpoint('event',eventStore),gvgs=endpoint('gvgs',gvgsStore);
  const eventFile=await publish(event,'event'),gvgsFile=await publish(gvgs,'gvgs');
  await call(event,'event','delete',{id:eventFile.id,version:eventFile.version});
  assert.equal((await call(gvgs,'gvgs','catalogue&id=test')).body.version,gvgsFile.version);
  assert.deepEqual((await gvgsStore.get('campaign-test')).items,[product]);
});
