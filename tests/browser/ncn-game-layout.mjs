import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

// Real compiled game UIs on an isolated HTTPS fixture. Nothing can reach the
// production site, Identity, score store or photo uploads.
const origin='https://ncn-game-layout.test',root=resolve('dist');
const phase=process.env.NCN_GAME_LAYOUT_PHASE||'after',out=resolve('artifacts/game-layout');
const games=[
 ['ran-luot','#rl-stage','#rl-stage','#rl-start','#rl-fullscreen'],
 ['flappy-bird','#gameShell','#gameShell','#startButton','#fullscreenButton'],
 ['pikachu','#pk-app','.pk-board','#pk-start','#pk-fullscreen'],
 ['ca-lon-nuot-ca-be','#ff-stage','#ff-stage','#ff-start','#ff-fullscreen'],
 ['xep-hinh','#xh-app','#xh-board','#xh-start','#xh-fullscreen'],
 ['dao-vang','#gm-app','#gm-field','#gm-start','#gm-fullscreen'],
 ['ghep-khoi','#bn-app','#bn-board','#bn-start','#bn-fullscreen'],
 ['ban-bong','#bb-app','#bb-field','#bb-start','#bb-fullscreen']
];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
const profile={id:'layout-fixture',name:'Kiểm tra bố cục',avatar:'preset:🐱',member:false};
const browser=await chromium.launch(),results=[];
await mkdir(out,{recursive:true});
try{
 for(const [path,app,board,start,full]of games.filter(g=>!process.env.NCN_GAME_LAYOUT_FILTER||g[0]===process.env.NCN_GAME_LAYOUT_FILTER)){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-31T10:00:00Z')});
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   assert.equal(url.origin,origin,'External traffic is forbidden in the layout fixture');
   if(url.pathname.startsWith('/.netlify/')){
    const value=url.pathname.includes('ncn-scores')?{profile,items:[],total:0,you:null,nextCursor:null,runId:'fixture-run',improved:true,best:100}:url.pathname.includes('identity')?{disable_signup:false,external:{email:true}}:url.pathname.includes('announcements')?{items:[]}:{user:null,items:[],online:1,total:1};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   }
   try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(file===root||file.startsWith(root+sep));if((await stat(file)).isDirectory())file+='/index.html';return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{missing.push(url.pathname);return route.fulfill({status:404,body:'Not found'});}
  });
  try{
   await page.goto(origin+'/'+path+'/');await page.waitForFunction(()=>window.NCNAccount?.state.ready);await page.locator(start).waitFor();
   const samples=[];
   for(const [width,height]of [[320,568],[390,844],[820,900],[1024,768],[1280,800],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});await page.clock.runFor(150);
    const sample=await page.evaluate(({app,board})=>{const r=selector=>{const el=document.querySelector(selector),b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,desktop:matchMedia('(min-width:1024px)').matches,columns:getComputedStyle(document.querySelector(app)).gridTemplateColumns,app:r(app),board:r(board)};},{app,board});
    assert.ok(sample.scrollWidth<=width+1,path+' horizontal overflow: '+JSON.stringify(sample));
    assert.ok(sample.board.width>100&&sample.board.height>120,path+' board collapsed');
    samples.push(sample);
   }
   await page.setViewportSize({width:1440,height:900});await page.clock.runFor(150);
   await page.locator(start).click();await page.clock.runFor(150);
   assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0,path+' fixture profile must start immediately');
   // Pausing prevents the fixture from losing a run while checking controls.
   await page.keyboard.press('p');await page.clock.runFor(100);
   const fullscreens=[];
   for(const [width,height]of [[1024,650],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});await page.clock.runFor(150);await page.locator(full).click();await page.clock.runFor(200);
    const immersive=await page.evaluate(({app,board})=>{const element=document.querySelector(app),canvas=document.querySelector(board),r=canvas.getBoundingClientRect();return {native:!!document.fullscreenElement,classes:element.className,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:{width:innerWidth,height:innerHeight},horizontalScrollers:[...element.querySelectorAll('*')].filter(e=>e.clientWidth>0&&e.getClientRects().length&&e.scrollWidth>e.clientWidth+2&&['auto','scroll'].includes(getComputedStyle(e).overflowX)).map(e=>({id:e.id,classes:e.className,client:e.clientWidth,scroll:e.scrollWidth})),controls:[...element.querySelectorAll('.bb-controls button,.pk-assists button')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()}))};},{app,board});
    assert.ok(immersive.native||/immersive|is-theater/.test(immersive.classes),path+' fullscreen did not open');
    assert.ok(immersive.left>=-1&&immersive.right<=width+1&&immersive.top>=-1&&immersive.bottom<=height+1,path+' fullscreen board clipped: '+JSON.stringify(immersive));
    for(const control of immersive.controls)assert.ok(control.top>=0&&control.bottom<=height&&control.left>=0&&control.right<=width,path+' fullscreen action clipped: '+JSON.stringify(control));
    assert.deepEqual(immersive.horizontalScrollers,[],path+' fullscreen contains an accidental horizontal scrollbar');
    fullscreens.push(immersive);
    // Some native fullscreen games contain only the board; their external
    // toggle is unavailable. Exit through the browser's actual fullscreen API.
    if(immersive.native)await page.evaluate(()=>document.exitFullscreen());else await page.locator(full).click();
    await page.clock.runFor(200);
   }
   await page.setViewportSize({width:1440,height:900});await page.clock.runFor(150);await page.locator(board).scrollIntoViewIfNeeded();
   if(phase==='after'){
    const desktop=samples.filter(s=>s.width>=1024);
    for(const s of desktop){
     if(['ran-luot','flappy-bird','ca-lon-nuot-ca-be'].includes(path))assert.ok(s.board.width>=s.width*.82&&s.board.height>=600,path+' desktop arena is too small: '+JSON.stringify(s));
     if(path==='xep-hinh')assert.ok(s.board.width>=320&&s.board.height>=640,path+' desktop blocks are too small: '+JSON.stringify(s));
     if(path==='dao-vang')assert.ok(s.board.width>=Math.min(920,s.width*.8),path+' desktop mine is too small: '+JSON.stringify(s));
     if(path==='ghep-khoi')assert.ok(s.board.width>=Math.min(620,s.width*.58),path+' desktop grid is too small: '+JSON.stringify(s));
     if(path==='ban-bong')assert.ok(s.board.width>=Math.min(570,s.width*.48),path+' desktop eggs are too small: '+JSON.stringify(s));
     if(path==='pikachu')assert.ok(s.board.width>=Math.min(1050,s.width*.68),path+' desktop tiles are too small: '+JSON.stringify(s));
    }
   }
   assert.deepEqual(errors,[],path+' browser errors');assert.deepEqual(missing,[],path+' missing local resources');
   if(['ban-bong','xep-hinh','ghep-khoi'].includes(path))await page.screenshot({path:out+'/'+phase+'-'+path+'.jpg',type:'jpeg',quality:85});
   results.push({path,samples,immersive:fullscreens[1],fullscreens,errors,missing});console.log('PASS '+path+' · 7 viewport sizes + 3 actual fullscreen sizes');
  }catch(error){await page.screenshot({path:out+'/failure-'+path+'.jpg',type:'jpeg',quality:85}).catch(()=>{});throw error;}
  finally{await ctx.close();}
 }
}finally{await writeFile(out+'/'+phase+'.json',JSON.stringify(results,null,2));await browser.close();}
