import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const built=process.env.NCN_INSURANCE_BUILT==='1',baseline=process.env.NCN_INSURANCE_BASELINE==='1';
const root=resolve(built?'dist':'public'),out=resolve('artifacts/insurance-ui/'+(baseline?'before':built?'built':'source'));
await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/.netlify/')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({items:[],online:0,total:0,user:null,profile:null,external:{email:true}}));return;}
    let file=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(file===root||file.startsWith(root+sep));
    if((await stat(file)).isDirectory())file+='/index.html';
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
const money=async id=>(await page.locator('#'+id).textContent()).replace(/\D/g,'');
try{
  await page.goto(base+'/2025/05/tu-van.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof updateTotal==='function'&&document.body.classList.contains('ncn-scroll-ready'));await page.evaluate(()=>document.fonts.ready);
  await page.locator('#giagoc').fill('10000000');await page.locator('#giaban').fill('10000000');
  assert.equal(await money('gopmoithang'),'1178000');
  for(const [id,group] of [['cb1','bhkv'],['cb2','bhrv'],['cb3','bhmr'],['cb4','bh11']]){
    await page.locator('#'+id).check();assert.ok(await page.locator('tr.'+group).first().isVisible());
    await page.locator('#'+id).uncheck();assert.equal(await page.locator('tr.'+group).first().isVisible(),false);
  }
  for(const [width,zoom] of [[1280,1],[768,1],[390,1],[320,1],[1280,1.5]])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    await page.evaluate(({zoom,theme})=>{document.documentElement.style.zoom=zoom;document.documentElement.dataset.ncnTheme=theme;},{zoom,theme});
    for(const id of ['cb1','cb2','cb3','cb4'])await page.locator('#'+id).check();
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const state=await page.locator('#ncn-insurance-app').evaluate((app,zoom)=>{
      const rect=app.getBoundingClientRect();
      return {width:rect.width/zoom,viewport:innerWidth,content:document.documentElement.scrollWidth,
        fields:[...app.querySelectorAll('input[type=text],select')].filter(el=>el.getClientRects().length).map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {id:el.id,height:r.height/zoom,radius:parseFloat(s.borderRadius),inside:r.left>=rect.left-1&&r.right<=rect.right+1,border:s.borderColor,shadow:s.boxShadow};}),
        choices:[...app.querySelectorAll('.ncn-insurance-options label')].map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {height:r.height/zoom,inside:r.left>=rect.left-1&&r.right<=rect.right+1,shadow:s.boxShadow};}),
        result:getComputedStyle(app.querySelector('#gopmoithang')).borderRadius,resultBorder:getComputedStyle(app.querySelector('#gopmoithang')).borderColor};
    },zoom);
    assert.ok(state.width<=480.5&&state.content<=state.viewport+1,JSON.stringify(state));
    for(const field of state.fields){assert.ok(field.inside,JSON.stringify(field));if(!baseline){assert.ok(field.height>=43.5&&field.radius>=12,JSON.stringify(field));assert.equal(field.border,state.resultBorder,JSON.stringify(field));}}
    if(!baseline){for(const choice of state.choices)assert.ok(choice.inside&&choice.height>=43.5&&choice.shadow!=='none',JSON.stringify(choice));assert.ok(parseFloat(state.result)>=12);}
    results.push({width,zoom,theme,state});
    if(zoom===1&&[1280,390].includes(width)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+width+'-'+theme+'.png',fullPage:true});}
  }
  await page.evaluate(()=>document.documentElement.style.zoom='');
  await page.locator('#radio12t').check();assert.ok(await page.locator('#radio12t').isChecked());await page.locator('#radio6t').check();
  await page.locator('#radio24tmr').check();assert.ok(await page.locator('#radio24tmr').isChecked());await page.locator('#radio12tmr').check();
  for(const id of ['cb1','cb2','cb3','cb4'])await page.locator('#'+id).uncheck();
  await page.locator('#tratruoc').fill('50');assert.equal(await money('tratruocfn'),'5000000');
  await page.locator('#kieutratruoc').selectOption('2');await page.locator('#tratruoc').fill('3000000');assert.equal(await money('tratruocfn'),'3000000');
  await page.locator('#goi').selectOption('12');assert.ok(Number(await money('gopmoithang'))>0);
  await page.locator('#nhomhang').selectOption('5');assert.ok(Number(await money('gopmoithang'))>0);
  assert.deepEqual(errors,[]);console.log('PASS insurance: 10 responsive light/dark/zoom layouts, all policy choices and calculation controls');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await ctx.close();await browser.close();await new Promise(done=>server.close(done));}
