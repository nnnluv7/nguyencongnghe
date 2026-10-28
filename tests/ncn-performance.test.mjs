import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {optimizePublicHTML,stylesheetKey} from '../netlify/lib/ncn-public-assets.mjs';
import {publicPageHeaders} from '../netlify/lib/ncn-public-cache.mjs';
import {createLibraryPageHandler} from '../netlify/lib/ncn-library-page.mjs';
import {createSitePageHandler} from '../netlify/lib/ncn-site-page.mjs';
import {createLibraryHandler} from '../netlify/lib/ncn-library-api.mjs';

const html='<html><head><link rel="stylesheet" href="/base.css?v=1"><link rel="stylesheet" href="/page.css"><script src="/legacy.js"></script><script type="module" src="/theme.js?v=old"></script></head><body id="page"><div id="editor">Original input</div></body></html>';
const manifest={styles:{[stylesheetKey(html)]:'/assets/ncn-built/styles/hash.css'},classic:{'/legacy.js':'/assets/ncn-built/legacy-hash.js'},modules:{'/theme.js':'/assets/ncn-built/theme-hash.js'},imports:{'/account.js':'/assets/ncn-built/account-hash.js','/account.js?v=old':'/assets/ncn-built/account-hash.js'},dependencies:{'/assets/ncn-built/theme-hash.js':['/assets/ncn-built/common-hash.js']}};
test('optimized HTML discovers dependency preloads up front, retains the editor and ordered classic execution',()=>{
  const result=optimizePublicHTML(html,manifest);
  assert.ok(result.includes('<div id="editor">Original input</div>'));
  assert.match(result,/<script defer src="\/assets\/ncn-built\/legacy-hash.js"/);
  assert.equal((result.match(/rel="stylesheet"/g)||[]).length,1);
  assert.equal((result.match(/href="\/assets\/ncn-built\/common-hash.js"/g)||[]).length,1);
  assert.ok(result.indexOf('type="importmap"')<result.indexOf('rel="modulepreload"'));
  const map=JSON.parse(result.match(/type="importmap">(.*?)<\/script>/)[1]);assert.equal(map.imports['/account.js'],map.imports['/account.js?v=old']);
  assert.equal(optimizePublicHTML(result,manifest),result);
});
test('unused legacy portal scripts are removed while editors retain their screenshot libraries and SRI',()=>{
  const script='<script integrity="sha512-actual" src="/assets/vendor/screenshot.js"></script>';
  const page=html.replace('<body id="page">','<body><main id="ncn-home">')+script;
  assert.equal(optimizePublicHTML(page,manifest).includes('screenshot.js'),false);
  const kept=optimizePublicHTML(html+script,manifest);assert.ok(kept.includes(script));
});
test('only the actual spreadsheet importers download the large Excel reader',()=>{
  const script='<script src="/assets/vendor/125962e77eb283b9aa.js"></script>';
  assert.equal(optimizePublicHTML(html+script,manifest).includes('125962'),false);
  for(const marker of ['<main id="ncn-sticker-app">','<main id="ncn-popup-app">','<main id="ncn-store-app">','<div id="vip-app">','<script src="/assets/inventory.js"></script>','<script src="/assets/print-import.js"></script>'])assert.ok(optimizePublicHTML(html+marker+script,manifest).includes('125962'));
});
test('only public shells use a bounded CDN cache; failed, unlisted and managed article responses never do',async()=>{
  const page=createSitePageHandler({pages:{'/tool/':'tool.html'},html:async()=>html,state:async()=>({catalog:[]}),inject:x=>x});
  const good=await page(new Request('https://ncn.test/tool/'));assert.match(good.headers.get('Netlify-CDN-Cache-Control'),/max-age=60/);assert.equal(good.headers.has('set-cookie'),false);
  const failed=createSitePageHandler({pages:{'/tool/':'tool.html'},html:async()=>html,state:async()=>{throw Error('offline');},inject:x=>x});
  for(const response of [await page(new Request('https://ncn.test/no/')),await failed(new Request('https://ncn.test/tool/'))])assert.equal(response.headers.get('Netlify-CDN-Cache-Control'),'no-store');
  const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),article=seed.find(x=>x.managedPage);
  const library=createLibraryPageHandler({seed,production:()=>false,store:()=>null,homeShell:async()=>html,indexShell:async()=>html,articleShell:async()=>html,original:async()=>html});
  assert.match((await library(new Request('https://ncn.test/'))).headers.get('Netlify-CDN-Cache-Control'),/max-age=15/);
  assert.equal((await library(new Request('https://ncn.test'+article.href))).headers.get('Netlify-CDN-Cache-Control'),'no-store');
});
test('CDN lifetime is shorter than the nearest Story expiry and never changes browser HTML freshness',()=>{
  const now=Date.parse('2026-10-28T00:00:00Z'),headers=publicPageHeaders({seconds:15,now,stories:[{expiresAt:new Date(now+4700).toISOString()}]});
  assert.match(headers['Netlify-CDN-Cache-Control'],/max-age=3,/);assert.equal(headers['Cache-Control'],'public, max-age=0, must-revalidate');
});
test('catalogue metadata and cached news start together without serial network round trips',async()=>{
  let release,indexStarted=false,newsStarted=false;const gate=new Promise(resolve=>release=resolve);
  const handler=createLibraryHandler({production:()=>true,seed:[],store:()=>({getWithMetadata:async()=>{indexStarted=true;await gate;return null;}}),news:async()=>{newsStarted=true;await gate;return [];}});
  const pending=handler(new Request('https://ncn.test/.netlify/functions/ncn-library?route=list'));await Promise.resolve();
  assert.equal(indexStarted,true);assert.equal(newsStarted,true);release();assert.deepEqual(await (await pending).json(),{items:[]});
});
