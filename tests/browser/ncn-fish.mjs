import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';

const root=resolve('public'),out=resolve('artifacts/fish'),seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),catalog=publicCatalog(seed),results=[],errors=[],requests=[];
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const notices=[{id:'fixture',text:'NCN Arcade · Chào mừng về với đại dương tuổi thơ'}];
const server=createServer(async(req,res)=>{
  try{
    requests.push({path:req.url,method:req.method});const url=new URL(req.url,'http://localhost');
    const json=value=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
    if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-library')?{items:catalog}:url.pathname.endsWith('ncn-billing')?{user:null}:url.pathname.endsWith('ncn-announcements')?{items:notices}:url.pathname.endsWith('ncn-stories')?{items:[],serverNow:new Date().toISOString()}:{total:1,online:1});
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Outside public');if((await stat(path)).isDirectory())path+='/index.html';
    let body=await readFile(path);if(path.endsWith('.html'))body=renderPublicHTML(body.toString(),catalog,{notices});res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
async function context(options={}){
  const ctx=await browser.newContext({viewport:{width:1440,height:1050},...options});
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await ctx.addInitScript(()=>{Math.random=()=>.31415926;});return ctx;
}
const desktop=await context();let page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure-'+results.length+'.jpg',fullPage:true}).catch(()=>{});throw error;}};
const state=()=>page.locator('#ff-stage').getAttribute('data-state'),score=async()=>Number((await page.locator('#ff-score').innerText()).replace(/\D/g,''));
const shot=name=>page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:85});
const tick=n=>page.clock.runFor(n);
try{
  await page.clock.install({time:new Date('2026-10-25T15:30:00Z')});await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(200);
  await check('ocean welcome and start control fit desktop, tablet and 320px phones',async()=>{
    for(const width of [1440,1280,820,640,390,360,320]){
      await page.setViewportSize({width,height:width<640?844:1050});await tick(150);
      const fit=await page.evaluate(()=>{const stage=document.getElementById('ff-stage').getBoundingClientRect(),start=document.getElementById('ff-start').getBoundingClientRect();return {w:innerWidth,scroll:document.documentElement.scrollWidth,stage:stage.toJSON(),start:start.toJSON(),clock:!!document.getElementById('ncn-toolbar-clock')};});
      assert.ok(fit.scroll<=width+1,JSON.stringify(fit));assert.ok(fit.start.left>=fit.stage.left&&fit.start.right<=fit.stage.right&&fit.start.top>fit.stage.top&&fit.start.bottom<fit.stage.bottom,JSON.stringify(fit));assert.equal(fit.clock,true);
      if(width===1440)await shot('welcome-desktop');if(width===390)await shot('welcome-phone');
    }
  });
  await check('mouse wheel over the ocean scrolls the page in welcome, play, pause and result states',async()=>{
    const wheelPage=await desktop.newPage();wheelPage.on('pageerror',e=>errors.push(e.message));
    try{
      await wheelPage.goto(base+'/ca-lon-nuot-ca-be/');
      const wheelScroll=async()=>{
        await wheelPage.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});
        const box=await wheelPage.locator('#ff-stage').boundingBox();
        await wheelPage.mouse.move(box.x+box.width*.75,box.y+Math.min(box.height*.5,250));
        await wheelPage.mouse.wheel(0,180);
        await wheelPage.waitForFunction(()=>scrollY>40);
        await wheelPage.mouse.wheel(0,-300);
        await wheelPage.waitForFunction(()=>scrollY<5);
      };
      await wheelScroll();
      await wheelPage.locator('#ff-start').click();await wheelScroll();
      await wheelPage.keyboard.press('p');assert.equal(await wheelPage.locator('#ff-stage').getAttribute('data-state'),'paused');await wheelScroll();
      await wheelPage.locator('#ff-end').click();assert.equal(await wheelPage.locator('#ff-stage').getAttribute('data-state'),'over');await wheelScroll();
    }finally{await wheelPage.close();}
  });
  await page.setViewportSize({width:1440,height:1050});await tick(150);
  await check('ordinary swimming eats real fish, earns points, and dash spends energy',async()=>{
    await page.locator('#ff-start').click();await tick(300);assert.equal(await state(),'playing');assert.equal(await page.locator('#ff-lives').getAttribute('aria-label'),'Còn 3 mạng');
    await page.keyboard.down('ArrowRight');await tick(2100);await page.keyboard.up('ArrowRight');assert.ok(await score()>0);await shot('playing-desktop');
    await page.keyboard.press('Space');await tick(100);assert.ok(parseInt(await page.locator('#ff-energy-value').innerText())<85);assert.equal(await page.locator('#ff-dash').isDisabled(),true);
  });
  await check('pause freezes the run and an explicit continue resumes without catching up time',async()=>{
    await page.keyboard.press('p');assert.equal(await state(),'paused');const time=await page.locator('#ff-time').innerText(),energy=await page.locator('#ff-energy-value').innerText();await tick(9000);assert.equal(await page.locator('#ff-time').innerText(),time);assert.equal(await page.locator('#ff-energy-value').innerText(),energy);
    await page.locator('#ff-resume').click();await tick(300);assert.equal(await state(),'playing');
  });
  await check('shared menu and shared Liquid Glass account pause the game with one login dialog',async()=>{
    await page.locator('#ncn-menu-open').click();await tick(100);assert.equal(await state(),'paused');assert.equal(await page.locator('#ncn-navigation a[href="/ca-lon-nuot-ca-be/"]').count(),1);assert.equal(await page.locator('#ncn-navigation a[href="/ran-luot/"]').count(),1);
    await page.locator('#ncn-menu-close').click();await tick(200);await page.locator('#ff-resume').click();assert.equal(await state(),'playing');
    await page.locator('.ncn-account-menu>summary').click();await tick(50);assert.equal(await state(),'paused');await page.locator('#ncn-account-host [data-ncn-account-open=login]').click();assert.equal(await page.locator('#ncn-account-dialog').count(),1);assert.equal(await page.locator('#ncn-account-dialog').isVisible(),true);
    await page.locator('[data-account-close]').click();await tick(100);assert.equal(await state(),'paused');
  });
  await check('help, reduced effects, sound preference and cosmetic fish colors persist safely',async()=>{
    await page.locator('#ff-help-open').click();assert.equal(await page.locator('#ff-help').isVisible(),true);await page.locator('#ff-reduced').check();await page.locator('#ff-help-close').click();assert.equal(await state(),'paused');
    await page.locator('#ff-end').click();assert.equal(await state(),'over');await page.locator('#ff-result-home').click();await page.locator('[data-skin=aqua]').click();await page.locator('#ff-sound').click();assert.equal(await page.locator('#ff-sound').getAttribute('aria-pressed'),'true');
    await page.locator('#ncn-theme-toggle').click();await tick(150);await shot('welcome-dark');await page.reload();await tick(150);
    assert.equal(await page.locator('#ff-reduced').isChecked(),true);assert.equal(await page.locator('[data-skin=aqua]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#ff-sound').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('html').getAttribute('data-ncn-theme'),'dark');assert.equal(await state(),'ready');await page.locator('#ff-sound').click();
  });
  await check('ending a real run awards its record once, replay resets the run, and reload retains the record',async()=>{
    await page.locator('#ff-start').click();await page.keyboard.down('ArrowRight');await tick(2300);await page.keyboard.up('ArrowRight');const earned=await score();assert.ok(earned>0);await page.keyboard.press('p');await page.locator('#ff-end').click();assert.equal(await state(),'over');assert.equal(Number((await page.locator('#ff-final-score').innerText()).replace(/\D/g,'')),earned);
    const record=await page.locator('#ff-best').innerText();await shot('result-desktop');await page.locator('#ff-retry').click();assert.equal(await state(),'playing');assert.equal(await score(),0);await page.keyboard.press('p');await page.locator('#ff-end').click();assert.equal(await page.locator('#ff-best').innerText(),record);await page.reload();await tick(100);assert.equal(await page.locator('#ff-best').innerText(),record);
  });
  await check('home first paint, hydrated search and Library discover the same game exactly once',async()=>{
    await page.goto(base+'/');await tick(150);const config=JSON.parse(await readFile('public/assets/ncn-theme/config.json','utf8'));assert.equal(await page.locator('#ncn-tool-grid .ncn-tool-card').count(),config.tools.length);assert.equal(await page.locator('#ncn-tool-grid a[href="/ca-lon-nuot-ca-be/"]').count(),1);
    await page.locator('[data-ncn-search-open]').first().click();await page.locator('#ncn-global-query').fill('ca lon nuot ca be');assert.ok(await page.locator('#ncn-global-results a[href="/ca-lon-nuot-ca-be/"]').count()>=1);
    await page.goto(base+'/thu-vien/?q=c%C3%A1+l%E1%BB%9Bn+nu%E1%BB%91t');await tick(150);assert.equal(await page.locator('#ncn-library-results a[href="/ca-lon-nuot-ca-be/"]').count(),1);
    const nojs=await context({javaScriptEnabled:false}),staticPage=await nojs.newPage();await staticPage.goto(base+'/');assert.equal(await staticPage.locator('#ncn-tool-grid a[href="/ca-lon-nuot-ca-be/"]').count(),1);await nojs.close();
  });
  await check('real touch drag controls the fish, releases cleanly and the touch dash works',async()=>{
    const mobile=await context({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const previous=page;page=await mobile.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-25T15:30:00Z')});await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').tap();await tick(500);
    const box=await page.locator('#ff-canvas').boundingBox(),x=Math.round(box.x+box.width*.22),y=Math.round(box.y+box.height*.56),cdp=await mobile.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:7,radiusY:7,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+58,y,id:1,radiusX:7,radiusY:7,force:1}]});await tick(2200);assert.equal(await page.locator('#ff-stick').isVisible(),true);assert.ok(await score()>0);await shot('playing-phone');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('#ff-stick').isVisible(),false);await page.locator('#ff-dash').tap();await tick(100);assert.ok(parseInt(await page.locator('#ff-energy-value').innerText())<85);await page.locator('#ff-pause').tap();assert.equal(await state(),'paused');await shot('paused-phone');await mobile.close();page=previous;
  });
  await check('storage denial never blocks play or turns a local record into authentication',async()=>{
    const blocked=await context();await blocked.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='ncn:fish:record:v1')throw new DOMException('blocked','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='ncn:fish:record:v1')throw new DOMException('blocked','SecurityError');return set.call(this,key,value);};});
    const previous=page;page=await blocked.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').click();await page.keyboard.down('ArrowRight');await tick(2000);await page.keyboard.up('ArrowRight');await page.keyboard.press('p');await page.locator('#ff-end').click();assert.equal(await state(),'over');assert.match(await page.locator('#ff-storage-note').innerText(),/chưa lưu được/);await blocked.close();page=previous;
  });
  await check('no browser exceptions or game/account writes reach an external service',async()=>{
    assert.deepEqual(errors,[]);assert.ok(requests.filter(x=>x.method!=='GET').every(x=>x.method==='POST'&&x.path==='/.netlify/functions/ncn-visitors'),JSON.stringify(requests.filter(x=>x.method!=='GET')));
  });
}finally{await writeFile(out+'/results.json',JSON.stringify({scope:'Isolated HTTP fixtures; external requests blocked',results},null,2));await desktop.close();await browser.close();await new Promise(done=>server.close(done));}
console.log('Ocean browser scenarios: '+results.length+' passed.');
