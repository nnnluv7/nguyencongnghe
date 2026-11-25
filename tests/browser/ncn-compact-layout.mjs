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
   // Mount the real member form after first paint, without a live account or writes.
   if(/\/ncn-(?:event|gvgs)$/.test(url.pathname)&&url.searchParams.get('route')==='app')return json({user:{id:'layout-guest',guest:true},trial:{limit:3,remaining:3},html:await read('netlify/lib/'+(url.pathname.endsWith('ncn-gvgs')?'ncn-gvgs-private':'ncn-event-private')+'/vip.html'),scripts:{core:'',ui:''}});
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
async function geometry(p,label){
 const g=await p.evaluate(()=>{
  const outer=document.getElementById('outer-wrapper'),o=outer.getBoundingClientRect(),s=getComputedStyle(outer),bar=document.getElementById('ncn-topbar').getBoundingClientRect(),footer=document.getElementById('ncn-footer')?.getBoundingClientRect(),notice=document.getElementById('ncn-announcement');
  const left=o.left+parseFloat(s.paddingLeft),right=o.right-parseFloat(s.paddingRight);
  const filters=[...document.querySelectorAll('#ncn-home-filters,.st-tabs')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect(),buttons=[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>b.getBoundingClientRect());return {x:r.x,right:r.right,width:r.width,inside:buttons.every(b=>b.left>=r.left+3&&b.right<=r.right-3&&b.top>=r.top+3&&b.bottom<=r.bottom-3),overlap:buttons.some((b,i)=>buttons.some((c,j)=>i!==j&&b.left<c.right-1&&b.right>c.left+1&&b.top<c.bottom-1&&b.bottom>c.top+1))};});
  const groups=[...document.querySelectorAll('#ncn-topbar .ncn-topbar-left,#ncn-topbar .ncn-topbar-right')].map(el=>el.getBoundingClientRect().toJSON());
  return {outer:o.toJSON(),left,right,bar:bar.toJSON(),groups,footer:footer?.toJSON(),notice:notice?.hidden?null:notice?.getBoundingClientRect().toJSON(),viewport:document.documentElement.clientWidth,mobile:matchMedia('(max-width:620px)').matches,filters};
 });
 assert.ok(Math.abs(g.bar.left-g.left)<1&&Math.abs(g.bar.right-g.right)<1,label+' toolbar edges '+JSON.stringify(g));
 if(g.footer)assert.ok(Math.abs(g.footer.left-g.left)<1&&Math.abs(g.footer.right-g.right)<1,label+' footer edges '+JSON.stringify(g));
 if(g.notice){
  if(g.mobile)assert.ok(Math.abs(g.notice.left-g.left)<1&&Math.abs(g.notice.right-g.right)<1&&g.notice.top>=g.bar.bottom+3,label+' mobile ticker row '+JSON.stringify(g));
  else assert.ok(g.notice.left>=g.groups[0].right+9&&g.notice.right<=g.groups[1].left-9&&Math.abs((g.notice.top+g.notice.bottom)-(g.bar.top+g.bar.bottom))<1,label+' ticker between toolbar groups '+JSON.stringify(g));
 }
 assert.ok(Math.abs(g.left-(g.viewport-g.right))<1,label+' equal side margins '+JSON.stringify(g));
 assert.ok(g.filters.every(f=>f.inside&&!f.overlap),label+' filter insets '+JSON.stringify(g));
 return g;
}
async function menuGeometry(p,label,scale=1){
 await p.locator('#ncn-menu-open').click();
 await p.waitForFunction(()=>getComputedStyle(document.getElementById('ncn-sidebar')).opacity==='1');
 const m=await p.locator('#ncn-sidebar').evaluate(panel=>{
  const r=panel.getBoundingClientRect(),bar=document.getElementById('ncn-topbar').getBoundingClientRect(),logo=panel.querySelector('.ncn-brand-image'),l=logo.getBoundingClientRect(),close=panel.querySelector('#ncn-menu-close').getBoundingClientRect(),nav=panel.querySelector('#ncn-navigation'),n=nav.getBoundingClientRect(),footer=panel.querySelector('.ncn-admin-card').getBoundingClientRect();
  return {x:r.x,barX:bar.x,width:r.width,top:r.top,bottom:r.bottom,viewport:innerHeight,logo:{width:l.width,height:l.height,radius:getComputedStyle(logo).borderRadius},close:close.width,nav:{width:n.width,height:n.height,scroll:nav.scrollHeight,footer:footer.top,bottom:n.bottom},links:[...nav.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect(),s=getComputedStyle(a);return {left:r.left,right:r.right,height:r.height,font:parseFloat(s.fontSize),overflow:a.scrollWidth>a.clientWidth+1};})};
 });
 assert.ok(Math.abs(m.x-m.barX)<1&&m.width/scale<=289&&m.top>=0&&m.bottom<=m.viewport+1,label+' menu edge '+JSON.stringify(m));
 assert.ok(m.logo.width===m.logo.height&&m.logo.width===m.close&&m.logo.radius==='50%',label+' round menu logo '+JSON.stringify(m));
 assert.ok(m.nav.height>40&&m.nav.bottom<=m.nav.footer+1&&m.nav.scroll>m.nav.height,label+' independently scrollable menu '+JSON.stringify(m));
 assert.ok(m.links.every(a=>a.height/scale>=39.9&&a.height/scale<=62&&!a.overflow&&a.font===13),label+' compact menu links '+JSON.stringify(m));
 if(label==='/ 1366'||label==='/ 390'){
  await p.screenshot({path:out+'/menu-'+label.split(' ')[1]+'-light.jpg',type:'jpeg',quality:85});
  await p.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');
  await p.waitForFunction(()=>getComputedStyle(document.querySelector('#ncn-navigation a')).color===getComputedStyle(document.getElementById('ncn-sidebar')).color);
  await p.screenshot({path:out+'/menu-'+label.split(' ')[1]+'-dark.jpg',type:'jpeg',quality:85});
  await p.evaluate(()=>document.documentElement.dataset.ncnTheme='light');
 }
 await p.keyboard.press('Escape');
 assert.equal(await p.locator('#ncn-menu-open').getAttribute('aria-expanded'),'false');
 assert.equal(await p.evaluate(()=>document.activeElement?.id),'ncn-menu-open');
}
async function typography(p,label,width){
 const actual=await p.evaluate(()=>{
  const visible=selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>({tag:el.tagName,selector:el.id||el.className,font:parseFloat(getComputedStyle(el).fontSize)}));
  return {title:visible('#ncn-home-latest h1,#ncn-tools .ncn-section-heading h2,#ncn-library .ncn-library-heading h1,.st-hero h2,.ncn-tool-heading h2,#ncn-audio-app h1,#ncn-cash-fund-app h1,#ncn-fifo-app h1,#ncn-wheel-app h1,#ncn-billing-app h1,#ncn-cash-app .cq-hero h2,#vip-gate h2,#ncn-event-app .ev-heading h2,.ncn-arcade-hero h1'),input:visible('#cq-erp,#cq-qty-500000,#ncn-audio-app input:not([type=checkbox]),#ncn-cash-fund-app input,#ncn-cash-fund-app select,#ncn-insurance-app input[type=text],#ncn-insurance-app select,#ncn-qr-app input[type=text],#ncn-event-app .ev-field select,.st-search input'),card:visible('#ncn-tool-grid h3,.ncn-article-card h3,.st-card strong'),label:visible('#ncn-audio-app label,#ncn-cash-fund-app label,#ncn-event-app .ev-field')};
 });
 for(const [role,expected] of [['title',width<=620?21:22],['input',width<=900?16:14],['card',14],['label',13]])assert.ok(actual[role].every(el=>el.font===expected),label+' '+role+' expected '+expected+': '+JSON.stringify(actual[role]));
}
const ctx=await context(),metrics=[];
const paint=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const targets=['/','/popup-a7/','/sticker/','/ban-hang/','/trang-tri/','/tin-tuc-cong-nghe/','/arcade/','/2024/02/kiem-quy.html','/2025/05/tu-van.html','/tien-quy-sieu-thi/','/2024/04/qrcode-generator-tao-ma-qrcode.html','/2024/01/ban-kiem-ke-san-pham-theo-file-excel.html','/2024/01/in-fifo.html','/thu-audio/','/vong-quay-may-man/','/donate/','/in-event/','/in-gvgs/'];
try{
 for(const path of targets.filter(path=>!process.env.NCN_COMPACT_PATH||path===process.env.NCN_COMPACT_PATH)){
  page=await ctx.newPage();await page.setViewportSize({width:1366,height:768});await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('body.ncn-scroll-ready');await page.waitForFunction(()=>window.NCNAccount?.state.ready);assert.equal(await page.locator('#ncn-toolbar-clock').count(),0);
  if(path==='/arcade/')await page.waitForSelector('.ncn-arcade-card');else if(['/popup-a7/','/sticker/','/ban-hang/','/trang-tri/'].includes(path))await page.waitForSelector('.st-card');
  if(['/in-event/','/in-gvgs/'].includes(path))await page.waitForSelector('#vip-app #ncn-event-app');
  if(path==='/sticker/')await page.locator('#st-groups [data-group=all]').click();
  await page.evaluate(()=>document.fonts.ready);await paint();
  const info=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewport:innerHeight,
   columns:[...document.querySelectorAll('#ncn-tool-grid,#ncn-articles,#ncn-featured-results,#ncn-library-results,.st-cards,.ncn-arcade-grid')].filter(el=>el.getClientRects().length).map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),
   cards:document.querySelectorAll('.st-card').length,cardWidths:[...document.querySelectorAll('#ncn-articles,#ncn-tool-grid,#ncn-featured-results,#ncn-library-results,.st-cards')].filter(el=>el.getClientRects().length&&el.firstElementChild).map(el=>el.firstElementChild.getBoundingClientRect().width),bar:document.getElementById('ncn-topbar').getBoundingClientRect().toJSON()}));
  await geometry(page,path);metrics.push({path,...info});console.log(JSON.stringify({path,...info}));
  assert.ok(info.columns.every(n=>n===5),JSON.stringify(info));assert.ok(info.cardWidths.every(width=>Math.abs(width-(1040-48-48)/5)<1),JSON.stringify(info));assert.ok(info.bar.height<=54);assert.ok(info.width<=1366);
  if(['/', '/popup-a7/','/sticker/','/tin-tuc-cong-nghe/'].includes(path))await page.screenshot({path:out+'/'+(path==='/'?'home':path.split('/')[1])+'.jpg',fullPage:true,type:'jpeg',quality:80});
  await page.evaluate(()=>{const spacer=document.createElement('div');spacer.id='test-scroll-spacer';spacer.style.height='1800px';document.body.append(spacer);scrollTo(0,500);});await paint();
  const fixed=await page.locator('#ncn-topbar').boundingBox();assert.ok(Math.abs(fixed.y-info.bar.y)<1);assert.equal(await page.locator('body.ncn-chrome-hidden').count(),0);await page.evaluate(()=>document.getElementById('test-scroll-spacer')?.remove());
  await page.evaluate(()=>{const avatar=document.querySelector('.ncn-account-avatar');if(avatar)avatar.replaceChildren(Object.assign(document.createElement('img'),{src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="skyblue"/></svg>'),alt:'Ảnh thử tỷ lệ'}));});
  for(const width of [1920,1366,1024,1023,901,900,768,621,620,390,360,320]){
   await page.setViewportSize({width,height:844});await paint();await geometry(page,path+' '+width);
   await typography(page,path+' '+width,width);
   if([1366,900,390,320].includes(width))await menuGeometry(page,path+' '+width);
   const mobile=await page.evaluate(()=>{const bar=document.getElementById('ncn-topbar').getBoundingClientRect(),controls=[...document.querySelectorAll('#ncn-menu-open,#ncn-topbar .ncn-brand-image,#ncn-topbar .ncn-top-search,#ncn-theme-toggle,#ncn-topbar .ncn-account-menu summary')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON()).sort((a,b)=>a.left-b.left);return {width:document.documentElement.scrollWidth,height:bar.height,inside:controls.every(r=>r.left>=bar.left&&r.right<=bar.right),overlap:controls.some((r,i)=>i&&r.left<controls[i-1].right-1)};});
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
   const round=await page.locator('#ncn-menu-open,#ncn-topbar .ncn-brand-image').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {width:r.width,height:r.height,radius:s.borderRadius,text:node.textContent.trim()};}));
   assert.equal(round.length,2);assert.equal(round[0].text,'');assert.ok(round.every(rect=>Math.abs(rect.width-rect.height)<.1&&Math.abs(rect.width-toolbar.controls[0].width)<.1&&rect.radius==='50%'),JSON.stringify({width,round,toolbar}));
   if(toolbar.avatar)assert.ok(Math.abs(toolbar.avatar.width-toolbar.avatar.height)<.1,JSON.stringify(toolbar.avatar));
   const avatarImage=await page.locator('.ncn-account-avatar img').evaluateAll(images=>images.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,fit:getComputedStyle(el).objectFit};}));
   assert.ok(avatarImage.every(rect=>Math.abs(rect.width-rect.height)<.1&&rect.fit==='cover'),JSON.stringify(avatarImage));
   await page.locator('#ncn-theme-toggle').click();
   assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');
   assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#ncn-topbar .ncn-topbar-left,#ncn-topbar .ncn-topbar-right')].every(el=>getComputedStyle(el).backgroundColor.startsWith('rgba('))));
   await page.locator('#ncn-theme-toggle').click();
   const art=await page.locator('#ncn-tool-grid .ncn-tool-art').first().evaluateAll(items=>items.map(el=>{const s=getComputedStyle(el,'::before');return {width:parseFloat(s.width),height:parseFloat(s.height)};}));
   assert.ok(art.every(rect=>Math.abs(rect.width-rect.height)<1),JSON.stringify({width,art}));
   if(width===390&&['/','/sticker/','/tin-tuc-cong-nghe/','/2024/02/kiem-quy.html'].includes(path)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+(path==='/'?'home':path.split('/').filter(Boolean).pop())+'-mobile.jpg',fullPage:true,type:'jpeg',quality:80});}

  }
  if(['/sticker/','/popup-a7/','/ban-hang/','/trang-tri/'].includes(path)){
   for(const width of [1366,390,320]){
    await page.setViewportSize({width,height:844});await paint();
    const sizes=await page.locator('.st-card-sizes').evaluateAll(groups=>groups.filter(group=>group.getClientRects().length).map(group=>{const parent=group.getBoundingClientRect();return {width:parent.width,buttons:[...group.querySelectorAll('button')].map(el=>{const rect=el.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,inside:rect.left>=parent.left-1&&rect.right<=parent.right+1,overflow:el.scrollWidth>el.clientWidth};})};}));
    for(const group of sizes){assert.ok(group.buttons.length);group.buttons.forEach((button,i)=>{assert.ok(button.inside&&!button.overflow&&Math.abs(button.width-group.width)<1&&button.width>button.height,JSON.stringify({path,width,group}));if(i)assert.ok(button.y>=group.buttons[i-1].y+group.buttons[i-1].height+4,JSON.stringify(group));});}
   }
  }
  if(path==='/'){
   await page.setViewportSize({width:1280,height:900});
   await page.addStyleTag({content:'html{overflow-y:scroll;scrollbar-gutter:stable both-edges}'});await paint();await geometry(page,'classic scrollbar');
   await page.evaluate(()=>document.documentElement.style.zoom='1.25');await paint();
   const zoom=await page.evaluate(()=>{const bar=document.getElementById('ncn-topbar').getBoundingClientRect(),footer=document.getElementById('ncn-footer').getBoundingClientRect();return {left:bar.left,right:bar.right,footerLeft:footer.left,footerRight:footer.right};});
   assert.ok(Math.abs(zoom.left-zoom.footerLeft)<1&&Math.abs(zoom.right-zoom.footerRight)<1,'zoomed edges '+JSON.stringify(zoom));
   await menuGeometry(page,'125% zoomed menu',1.25);
   await page.evaluate(()=>document.documentElement.style.zoom='');
   const notices=state.notices;
   async function updateNotices(items){state.notices=items;await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/ncn-announcements')),page.evaluate(()=>dispatchEvent(new Event('ncn-announcements-changed')))]);await paint();}
   for(const width of [1280,390]){
    await page.setViewportSize({width,height:844});await paint();
    await updateNotices([]);assert.equal(await page.locator('#ncn-announcement').isVisible(),false);assert.equal(await page.locator('body.ncn-has-announcements').count(),0);
    const empty=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ncn-chrome-space')));
    await updateNotices([{text:'   '}]);assert.equal(await page.locator('#ncn-announcement').isVisible(),false);
    await updateNotices([{text:'Thông báo kiểm tra'}]);assert.equal(await page.locator('#ncn-announcement').isVisible(),true);await geometry(page,'notice reappeared '+width);
    const shown=await page.locator('#ncn-announcement').evaluate(el=>{const s=getComputedStyle(el),fade=getComputedStyle(el,'::before');return {font:parseFloat(s.fontSize),border:s.borderTopWidth,mask:fade.maskImage,space:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ncn-chrome-space'))};});
    assert.equal(shown.font,14);assert.equal(shown.border,'0px');assert.match(shown.mask,/linear-gradient/);assert.ok(Math.abs(shown.space-empty-(width<=620?36:0))<1,JSON.stringify(shown));
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/announcement-'+width+'.jpg',type:'jpeg',quality:85});
    const account=page.locator('#ncn-topbar .ncn-account-menu>summary');await account.click();
    assert.ok(await page.locator('.ncn-account-dropdown').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+20,r.top+15);return el.contains(hit);}), 'Account dropdown must remain above the mobile ticker');await account.click();
    await page.locator('#ncn-announcement-pause').click();assert.equal(await page.locator('#ncn-announcement-pause').getAttribute('aria-pressed'),'true');await page.locator('#ncn-announcement-pause').click();
   }
   await page.setViewportSize({width:1280,height:900});await updateNotices([]);await page.evaluate(()=>scrollTo(0,0));await paint();
   const first=await page.evaluate(()=>({heading:document.querySelector('#ncn-home-latest h1').getBoundingClientRect().top,bar:document.getElementById('ncn-topbar').getBoundingClientRect().bottom}));assert.ok(first.heading>=first.bar+8,JSON.stringify(first));
   await updateNotices(notices);
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
    await page.setViewportSize({width,height:800});await paint();await geometry(page,route+' '+width);
    await menuGeometry(page,route+' '+width);
    await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1000px';document.body.append(spacer);scrollTo(0,300);});await paint();
    const state=await page.evaluate(()=>{const bar=document.getElementById('ncn-topbar')||document.getElementById('ncn-game-topbar'),rect=bar?.getBoundingClientRect();return {hidden:document.body.classList.contains('ncn-chrome-hidden'),top:rect?.top,height:rect?.height,width:document.documentElement.scrollWidth,viewport:innerWidth};});
    assert.ok(!state.hidden&&state.top>=0&&state.height<=56&&state.width<=state.viewport+1,file+': '+JSON.stringify(state));
   }
   await page.close();console.log('PASS compact toolbar '+(++n)+'/'+files.length+': '+file.slice(7));
  }
 }
 console.log('PASS compact desktop layouts, five columns, natural long-page scrolling and persistent navigation');
}finally{await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));await ctx.close();await browser.close();}
