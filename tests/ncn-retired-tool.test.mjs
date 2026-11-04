import test from 'node:test';
import assert from 'node:assert/strict';
import {mergedLibrary,publicCatalog,readLibrary} from '../netlify/lib/ncn-library-api.mjs';

test('old saved metadata cannot restore a deleted tool to the Library',()=>{
  const deleted={id:'legacy-70d5bee4a542c9c6',kind:'legacy',status:'published',title:'Old tool',href:'/old-tool/'};
  const kept={id:'post-keep',kind:'link',status:'published',title:'Keep',href:'/keep/',labels:[]};
  const saved={items:[deleted,kept]};
  assert.deepEqual(mergedLibrary([],saved),[kept]);
  assert.deepEqual(publicCatalog([],saved).map(item=>item.link),['/keep/']);
  assert.deepEqual(mergedLibrary([deleted],saved),[kept]);
});

test('saved retired metadata is removed without overwriting a concurrent edit',async()=>{
  const deleted={id:'legacy-70d5bee4a542c9c6',title:'Old tool'};
  const kept={id:'post-keep',title:'Keep'};
  let saved={etag:'v1',data:{items:[deleted,kept]}},writes=0;
  const store={
    getWithMetadata:async()=>structuredClone(saved),
    setJSON:async(key,data,options)=>{
      assert.equal(key,'index');assert.equal(options.onlyIfMatch,saved.etag);writes++;
      if(writes===1){saved={etag:'v2',data:{items:[deleted,{...kept,title:'New edit'}]}};return {modified:false};}
      saved={etag:'v3',data:structuredClone(data)};return {modified:true};
    }
  };
  const result=await readLibrary(store);
  assert.deepEqual(result,{etag:'v3',data:{items:[{...kept,title:'New edit'}]}});
  assert.equal(writes,2);
  await readLibrary(store);assert.equal(writes,2);
});
