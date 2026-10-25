import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createLibraryPageHandler,injectCatalog} from '../../netlify/lib/ncn-library-page.mjs';
import {createSitePageHandler} from '../../netlify/lib/ncn-site-page.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {mergeNews} from '../../netlify/lib/ncn-news.mjs';

const origin='https://ncn-layout.test',root=resolve('public'),out=resolve('artifacts/layout');await mkdir(out,{recursive:true});
const read=path=>readFile(path,'utf8'),seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json')),news=JSON.parse(await read('netlify/lib/ncn-news/genk-seed.json')),pages=JSON.parse(await read('netlify/lib/ncn-shell/pages.json'));
const catalog=mergeNews(publicCatalog(seed),news),now=Date.now(),photo={id:'story-'+'a'.repeat(40),authorKey:'fixture',name:'Thành viên thử nghiệm',caption:'Kiểm tra bố cục Story',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),width:640,height:480};
const state={catalog,notices:[{id:'fixture',text:'NCN · Thông báo kiểm tra giao diện đồng bộ'}],stories:[photo],now};
const common={production:()=>true,seed,store:()=>({getWithMetadata:async()=>null}),state:async()=>state};
const library=createLibraryPageHandler({...common,homeShell:()=>read('public/index.html'),indexShell:()=>read('public/thu-vien/index.html'),articleShell:()=>read('netlify/lib/ncn-library/article-shell.html'),original:path=>read('public/'+path)});
const shell=createSitePageHandler({pages,html:path=>read('public/'+path),state:async()=>state,inject:injectCatalog});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const browser=await chromium.launch(),results=[];let page,blocked=false,pending=[];
const logo=await readFile('public/assets/ncn-theme/logo.png');
async function context(){
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){assert.equal(request.method(),'GET','No real external writes');return /\.(?:jpg|png|webp)(?:\?|$)/i.test(url.pathname)?route.fulfill({contentType:'image/png',body:logo}):route.abort();}
  if(blocked&&/\/assets\/ncn-(?:theme\/(?:theme|catalogue)|account)/.test(url.pathname))await new Promise(resolve=>pending.push(resolve));
  const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname.startsWith('/.netlify/functions/')){
   if(url.pathname.endsWith('ncn-library'))return json({items:catalog});
   if(url.pathname.endsWith('ncn-announcements'))return json({items:state.notices});
   if(url.pathname.endsWith('ncn-stories'))return url.searchParams.get('route')==='image'?route.fulfill({contentType:'image/png',body:logo}):json({items:state.stories,serverNow:new Date().toISOString()});
   if(url.pathname.endsWith('ncn-billing'))return json({user:null});
   return json({online:1,total:1});
  }
  if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
  const req=new Request(request.url()),managed=seed.some(x=>x.managedPage&&x.href===url.pathname);
  if(['/','/index.html','/thu-vien/','/thu-vien/index.html'].includes(url.pathname)||managed){const response=await library(req);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
  if(pages[url.pathname]||pages[decodeURIComponent(url.pathname)]){const response=await shell(req);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Outside root');if((await stat(path)).isDirectory())path=resolve(path,'index.html');return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}
 });return ctx;
}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}}
const paint=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const fits=async p=>{const size=await p.evaluate(()=>({w:innerWidth,actual:document.documentElement.scrollWidth}));assert.ok(size.actual<=size.w+1,JSON.stringify(size));};
const ctx=await context();
try{
 for(const path of ['/','/thu-vien/'])await check('complete first paint with delayed modules: '+path,async()=>{
  blocked=true;page=await ctx.newPage();await page.goto(origin+path,{waitUntil:'commit'});await page.locator(path==='/'?'#ncn-tool-grid':'#ncn-library-results').waitFor();await paint(page);
  const ids=path==='/'?['ncn-home-latest','ncn-tools']:['ncn-library-featured','ncn-stories','ncn-library-count'];
  const before=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()])),ids);
  assert.equal(await page.locator(path==='/'?'#ncn-articles a':'#ncn-library-results a').count(),path==='/'?4:12);
  assert.equal(await page.locator('#ncn-announcement').isVisible(),true);if(path==='/thu-vien/')assert.equal(await page.locator('[data-story-id]').count(),1);
  blocked=false;pending.splice(0).forEach(resolve=>resolve());await page.waitForFunction(()=>window.NCNAccount?.state.ready);await paint(page);
  const after=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()])),ids);
  for(const id of ids)for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[id][key]-after[id][key])<1.1,id+' '+key+' moved: '+before[id][key]+' → '+after[id][key]);
  await fits(page);await page.screenshot({path:out+(path==='/'?'/home-desktop.jpg':'/library-desktop.jpg'),fullPage:true,type:'jpeg',quality:80});await page.close();
 });
 page=await ctx.newPage();await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await check('heading sizes and inline search icon, input and card edges align at every breakpoint',async()=>{
  for(const width of [1920,1280,820,640,390,320]){
   await page.setViewportSize({width,height:900});await paint(page);await fits(page);
   const value=await page.evaluate(()=>{const field=document.querySelector('.ncn-inline-search'),input=field.querySelector('input'),icon=field.querySelector('svg'),heading=document.querySelector('#ncn-tools .ncn-section-heading'),grid=document.getElementById('ncn-tool-grid');return {field:field.getBoundingClientRect().toJSON(),input:input.getBoundingClientRect().toJSON(),icon:icon.getBoundingClientRect().toJSON(),heading:heading.getBoundingClientRect().toJSON(),grid:grid.getBoundingClientRect().toJSON(),h1:getComputedStyle(document.getElementById('ncn-latest-title')).fontSize,h2:getComputedStyle(heading.querySelector('h2')).fontSize};});
   assert.equal(value.h1,value.h2,width+' headings');assert.ok(value.field.height>=44&&value.field.height<=48,width+' search height');assert.ok(Math.abs((value.icon.y+value.icon.height/2)-(value.input.y+value.input.height/2))<1,width+' centered icon');assert.ok(Math.abs(value.field.right-value.grid.right)<1,width+' search right edge');
   if(width<=640)assert.ok(Math.abs(value.field.width-value.grid.width)<1,width+' mobile search width');
  }
  await page.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');await page.screenshot({path:out+'/home-phone-dark.jpg',type:'jpeg',quality:85});
 });
 await page.goto(origin+'/thu-vien/',{waitUntil:'domcontentloaded'});
 await check('GenK entries participate in library source filters, searching and persistent query URLs',async()=>{
  await page.selectOption('#ncn-library-source','genk');assert.match(await page.locator('#ncn-library-count').innerText(),/^40 nội dung/);assert.equal(await page.locator('#ncn-library-results a[data-ncn-source=genk]').count(),12);
  await page.locator('#ncn-library-next').click();assert.ok(page.url().includes('page=2'));await page.reload({waitUntil:'domcontentloaded'});assert.match(await page.locator('#ncn-library-page').innerText(),/Trang 2/);
  const title=news[0].title;await page.locator('#ncn-library-query').fill(title);assert.equal(await page.locator('#ncn-library-results a').count(),1);assert.equal(await page.locator('#ncn-library-results a').getAttribute('href'),news[0].link);assert.equal(await page.locator('#ncn-library-results a').getAttribute('target'),'_blank');
 });
 await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/thu-vien/',{waitUntil:'domcontentloaded'});
 await check('library hover eases in and out instead of jumping and respects reduced motion',async()=>{
  const card=page.locator('#ncn-library-results a').first();await card.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await paint(page);const normal=await card.evaluate(el=>el.getBoundingClientRect().top);
  await card.hover();await page.waitForTimeout(70);const middle=await card.evaluate(el=>el.getBoundingClientRect().top);await page.waitForTimeout(240);const end=await card.evaluate(el=>el.getBoundingClientRect().top);assert.ok(middle<normal&&middle>end+.05);assert.ok(normal-end>2.5&&normal-end<3.5);
  await page.mouse.move(0,0);await page.waitForTimeout(70);const leaving=await card.evaluate(el=>el.getBoundingClientRect().top);assert.ok(leaving>end&&leaving<normal);
  await page.emulateMedia({reducedMotion:'reduce'});await card.hover();await paint(page);assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 });
 await page.close();
 async function htmlFiles(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())result.push(...await htmlFiles(path));else if(item.name.endsWith('.html'))result.push(path);}return result;}
 const files=(await htmlFiles('public')).sort();
 for(const [i,file] of files.entries())await check('shared layout '+(i+1)+'/'+files.length+': '+file.slice(7),async()=>{
  page=await ctx.newPage();const response=await page.goto(origin+'/'+file.slice(7),{waitUntil:'domcontentloaded'});const initial=await response.text();assert.ok(initial.includes('window.NCN_NOTICE_SNAPSHOT'),file+' server notice snapshot');assert.ok(initial.includes('site.css?v=20261025-sync-1')||file.includes('flappy-bird'),file+' final stylesheet');await paint(page);
  for(const width of [1280,390]){await page.setViewportSize({width,height:844});await paint(page);await fits(page);
   const input=page.locator('#ncn-global-query');if(await input.count()){await page.evaluate(()=>document.getElementById('ncn-search-dialog').showModal());await paint(page);const geo=await page.evaluate(()=>{const box=document.getElementById('ncn-search-dialog').getBoundingClientRect(),input=document.getElementById('ncn-global-query').getBoundingClientRect(),icon=document.querySelector('.ncn-search-dialog-head svg').getBoundingClientRect();return {left:box.left,right:box.right,w:innerWidth,delta:Math.abs(input.top+input.height/2-icon.top-icon.height/2)};});assert.ok(geo.left>=0&&geo.right<=geo.w&&geo.delta<2,JSON.stringify(geo));await page.evaluate(()=>document.getElementById('ncn-search-dialog').close());}
  }await page.close();
 });
}finally{blocked=false;pending.splice(0).forEach(resolve=>resolve());await writeFile(out+'/results.json',JSON.stringify(results,null,2));await ctx.close();await browser.close();}
