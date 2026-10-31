import {chromium,webkit,devices} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {SPECIES,VERSION,LEVELS,findMatch,removePair} from '../../public/pikachu/core.js';
import {arcadeEngineFixture} from '../fixtures/arcade-store.mjs';

// Actual Chromium/WebKit renderers with touch and Retina viewports. All profile,
// score and account requests stay in this synthetic origin, never production.
const engine=process.env.NCN_BROWSER||'chromium',built=!!process.env.NCN_BUILT_TEST;
const browser=await (engine==='webkit'?webkit:chromium).launch();
const origin='https://ncn-pikachu-art.test',root=resolve(built?'dist':'public');
const out=resolve('artifacts/pikachu-art-browser/'+engine+(built?'-built':''));await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
const results=[],errors=[];let context,page,requests,blockedArt=false,delayArt=0;
const seedBoard=()=>({rows:10,cols:8,cells:Array.from({length:80},(_,i)=>Math.floor(i/2)%SPECIES.length+1)});
const save=(level=0,board=seedBoard())=>({version:VERSION,mode:'classic',date:'2026-10-31',level,score:0,time:360,hints:3,shuffles:3,board});
async function fixture({viewport={width:390,height:844},reduced=false,level=0}={}){
 await context?.close();requests=[];
 context=await browser.newContext({...devices['iPhone 13 Pro Max'],viewport,reducedMotion:reduced?'reduce':'no-preference'});
 await context.addInitScript(({save,reduced})=>{if(!localStorage.getItem('ncn-pikachu-save-v1'))localStorage.setItem('ncn-pikachu-save-v1',JSON.stringify(save));localStorage.setItem('ncn-pikachu-prefs-v1',JSON.stringify({sound:false,reduced}));Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});},{save:save(level),reduced});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin,'External traffic is forbidden');requests.push({path:url.pathname,method:req.method()});
  if(url.pathname.startsWith('/.netlify/')){const json=url.pathname.endsWith('ncn-scores')?arcadeEngineFixture(url):url.pathname.includes('identity')?{disable_signup:false,external:{email:true}}:url.pathname.endsWith('ncn-billing')?{user:null}:{items:[],online:1,total:1};return route.fulfill({contentType:'application/json',body:JSON.stringify(json)});}
  if(url.pathname.startsWith('/pikachu/art/')){if(blockedArt)return route.fulfill({status:503,body:'Fixture image unavailable'});if(delayArt)await new Promise(done=>setTimeout(done,delayArt));}
  try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(file===root||file.startsWith(root+sep));if((await stat(file)).isDirectory())file+='/index.html';return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Not found'});}
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/pikachu/');await page.waitForFunction(()=>window.NCNAccount?.state.ready);await page.locator('#pk-continue').waitFor();
}
async function begin({full=false,art=true}={}){
 if(full)await page.locator('#pk-fullscreen').tap();
 await page.locator('#pk-continue').tap();await page.locator('#pk-app[data-state=playing]').waitFor();
 if(art)await page.locator('#pk-board[data-art=ready]').waitFor();
 await page.locator('#pk-board').scrollIntoViewIfNeeded();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
}
async function refs(){await page.evaluate(()=>{window.__pkArtNodes=[...document.querySelectorAll('.pk-tile')].map(el=>[el,el.firstElementChild]);});}
async function stable(){assert.ok(await page.evaluate(()=>window.__pkArtNodes.every(([tile,art],i)=>tile===document.querySelector('[data-index="'+i+'"]')&&art===tile.firstElementChild)),'Matching/gravity replaced existing tile or art nodes');}
async function values(){return page.locator('.pk-tile').evaluateAll(els=>els.map(el=>Number(el.dataset.type)));}
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+engine+' '+name);}catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.png'}).catch(()=>{});throw error;}};
const shot=()=>page.screenshot({scale:'css',animations:'allow'});
async function crop(png,rect){return sharp(png).extract({left:Math.ceil(rect.x)+2,top:Math.ceil(rect.y)+2,width:Math.floor(rect.width)-4,height:Math.floor(rect.height)-4}).ensureAlpha().raw().toBuffer();}
async function noFlash(full){
 await fixture();await begin({full});await refs();
 await page.locator('[data-index="0"]').tap();
 const sentinels=await page.locator('[data-index="40"],[data-index="20"]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
 assert.ok(sentinels.every(r=>r.top>=0&&r.bottom<=844),'Sentinel pictures must be visible without screenshot scrolling');
 const before=await shot(),reference=await Promise.all(sentinels.map(r=>crop(before,r)));
 for(const pixels of reference){let ink=0;for(let k=0;k<pixels.length;k+=4)if(pixels[k]<210||pixels[k+1]<190||pixels[k+2]<160)ink++;assert.ok(ink>50,'Baseline must contain an actual painted character, not a blank tile');}
 const warmArtCount=requests.filter(r=>r.path.startsWith('/pikachu/art/')).length;
 await page.locator('[data-index="1"]').tap();
 // Capture actual paint frames through the pair fade AND the subsequent board
 // update. One sentinel shares Pikachu's texture, the other is another species.
 for(let frame=0;frame<10;frame++){
  const png=await shot();
  for(let j=0;j<sentinels.length;j++){
   const pixels=await crop(png,sentinels[j]),old=reference[j];let changed=0;
   assert.equal(pixels.length,old.length);
   for(let k=0;k<pixels.length;k+=4)if(Math.max(Math.abs(pixels[k]-old[k]),Math.abs(pixels[k+1]-old[k+1]),Math.abs(pixels[k+2]-old[k+2]))>18)changed++;
   assert.ok(changed/(pixels.length/4)<.02,'Unaffected character flashed/repainted: frame '+frame+', sentinel '+j+', changed pixels '+changed);
  }
  await stable();
 }
 await page.waitForFunction(()=>document.querySelector('[data-index="0"]').dataset.type==='0');
 assert.equal((await values()).filter(Boolean).length,78);await stable();
 const artRequests=requests.filter(r=>r.path.startsWith('/pikachu/art/'));
 assert.equal(new Set(artRequests.map(r=>r.path)).size,1,'All characters must share one texture URL');
 assert.equal(artRequests.length,warmArtCount,'A match must not request the texture again');
 assert.equal(await page.locator('#pk-board use').count(),0,'No external SVG use trees on the board');
 assert.ok(await page.locator('#pk-board').evaluate(el=>[...el.querySelectorAll('.pk-tile,.pk-tile-art,.pk-path-glow')].every(tile=>getComputedStyle(tile).filter==='none')),'Tile/path SVG filter introduced an iPhone repaint dependency');
 await page.screenshot({path:out+(full?'/iphone-fullscreen.png':'/iphone-normal.png'),scale:'css'});
}
try{
 await check('touch matching keeps every other character painted, in the normal iPhone page',()=>noFlash(false));
 await check('touch matching keeps every other character painted, in fitted iPhone fullscreen',()=>noFlash(true));
 await check('all twenty full-body characters share a sharp Retina texture and no remote sprite service',async()=>{
  const css=await readFile('public/pikachu/tile-art.css','utf8'),path=css.match(/url\("([^"]+)"/)[1],meta=await sharp(await readFile('public'+path)).metadata();
  assert.equal(meta.width,1280);assert.equal(meta.height,1024);
  const board=await page.locator('#pk-board').evaluate(el=>[...el.querySelectorAll('.pk-tile')].filter(x=>Number(x.dataset.type)).map(x=>({type:Number(x.dataset.type),position:x.firstElementChild.style.backgroundPosition,width:x.getBoundingClientRect().width,dpr:devicePixelRatio})));
  assert.equal(new Set(board.map(x=>x.type)).size,20);
  for(const t of board){assert.ok(t.width*t.dpr<=256,'Texture is too small for this Retina tile');assert.ok(t.position.length>0);}
  assert.ok(requests.every(r=>!r.path.endsWith('/tiles.svg')));
 });
 await check('gravity, hints and shuffling reuse tile nodes and preserve the actual saved board',async()=>{
  await fixture({level:1});await begin({full:true});await refs();
  let board={rows:10,cols:8,cells:await values()};
  for(let n=0;n<8;n++){
   const pair=findMatch(board);assert.ok(pair);board=removePair(board,pair.first,pair.second,LEVELS[1].gravity);
   await page.locator('[data-index="'+pair.first+'"]').tap();await page.locator('[data-index="'+pair.second+'"]').tap();
   await page.waitForFunction(expected=>document.getElementById('pk-board').querySelectorAll('.is-matched').length===0&&JSON.stringify([...document.querySelectorAll('.pk-tile')].map(x=>Number(x.dataset.type)))===JSON.stringify(expected),board.cells);
   assert.deepEqual(await values(),board.cells);await stable();
  }
  await page.locator('#pk-hint').tap();await stable();await page.locator('#pk-shuffle').tap();await stable();
  const before=await values();await page.keyboard.press('p');await page.reload();await page.locator('#pk-continue').tap();await page.locator('#pk-app[data-state=playing]').waitFor();await page.locator('#pk-board[data-art=ready]').waitFor();assert.deepEqual(await values(),before);
 });
 await check('rotation, dark mode and reduced motion keep the images and controls usable',async()=>{
  await fixture({reduced:true});await begin({full:true});await refs();const before=await values();
  for(const [width,height]of [[844,390],[320,568],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForFunction(()=>{const b=document.getElementById('pk-board').getBoundingClientRect(),h=document.querySelector('.pk-board-holder').getBoundingClientRect();return b.width<=h.width+1&&b.height<=h.height+1;});
   assert.deepEqual(await values(),before);await stable();
   const clip=await page.locator('#pk-fullscreen').boundingBox();assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=width&&clip.y+clip.height<=height);
  }
  await page.locator('#pk-fullscreen').tap();await page.keyboard.press('Home');await page.locator('#ncn-theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');
  await page.locator('#pk-fullscreen').tap();if(await page.locator('#pk-app').getAttribute('data-state')==='paused')await page.locator('#pk-start').tap();await page.locator('[data-index="0"]').tap();await page.locator('[data-index="1"]').tap();await page.waitForFunction(()=>document.querySelector('[data-index="0"]').dataset.type==='0');await stable();
 });
 await check('an unavailable texture still has readable matching labels and never blocks play',async()=>{
  blockedArt=true;await fixture();await begin({art:false});await page.locator('#pk-board[data-art=fallback]').waitFor();
  assert.equal(await page.locator('[data-index="0"] .pk-tile-label').innerText(),'Pikachu');
  assert.equal(await page.locator('[data-index="0"] .pk-tile-label').isVisible(),true);
  await page.locator('[data-index="0"]').tap();await page.locator('[data-index="1"]').tap();await page.waitForFunction(()=>document.querySelector('[data-index="0"]').dataset.type==='0');blockedArt=false;
 });
 await check('no browser errors or production writes',async()=>assert.deepEqual(errors,[]));
}finally{await writeFile(out+'/results.json',JSON.stringify({engine,version:browser.version(),built,results},null,2));await context?.close();await browser.close();}
