import {chromium} from 'playwright';import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import assert from 'node:assert/strict';
import {createScoresHandler} from '../../netlify/lib/ncn-scores-api.mjs';import {memoryStore} from '../fixtures/arcade-store.mjs';import {createGame,drop,step,endStage,target,mine,difficulty,quota,readSave} from '../../public/dao-vang/core.js';
const built=!!process.env.NCN_BUILT_TEST,origin='https://ncn-gold.test',root=resolve(built?'dist':'public'),out=resolve('artifacts/gold'+(built?'-built':'')),at=Date.parse('2026-10-29T03:00:00Z'),SAVE='ncn-gold-save-v1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const browser=await chromium.launch(),results=[],errors=[],contexts=[];let page,active;await mkdir(out,{recursive:true});
const member={id:'gold-fixture-member',name:'Bác Thợ Mỏ',email:'fixture@example.test',avatar:'preset:🐼',admin:false,vip:false},jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:member.id,exp:Math.floor(at/1000)+36000})).toString('base64url')+'.fixture';
async function fixture({save=null,signed=false,blocked=false,viewport={width:1440,height:1000},fallback=false,touch=false,dark=false}={}){
 const ctx=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,reducedMotion:'reduce'}),f={context:ctx,store:memoryStore(),now:at,calls:[]};contexts.push(ctx);if(signed)await ctx.addCookies([{name:'nf_jwt',value:jwt,url:origin}]);
 await ctx.addInitScript(({save,blocked,fallback,dark,SAVE})=>{if(save&&!localStorage.getItem(SAVE))localStorage.setItem(SAVE,JSON.stringify(save));if(!localStorage.getItem('ncn-gold-prefs-v1'))localStorage.setItem('ncn-gold-prefs-v1',JSON.stringify({sound:false,reduced:true}));if(dark)localStorage.setItem('ncn-theme','dark');if(fallback)Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});if(blocked)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});},{save,blocked,fallback,dark,SAVE});
 const handler=createScoresHandler({production:()=>true,store:()=>f.store,now:()=>f.now,verify:async req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?member:null});
 await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()),headers=await req.allHeaders();if(u.origin!==origin){assert.equal(req.method(),'GET','External writes are blocked');return route.abort();}const json=(v,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(v)}),logged=(headers.cookie||'').includes('nf_jwt='+jwt);
 if(u.pathname==='/.netlify/functions/ncn-scores'){f.calls.push({route:u.searchParams.get('route'),method:req.method(),body:req.postData()});const res=await handler(new Request(req.url(),{method:req.method(),headers,...(req.method()==='POST'?{body:req.postData()}:{})}));return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});}
 if(u.pathname==='/.netlify/identity/token'&&logged)return json({access_token:jwt,refresh_token:'fixture',token_type:'bearer',expires_in:3600});
 if(u.pathname.startsWith('/.netlify/identity/'))return json(u.pathname.endsWith('/user')?(logged?{id:member.id,email:member.email,confirmed_at:'2026-10-01T00:00:00Z',user_metadata:{full_name:member.name},app_metadata:{roles:[]}}:{msg:'Unauthorized'}):{disable_signup:false,external:{email:true}},u.pathname.endsWith('/user')&&!logged?401:200);
 if(u.pathname.startsWith('/.netlify/functions/'))return json(u.pathname.endsWith('ncn-billing')?{user:logged?member:null}:{items:[],online:1,total:1});
 try{let path=resolve(root,'.'+decodeURIComponent(u.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error();if((await stat(path)).isDirectory())path+='/index.html';return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}});
 f.page=await ctx.newPage();page=f.page;active=f;page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(at)});await page.clock.pauseAt(new Date(at+100));return f;
}
const tick=async(ms=100)=>{active.now+=ms;await page.clock.runFor(ms);};
const open=async()=>{await page.goto(origin+'/dao-vang/');await page.waitForFunction(()=>window.NCNAccount?.state.ready);await page.locator('#gm-start').waitFor();await tick();};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ncn-gold-save-v1'))),state=()=>page.locator('#gm-app').getAttribute('data-state');
const shot=async name=>page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:85,fullPage:!(await page.locator('#gm-app').evaluate(el=>el.classList.contains('gm-immersive')))});
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await shot('failure-'+results.length).catch(()=>{});console.error('STATE',await state().catch(()=>null),'TOAST',await page.locator('#gm-toast').innerText().catch(()=>''));throw error;}}
async function quick(){await page.locator('#gm-quick').click();if(await page.locator('#gm-confirm').isVisible())await page.locator('#gm-confirm-yes').click();await page.locator('#gm-app[data-state=playing]').waitFor();}
async function haul(){await tick(650);await page.locator('#gm-board').focus();await page.keyboard.press('Space');await tick(3000);}
function carried(){const g=createGame({seed:123,date:'2026-10-29'});g.hook.angle=0;drop(g);step(g,.3);return{...g,ranked:false};}
try{
 await fixture();await open();
 await check('welcome, eight-game navigation and start controls fit 320px through desktop',async()=>{for(const width of [1440,1000,820,700,390,360,320]){await page.setViewportSize({width,height:900});await tick();const box=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect().toJSON();return{w:innerWidth,actual:document.documentElement.scrollWidth,field:r('gm-field'),title:r('gm-title'),start:r('gm-start'),quick:r('gm-quick')};});assert.ok(box.actual<=box.w+1,JSON.stringify(box));assert.ok(box.title.top>=box.field.top-1&&box.quick.bottom<=box.field.bottom+1,JSON.stringify(box));assert.equal(await page.locator('.ncn-arcade-links a').count(),8);if(width===1440)await shot('welcome-desktop');if(width===390)await shot('welcome-phone');}});
 await check('native desktop full screen retains the mine and welcome before starting',async()=>{
  for(const [width,height]of [[1440,900],[2048,1307],[1280,720]]){
   await page.setViewportSize({width,height});await page.locator('#gm-fullscreen').click();await tick(150);
   assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'gm-app','Use the browser fullscreen path, not only the CSS fallback');
   const geo=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,field:rect('gm-field'),board:rect('gm-board'),start:rect('gm-start'),quick:rect('gm-quick'),drop:rect('gm-drop')};});
   assert.ok(geo.field.height>=300&&geo.board.height>=geo.field.height-2,JSON.stringify(geo));
   assert.ok(geo.start.top>=geo.field.top&&geo.quick.bottom<=geo.field.bottom+1,JSON.stringify(geo));
   assert.ok(geo.field.top>=0&&geo.drop.bottom<=geo.h+1,JSON.stringify(geo));
   await shot('fullscreen-welcome-native-'+width);await page.locator('#gm-fullscreen').click();await tick(100);assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
  }
  await page.locator('#gm-fullscreen').click();await tick(150);await quick();await tick(150);
  assert.equal(await state(),'playing');assert.ok(await page.locator('#gm-field').evaluate(el=>el.getBoundingClientRect().height>=300));
  await page.locator('#gm-pause').click();assert.equal(await state(),'paused');await shot('fullscreen-paused-native');
  assert.ok(await page.locator('#gm-field').evaluate(el=>el.getBoundingClientRect().height>=300));
  await page.locator('#gm-back').click();assert.equal(await state(),'ready');assert.equal(await page.locator('#gm-continue').isVisible(),true);
  const restoredWelcome=await page.evaluate(()=>({field:document.getElementById('gm-field').getBoundingClientRect().toJSON(),quick:document.getElementById('gm-quick').getBoundingClientRect().toJSON()}));
  assert.ok(restoredWelcome.quick.bottom<=restoredWelcome.field.bottom+1,JSON.stringify(restoredWelcome));
  await shot('fullscreen-welcome-saved-native');await page.locator('#gm-fullscreen').click();await tick(100);
 });
 await check('quick play really hauls gold, writes no profile or score and freezes while paused',async()=>{await page.setViewportSize({width:1440,height:1000});await quick();await haul();assert.equal(await page.locator('#gm-cash').innerText(),'250');await page.locator('#gm-pause').click();assert.equal(await state(),'paused');const before=await saved();await tick(5000);assert.deepEqual((await saved()).hook,before.hook);assert.equal((await saved()).time,before.time);assert.equal(active.calls.filter(c=>c.method==='POST').length,0);await shot('playing-desktop');});
 await fixture();await open();
 await check('a guest earns a real result under the shared NCN Arcade profile',async()=>{await page.locator('#gm-start').click();await page.locator('#ncn-player-name').fill('Bác Thợ Mỏ');await page.locator('.ncn-arcade-profile [type=submit]').click();await page.locator('#gm-app[data-state=playing]').waitFor();await haul();assert.equal(await page.locator('#gm-cash').innerText(),'250');await page.locator('#gm-pause').click();await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));const scores=active.calls.filter(c=>c.route==='score').map(c=>JSON.parse(c.body));assert.equal(scores.at(-1).score,250);assert.equal([...active.store.entries.keys()].filter(k=>k.startsWith('best/')).length,1);});
 await fixture({save:carried()});await open();
 await check('restoring an in-flight payload pauses the exact timer and banks once after resume',async()=>{const before=await saved();assert.ok(before.hook.item);await page.locator('#gm-continue').click();assert.equal(await state(),'paused');assert.equal((await saved()).time,before.time);await tick(5000);assert.equal((await saved()).time,before.time);await page.locator('#gm-start').click();await tick(4000);await page.locator('#gm-pause').click();assert.equal((await saved()).money,250);await page.reload();await tick();await page.locator('#gm-continue').click();assert.equal(await state(),'paused');await page.locator('#gm-start').click();await tick(4000);await page.locator('#gm-pause').click();assert.equal((await saved()).money,250);});
 const shopSave=createGame({seed:19,date:'2026-10-29'});shopSave.money=shopSave.score=1000;shopSave.time=.2;shopSave.elapsed=59.8;
 await fixture({save:{...shopSave,ranked:false}});await open();
 await check('deadline opens the shop, purchased strength survives reload and applies at stage two',async()=>{await page.locator('#gm-continue').click();await page.locator('#gm-start').click();await tick(500);await page.locator('#gm-shop[open]').waitFor();await page.locator('[data-good=strength]').click();const bought=await saved();assert.equal(bought.score,1000);assert.ok(bought.money<1000);assert.equal(bought.nextBoosts.strength,true);await page.reload();await tick();await page.locator('#gm-continue').click();await page.locator('#gm-shop[open]').waitFor();assert.equal(await page.locator('[data-good=strength]').innerText(),'Đã mua');await shot('shop');await page.locator('#gm-shop-next').click();assert.equal(await state(),'playing');await page.locator('#gm-pause').click();const next=await saved();assert.equal(next.level,2);assert.equal(next.boosts.strength,true);assert.equal(next.score,1000);});
 const late=carried();late.time=.025;late.elapsed=59.975;
 await fixture({save:late});await open();
 await check('a heavy item still on the rope at timeout is not paid',async()=>{await page.locator('#gm-continue').click();await page.locator('#gm-start').click();await tick(200);assert.equal(await state(),'lost');assert.equal(await page.locator('#gm-cash').innerText(),'0');assert.equal(await page.locator('#gm-result-score').innerText(),'0');});
 const daily=createGame({mode:'daily',date:'2026-10-29'});daily.level=5;daily.startMoney=daily.startScore=target(4);daily.goal=target(5);daily.items=mine(daily.seed,5);daily.money=daily.score=daily.goal;daily.time=.1;daily.elapsed=59.9;
 await fixture({save:{...daily,ranked:false}});await open();
 await check('the daily final stage wins at five without opening stage six',async()=>{await page.locator('#gm-continue').click();await page.locator('#gm-start').click();await tick(300);assert.equal(await state(),'won');assert.match(await page.locator('#gm-kicker').innerText(),/5 MÀN/);assert.equal(await page.locator('#gm-shop').isVisible(),false);});
 await fixture();await open();
 await check('wheel over the mine scrolls the page, and the site menu safely pauses play',async()=>{await quick();await page.locator('#gm-board').hover();const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,300);await tick(300);assert.ok(await page.evaluate(y=>scrollY>y+10,before));await page.mouse.wheel(0,-200);await tick(300);await page.locator('#ncn-menu-open').click();await tick();assert.equal(await state(),'paused');await page.locator('#ncn-menu-close').click();});
 await fixture({fallback:true,touch:true,viewport:{width:390,height:844}});await open();
 await check('phone full screen and landscape keep both mining controls within the viewport',async()=>{await quick();await page.locator('#gm-fullscreen').click();await tick();assert.equal(await page.locator('#gm-app').evaluate(el=>el.classList.contains('gm-immersive')),true);for(const [width,height]of [[390,844],[844,390],[667,375]]){await page.setViewportSize({width,height});await tick();const geo=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,field:rect('gm-field'),drop:rect('gm-drop'),bomb:rect('gm-bomb'),full:rect('gm-fullscreen')};});for(const key of ['drop','bomb','full'])assert.ok(geo[key].left>=-1&&geo[key].right<=geo.w+1&&geo[key].top>=-1&&geo[key].bottom<=geo.h+1,JSON.stringify(geo));assert.ok(geo.field.height>150,JSON.stringify(geo));await shot('fullscreen-'+width);}await page.locator('#gm-fullscreen').click();await tick();assert.equal(await page.locator('#gm-app').evaluate(el=>el.classList.contains('gm-immersive')),false);});
 await fixture({fallback:true,touch:true,viewport:{width:390,height:844}});await open();
 await check('fallback full screen keeps welcome and mine usable on desktop and both phone orientations',async()=>{
  for(const [width,height]of [[1440,900],[390,844],[320,640],[844,390],[667,375]]){
   await page.setViewportSize({width,height});await page.locator('#gm-fullscreen').click();await tick(150);
   const geo=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return{w:innerWidth,h:innerHeight,field:rect('gm-field'),board:rect('gm-board'),start:rect('gm-start'),quick:rect('gm-quick'),drop:rect('gm-drop')};});
   assert.equal(await page.evaluate(()=>document.fullscreenElement),null,'Exercise the fallback separately');
   assert.ok(geo.field.height>=150&&geo.board.height>=geo.field.height-2,JSON.stringify(geo));
   assert.ok(geo.start.top>=geo.field.top&&geo.quick.bottom<=geo.field.bottom+1,JSON.stringify(geo));
   assert.ok(geo.field.top>=0&&geo.drop.bottom<=geo.h+1,JSON.stringify(geo));
   await shot('fullscreen-welcome-fallback-'+width);await page.locator('#gm-fullscreen').click();await tick(100);
  }
 });
 await fixture({blocked:true,dark:true,viewport:{width:390,height:844}});await open();
 await check('blocked storage, reduced motion and dark theme still permit real quick play',async()=>{await quick();await haul();assert.equal(await page.locator('#gm-cash').innerText(),'250');assert.match(await page.locator('#gm-storage-note').innerText(),/không cho lưu/);await page.locator('#gm-pause').click();await shot('dark-phone');});
 const surplus=createGame({seed:19,date:'2026-10-29'});surplus.money=surplus.score=10000;
 await fixture({save:{...surplus,ranked:false}});await open();
 await check('early exit keeps surplus and still requires fresh earnings in the next stage',async()=>{
  await page.locator('#gm-continue').click();await page.locator('#gm-start').click();await page.locator('#gm-exit-level').click();await page.locator('#gm-shop[open]').waitFor();await page.locator('[data-good=strength]').click();const wallet=(await saved()).money;await page.locator('#gm-shop-next').click();await tick(100);const next=await saved();assert.equal(next.level,2);assert.equal(next.startMoney,wallet);assert.equal(next.goal,wallet+quota(2));assert.equal(next.score-next.startScore,0);assert.equal(await page.locator('#gm-exit-level').isDisabled(),true);
 });
 const final=createGame({seed:123,date:'2026-10-29'});final.level=200;final.startMoney=final.money=500000;final.startScore=final.score=520000;final.spent=20000;final.goal=target(200,final.startMoney);final.money+=quota(200);final.score+=quota(200);final.time=difficulty(200).time;final.items=mine(final.seed,200);
 await fixture({save:{...final,ranked:false}});await open();
 await check('stage 200 renders the deep mine with readable classic HUD and ends the campaign once',async()=>{
  await page.locator('#gm-continue').click();await page.locator('#gm-start').click();await tick(100);assert.equal(await page.locator('#gm-level').innerText(),'200 / 200');assert.match(await page.locator('#gm-stage-tag').innerText(),/20 \/ 20.*45s/);assert.equal(await page.locator('#gm-clock').innerText(),'45');assert.equal(readSave(await saved()).level,200);await shot('stage-200');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await tick(100);const fit=await page.locator('.gm-hud').evaluate(el=>[...el.children].map(n=>({scroll:n.scrollWidth,width:n.clientWidth})));assert.ok(fit.every(x=>x.scroll<=x.width+1),JSON.stringify({width,fit}));}
  await page.locator('#gm-exit-level').click();assert.equal(await state(),'won');assert.match(await page.locator('#gm-kicker').innerText(),/200 MÀN/);assert.equal(await page.locator('#gm-shop').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('ncn-gold-save-v1')),null);
 });
 const legacy=createGame({seed:123,date:'2026-10-29'});legacy.version=1;delete legacy.startMoney;delete legacy.startScore;legacy.level=100;legacy.goal=650;for(let i=2;i<=100;i++)legacy.goal+=Math.min(4000,545+(i-2)*270);legacy.money=legacy.score=legacy.goal;legacy.time=.1;legacy.elapsed=59.9;legacy.items=mine(legacy.seed,100);
 await fixture({save:{...legacy,ranked:false}});await open();
 await check('an old schema-1 campaign resumes stage 100 exactly and continues at 101',async()=>{
  await page.locator('#gm-continue').click();assert.equal(await state(),'paused');assert.equal((await saved()).time,.1);await page.locator('#gm-start').click();await tick(300);await page.locator('#gm-shop[open]').waitFor();await page.locator('#gm-shop-next').click();await tick(100);const next=await saved();assert.equal(next.version,2);assert.equal(next.level,101);assert.equal(next.goal-next.startMoney,quota(101));assert.equal(await page.locator('#gm-level').innerText(),'101 / 200');
 });
 await fixture({touch:true,viewport:{width:390,height:844}});await open();
 await check('a phone tap drops once, while a vertical swipe over the mine scrolls without dropping',async()=>{
  await quick();await tick(650);await page.locator('#gm-board').tap();await tick(3000);assert.equal(await page.locator('#gm-cash').innerText(),'250');
  const sea=await page.locator('#gm-board').boundingBox(),cdp=await active.context.newCDPSession(page),x=Math.round(sea.x+sea.width*.65),y=Math.round(sea.y+sea.height*.7),finger=(yy)=>({x,y:yy,id:1,radiusX:6,radiusY:6,force:1});const before=await page.evaluate(()=>scrollY);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(y-65)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick(100);assert.equal((await saved()).hook.state,'swing');assert.ok(await page.evaluate(at=>scrollY>at+10,before));
 });
 await check('all tested game states avoid uncaught JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
}finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));for(const ctx of contexts)await ctx.close();await browser.close();}
