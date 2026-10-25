import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseGenkRSS,syncGenkNews,mergeNews,GENK_RSS} from '../netlify/lib/ncn-news.mjs';
import {renderPublicHTML} from '../netlify/lib/ncn-public-render.mjs';
import {createSitePageHandler} from '../netlify/lib/ncn-site-page.mjs';
import {publicCatalog} from '../netlify/lib/ncn-library-api.mjs';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const read=path=>readFile(path,'utf8'),seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json')),news=JSON.parse(await read('netlify/lib/ncn-news/genk-seed.json')),rows=publicCatalog(seed);
const item=(slug='tin-moi',extra='')=>'<item><title><![CDATA[Tin mới &amp; công nghệ]]></title><link>https://genk.vn/'+slug+'.chn?utm_source=rss</link><description><![CDATA[<a href="https://genk.vn/'+slug+'.chn"><img src="https://genk.mediacdn.vn/a.jpg"></a><br>Mô tả ngắn về công nghệ.]]></description><pubDate>Sun, 25 Oct 2026 12:00:00 +0700</pubDate>'+extra+'</item>';
const rss=items=>'<?xml version="1.0"?><rss version="2.0"><channel>'+items+'</channel></rss>';
const now=Date.parse('2026-10-25T06:00:00Z');

test('official RSS becomes dated, deduplicated source links and short passive previews',()=>{
  const items=parseGenkRSS(rss(item()+item()+item('tin-khac')),now);assert.equal(items.length,2);assert.equal(items[0].title,'Tin mới & công nghệ');assert.equal(items[0].source,'GenK');assert.equal(items[0].datetime,'2026-10-25T05:00:00.000Z');assert.ok(items.every(x=>x.link.startsWith('https://genk.vn/')&&!x.link.includes('?')));assert.equal(items[0].thumbnail.src,'https://genk.mediacdn.vn/a.jpg');assert.equal(items[0].summary.includes('<'),false);
});
test('RSS rejects external entities, malformed feeds and unsafe article or thumbnail hosts',()=>{
  for(const xml of ['<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+rss(item()),'<rss>',rss('')])assert.throws(()=>parseGenkRSS(xml,now));
  assert.throws(()=>parseGenkRSS(rss(item().replace('https://genk.vn/tin-moi.chn','https://genk.vn.evil.test/a')),now));
  assert.equal(parseGenkRSS(rss(item().replace('https://genk.mediacdn.vn/a.jpg','https://evil.test/a.jpg')),now)[0].thumbnail,null);
});
test('sync uses only the fixed feed, retains last good data on failure and revalidates with ETag',async()=>{
  const store=memoryStories();let calls=0;
  const fetcher=async(url,options)=>{assert.equal(url,GENK_RSS);assert.equal(options.redirect,'error');calls++;return new Response(rss(item()),{headers:{'Content-Type':'text/xml',ETag:'feed-1'}});};
  assert.equal((await syncGenkNews(store,{fetcher,now})).count,1);assert.equal(calls,1);
  const before=structuredClone(store.entries.get('genk'));
  await assert.rejects(syncGenkNews(store,{now,fetcher:async()=>new Response('Forbidden',{status:403})}));assert.deepEqual(store.entries.get('genk'),before);
  await assert.rejects(syncGenkNews(store,{now,fetcher:async()=>new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}})}));assert.deepEqual(store.entries.get('genk'),before);
  const result=await syncGenkNews(store,{now,fetcher:async(_url,options)=>{assert.equal(options.headers['If-None-Match'],'feed-1');return new Response(null,{status:304});}});assert.equal(result.updated,false);assert.deepEqual(store.entries.get('genk'),before);
});
test('a concurrent feed sync cannot overwrite a newer successful snapshot',async()=>{
  const store=memoryStories();await store.setJSON('genk',{items:[]});store.beforeWrite=async()=>store.setJSON('genk',{items:news,etag:'newer'});
  const result=await syncGenkNews(store,{now,fetcher:async()=>new Response(rss(item()),{headers:{'Content-Type':'text/xml'}})});assert.equal(result.updated,false);assert.equal(store.entries.get('genk').data.etag,'newer');
});
test('homepage sends four final article cards and notice geometry before any client code executes',async()=>{
  const html=renderPublicHTML(await read('public/index.html'),mergeNews(rows,news),{notices:[{text:'Tin mới <script>alert(1)</script>'}],now});
  const section=html.slice(html.indexOf('id="ncn-home-latest"'),html.indexOf('id="ncn-favorites-section"'));assert.equal((section.match(/class="ncn-article-card"/g)||[]).length,4);assert.ok(section.includes('data-ncn-source="genk"'));assert.ok(html.includes('class="ncn-has-announcements '));assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.equal(html.includes('>Tin mới <script>'),false);
});
test('library source, search, category and page query have matching initial server results',async()=>{
  const html=renderPublicHTML(await read('public/thu-vien/index.html'),mergeNews(rows,news),{query:new URLSearchParams('source=genk&page=2'),now});
  const content=html.match(/<!-- NCN:results:start -->([\s\S]*?)<!-- NCN:results:end -->/)[1];assert.equal((content.match(/class="ncn-article-card"/g)||[]).length,12);assert.equal((content.match(/data-ncn-source="genk"/g)||[]).length,12);assert.ok(html.includes('40 nội dung'));assert.ok(html.includes('Trang 2 / 4'));
  assert.equal(html.includes('id="ncn-library-prev" disabled'),false);
  const empty=renderPublicHTML(await read('public/thu-vien/index.html'),mergeNews(rows,news),{query:new URLSearchParams('q=%3Cscript%3E&source=ncn'),now});assert.ok(empty.includes('0 nội dung phù hợp'));assert.ok(empty.includes('value="&lt;script&gt;"'));
});
test('public shells cannot bypass managed article deletion, read arbitrary files or accept writes',async()=>{
  const pages=JSON.parse(await read('netlify/lib/ncn-shell/pages.json')),handler=createSitePageHandler({pages,html:path=>read('public/'+path),state:async()=>({catalog:rows}),inject:(html)=>html});
  const allowed=await handler(new Request('https://ncn.test/2024/02/kiem-quy.html'));assert.equal(allowed.status,200);assert.ok((await allowed.text()).includes('id="ncn-cash-app"'));
  assert.equal((await handler(new Request('https://ncn.test/.netlify/functions/ncn-site-page?page=../../package.json'))).status,404);
  const unicode=Object.keys(pages).find(path=>path.includes('Căn giữa tiêu đề')&&!path.endsWith('index.html'));
  assert.ok(unicode);assert.equal((await handler(new Request('https://ncn.test'+encodeURI(unicode)))).status,200);
  for(const row of seed.filter(x=>x.managedPage))assert.equal((await handler(new Request('https://ncn.test/.netlify/functions/ncn-site-page?page='+row.sourcePath))).status,404);
  assert.equal((await handler(new Request('https://ncn.test/2024/02/kiem-quy.html',{method:'POST'}))).status,405);
});
test('feed merging preserves local CMS entries and avoids duplicates already present in NCN',()=>{
  const existing={...news[0],source:undefined,title:'Bài NCN đã chọn'};const merged=mergeNews([existing],news);assert.equal(merged.filter(x=>x.link===existing.link).length,1);assert.equal(merged[0].title,existing.title);
});
test('a public catalogue outage does not prevent a static print or cash tool from opening',async()=>{
  const pages=JSON.parse(await read('netlify/lib/ncn-shell/pages.json'));
  const handler=createSitePageHandler({pages,html:path=>read('public/'+path),state:async()=>{throw Error('Public store unavailable');},inject:(html,catalog)=>{assert.deepEqual(catalog,[]);return html;}});
  const response=await handler(new Request('https://ncn.test/2024/02/kiem-quy.html'));assert.equal(response.status,200);assert.ok((await response.text()).includes('id="ncn-cash-app"'));
});
