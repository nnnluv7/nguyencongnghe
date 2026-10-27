import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createScoresHandler} from '../../netlify/lib/ncn-scores-api.mjs';
import {scorePhoto} from '../../netlify/lib/ncn-score-photos.mjs';
import {memoryStore} from '../fixtures/arcade-store.mjs';
import {createGame,index,readProgress} from '../../public/ban-bong/core.js';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';

// All accounts, avatars, uploads and scores remain inside a synthetic HTTPS site.
const origin='https://ncn-bubble.test',root=resolve('public'),out=resolve('artifacts/bubble'),at=Date.parse('2026-10-27T03:00:00Z'),errors=[],results=[],contexts=[];
const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),catalog=publicCatalog(seed);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const member={id:'bubble-fixture-member',email:'private@example.test',name:'Bạn NCN thử',avatar:origin+'/member.png',admin:false,vip:false,createdAt:'2026-10-01T00:00:00Z'};
const jwtFor=now=>Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:member.id,email:member.email,exp:Math.floor(now/1000)+3*86400})).toString('base64url')+'.fixture';
const browser=await chromium.launch();let active,page;
await mkdir(out,{recursive:true});
function clearSave(level=1,mode='journey'){
 const g=createGame({level,mode,seed:9,date:'2026-10-27'});g.board.fill(0);g.board[index(0,5)]=1;g.board[index(1,4)]=1;g.board[index(1,5)]=2;g.current=1;g.next=2;return g;
}
async function fixture({signed=false,save=null,progress=null,clock=true,fallback=false,denied=false,blocked=false,touch=false,viewport={width:1440,height:1000}}={}){
 const jwt=jwtFor(clock?at:Date.now());
 const f={store:memoryStore(),now:at,clock,calls:[]},ctx=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});f.context=ctx;contexts.push(ctx);
 if(signed)await ctx.addCookies([{name:'nf_jwt',value:jwt,url:origin}]);
 const handler=createScoresHandler({production:()=>true,store:()=>f.store,now:()=>f.now,photo:scorePhoto,verify:async req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?member:null});
 await ctx.addInitScript(({save,progress,fallback,denied,blocked})=>{
  if(!localStorage.getItem('ncn-bubble-prefs-v1'))localStorage.setItem('ncn-bubble-prefs-v1',JSON.stringify({reduced:false,sound:false}));
  if(save&&!localStorage.getItem('ncn-bubble-save-v1'))localStorage.setItem('ncn-bubble-save-v1',JSON.stringify(save));
  if(progress&&!localStorage.getItem('ncn-bubble-progress-v1'))localStorage.setItem('ncn-bubble-progress-v1',JSON.stringify(progress));
  if(fallback)Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});
  window.__wakeFixture={requests:0,releases:0};class Sentinel extends EventTarget{released=false;async release(){if(!this.released){this.released=true;window.__wakeFixture.releases++;this.dispatchEvent(new Event('release'));}}}
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request(){window.__wakeFixture.requests++;return denied?Promise.reject(Error('Denied')):Promise.resolve(new Sentinel());}}});
  if(blocked)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
 },{save,progress,fallback,denied,blocked});
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),headers=await req.allHeaders();
  if(url.origin!==origin){assert.notEqual(req.method(),'POST','No external write permitted');return route.abort();}
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}),signedIn=(headers.cookie||'').includes('nf_jwt='+jwt);
  if(url.pathname==='/.netlify/functions/ncn-scores'){
   f.calls.push({route:url.searchParams.get('route'),body:req.postData()});const response=await handler(new Request(req.url(),{method:req.method(),headers,...(req.method()==='POST'?{body:req.postData()}:{})}));return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  }
  if(url.pathname==='/.netlify/identity/token'&&signedIn)return json({access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600});
  if(url.pathname.startsWith('/.netlify/identity/'))return json(url.pathname.endsWith('/user')?(signedIn?{id:member.id,email:member.email,confirmed_at:member.createdAt,created_at:member.createdAt,app_metadata:{roles:[]},user_metadata:{full_name:member.name,picture:member.avatar}}:{msg:'Unauthorized'}):{disable_signup:false,external:{email:true}},url.pathname.endsWith('/user')&&!signedIn?401:200);
  if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-billing')?{user:signedIn?member:null}:url.pathname.endsWith('ncn-library')?{items:catalog}:url.pathname.endsWith('ncn-announcements')?{items:[{text:'NCN Arcade · Sáu game, một hồ sơ'}]}:{items:[],total:1,online:1});
  if(url.pathname==='/member.png')return route.fulfill({contentType:'image/png',body:await readFile(root+'/assets/ncn-theme/logo.png')});
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error();if((await stat(path)).isDirectory())path+='/index.html';let body=await readFile(path);if(path.endsWith('.html'))body=renderPublicHTML(body.toString(),catalog,{notices:[{text:'NCN Arcade · Sáu game, một hồ sơ'}]});return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body});}catch{return route.fulfill({status:404,body:'Not found'});}
 });
 f.page=await ctx.newPage();f.page.on('pageerror',e=>errors.push(e.message));if(clock)await f.page.clock.install({time:new Date(at)});active=f;page=f.page;return f;
}
const tick=async(ms=100)=>{active.now+=ms;if(active.clock)await page.clock.runFor(ms);else await page.waitForTimeout(ms);};
const open=async(path='/ban-bong/')=>{await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);await page.locator('#bb-start').waitFor();await tick();};
const state=()=>page.locator('#bb-app').getAttribute('data-state');
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ncn-bubble-save-v1')));
const shot=async name=>page.screenshot({path:out+'/'+name+'.jpg',fullPage:true,type:'jpeg',quality:85});
async function fire(){await page.locator('#bb-app[data-state=playing]').waitFor();await page.locator('#bb-board').focus();await page.keyboard.press('Space');await tick(1100);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});console.log('STATE',await state().catch(()=>null),'TOAST',await page.locator('#bb-toast').innerText().catch(()=>''));await shot('failure-'+results.length).catch(()=>{});throw error;}}
async function fullscreenFits(){
 await page.waitForFunction(()=>document.getElementById('bb-app').classList.contains('bb-immersive'));
 const g=await page.evaluate(()=>{const rect=el=>el.getBoundingClientRect().toJSON(),app=document.getElementById('bb-app');return {w:innerWidth,h:innerHeight,app:rect(app),scroll:app.scrollHeight,client:app.clientHeight,field:rect(document.getElementById('bb-field')),controls:['bb-score','bb-level','bb-fullscreen','bb-board','bb-swap','bb-rainbow','bb-bomb'].map(id=>({id,...rect(document.getElementById(id))})),buttons:['bb-start','bb-continue','bb-home','bb-levels'].map(id=>document.getElementById(id)).filter(el=>!el.hidden&&!el.closest('[hidden]')).map(el=>({id:el.id,...rect(el)}))};});
 assert.ok(g.app.x>=-1&&g.app.y>=-1&&g.app.right<=g.w+1&&g.app.bottom<=g.h+1&&g.scroll<=g.client+1,JSON.stringify(g));
 for(const r of g.controls)assert.ok(r.width>0&&r.height>0&&r.x>=-1&&r.right<=g.w+1&&r.y>=-1&&r.bottom<=g.h+1,JSON.stringify({r,g}));
 for(const r of g.buttons)assert.ok(r.y>=g.field.y-1&&r.bottom<=g.field.bottom+1,JSON.stringify({r,g}));return g;
}
try{
 await fixture();await open();
 await check('the six-game NCN welcome fits 320px through desktop with all essential buttons inside the game',async()=>{
  for(const width of [1440,1000,820,700,390,360,320]){await page.setViewportSize({width,height:900});await tick();const g=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {width:innerWidth,scroll:document.documentElement.scrollWidth,field:rect('bb-field'),title:rect('bb-overlay-title'),start:rect('bb-start')};});assert.ok(g.scroll<=g.width+1,JSON.stringify(g));assert.ok(g.title.y>=g.field.y-1&&g.start.bottom<=g.field.bottom+1,JSON.stringify(g));assert.equal(await page.locator('.ncn-arcade-links a').count(),6);if(width===1440)await shot('welcome-desktop');if(width===390)await shot('welcome-phone');}
  await page.setViewportSize({width:1440,height:1000});await tick();
 });
 await check('a guest creates one shared profile, aims a real shot and saves an earned score to the actual score handler',async()=>{
  await page.locator('#bb-start').click();await page.locator('.ncn-arcade-profile[open]').waitFor();await page.locator('#ncn-player-name').fill('Bóng Ký Ức');await page.locator('.ncn-arcade-profile [type=submit]').click();await page.locator('#bb-app[data-state=playing]').waitFor();await tick();
  const before=await saved();await page.locator('#bb-swap').click();const swapped=await saved();assert.equal(swapped.current,before.next);assert.equal(swapped.next,before.current);assert.equal(swapped.shots,0);
  await page.locator('#bb-bomb').click();await fire();const after=await saved();assert.equal(after.shots,1);assert.equal(after.powers.bomb,0);assert.ok(after.score>0);await page.keyboard.press('p');assert.equal(await state(),'paused');await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));assert.equal([...active.store.entries.keys()].filter(x=>x.startsWith('best/')&&x.includes('/bubble/journey')).length,1);assert.equal((await active.context.cookies()).filter(x=>x.name==='__Host-ncn_arcade').length,1);await shot('guest-score');
 });
 await check('pause and reload preserve the exact board, queue, powers and score without asking for a guest profile again',async()=>{
  const before=await saved();await tick(15000);assert.deepEqual(await saved(),before);await page.reload();await tick();await page.locator('#bb-continue').click();await page.locator('#bb-app[data-state=playing]').waitFor();await page.keyboard.press('p');assert.deepEqual(await saved(),before);assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0);
 });
 await check('a real three-ball match drops its hanging ball, earns stars and unlocks the next stage',async()=>{
  await fixture({signed:true,save:clearSave()});await open();await page.locator('#bb-continue').click();await fire();assert.equal(await state(),'cleared');assert.equal(await page.locator('#bb-remaining').innerText(),'0');assert.equal(await page.locator('#bb-result-stars').innerText(),'★★★');assert.match(await page.locator('#bb-toast').innerText(),/4 bóng/);const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('ncn-bubble-progress-v1')));assert.equal(p.modes.journey.unlocked,2);assert.equal(p.modes.journey.stars[1],3);await shot('stage-cleared');await page.locator('#bb-start').click();assert.equal(await page.locator('#bb-level').innerText(),'02');assert.equal((await saved()).powers.bomb,1);assert.match(await page.locator('.ncn-score-player strong').innerText(),/Bạn NCN thử/);assert.equal(await page.locator('.ncn-score-player img').getAttribute('src'),member.avatar);
 });
 await check('the sixty-stage map keeps locked stages disabled and cancel preserves the active run',async()=>{
  await page.locator('#bb-map-open').click();await page.locator('#bb-world-select').selectOption('5');assert.equal(await page.locator('#bb-map-grid [data-level="60"]').isEnabled(),false);await page.locator('#bb-world-select').selectOption('0');assert.equal(await page.locator('#bb-map-grid [data-level="2"]').isEnabled(),true);await page.locator('#bb-map-grid [data-level="1"]').click();await page.locator('#bb-confirm[open]').waitFor();const before=await saved();await page.locator('#bb-confirm-no').click();assert.deepEqual(await saved(),before);assert.equal(await state(),'paused');await page.locator('#bb-start').click();
 });
 await check('rainbow shots inherit the hit colour and consume exactly one special',async()=>{
  const g=clearSave();g.board[index(1,5)]=1;g.board[index(0,0)]=3;g.current=3;g.next=1;await fixture({signed:true,save:g});await open();await page.locator('#bb-continue').click();await page.locator('#bb-rainbow').click();assert.equal(await page.locator('#bb-rainbow').getAttribute('aria-pressed'),'true');await fire();const next=await saved();assert.equal(next.powers.rainbow,0);assert.equal(next.board[index(0,5)],0);assert.equal(next.board[index(0,0)],3);assert.equal(next.shots,1);assert.equal(await page.locator('#bb-rainbow').isEnabled(),false);
 });
 await check('stage 60 and daily stage five finish their journeys and keep their scores and stars',async()=>{
  for(const [level,mode]of [[60,'journey'],[5,'daily']]){const p=readProgress(null);p.modes.journey.unlocked=60;await fixture({signed:true,save:clearSave(level,mode),progress:p});await open();await page.locator('#bb-continue').click();await fire();assert.equal(await state(),'won');assert.equal(await saved(),null);const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ncn-bubble-progress-v1')));assert.ok(record.best>0);if(mode==='journey')assert.equal(record.modes.journey.stars[60],3);await shot('completed-'+mode);}
 });
 await check('daily games share a reproducible board and an old daily save is not resumed on a new date',async()=>{
  await fixture({signed:true});await open();await page.locator('[data-bb-mode=daily]').click();await page.locator('#bb-start').click();await page.locator('#bb-app[data-state=playing]').waitFor();const first=await saved();assert.equal(first.mode,'daily');assert.equal(first.date,'2026-10-27');assert.equal(await page.locator('#bb-total').innerText(),'5');await page.keyboard.press('p');
  await fixture({signed:true});await open();await page.locator('[data-bb-mode=daily]').click();await page.locator('#bb-start').click();await page.locator('#bb-app[data-state=playing]').waitFor();assert.deepEqual((await saved()).board,first.board);await page.keyboard.press('p');await page.clock.setSystemTime(new Date(at+86400000));active.now+=86400000;await page.reload();await tick();assert.equal(await page.locator('#bb-continue').isVisible(),false);await page.locator('#bb-start').click();await page.locator('#bb-app[data-state=playing]').waitFor();assert.notDeepEqual((await saved()).board,first.board);
 });
 await check('mobile taps and dragging fire one ball each; cancelled gestures and typing in a dialog cannot fire',async()=>{
  await fixture({signed:true,touch:true,viewport:{width:390,height:844}});await open();await page.locator('#bb-start').tap();await page.locator('#bb-app[data-state=playing]').waitFor();const b=await page.locator('#bb-board').boundingBox();await page.locator('#bb-board').tap({position:{x:b.width*.45,y:b.height*.26}});await tick(1100);assert.equal((await saved()).shots,1);
  const box=await page.locator('#bb-board').boundingBox();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.26,{steps:5});await page.mouse.up();await tick(1100);assert.equal((await saved()).shots,2);await page.dispatchEvent('#bb-board','pointercancel');assert.equal((await saved()).shots,2);await page.locator('#bb-help-open').click();assert.equal(await state(),'paused');await page.locator('#bb-reduced').focus();await page.keyboard.press('Space');assert.equal((await saved()).shots,2);await page.locator('[data-bb-close="bb-help"]').last().click();await shot('playing-phone');
 });
 await check('shared menus and account management pause the game; dark mode and reduced effects survive reload',async()=>{
  await fixture({signed:true});await open();await page.locator('#bb-start').click();await page.locator('#bb-app[data-state=playing]').waitFor();await page.evaluate(()=>scrollTo(0,0));await tick();await page.locator('.ncn-account-menu>summary').click();assert.equal(await state(),'paused');await page.locator('#auth-header-desktop [data-ncn-account-open=profile]').click();await page.locator('[data-member-form]').waitFor();await page.locator('[data-account-close]').click();await page.locator('#ncn-theme-toggle').click();await page.locator('#bb-help-open').click();await page.locator('#bb-reduced').check();await page.locator('[data-bb-close="bb-help"]').last().click();await page.reload();await tick();assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');assert.equal(await page.locator('#bb-reduced').isChecked(),true);await shot('welcome-dark');
 });
 await check('native fullscreen fits phone, tablet and landscape, keeps its exit control and holds the screen awake',async()=>{
  await fixture({signed:true,clock:false,viewport:{width:390,height:844}});await open();await page.locator('#bb-fullscreen').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='bb-app');await page.locator('#bb-awake-status[data-state=active]').waitFor();
  for(const [width,height]of [[390,844],[320,568],[568,320],[844,390],[768,1024],[1440,900]]){await page.setViewportSize({width,height});await fullscreenFits();}
  await page.setViewportSize({width:390,height:844});await fullscreenFits();await page.locator('#bb-start').click();await page.locator('#bb-app[data-state=playing]').waitFor();await fullscreenFits();await shot('fullscreen-phone');await page.locator('#bb-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement&&!document.getElementById('bb-app').classList.contains('bb-immersive'));assert.equal(await page.locator('#ncn-site-shell').getAttribute('inert'),null);await page.waitForFunction(()=>window.__wakeFixture.releases>0);
 });
 await check('fullscreen fallback, denied wake lock and result actions remain usable on a short screen',async()=>{
  await fixture({signed:true,clock:false,fallback:true,denied:true,save:clearSave(),viewport:{width:568,height:320}});await open();await page.locator('#bb-fullscreen').click();await fullscreenFits();await page.locator('#bb-awake-status[data-state=unavailable]').waitFor();await page.locator('#bb-continue').click();await page.locator('#bb-board').focus();await page.keyboard.press('Space');await page.locator('#bb-app[data-state=cleared]').waitFor();await fullscreenFits();await shot('fullscreen-landscape-result');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('bb-app').classList.contains('bb-immersive'));
 });
 await check('blocked storage still permits a playable guest round and corrupt saves never offer a false continue',async()=>{
  await fixture({blocked:true});await open();await page.locator('#bb-start').click();await page.locator('#ncn-player-name').fill('Bạn Không Lưu Máy');await page.locator('.ncn-arcade-profile [type=submit]').click();await page.locator('#bb-app[data-state=playing]').waitFor();await page.locator('#bb-bomb').click();await fire();assert.equal(await state(),'playing');assert.match(await page.locator('#bb-storage-note').innerText(),/không cho lưu/);
  await fixture({save:{version:1,level:999,board:[1]}});await open();assert.equal(await page.locator('#bb-continue').isVisible(),false);
 });
 await check('hub, website search, static menu, Library and the shared scoreboard all discover the sixth game',async()=>{
  await page.goto(origin+'/arcade/');await tick();assert.equal(await page.locator('.ncn-arcade-card').count(),6);assert.equal(await page.locator('.ncn-arcade-card[href="/ban-bong/"]').count(),1);await shot('six-game-hub');await page.goto(origin+'/');await page.waitForFunction(()=>document.body.classList.contains('ncn-scroll-ready'));await page.locator('[data-ncn-group=arcade]').click();assert.equal(await page.locator('#ncn-tool-grid a[href="/ban-bong/"]').count(),1);await page.locator('[data-ncn-search-open]').first().click();await page.locator('#ncn-global-query').fill('ban bong');await page.locator('#ncn-global-results a[href="/ban-bong/"]').waitFor();await page.locator('#ncn-search-close').click();await page.locator('#ncn-menu-open').click();assert.equal(await page.locator('#ncn-navigation a[href="/ban-bong/"]').count(),1);await page.locator('#ncn-menu-close').click();await page.goto(origin+'/thu-vien/?q=ban+bong');await tick();await page.locator('#ncn-library-results a[href="/ban-bong/"]').waitFor();assert.deepEqual(errors,[]);
 });
 console.log('Bubble Shooter: '+results.length+' scenarios passed, with no production writes.');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));for(const ctx of contexts)await ctx.close();await browser.close();}
