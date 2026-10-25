import sharp from 'sharp';
import {memoryStories} from '../fixtures/ncn-stories.mjs';
import {createStoriesHandler} from '../../netlify/lib/ncn-stories-api.mjs';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createLibraryHandler} from '../../netlify/lib/ncn-library-api.mjs';
import {createLibraryPageHandler} from '../../netlify/lib/ncn-library-page.mjs';

// Synthetic HTTPS origin. Real handlers and the real UI use an isolated memory
// store; no production Identity, content, payment or external write is possible.
const origin='https://ncn-stories.test',root=resolve('public'),out=resolve('artifacts/stories');
await mkdir(out,{recursive:true});
const read=path=>readFile(path,'utf8');
const seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json'));
const originalBodies=JSON.parse(await read('netlify/lib/ncn-library/original-markdown.json'));
const entries=new Map();let serial=0,failDelete=false,losePurgeReply=false;
const store={async get(key){return structuredClone(entries.get(key)?.data??null);},async getWithMetadata(key){return structuredClone(entries.get(key)??null);},async *list({prefix}){yield {blobs:[...entries.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};},async delete(key){if(failDelete){failDelete=false;throw Error('Fixture cleanup interruption');}entries.delete(key);},async setJSON(key,data,options={}){
  const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
  entries.set(key,{data:structuredClone(data),etag:'"'+(++serial)+'"'});return {modified:true};
}};
const users=new Map([
  ['admin@example.test',{id:'admin',email:'admin@example.test',name:'Admin thử nghiệm',admin:true,vip:true}],
  ['member@example.test',{id:'member',email:'member@example.test',name:'Thành viên NCN thử',admin:false,vip:false}],
  ['other@example.test',{id:'other',email:'other@example.test',name:'Một thành viên khác',admin:false,vip:false}]
]),tokens=new Map();
const raw=user=>({id:user.id,email:user.email,confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{roles:user.admin?['admin']:user.vip?['vip']:[]},user_metadata:{full_name:user.name,roles:['admin']}});
const tokenUser=req=>tokens.get(decodeURIComponent((req.headers.get('cookie')||'').match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1]||''))||null;
const deps={seed,originalBodies,production:()=>true,store:()=>store,verify:async req=>tokenUser(req),app:view=>read('netlify/lib/ncn-library/admin-'+(view==='library'?'library':'hub')+'.html')};
const handler=createLibraryHandler(deps),pageHandler=createLibraryPageHandler({...deps,homeShell:()=>read('public/index.html'),indexShell:()=>read('public/thu-vien/index.html'),articleShell:()=>read('netlify/lib/ncn-library/article-shell.html'),original:path=>read('public/'+path)});
let storyNow=null;
const storyStore=memoryStories(),stories=createStoriesHandler({production:()=>true,store:()=>storyStore,verify:async req=>tokenUser(req),now:()=>storyNow??Date.now()});
const picture=await sharp({create:{width:900,height:1200,channels:3,background:'#689ba8'}}).jpeg().toBuffer();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const browser=await chromium.launch(),results=[];let page;
async function context(){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){assert.notEqual(request.method(),'POST','No external writes');return route.abort();}
    const headers=await request.allHeaders();
    const req=new Request(request.url(),{method:request.method(),headers,...(['GET','HEAD'].includes(request.method())?{}:{body:request.postData()||''})});
    const user=tokenUser(req),identityUser=tokens.get((headers.authorization||'').replace(/^Bearer /,''))||user;
    const reply=(data,status=200,type='application/json')=>route.fulfill({status,contentType:type,body:typeof data==='string'?data:JSON.stringify(data)});
    const respond=async response=>route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    if(url.pathname.startsWith('/.netlify/identity/')){
      const action=url.pathname.split('/').at(-1);
      if(action==='settings')return reply({autoconfirm:true,disable_signup:false,external:{email:true}});
      if(action==='token'){
        const data=Object.fromEntries(new URLSearchParams(request.postData()||'')),u=users.get(data.username)||[...users.values()].find(x=>'refresh-'+x.id===data.refresh_token);
        if(!u||data.grant_type==='password'&&data.password!=='Example123!')return reply({error_description:'Fixture credentials only'},400);
        const token=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';tokens.set(token,u);
        return reply({access_token:token,refresh_token:'refresh-'+u.id,expires_in:3600,token_type:'bearer',user:raw(u)});
      }
      if(action==='user')return reply(identityUser?raw(identityUser):{error:'Unauthorized'},identityUser?200:401);
      if(action==='logout')return reply({});
      throw Error('Unmocked Identity action '+action);
    }
    if(url.pathname==='/.netlify/functions/ncn-library'){const response=await handler(req);if(losePurgeReply&&url.searchParams.get('route')==='purge'&&response.ok){losePurgeReply=false;return route.abort('failed');}return respond(response);}
    if(url.pathname==='/.netlify/functions/ncn-billing')return reply({user});
    if(url.pathname==='/.netlify/functions/ncn-announcements')return reply({items:[],admin:!!user?.admin});
    if(url.pathname==='/.netlify/functions/ncn-stories')return respond(await stories(req));
    if(url.pathname==='/.netlify/functions/ncn-visitors')return reply({total:1,online:1});
    if(url.pathname.startsWith('/.netlify/functions/'))throw Error('Unexpected function '+url.pathname);
    let query=null;
    if(['/','/index.html'].includes(url.pathname))query='view=home';
    if(['/thu-vien/','/thu-vien/index.html'].includes(url.pathname))query='view=index';
    const article=url.pathname.match(/^\/bai-viet\/([^/]+)\/?$/);if(article)query='slug='+encodeURIComponent(article[1]);
    const original=seed.find(x=>x.managedPage&&[x.href,x.href.replace(/\.html$/,''),x.href.replace(/\.html$/,'/')].includes(url.pathname));if(original)query='legacy='+original.id;
    if(query)return respond(await pageHandler(new Request(origin+'/.netlify/functions/ncn-library-page?'+query,{headers})));
    assert.equal(request.method(),'GET','Only fixture APIs can write');
    try{
      let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('Outside public');
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      return route.fulfill({status:200,contentType:types[extname(file)]||'application/octet-stream',body:await readFile(file)});
    }catch{return reply('Not found',404,'text/plain');}
  });
  return ctx;
}
async function open(ctx,path){const p=await ctx.newPage();await p.goto(origin+path,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.NCNAccount?.state.ready);return p;}
async function login(p,email){
  await p.evaluate(()=>window.NCNAccount.open('login'));
  const form=p.locator('[data-account-form=login]');await form.locator('[name=email]').fill(email);await form.locator('[name=password]').fill('Example123!');await form.locator('[type=submit]').click();
  try{await p.waitForFunction(()=>!!window.NCNAccount.state.user&&!document.getElementById('ncn-account-dialog').open);}
  catch(error){await p.screenshot({path:out+'/login-failure.jpg',type:'jpeg',quality:80});console.log(await p.evaluate(()=>({message:document.getElementById('ncn-account-message')?.textContent,ready:NCNAccount.state.ready,user:NCNAccount.state.user,error:NCNAccount.state.error?.message})));throw error;}
}
async function check(name,action){try{await action();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}}
async function saved(p,pattern=/Đã lưu/){await p.waitForFunction(()=>!document.getElementById('nl-refresh').disabled);await p.locator('#nl-status').filter({hasText:pattern}).waitFor();}
async function choose(p,item){await p.locator('#nl-search').fill(item.title);await p.locator('[data-article-id="'+item.id+'"]').click();await p.waitForFunction(id=>new URL(location.href).searchParams.get('id')===id,item.id);await p.waitForFunction(()=>!document.getElementById('nl-save').disabled);}
async function fits(p){const size=await p.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.content<=size.viewport+1,JSON.stringify(size));}
async function library(ctx){const p=await open(ctx,'/thu-vien/');await p.locator('#ncn-stories[data-mounted=true]').waitFor();await p.locator('[data-story-status]').filter({hasText:/khoảnh khắc|xuất hiện/}).waitFor();return p;}
async function upload(p,text){await p.locator('[data-story-add]').click();await p.locator('#ncn-story-compose input[type=file]').setInputFiles({name:'fixture.jpg',mimeType:'image/jpeg',buffer:picture});await p.locator('#ncn-story-compose [data-message]').filter({hasText:'Ảnh đã sẵn sàng'}).waitFor();await p.locator('#ncn-story-compose [name=caption]').fill(text);await p.locator('#ncn-story-compose [type=submit]').click();await p.locator('#ncn-story-compose').waitFor({state:'hidden'});await p.locator('[data-story-id]').first().waitFor();}
let guest,member,other,admin;
try{
  guest=await context();page=await library(guest);
  await check('Library presents four cards per desktop row with featured content and Story before the count',async()=>{
    assert.equal(await page.locator('#ncn-library-results').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
    assert.equal(await page.locator('#ncn-featured-results a').count(),3);
    assert.equal(await page.locator('[data-story-rail]').evaluate(el=>getComputedStyle(el).display),'flex');
    assert.equal(Math.round((await page.locator('[data-story-add]').boundingBox()).height),196);
    const order=await page.evaluate(()=>['ncn-library-featured','ncn-stories','ncn-library-count'].map(id=>document.getElementById(id).getBoundingClientRect().top));assert.ok(order[0]<order[1]&&order[1]<order[2]);
    assert.match(await page.locator('#ncn-library-count').innerText(),/^77 nội dung/);await fits(page);await page.screenshot({path:out+'/library-desktop-empty.jpg',fullPage:true,type:'jpeg',quality:80});
  });
  await check('guest posting uses the single shared login and registration dialog',async()=>{
    await page.locator('[data-story-add]').click();await page.locator('#ncn-account-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#ncn-account-dialog').count(),1);
    await page.locator('[data-account-mode=register]').first().click();assert.equal(await page.locator('[data-account-form=register]').isVisible(),true);await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ncn-story-compose').isVisible(),false);
  });
  member=await context();page=await library(member);await login(page,'member@example.test');
  await check('an ordinary non-VIP member can preview and publish a photo with a caption',async()=>{
    assert.equal(await page.evaluate(()=>NCNAccount.state.user.vip),false);await upload(page,'Một góc công việc <script>window.storyXSS=1</script>');
    assert.equal((await page.locator('[data-story-id]').count()),1);assert.equal(await page.evaluate(()=>window.storyXSS),undefined);
    assert.equal([...storyStore.entries.keys()].filter(x=>x.startsWith('image-')).length,2);
  });
  await check('public readers see the actual member photo, safe text and no delete control',async()=>{
    page=await library(guest);await page.locator('[data-story-id]').click();await page.waitForFunction(()=>document.querySelector('#ncn-story-viewer img').naturalWidth>0);
    assert.equal(await page.locator('#ncn-story-viewer [data-author]').textContent(),'Thành viên NCN thử');assert.equal(await page.locator('#ncn-story-viewer [data-delete]').isVisible(),false);assert.equal(await page.evaluate(()=>window.storyXSS),undefined);await page.keyboard.press('Escape');
  });
  other=await context();page=await library(other);await login(page,'other@example.test');
  await check('another member cannot delete the first photo and can post their own',async()=>{
    await page.locator('[data-story-id]').click();assert.equal(await page.locator('[data-delete]').isVisible(),false);await page.keyboard.press('Escape');await upload(page,'Khoảnh khắc thứ hai');assert.equal(await page.locator('[data-story-id]').count(),2);
  });
  await check('viewer keyboard navigation and cancellation keep both photos',async()=>{
    await page.locator('[data-story-id]').first().click();await page.locator('[data-delete]').click();await page.locator('[data-keep]').click();assert.equal(await page.locator('.ncn-story-confirm').isVisible(),false);
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-position]').textContent(),'2 / 2');assert.equal(await page.locator('[data-delete]').isVisible(),false);await page.keyboard.press('Escape');
  });
  await check('phone and dark layouts fit, with a horizontally scrollable photo rail',async()=>{
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');await fits(page);
    assert.equal(Math.round((await page.locator('[data-story-id]').first().boundingBox()).height),178);
    assert.equal(await page.locator('#ncn-library-results').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    await page.locator('#ncn-stories').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/stories-phone-dark.jpg',type:'jpeg',quality:85});await page.locator('[data-story-id]').first().click();await fits(page);await page.screenshot({path:out+'/viewer-phone-dark.jpg',type:'jpeg',quality:85});await page.keyboard.press('Escape');
  });
  await check('owner confirmation permanently removes the selected photo and its thumbnail',async()=>{
    await page.locator('[data-story-id]').first().click();await page.locator('[data-delete]').click();await page.locator('[data-confirm-delete]').click();await page.locator('#ncn-story-viewer').waitFor({state:'hidden'});
    assert.equal(await page.locator('[data-story-id]').count(),1);assert.equal([...storyStore.entries.keys()].filter(x=>x.startsWith('image-')).length,2);
  });
  page=await library(member);
  await check('signing out closes the composer and clears its selected local photo',async()=>{
    await page.locator('[data-story-add]').click();await page.locator('#ncn-story-compose input[type=file]').setInputFiles({name:'fixture.jpg',mimeType:'image/jpeg',buffer:picture});await page.locator('#ncn-story-compose [data-message]').filter({hasText:'Ảnh đã sẵn sàng'}).waitFor();
    await page.evaluate(()=>NCNAccount.signOut());await page.locator('#ncn-story-compose').waitFor({state:'hidden'});assert.equal(await page.locator('#ncn-story-compose img').getAttribute('src'),null);
  });
  admin=await context();page=await library(admin);await login(page,'admin@example.test');
  await check('Admin can remove a member Story through the public viewer',async()=>{
    await page.locator('[data-story-id]').click();await page.locator('[data-delete]').click();await page.locator('[data-confirm-delete]').click();await page.locator('#ncn-story-viewer').waitFor({state:'hidden'});assert.equal(await page.locator('[data-story-id]').count(),0);assert.equal([...storyStore.entries.keys()].filter(x=>x.startsWith('image-')).length,0);
  });
  await check('Admin can choose a featured item using the library editor and readers see it first',async()=>{
    page=await open(admin,'/admin/thu-vien/');await page.locator('#nl-form').waitFor();await page.waitForFunction(()=>!document.getElementById('nl-refresh').disabled);
    await page.locator('#nl-new').click();await page.locator('#nl-title').fill('Nội dung nổi bật do Admin chọn');await page.locator('#nl-state').selectOption('published');await page.locator('#nl-featured').check();await page.locator('#nl-body').fill('Một bài viết nổi bật để kiểm tra.');await page.locator('#nl-save').click();await saved(page);
    page=await library(guest);assert.equal(await page.locator('#ncn-featured-results h3').first().textContent(),'Nội dung nổi bật do Admin chọn');assert.equal(await page.locator('#ncn-featured-results a').count(),1);
    await fits(page);await page.screenshot({path:out+'/library-featured-admin.jpg',type:'jpeg',quality:80});
  });
  await check('Story expires on an open page at 24 hours using server time, then its direct image is unavailable',async()=>{
    page=await library(other);await upload(page,'Ảnh kiểm tra tự xoá 24 giờ');
    const item=storyStore.entries.get('index').data.items.find(x=>x.state==='active');storyNow=Date.parse(item.expiresAt)-1800;
    page=await library(guest);await page.locator('[data-story-id]').click();await page.locator('#ncn-story-viewer').waitFor({state:'visible'});
    await page.locator('[data-story-id]').waitFor({state:'detached'});await page.locator('#ncn-story-viewer').waitFor({state:'hidden'});
    storyNow=Date.parse(item.expiresAt);const result=await page.evaluate(async id=>{const r=await fetch('/.netlify/functions/ncn-stories?route=image&id='+id);return r.status;},item.id);assert.equal(result,404);
  });
}finally{
  await writeFile(out+'/results.json',JSON.stringify(results,null,2));await Promise.allSettled([guest,member,other,admin].filter(Boolean).map(ctx=>ctx.close()));await browser.close();
}
