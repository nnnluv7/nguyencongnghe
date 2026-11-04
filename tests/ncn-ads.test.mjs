import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizePublicHTML} from '../netlify/lib/ncn-public-assets.mjs';
import {mountInlineAd} from '../public/assets/ncn-ads.js';

const page=id=>'<html><head><title>NCN</title></head><body><main id="'+id+'">Original content</main><footer id="ncn-footer">Footer</footer></body></html>';
test('reading pages get one manual banner below content and repeated rendering never duplicates it',()=>{
  for(const id of ['ncn-home','ncn-library','ncn-library-detail']){
    const html=optimizePublicHTML(page(id));
    assert.equal((html.match(/data-ad-slot="8631703362"/g)||[]).length,1);
    assert.ok(html.indexOf('id="ncn-inline-ad"')>html.indexOf('</main>'));
    assert.ok(html.indexOf('id="ncn-inline-ad"')<html.indexOf('<footer'));
    assert.equal(optimizePublicHTML(html),html);
    assert.equal(html.includes('data-full-width-responsive'),false);
  }
});
test('working tools, private editors, games and account pages have no banner or ad request module',()=>{
  for(const id of ['ncn-cash-app','ncn-sticker-app','ncn-popup-app','vip-app','pk-app','ncn-warehouse-app','pay-account','ncn-arcade']){
    const html=optimizePublicHTML(page(id));
    assert.equal(html.includes('data-ad-slot='),false,id);
    assert.equal(html.includes('src="/assets/ncn-ads.js"'),false,id);
    assert.ok(html.includes('Original content'));
  }
  assert.equal(optimizePublicHTML(page('ncn-library-detail').replace('<body>','<body class="static_page">')).includes('data-ad-slot='),false,'privacy and contact pages');
});
function fixture({width=320,print=false}={}){
  let intersection,changed;const attributes=new Map(),queue=[];
  const slot={getClientRects:()=>width?[{}]:[],getBoundingClientRect:()=>({width}),getAttribute:name=>attributes.get(name)};
  const host={dataset:{},hidden:false,querySelector:()=>slot};
  const doc={getElementById:()=>host},win={adsbygoogle:queue,matchMedia:()=>({matches:print}),
    MutationObserver:class{constructor(callback){changed=callback;}observe(){}disconnect(){}},
    IntersectionObserver:class{constructor(callback){intersection=callback;}observe(){}disconnect(){}}};
  mountInlineAd({doc,win});
  return {host,queue,doc,win,near:()=>intersection([{isIntersecting:true}]),status:value=>{attributes.set('data-ad-status',value);changed();}};
}
test('an ad is requested only near the viewport and at most once, even after repeated mounting',()=>{
  const f=fixture();assert.equal(f.queue.length,0);f.near();f.near();mountInlineAd(f);assert.equal(f.queue.length,1);
  f.status('filled');assert.equal(f.host.hidden,false);f.status('unfilled');assert.equal(f.host.hidden,true);
});
test('small screens and printing do not request ads',()=>{
  for(const options of [{width:0},{width:288},{print:true}]){const f=fixture(options);f.near();assert.equal(f.queue.length,0);}
});
