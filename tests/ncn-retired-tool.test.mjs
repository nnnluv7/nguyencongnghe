import test from 'node:test';
import assert from 'node:assert/strict';
import {mergedLibrary,publicCatalog} from '../netlify/lib/ncn-library-api.mjs';

test('old saved metadata cannot restore a deleted tool to the Library',()=>{
  const deleted={id:'legacy-70d5bee4a542c9c6',kind:'legacy',status:'published',title:'Old tool',href:'/old-tool/'};
  const kept={id:'post-keep',kind:'link',status:'published',title:'Keep',href:'/keep/',labels:[]};
  const saved={items:[deleted,kept]};
  assert.deepEqual(mergedLibrary([],saved),[kept]);
  assert.deepEqual(publicCatalog([],saved).map(item=>item.link),['/keep/']);
  assert.deepEqual(mergedLibrary([deleted],saved),[kept]);
});
