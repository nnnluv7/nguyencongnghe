import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {optimizePublicHTML} from '../netlify/lib/ncn-public-assets.mjs';
import {createSitePageHandler} from '../netlify/lib/ncn-site-page.mjs';
import {injectCatalog} from '../netlify/lib/ncn-library-page.mjs';

const shell='<html><head><meta charset="utf-8"><title>Tiếng Việt</title></head><body><script src="/assets/catalog.js"></script><main id="ncn-cash-app">Original controls</main><footer id="ncn-footer"></footer></body></html>';
const manifest={styles:{},modules:{},classic:{},imports:{'/unrelated-game.js':'/large-game.js'},runtimeImports:{'/account.js?v=1':'/account-hash.js'},dependencies:{}};
test('UTF-8 remains early, unused module aliases stay out, and the supplied AdSense loader stays singular',()=>{
  const html=optimizePublicHTML(shell,manifest),charset=html.indexOf('<meta charset="utf-8">');
  assert.ok(charset>=0&&charset<1024);assert.ok(html.includes('Tiếng Việt'));
  assert.deepEqual(JSON.parse(html.match(/type="importmap">(.*?)<\/script>/)[1]).imports,manifest.runtimeImports);
  assert.equal((html.match(/src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/g)||[]).length,1);
  assert.equal(optimizePublicHTML(html,manifest),html);assert.equal(html.includes('data-ad-slot='),false);
});
test('informational articles shed legacy runtime while print and utility pages keep their dependencies and video geometry',()=>{
  const original=shell.replace('ncn-cash-app','article-content').replace('<body>','<body class="ncn-library-article">')+'<script src="/assets/vendor/jquery.js"></script><script src="/assets/site-bridge.js"></script><script src="/assets/js/b638b6b6b0e4f4118c.js"></script><script src="/assets/js/04eaf19c4b9f842a27.js"></script><iframe src="https://www.youtube.com/embed/test" width="640" height="360"></iframe>';
  const html=optimizePublicHTML(original,manifest);assert.equal(html.includes('jquery.js'),false);
  for(const ref of ['site-bridge.js','b638b6b6b0e4f4118c.js','04eaf19c4b9f842a27.js','Original controls'])assert.ok(html.includes(ref));
  assert.ok(html.includes('<iframe loading="lazy" src="https://www.youtube.com/embed/test" width="640" height="360">'));
  for(const kind of ['utility','print'])assert.ok(optimizePublicHTML(original.replace('ncn-library-article','ncn-library-'+kind),manifest).includes('jquery.js'));
});
test('tool shells omit catalogue reads and snapshots until search; legacy search retains complete data and failed shells do not cache',async()=>{
  const options=[],handler=createSitePageHandler({pages:{'/tool/':'tool.html','/search/':'search/index.html'},html:async()=>shell,state:async option=>{options.push(option);return {catalog:option.catalog?[{title:'Current article'}]:[],catalogDeferred:!option.catalog};},inject:injectCatalog});
  const tool=await(await handler(new Request('https://ncn.test/tool/'))).text(),search=await(await handler(new Request('https://ncn.test/search/'))).text();
  assert.deepEqual(options,[{catalog:false},{catalog:true}]);assert.ok(tool.includes('window.NCN_LIBRARY_DEFERRED=true'));assert.ok(tool.includes('window.CG_CATALOG=[]'));
  assert.ok(search.includes('Current article'));assert.equal(search.includes('NCN_LIBRARY_DEFERRED'),false);
  const failed=createSitePageHandler({pages:{'/tool/':'tool.html'},html:async()=>shell,state:async()=>{throw Error('offline');},inject:injectCatalog});
  const response=await failed(new Request('https://ncn.test/tool/'));assert.equal(response.headers.get('Netlify-CDN-Cache-Control'),'no-store');assert.ok((await response.text()).includes('NCN_LIBRARY_DEFERRED=true'));
});
test('Escape closes legacy UI safely when the modern page has no jQuery',async()=>{
  const events={},doc={querySelectorAll:()=>[],querySelector:()=>null,body:{classList:{remove(){}}},addEventListener:(event,fn)=>{events[event]=fn;}};
  const win={};runInNewContext(await readFile('public/assets/site-bridge.js','utf8'),{window:win,document:doc,location:{href:'https://ncn.test/tool/',pathname:'/tool/',origin:'https://ncn.test'}});
  events.DOMContentLoaded();assert.doesNotThrow(()=>events.keydown({key:'Escape'}));
});
