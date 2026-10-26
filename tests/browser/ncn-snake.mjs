import {arcadeEngineFixture} from '../fixtures/arcade-store.mjs';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';

const root=resolve('public'),out=resolve('artifacts/snake'),seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),catalog=publicCatalog(seed),results=[],errors=[];
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
let requests=[];
const server=createServer(async(req,res)=>{
 try{
  requests.push({url:req.url,method:req.method});const u=new URL(req.url,'http://localhost');
  const json=data=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(u.pathname.endsWith('/.netlify/functions/ncn-scores'))return json(arcadeEngineFixture(u));if(u.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
  if(u.pathname.startsWith('/.netlify/functions/'))return json(u.pathname.endsWith('ncn-library')?{items:catalog}:u.pathname.endsWith('ncn-billing')?{user:null}:u.pathname.endsWith('ncn-announcements')?{items:[{id:'test',text:'Chào mừng đến với NCN Arcade'}]}:{total:1,online:1});
  let path=resolve(root,'.'+decodeURIComponent(u.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Invalid path');if((await stat(path)).isDirectory())path+='/index.html';
  let body=await readFile(path);if(path.endsWith('.html'))body=renderPublicHTML(body.toString(),catalog,{notices:[{id:'test',text:'Chào mừng đến với NCN Arcade'}]});res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1050}});let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(e){results.push({name,ok:false,error:e.message});await page.screenshot({path:out+'/failure-'+results.length+'.jpg',fullPage:true}).catch(()=>{});throw e;}};
const screenshot=async name=>page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:86,fullPage:true});
const state=()=>page.locator('#rl-stage').getAttribute('data-state');
try{
 await page.clock.install({time:new Date('2026-10-25T13:00:00Z')});await page.addInitScript(()=>{Math.random=()=>.31415926535;});await page.goto(base+'/ran-luot/');await page.clock.runFor(150);
 await check('welcome fits desktop, tablet and small phones with no overflow or covered start controls',async()=>{
  for(const width of [1440,1280,820,640,390,360,320]){
   await page.setViewportSize({width,height:width<640?844:1050});await page.clock.runFor(120);
   const geometry=await page.evaluate(()=>{const s=document.getElementById('rl-stage').getBoundingClientRect(),start=document.getElementById('rl-start').getBoundingClientRect(),daily=document.getElementById('rl-daily').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,w:innerWidth,s:s.toJSON(),start:start.toJSON(),daily:daily.toJSON()};});
   assert.ok(geometry.scroll<=width+1,JSON.stringify(geometry));assert.ok(geometry.start.left>=geometry.s.left&&geometry.start.right<=geometry.s.right);assert.ok(geometry.daily.bottom<geometry.s.bottom&&geometry.start.top>geometry.s.top,JSON.stringify(geometry));
   if(width===1440)await screenshot('welcome-desktop');if(width===390)await screenshot('welcome-phone');
  }
 });
 await page.setViewportSize({width:1440,height:1050});await page.clock.runFor(100);
 await check('mouse movement earns real points, boost uses energy, phase works and pause freezes timers',async()=>{
  await page.locator('#rl-start').click();assert.equal(await state(),'playing');const box=await page.locator('#rl-canvas').boundingBox();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await page.clock.runFor(1400);
  assert.ok(Number((await page.locator('#rl-score').innerText()).replace(/\D/g,''))>0);await screenshot('playing-desktop');
  await page.keyboard.down('ArrowDown');await page.clock.runFor(300);await page.keyboard.up('ArrowDown');await page.keyboard.down('Shift');await page.clock.runFor(1000);await page.keyboard.up('Shift');assert.ok(parseInt(await page.locator('#rl-energy-value').innerText())<95,'boost energy: '+await page.locator('#rl-energy-value').innerText()+' / '+await state());
  await page.keyboard.press('q');await page.clock.runFor(100);assert.equal(await page.locator('#rl-phase').isDisabled(),true);
  await page.keyboard.press('p');assert.equal(await state(),'paused');const info=await page.locator('#rl-run-info').innerText(),phase=await page.locator('#rl-phase-text').innerText();await page.clock.runFor(9000);assert.equal(await page.locator('#rl-run-info').innerText(),info);assert.equal(await page.locator('#rl-phase-text').innerText(),phase);
  await page.locator('#rl-resume').click();assert.equal(await state(),'playing');
 });
 await check('shared navigation and shared account dialog pause the game without duplicated login',async()=>{
  await page.locator('#ncn-menu-open').click();assert.equal(await state(),'paused');assert.equal(await page.locator('#ncn-navigation a[href="/ran-luot/"]').count(),1);await page.locator('#ncn-menu-close').click();await page.clock.runFor(250);await page.locator('#rl-resume').click();
  await page.locator('.ncn-account-menu>summary').click();assert.equal(await state(),'paused');await page.locator('#ncn-account-host [data-ncn-account-open="login"]').click();assert.equal(await page.locator('#ncn-account-dialog').count(),1);assert.equal(await page.locator('#ncn-account-dialog').isVisible(),true);await page.locator('[data-account-close]').click();
 });
 await check('help, reduced effects, muted audio and site theme persist without starting or resuming a run',async()=>{
  await page.locator('#rl-help-open').click();assert.equal(await page.locator('#rl-help').isVisible(),true);await page.locator('#rl-reduced').check();await page.locator('#rl-help-close').click();assert.equal(await state(),'paused');
  await page.locator('#rl-home-paused').click();await page.locator('#rl-sound').click();assert.equal(await page.locator('#rl-sound').getAttribute('aria-pressed'),'true');await page.locator('#ncn-theme-toggle').click();await screenshot('welcome-dark');
  await page.reload();await page.clock.runFor(100);assert.equal(await page.locator('#rl-reduced').isChecked(),true);assert.equal(await page.locator('#rl-sound').getAttribute('aria-pressed'),'true');assert.equal(await state(),'ready');assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');
 });
 await check('daily challenge links validate and deterministic games have the three-minute clock',async()=>{
  await page.goto(base+'/ran-luot/?challenge=2026-10-24');await page.clock.runFor(100);assert.match(await page.locator('#rl-daily-date').innerText(),/2026-10-24/);await page.locator('#rl-daily').click();await page.clock.runFor(300);assert.match(await page.locator('#rl-run-info').innerText(),/Thử thách 24\/10 · Còn 02:59/);await page.keyboard.press('p');await page.locator('#rl-home-paused').click();
 });
 await check('a run ends on collision, saves a real record, uses the shared player profile and supports replay',async()=>{
  await page.locator('#rl-start').click();await page.clock.runFor(16000);assert.equal(await state(),'over');assert.equal(await page.locator('#rl-leaders img').count(),0);assert.ok(Number(await page.locator('#rl-final-score').innerText())>=0);assert.match(await page.locator('#rl-xp-note').innerText(),/XP/);
  const record=await page.locator('#rl-best').innerText();await screenshot('result-desktop');await page.locator('#rl-retry').click();assert.equal(await state(),'playing');await page.keyboard.press('p');await page.locator('#rl-home-paused').click();await page.reload();await page.clock.runFor(100);assert.equal(await page.locator('#rl-best').innerText(),record);
 });
 await check('home and global search both open the game with the complete initial card count',async()=>{
  await page.goto(base+'/');await page.clock.runFor(100);const cfg=JSON.parse(await readFile('public/assets/ncn-theme/config.json','utf8'));assert.equal(await page.locator('#ncn-tool-grid .ncn-tool-card').count(),cfg.tools.length);assert.equal(await page.locator('#ncn-tool-grid a[href="/ran-luot/"]').count(),1);await page.locator('[data-ncn-search-open]').first().click();await page.locator('#ncn-global-query').fill('ran luot');assert.ok(await page.locator('#ncn-global-results a[href="/ran-luot/"]').count()>=1);
 });
 await page.close();
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await touch.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base+'/ran-luot/');await page.clock.runFor(100);
 await check('touch joystick and boost work together, pointer cancellation releases both and app switching pauses',async()=>{
  await page.locator('#rl-start').tap();await page.clock.runFor(100);assert.equal(await page.locator('#rl-stick').isVisible(),true);
  const stick=await page.locator('#rl-stick').boundingBox(),b=await page.locator('#rl-boost').boundingBox();
  const session=await touch.newCDPSession(page),finger={x:stick.x+stick.width*.5,y:stick.y+stick.height*.8,id:1},thumb={x:b.x+20,y:b.y+20,id:2};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});await page.clock.runFor(800);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,thumb]});await page.clock.runFor(800);assert.ok(parseInt(await page.locator('#rl-energy-value').innerText())<100);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.clock.runFor(500);assert.equal(await page.locator('#rl-boost').evaluate(el=>el.classList.contains('is-held')),false);await screenshot('playing-phone');await session.detach();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await state(),'paused');await page.clock.runFor(5000);assert.equal(await state(),'paused');
 });
 await touch.close();
 await check('no browser errors or external writes; only the visitor and isolated score APIs use POST',async()=>{assert.deepEqual(errors,[]);const writes=requests.filter(r=>r.method!=='GET');assert.ok(writes.every(r=>r.method==='POST'&&(r.url==='/.netlify/functions/ncn-visitors'||r.url.startsWith('/.netlify/functions/ncn-scores?'))),JSON.stringify(writes));});
}finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await context.close();await browser.close();await new Promise(done=>server.close(done));}
