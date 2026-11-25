import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createLibraryPageHandler,injectCatalog} from '../../netlify/lib/ncn-library-page.mjs';
import {createSitePageHandler} from '../../netlify/lib/ncn-site-page.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {mergeNews} from '../../netlify/lib/ncn-news.mjs';
import {optimizePublicResponse} from '../../netlify/lib/ncn-public-assets.mjs';

const built=!!process.env.NCN_BUILT_TEST;
const origin='https://ncn-layout.test',root=resolve(built?'dist':'public'),out=resolve('artifacts/compact-layout'+(built?'-built':''));await mkdir(out,{recursive:true});
const read=path=>readFile(path,'utf8'),seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json')),news=JSON.parse(await read('netlify/lib/ncn-news/genk-seed.json')),pages=JSON.parse(await read('netlify/lib/ncn-shell/pages.json'));
const catalog=mergeNews(publicCatalog(seed),news),now=Date.now(),photo={id:'story-'+'a'.repeat(40),authorKey:'fixture',name:'Thành viên thử nghiệm',caption:'Kiểm tra bố cục Story',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),width:640,height:480};
const state={catalog,notices:[{id:'fixture',text:'NCN · Thông báo kiểm tra giao diện đồng bộ'}],stories:[photo],now};
const common={production:()=>true,seed,store:()=>({getWithMetadata:async()=>null}),state:async()=>state};
const library=createLibraryPageHandler({...common,homeShell:()=>read('public/index.html'),indexShell:()=>read('public/tin-tuc-cong-nghe/index.html'),articleShell:()=>read('netlify/lib/ncn-library/article-shell.html'),original:path=>read('public/'+path)});
const shell=createSitePageHandler({pages,html:path=>read('public/'+path),state:async({catalog=true}={})=>catalog?state:{...state,catalog:[],catalogDeferred:true},inject:injectCatalog});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const browser=await chromium.launch(),results=[],controlAudit=[];let page,blocked=false,pending=[];
const logo=await readFile('public/assets/ncn-theme/logo.png');
async function context(){
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){assert.equal(request.method(),'GET','No real external writes');return /\.(?:jpg|png|webp)(?:\?|$)/i.test(url.pathname)?route.fulfill({contentType:'image/png',body:logo}):route.abort();}
  if(blocked&&(built?/\/assets\/ncn-built\/(?:shared\/|assets\/ncn-(?:theme\/|account))/:/\/assets\/ncn-(?:theme\/(?:theme|catalogue)|account)/).test(url.pathname))await new Promise(resolve=>pending.push(resolve));
  const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname.startsWith('/.netlify/functions/')){
   if(url.pathname.endsWith('ncn-library'))return json({items:catalog});
   if(url.pathname.endsWith('ncn-announcements'))return json({items:state.notices});
   if(url.pathname.endsWith('ncn-stories'))return url.searchParams.get('route')==='image'?route.fulfill({contentType:'image/png',body:logo}):json({items:state.stories,serverNow:new Date().toISOString()});
   if(url.pathname.endsWith('ncn-billing'))return json({user:null});
   if(url.pathname.endsWith('ncn-audio'))return json({ready:false,samples:[]});
   return json({online:1,total:1});
  }
  if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
  const req=new Request(request.url()),managed=seed.some(x=>x.managedPage&&x.href===url.pathname);
  if(['/','/index.html','/tin-tuc-cong-nghe/','/tin-tuc-cong-nghe/index.html'].includes(url.pathname)||managed){const response=built?await optimizePublicResponse(await library(req)):await library(req);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
  if(pages[url.pathname]||pages[decodeURIComponent(url.pathname)]){const response=built?await optimizePublicResponse(await shell(req)):await shell(req);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Outside root');if((await stat(path)).isDirectory())path=resolve(path,'index.html');return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}
 });return ctx;
}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}}
const ctx=await context(),metrics=[];
const paint=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const targets=['/','/popup-a7/','/sticker/','/ban-hang/','/trang-tri/','/tin-tuc-cong-nghe/','/arcade/','/2024/02/kiem-quy.html','/2025/05/tu-van.html','/tien-quy-sieu-thi/'];
try{
 for(const path of targets){
  page=await ctx.newPage();await page.setViewportSize({width:1366,height:768});await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('body.ncn-scroll-ready');await page.waitForFunction(()=>window.NCNAccount?.state.ready);
  if(path==='/arcade/')await page.waitForSelector('.ncn-arcade-card');else if(['/popup-a7/','/sticker/','/ban-hang/','/trang-tri/'].includes(path))await page.waitForSelector('.st-card');
  if(path==='/sticker/')await page.locator('#st-groups [data-group=all]').click();
  await page.evaluate(()=>document.fonts.ready);await paint();
  const info=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewport:innerHeight,
   columns:[...document.querySelectorAll('#ncn-tool-grid,#ncn-articles,#ncn-featured-results,#ncn-library-results,.st-cards,.ncn-arcade-grid')].filter(el=>el.getClientRects().length).map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),
   cards:document.querySelectorAll('.st-card').length,cardWidths:[...document.querySelectorAll('#ncn-articles,#ncn-tool-grid,#ncn-featured-results,#ncn-library-results,.st-cards')].filter(el=>el.getClientRects().length&&el.firstElementChild).map(el=>el.firstElementChild.getBoundingClientRect().width),bar:document.getElementById('ncn-topbar').getBoundingClientRect().toJSON()}));
  metrics.push({path,...info});console.log(JSON.stringify({path,...info}));
  assert.ok(info.columns.every(n=>n===5),JSON.stringify(info));assert.ok(info.cardWidths.every(width=>Math.abs(width-(1366-48-48)/5)<1),JSON.stringify(info));assert.ok(info.bar.height<=54);assert.ok(info.width<=1366);
  if(['/', '/popup-a7/','/tin-tuc-cong-nghe/'].includes(path))await page.screenshot({path:out+'/'+(path==='/'?'home':path.split('/')[1])+'.jpg',fullPage:true,type:'jpeg',quality:80});
  await page.evaluate(()=>{const spacer=document.createElement('div');spacer.id='test-scroll-spacer';spacer.style.height='1800px';document.body.append(spacer);scrollTo(0,500);});await paint();
  const fixed=await page.locator('#ncn-topbar').boundingBox();assert.ok(Math.abs(fixed.y-info.bar.y)<1);assert.equal(await page.locator('body.ncn-chrome-hidden').count(),0);await page.evaluate(()=>document.getElementById('test-scroll-spacer')?.remove());
  await page.evaluate(()=>{const avatar=document.querySelector('.ncn-account-avatar');if(avatar)avatar.replaceChildren(Object.assign(document.createElement('img'),{src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="skyblue"/></svg>'),alt:'Ảnh thử tỷ lệ'}));});
  for(const width of [1920,1366,1024,900,768,390,320]){
   await page.setViewportSize({width,height:844});await paint();
   const mobile=await page.evaluate(()=>{const bar=document.getElementById('ncn-topbar').getBoundingClientRect(),controls=[...document.querySelectorAll('#ncn-menu-open,#ncn-topbar .ncn-brand-image,#ncn-toolbar-clock,#ncn-topbar .ncn-top-search,#ncn-theme-toggle,#ncn-topbar .ncn-account-menu summary')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON()).sort((a,b)=>a.left-b.left);return {width:document.documentElement.scrollWidth,height:bar.height,inside:controls.every(r=>r.left>=bar.left&&r.right<=bar.right),overlap:controls.some((r,i)=>i&&r.left<controls[i-1].right-1)};});
   assert.ok(mobile.width<=width+1&&mobile.height<=54&&mobile.inside&&!mobile.overlap,JSON.stringify({path,width,...mobile}));
   const toolbar=await page.evaluate(()=>{
    const bar=document.getElementById('ncn-topbar'),left=bar.querySelector('.ncn-topbar-left'),right=bar.querySelector('.ncn-topbar-right');
    const children=[...right.children].map(el=>el.matches('details')?el.querySelector('summary'):el).map(el=>el.getBoundingClientRect().toJSON());
    const avatar=bar.querySelector('.ncn-account-avatar'),rect=avatar?.getBoundingClientRect();
    return {grouped:left.contains(document.getElementById('ncn-menu-open'))&&right.contains(bar.querySelector('.ncn-top-search')),searchText:bar.querySelector('.ncn-top-search').textContent.trim(),label:bar.querySelector('.ncn-top-search').getAttribute('aria-label'),background:getComputedStyle(bar).backgroundColor,groups:[left,right].map(el=>getComputedStyle(el).backgroundColor),controls:children,avatar:rect?.toJSON()};
   });
   assert.ok(toolbar.grouped&&toolbar.label&&toolbar.searchText==='',JSON.stringify(toolbar));
   assert.equal(toolbar.background,'rgba(0, 0, 0, 0)');
   assert.ok(toolbar.groups.every(value=>value.startsWith('rgba(')));
   assert.ok(toolbar.controls.every(rect=>Math.abs(rect.width-rect.height)<.1&&Math.abs(rect.y-toolbar.controls[0].y)<.1),JSON.stringify({path,width,toolbar}));
   if(toolbar.avatar)assert.ok(Math.abs(toolbar.avatar.width-toolbar.avatar.height)<.1,JSON.stringify(toolbar.avatar));
   const avatarImage=await page.locator('.ncn-account-avatar img').evaluateAll(images=>images.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,fit:getComputedStyle(el).objectFit};}));
   assert.ok(avatarImage.every(rect=>Math.abs(rect.width-rect.height)<.1&&rect.fit==='cover'),JSON.stringify(avatarImage));
   await page.locator('#ncn-theme-toggle').click();
   assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');
   assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#ncn-topbar .ncn-topbar-left,#ncn-topbar .ncn-topbar-right')].every(el=>getComputedStyle(el).backgroundColor.startsWith('rgba('))));
   await page.locator('#ncn-theme-toggle').click();
   const art=await page.locator('#ncn-tool-grid .ncn-tool-art').first().evaluateAll(items=>items.map(el=>{const s=getComputedStyle(el,'::before');return {width:parseFloat(s.width),height:parseFloat(s.height)};}));
   assert.ok(art.every(rect=>Math.abs(rect.width-rect.height)<1),JSON.stringify({width,art}));
   if(width===390&&['/','/tin-tuc-cong-nghe/','/2024/02/kiem-quy.html'].includes(path)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+(path==='/'?'home':path.split('/').filter(Boolean).pop())+'-mobile.jpg',fullPage:true,type:'jpeg',quality:80});}

  }
  if(path==='/')assert.equal(await page.locator('#ncn-articles .ncn-article-card').count(),5);
  if(path==='/tin-tuc-cong-nghe/'){
   assert.equal(await page.locator('#ncn-library-results .ncn-article-card').count(),15);
   await page.locator('#ncn-library-next').click();assert.match(await page.locator('#ncn-library-page').innerText(),/^Trang 2/);
   assert.equal(await page.locator('#ncn-library-results .ncn-article-card').count(),15);
   await page.locator('#ncn-library-query').fill('không có kết quả kiểm tra 975');assert.equal(await page.locator('#ncn-library-results .ncn-empty').count(),1);
  }
  if(path==='/2024/02/kiem-quy.html'){
   assert.ok((await page.locator('#ncn-cash-app').boundingBox()).width<=440);
   await page.locator('#cq-qty-500000').fill('2');await page.locator('#cq-erp').fill('1000000');
   assert.match(await page.locator('#cq-actual').innerText(),/1.000.000/);assert.match(await page.locator('#cq-delta').innerText(),/^0/);
   await page.locator('#cq-qty-500000').pressSequentially('a.,-');assert.equal(await page.locator('#cq-qty-500000').inputValue(),'2');
   await page.emulateMedia({media:'print'});assert.equal(await page.locator('#ncn-site-shell').isVisible(),false);await page.emulateMedia({media:'screen'});
  }
  await page.locator('#ncn-topbar .ncn-top-search').click();await page.locator('#ncn-global-query').waitFor({state:'visible'});await page.keyboard.press('Escape');
  await page.locator('#ncn-menu-open').click();await page.locator('#ncn-sidebar').waitFor({state:'visible'});await page.keyboard.press('Escape');
  await page.emulateMedia({contrast:'more'});
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#ncn-topbar .ncn-topbar-left,#ncn-topbar .ncn-topbar-right')].every(el=>getComputedStyle(el).backgroundColor.startsWith('rgb(')&&getComputedStyle(el).backdropFilter==='none')));
  await page.emulateMedia({contrast:'no-preference'});
  await page.close();
 }
 if(process.env.NCN_COMPACT_SWEEP){
  async function htmls(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory())result.push(...await htmls(p));else if(item.name.endsWith('.html'))result.push(p);}return result;}
  const files=(await htmls('public')).filter(file=>process.env.NCN_COMPACT_SWEEP!=='labels'||file.startsWith('public/search/'));let n=0;
  for(const file of files){
   page=await ctx.newPage();let route='/'+file.slice(7);if(route==='/tin-tuc-cong-nghe/index.html')route='/tin-tuc-cong-nghe/';
   await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('body.ncn-scroll-ready');
   for(const width of [1280,390]){
    await page.setViewportSize({width,height:800});await paint();
    await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1000px';document.body.append(spacer);scrollTo(0,300);});await paint();
    const state=await page.evaluate(()=>{const bar=document.getElementById('ncn-topbar')||document.getElementById('ncn-game-topbar'),rect=bar?.getBoundingClientRect();return {hidden:document.body.classList.contains('ncn-chrome-hidden'),top:rect?.top,height:rect?.height,width:document.documentElement.scrollWidth,viewport:innerWidth};});
    assert.ok(!state.hidden&&state.top>=0&&state.height<=56&&state.width<=state.viewport+1,file+': '+JSON.stringify(state));
   }
   await page.close();console.log('PASS compact toolbar '+(++n)+'/'+files.length+': '+file.slice(7));
  }
 }
 console.log('PASS compact desktop layouts, five columns, natural long-page scrolling and persistent navigation');
}finally{await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));await ctx.close();await browser.close();}
