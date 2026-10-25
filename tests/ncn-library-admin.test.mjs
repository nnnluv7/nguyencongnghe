import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLibraryHandler,publicCatalog,mergedLibrary} from '../netlify/lib/ncn-library-api.mjs';
import {createLibraryPageHandler,injectCatalog} from '../netlify/lib/ncn-library-page.mjs';
import {renderMarkdown} from '../public/assets/ncn-library/content.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const seed=JSON.parse(read('netlify/lib/ncn-library/seed.json'));
const originalBodies=JSON.parse(read('netlify/lib/ncn-library/original-markdown.json'));
const origin='https://nguyencongnghe.com',admin={id:'admin',admin:true},vip={id:'vip',vip:true,admin:false};
const id='post-12345678-1234-4234-8234-123456789abc';
export function memoryLibrary(){
  const entries=new Map();let serial=0;
  return {entries,beforeWrite:null,beforeDelete:null,async get(key){return structuredClone(entries.get(key)?.data??null);},async getWithMetadata(key){return structuredClone(entries.get(key)??null);},async *list({prefix}){const keys=[...entries.keys()].filter(k=>k.startsWith(prefix));for(let i=0;i<keys.length;i+=2)yield {blobs:keys.slice(i,i+2).map(key=>({key}))};},async delete(key){if(this.beforeDelete)await this.beforeDelete(key);entries.delete(key);},async setJSON(key,data,options={}){
    if(this.beforeWrite){const hook=this.beforeWrite;this.beforeWrite=null;await hook(key);}
    const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
    entries.set(key,{data:structuredClone(data),etag:'"'+(++serial)+'"'});return {modified:true};
  }};
}
const input=(overrides={})=>({id,version:null,kind:'article',mode:'markdown',title:'Bài viết mới',summary:'Mô tả ngắn',image:'',labels:['Hướng dẫn'],status:'published',body:'## Nội dung\nBài viết **tiếng Việt**.',...overrides});

test('Admin can feature a published item, preserve the flag with older editors, and hide it with the article',async()=>{
  const f=fixture(),saved=await call(f,'save',input({featured:true}));assert.equal(saved.status,200);assert.equal(saved.body.item.featured,true);
  assert.equal((await call(f,'list')).body.items.find(x=>x.title==='Bài viết mới').featured,true);
  const edited=await call(f,'save',input({version:saved.body.item.version}));assert.equal(edited.body.item.featured,true);
  assert.equal((await call(f,'save',input({version:edited.body.item.version,featured:'yes'}))).status,400);
  await call(f,'visibility',{id,version:edited.body.item.version});assert.equal((await call(f,'list')).body.items.some(x=>x.title==='Bài viết mới'),false);
});
function fixture({user=admin,production=true,now}={}){
  const store=memoryLibrary();
  const deps={seed,originalBodies,now,store:()=>store,production:()=>production,verify:async()=>user,app:async view=>read('netlify/lib/ncn-library/admin-'+(view==='library'?'library':'hub')+'.html')};
  return {store,handler:createLibraryHandler(deps),page:createLibraryPageHandler({...deps,homeShell:async()=>read('public/index.html'),indexShell:async()=>read('public/thu-vien/index.html'),articleShell:async()=>read('netlify/lib/ncn-library/article-shell.html'),original:async path=>read('public/'+path)})};
}
function request(route,data,headers={}){return new Request(origin+'/.netlify/functions/ncn-library?route='+route,{method:data===undefined?'GET':'POST',...(data===undefined?{}:{body:JSON.stringify(data)}),headers:{origin,'content-type':'application/json',...headers}});}
async function call(f,route,data,headers){const response=await f.handler(request(route,data,headers));return {status:response.status,body:await response.json()};}
async function page(f,query){const response=await f.page(new Request(origin+'/.netlify/functions/ncn-library-page?'+query));return {status:response.status,html:await response.text()};}

