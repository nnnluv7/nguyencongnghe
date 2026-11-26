import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createEngagementHandler,cleanupEngagement,engagementKey} from '../netlify/lib/ncn-engagement-api.mjs';
import {createEngagementResolver} from '../netlify/lib/ncn-engagement-targets.mjs';
import {createLibraryPageHandler} from '../netlify/lib/ncn-library-page.mjs';
import {publicCatalog} from '../netlify/lib/ncn-library-api.mjs';
import {readGenkArticle,parseGenkRSS,syncGenkNews} from '../netlify/lib/ncn-news.mjs';
import {articleCardHTML} from '../public/assets/ncn-theme/catalogue.js';
import {shareURL} from '../public/assets/ncn-community/model.js';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const origin='https://community.test',article='legacy-'+('a'.repeat(16)),story='story-'+('b'.repeat(40));
const member={id:'member',name:'Thành viên thử',email:'private@example.test',admin:false},other={...member,id:'other'},admin={...member,id:'admin',admin:true};
function fixture(){
  const store=memoryStories();let now=Date.parse('2026-11-26T04:00:00Z'),valid=true;
  const handler=createEngagementHandler({production:()=>true,store:()=>store,verify:async req=>({member,other,admin})[req.headers.get('x-user')]||null,resolveTarget:async kind=>valid?(kind==='story'?{expiresAt:new Date(now+10000).toISOString()}:{}):null,now:()=>now});
  return {store,handler,advance:ms=>now+=ms,remove:()=>valid=false};
}
const comment=(text='Bình luận thử',extra={})=>({action:'comment',text,requestId:randomUUID(),...extra});
async function call(f,input=null,{user='member',kind='article',id=article,before='',originHeader=origin}={}){
  const url=new URL(origin+'/.netlify/functions/ncn-engagement');url.search=new URLSearchParams({kind,id,...(before?{before}:{})});
  const response=await f.handler(new Request(url,{method:input?'POST':'GET',headers:{'content-type':'application/json','x-user':user,Origin:originHeader},...(input?{body:JSON.stringify({kind,id,...input})}:{})}));
  return {response,status:response.status,body:await response.json()};
}
test('public reads have counters and comments but guests cannot create engagement',async()=>{
  const f=fixture(),empty=await call(f,null,{user:''});assert.equal(empty.status,200);assert.deepEqual(empty.body.reactions,{like:0,dislike:0,love:0,angry:0});assert.equal(f.store.entries.size,0);
  for(const input of [comment(),{action:'react',value:'love'}])assert.equal((await call(f,input,{user:''})).status,401);
  assert.equal(f.store.entries.size,0);assert.match(empty.response.headers.get('cache-control'),/private.*no-store/);assert.equal(empty.response.headers.get('vary'),'Cookie');
});
test('ordinary members choose one of four reactions; replacing and removing cannot inflate counts',async()=>{
  const f=fixture();for(const value of ['like','dislike','love','angry','angry',null]){
    const result=await call(f,{action:'react',value});assert.equal(result.status,200);assert.equal(result.body.mine,value);assert.equal(Object.values(result.body.reactions).reduce((a,b)=>a+b,0),value?1:0);
  }
  const guests=await call(f,null,{user:''});assert.equal(guests.body.mine,null);
});
test('concurrent members and concurrent comments preserve every independent update',async()=>{
  const f=fixture(),results=await Promise.all(['member','other','admin'].map(user=>call(f,{action:'react',value:'love'},{user})));
  assert.ok(results.every(x=>x.status===200));assert.equal((await call(f)).body.reactions.love,3);
  const comments=await Promise.all(['member','other','admin'].map(user=>call(f,comment(user),{user})));
  assert.ok(comments.every(x=>x.status===200));assert.equal((await call(f)).body.commentCount,3);
});
test('retrying the same comment, even concurrently, creates one record',async()=>{
  const f=fixture(),input=comment(),results=await Promise.all([call(f,input),call(f,input)]);assert.ok(results.every(x=>x.status===200));
  assert.equal((await call(f,input)).body.commentCount,1);assert.equal((await call(f)).body.comments.length,1);
});
test('comment ownership and Admin moderation are enforced by the authenticated account',async()=>{
  const f=fixture(),saved=await call(f,comment()),id=saved.body.comments[0].id;
  assert.equal(saved.body.comments[0].canDelete,true);assert.equal((await call(f,null,{user:'other'})).body.comments[0].canDelete,false);
  assert.equal((await call(f,{action:'delete-comment',commentId:id,admin:true,owner:'member'},{user:'other'})).status,403);
  assert.equal((await call(f,{action:'delete-comment',commentId:id},{user:'admin'})).body.commentCount,0);
  const raw=JSON.stringify(f.store.entries.get(engagementKey('article',article)).data);assert.equal(raw.includes('Bình luận thử'),false);
  assert.equal((await call(f,{action:'delete-comment',commentId:id})).status,200);
});
test('public JSON never exposes emails, account IDs, storage keys or moderation flags',async()=>{
  const f=fixture();await call(f,comment('<img src=x onerror=alert(1)>'));
  const result=await call(f,null,{user:''}),json=JSON.stringify(result.body);
  for(const value of ['private@example.test','"authorKey"','"owner"','"member"','thread-','rate-'])assert.equal(json.includes(value),false);
  assert.equal(result.body.comments[0].text,'<img src=x onerror=alert(1)>');assert.equal(result.body.comments[0].canDelete,false);
  const client=await readFile('public/assets/ncn-community/engagement.js','utf8');assert.match(client,/body\.append\(meta,node\('p',item\.text\)\)/);
});
test('cross-origin, invalid targets, invalid values and streamed oversized bodies fail before writes',async()=>{
  const f=fixture();assert.equal((await call(f,comment(),{originHeader:'https://evil.test'})).status,403);
  for(const options of [{kind:'__proto__'},{id:'../../index'},{kind:'story',id:'bad'}])assert.equal((await call(f,comment(),options)).status,400);
  for(const input of [comment(''),comment('x'.repeat(1001)),comment('bad\u0000text'),comment('ok',{requestId:'invalid'}),{action:'react',value:'admin'},{action:'react'},{action:'delete-comment',commentId:'../bad'}])assert.equal((await call(f,input)).status,400);
  const response=await f.handler(new Request(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(13000)})}));assert.equal(response.status,413);assert.equal(f.store.entries.size,0);
});
test('rate limiting is per real member and shared across article targets',async()=>{
  const f=fixture();for(let n=0;n<20;n++)assert.equal((await call(f,comment(String(n)),{id:'legacy-'+n.toString(16).padStart(16,'0')})).status,200);
  assert.equal((await call(f,comment('too many'))).status,429);assert.equal((await call(f,comment('another member'),{user:'other'})).status,200);
  f.advance(3600001);assert.equal((await call(f,comment('later'))).status,200);
});
test('pagination is stable when new comments arrive and deleted cursor comments stay usable',async()=>{
  const f=fixture();for(let n=0;n<20;n++)await call(f,comment(String(n)));f.advance(3600001);for(let n=20;n<25;n++)await call(f,comment(String(n)));
  const first=(await call(f)).body;assert.equal(first.comments.length,20);assert.ok(first.nextCursor);assert.equal(first.commentCount,25);
  await call(f,comment('new'));await call(f,{action:'delete-comment',commentId:first.nextCursor});
  const second=(await call(f,null,{before:first.nextCursor})).body;assert.equal(second.comments.length,5);assert.equal(second.nextCursor,null);
  assert.equal(second.comments.some(x=>first.comments.some(y=>x.id===y.id)),false);
});
test('deleted and expired Stories cannot accept or reveal comments; cleanup removes the thread',async()=>{
  const f=fixture();assert.equal((await call(f,comment(),{kind:'story',id:story})).status,200);f.advance(10001);
  await cleanupEngagement(f.store,Date.parse('2026-11-26T04:00:10.001Z'));assert.equal(f.store.entries.has(engagementKey('story',story)),false);
  f.remove();assert.equal((await call(f,null,{kind:'story',id:story})).status,410);assert.equal((await call(f,comment(),{kind:'story',id:story})).status,410);
});
test('a Story removed during a conditional write does not leave readable orphan engagement',async()=>{
  const f=fixture();f.store.beforeWrite=async key=>{if(key.startsWith('rate-'))f.store.beforeWrite=async()=>f.remove();};
  assert.equal((await call(f,comment(),{kind:'story',id:story})).status,410);assert.equal(f.store.entries.has(engagementKey('story',story)),false);
});
test('resolvers exclude tools, hidden articles, forged IDs and expired Stories',async()=>{
  const library=memoryStories(),news=memoryStories(),stories=memoryStories();
  const seed=[{id:article,kind:'legacy',managedPage:true,isPage:false},{id:'legacy-'+('c'.repeat(16)),kind:'legacy',managedPage:false}];
  const resolve=createEngagementResolver({seed,library:()=>library,news:()=>news,stories:()=>stories});
  assert.deepEqual(await resolve('article',article),{});assert.equal(await resolve('article',seed[1].id),null);
  await library.setJSON('index',{items:[{...seed[0],status:'hidden'}]});assert.equal(await resolve('article',article),null);
  await stories.setJSON('index',{items:[{id:story,state:'active',expiresAt:'2026-11-26T04:00:00Z'}]});assert.equal(await resolve('story',story,Date.parse('2026-11-26T04:00:00Z')),null);
});
test('GenK cards open a local summary, with attribution and a full-original link; no full article scraper',async()=>{
  const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),news=JSON.parse(await readFile('netlify/lib/ncn-news/genk-seed.json','utf8')),item=news[0];
  const card=articleCardHTML(item);assert.match(card,/href="\/tin-tuc-cong-nghe\/\?bai=rss-genk-/);assert.equal(card.includes('target="_blank"'),false);
  const handler=createLibraryPageHandler({seed,state:async()=>({catalog:[...publicCatalog(seed),...news]}),articleShell:()=>readFile('netlify/lib/ncn-library/article-shell.html','utf8')});
  const response=await handler(new Request(origin+'/tin-tuc-cong-nghe/?bai='+item.id));assert.equal(response.status,200);const html=await response.text();
  assert.ok(html.includes('TÓM TẮT TỪ GENK'));assert.ok(html.includes(item.link));assert.ok(html.includes('Đọc toàn bộ bài trên GenK'));assert.ok(html.includes('id="ncn-article-community"'));assert.ok(html.includes('id="ncn-community-target"'));assert.equal(html.includes('Chỉnh sửa bài viết'),false);
  const unknown=await handler(new Request(origin+'/tin-tuc-cong-nghe/?bai=rss-genk-'+('e'.repeat(20))));assert.equal(unknown.status,404);
});
test('archived RSS metadata keeps a shared summary available after leaving the latest feed',async()=>{
  const store=memoryStories(),now=Date.parse('2026-11-26T04:00:00Z');
  const xml='<rss><channel><item><title>Thông tin thử nghiệm</title><link>https://genk.vn/fixture.chn</link><description>Tóm tắt thử nghiệm</description><pubDate>Thu, 26 Nov 2026 10:00:00 +0700</pubDate></item></channel></rss>';
  await syncGenkNews(store,{now,fetcher:async()=>new Response(xml,{headers:{'content-type':'application/rss+xml'}})});const id=parseGenkRSS(xml,now)[0].id;
  await store.setJSON('genk',{items:[]});assert.equal((await readGenkArticle(store,id)).id,id);assert.equal(await readGenkArticle(store,'../../index'),null);
});
test('the first unchanged RSS response archives existing metadata once and keeps seed links readable',async()=>{
  const store=memoryStories(),item={id:'rss-genk-'+('f'.repeat(20)),source:'GenK',title:'Tin đã chia sẻ',link:'https://genk.vn/old.chn'};
  await store.setJSON('genk',{items:[item],etag:'old-etag'});let writes=0;
  const set=store.setJSON.bind(store);store.setJSON=async(...args)=>{writes++;return set(...args);};
  await syncGenkNews(store,{fetcher:async()=>new Response(null,{status:304})});assert.equal((await store.get('article-'+item.id)).title,item.title);assert.equal(writes,2);
  writes=0;await syncGenkNews(store,{fetcher:async()=>new Response(null,{status:304})});assert.equal(writes,0);
  await store.setJSON('genk',{items:[]});await store.delete('article-'+item.id);assert.equal((await readGenkArticle(store,item.id,[item])).title,item.title);
});
test('shared Story previews name the actual photo before scripts run and stop advertising expired photos',async()=>{
  const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),now=Date.parse('2026-11-26T04:00:00Z');let expiresAt=new Date(now+10000).toISOString();
  const handler=createLibraryPageHandler({seed,state:async()=>({catalog:publicCatalog(seed),now,stories:[{id:story,name:'Thành viên thử',caption:'Khoảnh khắc chia sẻ',expiresAt,createdAt:new Date(now-1000).toISOString()}]}),indexShell:()=>readFile('public/tin-tuc-cong-nghe/index.html','utf8')});
  let html=await (await handler(new Request(origin+'/tin-tuc-cong-nghe/?story='+story))).text();assert.match(html,/property="og:title" content="Story của Thành viên thử"/);assert.ok(html.includes('ncn-stories?route=image&amp;id='+story));
  expiresAt=new Date(now).toISOString();html=await (await handler(new Request(origin+'/tin-tuc-cong-nghe/?story='+story))).text();assert.ok(html.includes('content="Story đã hết hạn"'));assert.equal(html.includes('ncn-stories?route=image&amp;id='+story),false);assert.ok(html.includes('content="noindex"'));
});
test('share links encode the local target without running social SDKs',()=>{
  const url='https://nguyencongnghe.com/tin-tuc-cong-nghe/?bai=rss-genk-'+('a'.repeat(20));
  const fb=new URL(shareURL('facebook',url));assert.equal(fb.origin,'https://www.facebook.com');assert.equal(fb.searchParams.get('u'),url);
  const threads=new URL(shareURL('threads',url,'Bài viết & cảm nhận'));assert.equal(threads.origin,'https://www.threads.com');assert.equal(threads.searchParams.get('url'),url);assert.equal(threads.searchParams.get('text'),'Bài viết & cảm nhận');
  assert.equal(shareURL('tiktok',url),'');assert.equal(shareURL('instagram',url),'');
});
