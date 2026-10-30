import {arcadeEngineFixture} from '../fixtures/arcade-store.mjs';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';

const root=resolve(process.env.NCN_BUILT_TEST==='1'?'dist':'public'),out=resolve(process.env.NCN_BUILT_TEST==='1'?'artifacts/fish-built':'artifacts/fish'),seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')),catalog=publicCatalog(seed),results=[],errors=[],requests=[];
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const notices=[{id:'fixture',text:'NCN Arcade · Chào mừng về với đại dương tuổi thơ'}];
const server=createServer(async(req,res)=>{
  try{
    requests.push({path:req.url,method:req.method});const url=new URL(req.url,'http://localhost');
    const json=value=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(url.pathname.endsWith('/.netlify/functions/ncn-scores'))return json(arcadeEngineFixture(url));if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
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
  await ctx.addInitScript(()=>{
    Math.random=()=>.31415926;
    // Observe the visible player marker and green prey rings drawn on Canvas.
    // This exercises the real source or compiled game without exposing game state.
    const proto=CanvasRenderingContext2D.prototype,transform=proto.setTransform,stroke=proto.stroke,fillText=proto.fillText,drawImage=proto.drawImage;
    proto.setTransform=function(...args){if(this.canvas.id==='ff-canvas'){window.__ncnFishPrey=[];window.__ncnFishBodies=0;window.__ncnFishDrawn=[];window.__ncnFishHunters=[];}return transform.apply(this,args);};
    proto.drawImage=function(source,...args){if(this.canvas.id==='ff-canvas'&&source.width===384&&source.height===320){window.__ncnFishBodies++;const m=this.getTransform(),r=this.canvas.getBoundingClientRect(),d=this.canvas.width/r.width;window.__ncnFishDrawn.push({x:m.e/d,y:m.f/d,size:Math.hypot(m.c,m.d)/d,face:Math.sign(m.a)});}return drawImage.call(this,source,...args);};
    proto.stroke=function(...args){if(this.canvas.id==='ff-canvas'&&String(this.strokeStyle).replace(/\s/g,'').startsWith('rgba(184,255,188,')){
      const m=this.getTransform(),r=this.canvas.getBoundingClientRect(),d=this.canvas.width/r.width;window.__ncnFishPrey.push({x:m.e/d,y:m.f/d});
    }return stroke.apply(this,args);};
    proto.fillText=function(text,x,y,...args){if(text==='!'&&this.canvas.id==='ff-canvas'){const m=this.getTransform(),r=this.canvas.getBoundingClientRect(),d=this.canvas.width/r.width;window.__ncnFishHunters.push({x:(m.a*x+m.c*y+m.e)/d,y:(m.b*x+m.d*y+m.f)/d});}if(text==='BẠN'&&this.canvas.id==='ff-canvas'){const m=this.getTransform(),r=this.canvas.getBoundingClientRect(),d=this.canvas.width/r.width;window.__ncnFishPlayer={x,y,sx:(m.a*x+m.c*y+m.e)/d,sy:(m.b*x+m.d*y+m.f)/d};if(window.__ncnFishRecordMotion)(window.__ncnFishFrames||=[]).push({t:performance.now(),x,y});}return fillText.call(this,text,x,y,...args);};
  });return ctx;
}
const desktop=await context();let page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure-'+results.length+'.jpg',fullPage:true}).catch(()=>{});throw error;}};
const state=()=>page.locator('#ff-stage').getAttribute('data-state'),score=async()=>Number((await page.locator('#ff-score').innerText()).replace(/\D/g,''));
const shot=name=>page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:85});
const tick=n=>page.clock.runFor(n);
async function freezeClock(target,time='2026-10-30T09:00:00Z'){const at=new Date(time);await target.clock.install({time:at});await target.clock.pauseAt(new Date(at.getTime()+100));}
try{
  await freezeClock(page,'2026-10-25T15:30:00Z');await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(200);
  await check('ocean welcome and start control fit desktop, tablet and 320px phones',async()=>{
    for(const width of [1440,1280,820,640,390,360,320]){
      await page.setViewportSize({width,height:width<640?844:1050});await tick(150);
      const fit=await page.evaluate(()=>{const stage=document.getElementById('ff-stage').getBoundingClientRect(),start=document.getElementById('ff-start').getBoundingClientRect();return {w:innerWidth,scroll:document.documentElement.scrollWidth,stage:stage.toJSON(),start:start.toJSON(),clock:!!document.getElementById('ncn-toolbar-clock')};});
      assert.ok(fit.scroll<=width+1,JSON.stringify(fit));assert.ok(fit.start.left>=fit.stage.left&&fit.start.right<=fit.stage.right&&fit.start.top>fit.stage.top&&fit.start.bottom<fit.stage.bottom,JSON.stringify(fit));assert.equal(fit.clock,true);
      if(width===1440)await shot('welcome-desktop');if(width===390)await shot('welcome-phone');
    }
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
    await page.locator('#ff-start').click();await page.keyboard.down('ArrowRight');await tick(600);await page.keyboard.up('ArrowRight');await page.keyboard.press('p');const earned=await score();assert.ok(earned>0);await page.locator('#ff-end').click();assert.equal(await state(),'over');assert.equal(Number((await page.locator('#ff-final-score').innerText()).replace(/\D/g,'')),earned);
    const record=await page.locator('#ff-best').innerText();await shot('result-desktop');await page.locator('#ff-retry').click();assert.equal(await state(),'playing');assert.equal(await score(),0);await page.keyboard.press('p');await page.locator('#ff-end').click();assert.equal(await page.locator('#ff-best').innerText(),record);await page.reload();await tick(100);assert.equal(await page.locator('#ff-best').innerText(),record);
  });
  await check('home first paint, hydrated search and Library discover the same game exactly once',async()=>{
    await page.goto(base+'/');await tick(150);const config=JSON.parse(await readFile('public/assets/ncn-theme/config.json','utf8'));assert.equal(await page.locator('#ncn-tool-grid .ncn-tool-card').count(),config.tools.length);assert.equal(await page.locator('#ncn-tool-grid a[href="/ca-lon-nuot-ca-be/"]').count(),1);
    await page.locator('[data-ncn-search-open]').first().click();await page.locator('#ncn-global-query').fill('ca lon nuot ca be');assert.ok(await page.locator('#ncn-global-results a[href="/ca-lon-nuot-ca-be/"]').count()>=1);
    await page.goto(base+'/thu-vien/?q=c%C3%A1+l%E1%BB%9Bn+nu%E1%BB%91t');await tick(150);assert.equal(await page.locator('#ncn-library-results a[href="/ca-lon-nuot-ca-be/"]').count(),1);
    const nojs=await context({javaScriptEnabled:false}),staticPage=await nojs.newPage();await staticPage.goto(base+'/');assert.equal(await staticPage.locator('#ncn-tool-grid a[href="/ca-lon-nuot-ca-be/"]').count(),1);await nojs.close();
  });
  await check('phone joystick steers, stops on release and supports a simultaneous second-finger dash',async()=>{
    const mobile=await context({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const previous=page;page=await mobile.newPage();page.on('pageerror',e=>errors.push(e.message));await freezeClock(page,'2026-10-26T12:00:00Z');await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').tap();await tick(150);
    assert.equal(await page.locator('#ff-stick').isVisible(),true);
    const box=await page.locator('#ff-stick').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844,'Joystick stays inside the visible phone screen: '+JSON.stringify(box));const x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height/2),cdp=await mobile.newCDPSession(page),finger=(x,y,id)=>({x,y,id,radiusX:7,radiusY:7,force:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(x,y,1)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(x+36,y,1)]});await tick(200);
    assert.equal(await page.locator('#ff-stick').evaluate(el=>el.classList.contains('is-held')),true);const knob=await page.locator('#ff-stick>span').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {x:m.m41,y:m.m42};});assert.ok(knob.x>28&&knob.x<=29.01&&Math.abs(knob.y)<2,JSON.stringify(knob));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick(50);const stopped=await page.evaluate(()=>window.__ncnFishPlayer.x);await tick(1200);assert.equal(await page.evaluate(()=>window.__ncnFishPlayer.x),stopped,'Releasing the joystick must stop the fish');
    assert.equal(await page.locator('#ff-stick').isVisible(),true);assert.equal(await page.locator('#ff-stick').evaluate(el=>el.classList.contains('is-held')),false);assert.equal(await page.locator('#ff-stick>span').evaluate(el=>el.style.transform),'');await shot('playing-phone');
    const dashBox=await page.locator('#ff-dash').boundingBox(),bx=Math.round(dashBox.x+dashBox.width/2),by=Math.round(dashBox.y+dashBox.height/2);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(x+30,y,1)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(x+30,y,1),finger(bx,by,2)]});await tick(100);
    assert.equal(await page.locator('#ff-stick').evaluate(el=>el.classList.contains('is-held')),true);assert.ok(parseInt(await page.locator('#ff-energy-value').innerText())<85);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.reload();await tick(150);await page.locator('#ff-start').tap();await tick(100);
    const sea=await page.locator('#ff-canvas').boundingBox(),tx=Math.round(sea.x+sea.width*.5),ty=Math.round(sea.y+sea.height*.53),beforeDrag=await page.evaluate(()=>window.__ncnFishPlayer.x);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(tx,ty,3)]});await tick(50);assert.equal(await page.evaluate(()=>window.__ncnFishPlayer.x),beforeDrag,'Touching elsewhere must not teleport the fish');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(tx+45,ty,3)]});await tick(350);assert.ok(await page.evaluate(()=>window.__ncnFishPlayer.x)>beforeDrag+20,'Dragging the sea must steer the fish');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tick(50);const dragStop=await page.evaluate(()=>window.__ncnFishPlayer.x);await tick(250);assert.equal(await page.evaluate(()=>window.__ncnFishPlayer.x),dragStop,'Releasing a direct drag must stop the fish');
    await page.locator('#ff-pause').tap();assert.equal(await state(),'paused');assert.equal(await page.locator('#ff-stick').isVisible(),false);const frozen=await page.locator('#ff-time').innerText();await tick(3000);assert.equal(await page.locator('#ff-time').innerText(),frozen);await shot('paused-phone');
    await page.locator('#ff-resume').tap();assert.equal(await page.locator('#ff-stick').isVisible(),true);for(const [width,height]of[[320,568],[360,640],[390,844]]){await page.setViewportSize({width,height});await tick(150);await page.locator('#ff-stage').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await tick(100);for(const id of['ff-stick','ff-pause','ff-dash']){const r=await page.locator('#'+id).boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1&&r.y>=0&&r.y+r.height<=height+1,JSON.stringify({id,r,width,height}));}}await mobile.close();page=previous;
  });
  await check('classic mouse play clears a stage, freezes at the result, saves progress and opens the next one',async()=>{
    const classic=await context(),previous=page;page=await classic.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').click();await tick(150);
      assert.equal(await page.locator('#ff-level').innerText(),'001 / 200');assert.equal(await page.locator('#ff-menu [role=listitem]').count(),3);assert.equal(await page.locator('#ff-menu .is-edible').count(),1);
      const canvas=await page.locator('#ff-canvas').boundingBox();
      assert.ok(await page.evaluate(()=>window.__ncnFishBodies<=13),'The opening has at most 12 fish plus the player');
      for(let i=0;i<600&&await state()==='playing';i++){
        const target=await page.evaluate(()=>{const p=window.__ncnFishPlayer;return (window.__ncnFishPrey||[]).filter(f=>f.x>20&&f.y>140&&f.x<innerWidth-20).sort((a,b)=>Math.hypot(a.x-p.sx,a.y-p.sy)-Math.hypot(b.x-p.sx,b.y-p.sy))[0];});
        if(target)await page.mouse.move(canvas.x+target.x,canvas.y+target.y);else await page.mouse.move(canvas.x+canvas.width*(Math.floor(i/20)%2?.2:.8),canvas.y+canvas.height*.5);await tick(150);
      }
      assert.equal(await state(),'cleared','Ordinary mouse steering should reach a stage clear');assert.notEqual(await page.locator('#ff-time').innerText(),'00:00');assert.equal(await page.locator('#ff-cleared').isVisible(),true);assert.equal(await page.locator('#ff-menu .is-edible').count(),3);
      const frozen=await page.locator('#ff-time').innerText();await tick(5000);assert.equal(await page.locator('#ff-time').innerText(),frozen);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ncn:fish:record:v1')).unlocked),2);await shot('classic-stage-clear');
      await page.locator('#ff-next').click();await tick(100);assert.equal(await state(),'playing');assert.equal(await page.locator('#ff-level').innerText(),'002 / 200');assert.equal(await page.locator('#ff-menu .is-edible').count(),1);
      await page.reload();await tick(150);assert.equal(await state(),'ready');assert.equal(await page.locator('#ff-stage-select').inputValue(),'2');assert.equal(await page.locator('#ff-stage-select option:not([disabled])').count(),2);assert.ok(Number((await page.locator('#ff-best').innerText()).replace(/\D/g,''))>0,'Clearing a stage must retain the best score across reload');
    }finally{await classic.close();page=previous;}
  });
  await check('high-refresh Canvas frames move continuously and releasing the key still stops precisely',async()=>{
    const smooth=await context(),previous=page;page=await smooth.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);
      // Drive the real animation loop every 8 ms, while physics remains at 60 Hz.
      await page.evaluate(()=>{window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),8);window.cancelAnimationFrame=clearTimeout;});
      await page.locator('#ff-start').click();await tick(100);await page.evaluate(()=>{window.__ncnFishRecordMotion=true;window.__ncnFishFrames=[];});await page.keyboard.down('ArrowRight');await tick(160);await page.keyboard.up('ArrowRight');
      const frames=await page.evaluate(()=>window.__ncnFishFrames);assert.ok(frames.length>=15,'The actual painter ran above 60 Hz');
      for(let i=4;i<frames.length;i++){const before=frames[i-1],after=frames[i];assert.ok(after.x>before.x,'No repeated movement frames');assert.ok(Math.abs((after.x-before.x)/(after.t-before.t)-.310)<.00001,'Even speed through physics boundaries: '+JSON.stringify({before,after}));}
      await tick(80);const stopped=await page.evaluate(()=>window.__ncnFishPlayer.x);await tick(300);assert.equal(await page.evaluate(()=>window.__ncnFishPlayer.x),stopped);await shot('smooth-high-refresh');
    }finally{await smooth.close();page=previous;}
  });
  await check('a visible big fish follows briefly with a cue, and pausing freezes the pursuit',async()=>{
    const chase=await context(),previous=page;page=await chase.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      // This fixed seed brings a predator into range after the opening protection.
      await freezeClock(page,'2026-10-30T09:00:00.006Z');await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').click();await tick(6300);const sea=await page.locator('#ff-canvas').boundingBox();let seen=await page.evaluate(()=>(window.__ncnFishHunters||[]).length>0);
      for(let i=0;i<110&&!seen&&await state()==='playing';i++){
        const target=await page.evaluate(()=>{const bodies=window.__ncnFishDrawn||[],p=bodies.at(-1);if(!p)return;return bodies.slice(0,-1).filter(f=>f.size>p.size*1.12&&f.y>60).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];});
        if(target)await page.mouse.move(sea.x+Math.max(20,Math.min(sea.width-20,target.x+target.face*120)),sea.y+target.y);await tick(100);
        const hunters=await page.evaluate(()=>window.__ncnFishHunters||[]);assert.ok(hunters.length<=1,'Only one pursuer in the opening stage');if(hunters.length){seen=true;break;}
      }
      await shot('short-predator-chase');if(!seen)console.log('Visible fish at failed chase:',await page.evaluate(()=>({bodies:window.__ncnFishDrawn,player:window.__ncnFishPlayer,shield:document.getElementById('ff-shield-label').innerText})));assert.equal(seen,true,'A nearby larger fish should visibly enter a pursuit');await page.keyboard.press('p');await tick(100);const frozen=await page.evaluate(()=>window.__ncnFishHunters);await tick(2000);assert.deepEqual(await page.evaluate(()=>window.__ncnFishHunters),frozen);
    }finally{await chase.close();page=previous;}
  });
  await check('a completed old campaign continues at stage 41 with its record, new character and held suction',async()=>{
    const advanced=await context();await advanced.addInitScript(()=>localStorage.setItem('ncn:fish:record:v1',JSON.stringify({version:2,best:5000,skin:'aqua',unlocked:40,wins:1})));
    const previous=page;page=await advanced.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);assert.equal(await page.locator('#ff-stage-select').inputValue(),'41');assert.equal(await page.locator('#ff-best').innerText(),'5.000');await page.locator('#ff-start').click();await tick(150);
      assert.equal(await page.locator('#ff-level').innerText(),'041 / 200');assert.equal(await page.locator('#ff-zone').innerText(),'Cá sư tử');assert.equal(await page.locator('#ff-suck').isEnabled(),true);
      const at=await page.evaluate(()=>window.__ncnFishPlayer.x),area=await page.locator('#ff-canvas').boundingBox();await page.keyboard.down('e');await page.mouse.move(area.x+area.width*.72,area.y+area.height*.5);await tick(1000);assert.ok(await page.evaluate(()=>window.__ncnFishPlayer.x)>at+50,'Holding suction must not disable mouse steering');assert.ok(parseInt(await page.locator('#ff-energy-value').innerText())<85);assert.equal(await page.locator('#ff-suck').evaluate(n=>n.classList.contains('is-held')),true);await page.keyboard.up('e');await tick(200);assert.equal(await page.locator('#ff-suck').evaluate(n=>n.classList.contains('is-held')),false);await shot('classic-suction');
      await page.keyboard.press('p');await page.locator('#ff-end').click();await page.locator('#ff-retry').click();await tick(100);assert.equal(await page.locator('#ff-level').innerText(),'041 / 200');assert.equal(await state(),'playing');
    }finally{await advanced.close();page=previous;}
  });
  await check('the last of 200 saved stages starts and retries with the correct character',async()=>{
    const late=await context();await late.addInitScript(()=>localStorage.setItem('ncn:fish:record:v1',JSON.stringify({version:3,best:12000,unlocked:200})));
    const previous=page;page=await late.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);assert.equal(await page.locator('#ff-stage-select').inputValue(),'200');assert.equal(await page.locator('#ff-stage-select option:not([disabled])').count(),200);
      await page.locator('#ff-start').click();await tick(150);assert.equal(await page.locator('#ff-level').innerText(),'200 / 200');assert.equal(await page.locator('#ff-zone').innerText(),'Cá voi sát thủ');assert.ok(await page.evaluate(()=>window.__ncnFishBodies<=21),'Even the last stage begins with at most 20 fish plus the player');await shot('stage-200');
      await page.keyboard.press('p');await page.locator('#ff-end').click();await page.locator('#ff-retry').click();await tick(150);assert.equal(await page.locator('#ff-level').innerText(),'200 / 200');assert.equal(await state(),'playing');
    }finally{await late.close();page=previous;}
  });
  await check('full-screen fallback fills the viewport, keeps Canvas visible and exits by button or Escape',async()=>{
    const full=await context();await full.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Native fullscreen unavailable in fixture'));});const previous=page;page=await full.newPage();page.on('pageerror',e=>errors.push(e.message));
    try{
      await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').click();await page.locator('#ff-fullscreen').click();await tick(150);
      const box=await page.locator('#ff-stage').boundingBox();assert.equal(box.x,0);assert.equal(box.y,0);assert.equal(box.width,1440);assert.equal(box.height,1050);assert.equal(await page.locator('#ff-exit-fullscreen').isVisible(),true);assert.ok((await page.locator('#ff-canvas').boundingBox()).height>1000);await shot('classic-fullscreen');
      await page.locator('#ff-exit-fullscreen').click();assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('ncn-fish-theater')),false);await page.keyboard.press('f');await tick(150);await page.keyboard.press('Escape');assert.equal(await page.locator('#ff-exit-fullscreen').isVisible(),false);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('ncn-fish-theater')),false);
    }finally{await full.close();page=previous;}
  });
  await check('storage denial never blocks play or turns a local record into authentication',async()=>{
    const blocked=await context();await blocked.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='ncn:fish:record:v1')throw new DOMException('blocked','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='ncn:fish:record:v1')throw new DOMException('blocked','SecurityError');return set.call(this,key,value);};});
    const previous=page;page=await blocked.newPage();page.on('pageerror',e=>errors.push(e.message));await freezeClock(page);await page.goto(base+'/ca-lon-nuot-ca-be/');await tick(150);await page.locator('#ff-start').click();await page.keyboard.down('ArrowRight');await tick(2000);await page.keyboard.up('ArrowRight');await page.keyboard.press('p');await page.locator('#ff-end').click();assert.equal(await state(),'over');assert.match(await page.locator('#ff-storage-note').innerText(),/chưa lưu được/);await blocked.close();page=previous;
  });
  await check('mouse wheel over the ocean scrolls the page in welcome, play, pause and result states',async()=>{
    const wheelContext=await context(),wheelPage=await wheelContext.newPage();wheelPage.on('pageerror',e=>errors.push(e.message));
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
    }finally{await wheelContext.close();}
  });
  await check('no browser exceptions or game/account writes reach an external service',async()=>{
    assert.deepEqual(errors,[]);assert.ok(requests.filter(x=>x.method!=='GET').every(x=>x.method==='POST'&&(x.path==='/.netlify/functions/ncn-visitors'||x.path.startsWith('/.netlify/functions/ncn-scores?'))),JSON.stringify(requests.filter(x=>x.method!=='GET')));
  });
}finally{await writeFile(out+'/results.json',JSON.stringify({scope:'Isolated HTTP fixtures; external requests blocked',results},null,2));await desktop.close();await browser.close();await new Promise(done=>server.close(done));}
console.log('Ocean browser scenarios: '+results.length+' passed.');