test('library seed preserves unique entries and only 40 article/resource pages get managed routes',()=>{
  assert.ok(seed.length>=77);assert.equal(new Set(seed.map(x=>x.id)).size,seed.length);assert.equal(seed.filter(x=>x.managedPage).length,40);
  const redirects=read('public/_redirects');
  for(const item of seed){
    const rule=item.href+'  /.netlify/functions/ncn-library-page?legacy='+item.id+'  200!';
    assert.equal(redirects.includes(rule),item.managedPage,item.href);
    if(item.managedPage){
      assert.ok(originalBodies[item.id]);assert.ok(read('public/'+item.sourcePath).includes('ncn-library-detail'));
      for(const path of [item.href.replace(/\.html$/,''),item.href.replace(/\.html$/,'/')])assert.ok(redirects.includes(path+'  /.netlify/functions/ncn-library-page?legacy='+item.id+'  200!'),path);
    }
  }
});
test('public catalogue never exposes drafts, trash, hidden items, body keys or creator metadata',async()=>{
  const f=fixture();const saved=await call(f,'save',input());assert.equal(saved.status,200);
  let list=await call(f,'list');assert.equal(list.body.items.length,seed.length+1);assert.equal(JSON.stringify(list.body).includes('body-post-'),false);assert.equal(JSON.stringify(list.body).includes('createdBy'),false);
  const hidden=await call(f,'visibility',{id,version:saved.body.item.version});assert.equal(hidden.status,200);list=await call(f,'list');assert.equal(list.body.items.length,seed.length);
  assert.equal((await page(f,'slug='+hidden.body.item.slug)).status,200);
});
test('guest and VIP cannot read private screens or forge ADMIN in a write',async()=>{
  for(const user of [null,vip,{id:'member',user_metadata:{roles:['admin']}}]){
    const f=fixture({user});
    for(const route of ['app','app&view=library','manage','detail&id='+seed[0].id])assert.equal((await call(f,route)).status,user?403:401,route);
    for(const route of ['save','visibility','trash','restore','purge'])assert.equal((await call(f,route,{...input(),admin:true,user:admin})).status,user?403:401,route);
    assert.equal(f.store.entries.size,0);assert.equal((await call(f,'list')).status,200);
  }
});
test('production, method and origin checks happen before writes',async()=>{
  const f=fixture({production:false});assert.equal((await call(f,'save',input())).status,503);assert.equal(f.store.entries.size,0);
  assert.equal((await call(f,'list')).body.items.length,seed.length);
  const active=fixture();assert.equal((await call(active,'save',input(),{origin:'https://other.example'})).status,403);assert.equal(active.store.entries.size,0);
  const response=await active.handler(new Request(origin+'/.netlify/functions/ncn-library?route=save',{method:'DELETE'}));assert.equal(response.status,405);
});
test('ADMIN can load the hub and library management screens',async()=>{
  const f=fixture();const hub=await call(f,'app'),library=await call(f,'app&view=library');
  assert.match(hub.body.html,/Quản trị Admin/);assert.match(hub.body.html,/\/admin\/thu-vien\//);assert.match(library.body.html,/id="nl-form"/);
  assert.equal((await call(f,'manage')).body.items.length,seed.length);
});
test('new articles publish, retain stable links after edits and reject stale saves',async()=>{
  const f=fixture(),saved=await call(f,'save',input());assert.equal(saved.status,200);
  const link=saved.body.item.href,version=saved.body.item.version;
  const edited=await call(f,'save',input({version,title:'Tên bài đã sửa',body:'Nội dung đã sửa.'}));assert.equal(edited.status,200);assert.equal(edited.body.item.href,link);
  assert.equal((await call(f,'save',input({version,title:'Bản cũ'}))).status,409);
  const html=await page(f,'slug='+edited.body.item.slug);assert.equal(html.status,200);assert.match(html.html,/Nội dung đã sửa\./);assert.equal(html.html.includes('Bản cũ'),false);
});
test('drafts stay private until explicitly published',async()=>{
  const f=fixture(),draft=await call(f,'save',input({status:'draft',body:'NỘI DUNG NHÁP RIÊNG'}));assert.equal(draft.status,200);
  assert.equal(JSON.stringify((await call(f,'list')).body).includes('NỘI DUNG NHÁP RIÊNG'),false);
  const hidden=await page(f,'slug='+draft.body.item.slug);assert.equal(hidden.status,404);assert.equal(hidden.html.includes('NỘI DUNG NHÁP RIÊNG'),false);
  const detail=await call(f,'detail&id='+id);assert.equal(detail.body.body,'NỘI DUNG NHÁP RIÊNG');
  assert.equal((await call(f,'save',input({version:draft.body.item.version,status:'published'}))).status,200);
});
test('the homepage feed identifies articles and dates old drafts from their first publication',async()=>{
  let clock='2026-10-01T00:00:00Z';const f=fixture({now:()=>new Date(clock)});
  const baseline=(await call(f,'list')).body.items;
  assert.equal(baseline.find(x=>x.link==='/2024/08/background-popup-a7.html').isArticle,false);
  assert.equal(baseline.find(x=>x.link==='/2021/10/wps-office.html').isArticle,true);
  let saved=await call(f,'save',input({status:'draft'}));assert.equal(saved.status,200);
  clock='2026-10-25T00:00:00Z';saved=await call(f,'save',input({version:saved.body.item.version}));assert.equal(saved.body.item.datetime,'2026-10-25T00:00:00.000Z');
  clock='2026-10-26T00:00:00Z';saved=await call(f,'save',input({version:saved.body.item.version,status:'draft'}));
  saved=await call(f,'save',input({version:saved.body.item.version}));assert.equal(saved.body.item.datetime,'2026-10-25T00:00:00.000Z');
});
test('trash and restore of owned articles removes the actual public page and recovers its body',async()=>{
  const f=fixture(),saved=await call(f,'save',input()),removed=await call(f,'trash',{id,version:saved.body.item.version});assert.equal(removed.status,200);
  const gone=await page(f,'slug='+saved.body.item.slug);assert.equal(gone.status,410);assert.equal(gone.html.includes('Bài viết <strong>tiếng Việt</strong>'),false);
  assert.equal((await call(f,'save',input({version:removed.body.item.version}))).status,409);
  assert.equal((await call(f,'restore',{id,version:saved.body.item.version})).status,409);
  const restored=await call(f,'restore',{id,version:removed.body.item.version});assert.equal(restored.status,200);assert.equal(restored.body.item.status,'published');
  assert.match((await page(f,'slug='+restored.body.item.slug)).html,/Bài viết <strong>tiếng Việt<\/strong>/);
});
test('legacy list removal and removal of the original article are separate, reversible actions',async()=>{
  const f=fixture(),item=seed.find(x=>x.managedPage),query='legacy='+item.id,before=await page(f,query);
  const listOnly=await call(f,'trash',{id:item.id,version:null,removePage:false});assert.equal(listOnly.status,200);assert.equal((await page(f,query)).status,200);
  const restored=await call(f,'restore',{id:item.id,version:listOnly.body.item.version});
  const blocked=await call(f,'trash',{id:item.id,version:restored.body.item.version,removePage:true});assert.equal(blocked.status,200);assert.equal((await page(f,query)).status,410);
  await call(f,'restore',{id:item.id,version:blocked.body.item.version});assert.equal((await page(f,query)).html,before.html);
});
test('legacy content can be replaced and returned to the preserved original',async()=>{
  const f=fixture(),item=seed.find(x=>x.managedPage),base={...item,version:null,mode:'markdown',status:'published',body:'NỘI DUNG THAY THẾ'};
  const replacement=await call(f,'save',base);assert.equal(replacement.status,200);assert.match((await page(f,'legacy='+item.id)).html,/NỘI DUNG THAY THẾ/);
  const original=await call(f,'save',{...base,version:replacement.body.item.version,mode:'original'});assert.equal(original.status,200);
  assert.equal((await page(f,'legacy='+item.id)).html.includes('NỘI DUNG THAY THẾ'),false);
});
test('tool and print pages permit listing changes but cannot be overwritten or disabled',async()=>{
  const f=fixture(),item=seed.find(x=>x.href==='/2024/01/in-fifo.html');assert.ok(item);assert.equal(item.managedPage,false);
  assert.equal((await call(f,'trash',{id:item.id,version:null,removePage:true})).status,400);
  assert.equal((await call(f,'save',{...item,version:null,status:'published',mode:'markdown',body:'Thay thế công cụ'})).status,400);
  const removed=await call(f,'trash',{id:item.id,version:null,removePage:false});assert.equal(removed.status,200);
  assert.equal((await page(f,'legacy='+item.id)).status,404);
  assert.equal(read('public/_redirects').includes(item.href+'  /.netlify/functions/ncn-library-page'),false);
});
test('link entries are editable and cannot silently duplicate an existing page',async()=>{
  const f=fixture(),saved=await call(f,'save',input({kind:'link',href:'https://example.com/huong-dan'}));assert.equal(saved.status,200);assert.equal(saved.body.item.mode,'link');
  assert.equal((await call(f,'save',input({id:'post-87654321-1234-4234-8234-123456789abc',kind:'link',href:seed[0].href}))).status,409);
  assert.equal((await call(f,'trash',{id,version:saved.body.item.version,removePage:true})).status,400);
});
test('index conflicts never publish a partially saved or stale article body',async()=>{
  const f=fixture(),saved=await call(f,'save',input());
  f.store.beforeWrite=async key=>{if(key==='index')await f.store.setJSON('index',{items:[]});else f.store.beforeWrite=async next=>{if(next==='index')await f.store.setJSON('index',{items:[]});};};
  const conflict=await call(f,'save',input({version:saved.body.item.version,body:'STALE NEW CONTENT'}));assert.equal(conflict.status,409);
  assert.equal(JSON.stringify((await call(f,'list')).body).includes('STALE NEW CONTENT'),false);assert.equal((await page(f,'slug='+saved.body.item.slug)).status,404);
});
test('unsafe values and invalid content never mutate the published index',async()=>{
  for(const change of [{href:'javascript:alert(1)',kind:'link'},{image:'data:text/html,x'},{image:'//other.example/p.png'},{title:''},{labels:['x'.repeat(61)]},{body:'x'.repeat(50001)},{status:'trash'},{id:'../index'}]){
    const f=fixture(),result=await call(f,'save',input(change));assert.equal(result.status,400,JSON.stringify(change).slice(0,70));assert.equal(f.store.entries.has('index'),false);
  }
});
test('article metadata and rendered content cannot execute HTML or script URLs',async()=>{
  const f=fixture(),saved=await call(f,'save',input({title:'</script><script>ATTACK()</script>',body:'<script>ATTACK()</script>\n\n[ouvrir](javascript:ATTACK)\n\n![photo](data:text/html,ATTACK)\n\n**Texte sûr**'}));assert.equal(saved.status,200);
  const html=(await page(f,'slug='+saved.body.item.slug)).html;
  assert.equal(html.includes('<script>ATTACK()'),false);assert.equal(html.includes('href="javascript:'),false);assert.equal(html.includes('src="data:text/html'),false);assert.match(html,/<strong>Texte sûr<\/strong>/);
  assert.ok(injectCatalog('<script src="/assets/catalog.js"></script>',[{title:'</script><script>ATTACK()'}]).includes('\\u003c/script>'));
});
test('Markdown keeps links, images, lists and code passive',()=>{
  const html=renderMarkdown('## Tiêu đề\n\n- Một\n- Hai\n\n[Link](https://example.com/)\n\n![Ảnh](/assets/image.png)\n\n```\n<script>example</script>\n```');
  for(const tag of ['<h2>','<ul>','<li>','<a href=','<img src=','<pre><code>'])assert.ok(html.includes(tag),tag);
  assert.equal(html.includes('<script>'),false);
});
test('source routes only render managed articles, not arbitrary files',async()=>{
  const f=fixture();for(const query of ['legacy=../../netlify.toml','slug=../admin','legacy=unknown'])assert.equal((await page(f,query)).status,404);
});
test('homepage and library HTML contain the current published catalogue before rendering',async()=>{
  const f=fixture(),saved=await call(f,'save',input({title:'BÀI MỚI ĐÃ ĐĂNG'}));
  for(const query of ['view=home','view=index']){
    const response=await page(f,query);assert.equal(response.status,200);assert.match(response.html,/window.NCN_LIBRARY_SNAPSHOT=true/);assert.ok(response.html.includes('BÀI MỚI ĐÃ ĐĂNG'));
    assert.equal(response.html.includes('src="/assets/catalog.js"'),false);
  }
  await call(f,'visibility',{id,version:saved.body.item.version});
  const home=await page(f,'view=home');assert.equal(home.html.includes('BÀI MỚI ĐÃ ĐĂNG'),false);assert.match(home.html,/id="ncn-home-latest"/);assert.equal(home.html.includes('id="ncn-welcome-panel"'),false);
  const draft=await call(f,'save',input({id:'post-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'BẢN NHÁP RIÊNG',status:'draft'}));assert.equal(draft.status,200);
  assert.equal((await page(f,'view=home')).html.includes('BẢN NHÁP RIÊNG'),false);
});
test('original public URLs work when the platform retains the pre-rewrite request URL',async()=>{
  const f=fixture(),item=seed.find(x=>x.managedPage);
  for(const path of ['/','/index.html','/thu-vien/','/thu-vien/index.html',item.href,item.href.replace(/\.html$/,''),item.href.replace(/\.html$/,'/')])assert.equal((await f.page(new Request(origin+path))).status,200,path);
  const saved=await call(f,'save',input());assert.equal((await f.page(new Request(origin+saved.body.item.href))).status,200);
});

test('permanent deletion requires trash, current version and explicit confirmation of the selected title',async()=>{
  const f=fixture(),saved=await call(f,'save',input());
  assert.equal((await call(f,'purge',{id,version:saved.body.item.version,confirmTitle:saved.body.item.title})).status,409);
  const trashed=await call(f,'trash',{id,version:saved.body.item.version});
  assert.equal((await call(f,'purge',{id,version:trashed.body.item.version})).status,400);
  assert.equal((await call(f,'purge',{id,version:saved.body.item.version,confirmTitle:saved.body.item.title})).status,409);
  assert.equal((await call(f,'purge',{id,version:trashed.body.item.version,confirmTitle:saved.body.item.title},{origin:'https://other.example'})).status,403);
  assert.ok([...f.store.entries.keys()].some(k=>k.startsWith('body-'+id+'-')));
  assert.equal((await call(f,'detail&id='+id)).body.item.status,'trash');
});
test('permanent deletion removes every content revision and cannot restore or recreate the old ID',async()=>{
  const f=fixture();let saved=await call(f,'save',input());const slug=saved.body.item.slug;
  for(let n=0;n<4;n++)saved=await call(f,'save',input({version:saved.body.item.version,body:'Revision '+n}));
  const other='post-87654321-1234-4234-8234-123456789abc';await call(f,'save',input({id:other,title:'Other item'}));
  const trashed=await call(f,'trash',{id,version:saved.body.item.version});
  const data={id,version:trashed.body.item.version,confirmTitle:saved.body.item.title},deleted=await call(f,'purge',data);assert.equal(deleted.status,200);
  assert.equal([...f.store.entries.keys()].filter(k=>k.startsWith('body-'+id+'-')).length,0);
  assert.ok([...f.store.entries.keys()].some(k=>k.startsWith('body-'+other+'-')));
  assert.equal((await call(f,'manage')).body.items.some(x=>x.id===id),false);
  assert.equal((await call(f,'detail&id='+id)).status,404);assert.equal((await page(f,'slug='+slug)).status,404);
  assert.equal((await call(f,'restore',{id,version:trashed.body.item.version})).status,409);
  assert.equal((await call(f,'save',input())).status,409);assert.equal((await call(f,'purge',data)).status,200);
  assert.equal(f.store.entries.get('index').data.items.some(x=>x.id===id),false);
});
test('legacy permanent deletion blocks the original URL and aliases without deleting GitHub source files',async()=>{
  const f=fixture(),item=seed.find(x=>x.id==='legacy-b1a4f4e54bd52f43'),original=read('public/'+item.sourcePath);
  const trashed=await call(f,'trash',{id:item.id,version:null,removePage:false});assert.equal((await page(f,'legacy='+item.id)).status,200);
  assert.equal((await call(f,'purge',{id:item.id,version:trashed.body.item.version,confirmTitle:item.title})).status,200);
  for(const href of [item.href,item.href.replace(/\.html$/,''),item.href.replace(/\.html$/,'/')])assert.equal((await f.page(new Request(origin+href))).status,410,href);
  const marker=f.store.entries.get('index').data.items.find(x=>x.id===item.id);
  assert.deepEqual(Object.keys(marker).sort(),['id','kind','pageRemoved','status','updatedAt','version']);
  assert.equal((await call(f,'manage')).body.items.some(x=>x.id===item.id),false);
  assert.equal((await call(f,'list')).body.items.some(x=>x.link===item.href),false);
  assert.equal((await call(f,'restore',{id:item.id,version:marker.version})).status,409);
  assert.equal((await call(f,'save',{...item,version:marker.version,status:'published',mode:'original'})).status,409);
  assert.equal(read('public/'+item.sourcePath),original);
});
test('permanent deletion of tool shortcuts and external links does not delete the destination',async()=>{
  const f=fixture(),tool=seed.find(x=>x.href==='/2024/01/in-fifo.html'),original=read('public'+tool.href);
  const trashed=await call(f,'trash',{id:tool.id,version:null,removePage:false});
  assert.equal((await call(f,'purge',{id:tool.id,version:trashed.body.item.version,confirmTitle:tool.title})).status,200);
  assert.equal(read('public'+tool.href),original);assert.equal(read('public/_redirects').includes(tool.href+'  /.netlify/functions/ncn-library-page'),false);
  const link=await call(f,'save',input({kind:'link',href:'https://example.com/file.xlsx'})),removed=await call(f,'trash',{id,version:link.body.item.version});
  assert.equal((await call(f,'purge',{id,version:removed.body.item.version,confirmTitle:link.body.item.title})).status,200);
  assert.equal((await call(f,'manage')).body.items.some(x=>x.id===id||x.id===tool.id),false);
});
test('a competing restore prevents a stale purge before any content is erased',async()=>{
  const f=fixture(),saved=await call(f,'save',input()),trashed=await call(f,'trash',{id,version:saved.body.item.version});
  f.store.beforeWrite=async key=>{assert.equal(key,'index');assert.equal((await call(f,'restore',{id,version:trashed.body.item.version})).status,200);};
  const result=await call(f,'purge',{id,version:trashed.body.item.version,confirmTitle:saved.body.item.title});assert.equal(result.status,409);
  assert.equal((await page(f,'slug='+saved.body.item.slug)).status,200);assert.ok([...f.store.entries.keys()].some(k=>k.startsWith('body-'+id+'-')));
  assert.equal(f.store.entries.has('gone-'+id),false);
});
test('interrupted cleanup cannot publish deleted content and can be safely retried',async()=>{
  const f=fixture();let saved=await call(f,'save',input());saved=await call(f,'save',input({version:saved.body.item.version,body:'Second revision'}));
  const trashed=await call(f,'trash',{id,version:saved.body.item.version});let failed=false;
  f.store.beforeDelete=async()=>{if(!failed){failed=true;throw Error('Transient storage failure');}};
  const result=await call(f,'purge',{id,version:trashed.body.item.version,confirmTitle:saved.body.item.title});assert.equal(result.status,503);
  const pending=await call(f,'detail&id='+id);assert.equal(pending.body.item.status,'purging');assert.equal(pending.body.body,'');assert.equal(pending.body.originalBody,'');
  assert.equal((await page(f,'slug='+saved.body.item.slug)).status,410);
  assert.equal((await call(f,'restore',{id,version:pending.body.item.version})).status,409);
  assert.equal((await call(f,'save',input({version:pending.body.item.version}))).status,409);
  assert.equal((await call(f,'purge',{id,version:pending.body.item.version,confirmTitle:pending.body.item.title})).status,200);
  assert.equal([...f.store.entries.keys()].filter(k=>k.startsWith('body-'+id+'-')).length,0);
});
test('final cleanup preserves unrelated updates and deletion frees the active article slot',async()=>{
  const f=fixture(),saved=await call(f,'save',input()),trashed=await call(f,'trash',{id,version:saved.body.item.version});
  const other='post-87654321-1234-4234-8234-123456789abc';let updated=false;
  f.store.beforeDelete=async()=>{if(!updated){updated=true;assert.equal((await call(f,'save',input({id:other,title:'Concurrent article'}))).status,200);}};
  assert.equal((await call(f,'purge',{id,version:trashed.body.item.version,confirmTitle:saved.body.item.title})).status,200);
  assert.equal((await call(f,'manage')).body.items.some(x=>x.id===other&&x.title==='Concurrent article'),true);
  assert.equal(f.store.entries.get('index').data.items.filter(x=>x.kind!=='legacy').length,1);
});
