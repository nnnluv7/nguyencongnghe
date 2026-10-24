import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const production=process.env.NCN_UI_BASE_URL==='https://nguyencongnghe.com';
const root=resolve('public'),out=resolve('artifacts/scroll-ui'+(production?'/production':'/source'));
await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/.netlify/functions/')){
      const body=url.pathname.endsWith('ncn-announcements')?{items:[{id:'qa',text:'NCN · Kiểm tra giao diện cuộn và nhập liệu'}]}:{total:123,online:1};
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(body));return;
    }
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+sep))throw Error('Outside public root');
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=production?'https://nguyencongnghe.com':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const results=[];
let page;
async function check(name,action){
  try{await action();results.push({name,ok:true});console.log('PASS '+name);}
  catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',type:'jpeg',quality:65}).catch(()=>{});throw error;}
}
async function fresh(width=1280,height=900){
  if(page)await page.close();
  page=await browser.newPage({viewport:{width,height}});
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname!==new URL(base).hostname)return route.abort();
    return route.continue();
  });
  return page;
}
async function open(path){
  await page.goto(base+path,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('body.ncn-scroll-ready');
}
async function noOverflow(){
  const size=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.document<=size.viewport+1,JSON.stringify(size));
}
async function shot(name){
  const data=await page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:55});
  // Public fixture only; readable remotely when the editing environment is offline.
  console.log('NCN_QA_IMAGE '+name+' '+data.toString('base64'));
}
async function scrollChrome(){
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
  await page.waitForTimeout(100);
  await page.evaluate(()=>scrollTo(0,350));
  await page.waitForFunction(()=>document.body.classList.contains('ncn-chrome-hidden'));
  await page.evaluate(()=>scrollBy(0,-80));
  await page.waitForFunction(()=>!document.body.classList.contains('ncn-chrome-hidden'));
  await page.waitForTimeout(300);
}
try{
  if(production){
    const assets=['assets/ncn-theme/scroll-ui.js','assets/ncn-theme/announcements.js','assets/ncn-theme/announcements.css','assets/ncn-direct/style.css','assets/ncn-cash/style.css'];
    const expected=await Promise.all(assets.map(path=>readFile('public/'+path,'utf8')));
    const deadline=Date.now()+120000;let ready=false;
    while(Date.now()<deadline&&!ready){
      const matches=await Promise.all(assets.map(async(path,index)=>{
        try{const response=await fetch(base+'/'+path+'?ncn-qa='+Date.now(),{signal:AbortSignal.timeout(10000)});return response.ok&&(await response.text())===expected[index];}
        catch{return false;}
      }));
      ready=matches.every(Boolean);if(!ready)await new Promise(done=>setTimeout(done,3000));
    }
    assert.ok(ready,'Production must serve this commit before browser checks run');
    console.log('Production assets match the tested source.');
  }
  await fresh();
  await open('/sticker/?mau=ptg&co=1');
  await page.waitForSelector('.ncn-workspace-bar');
  await check('desktop: one form scroll, stable preview and primary print action',async()=>{
    const rail=page.locator('.st-editor-grid>.ncn-workspace-fields');
    assert.equal(await rail.evaluate(node=>getComputedStyle(node).position),'static');
    assert.equal(await rail.evaluate(node=>getComputedStyle(node).overflowY),'visible');
    assert.equal(await rail.locator('.ncn-print-settings').evaluate(node=>node.open),false);
    const input=rail.locator('input[data-field-index="0"]').first();
    await input.fill('NCN KIEM TRA');
    await page.waitForTimeout(300);
    await page.waitForFunction(()=>document.querySelector('#st-preview')?.contentDocument?.querySelector('input[data-field="0"]')?.value==='NCN KIEM TRA');
    await input.focus();
    await page.waitForFunction(()=>document.querySelector('#st-preview')?.contentDocument?.querySelector('input[data-ncn-active]'));
    await scrollChrome();
    const rect=await page.locator('.ncn-workspace-bar .ncn-print-primary').boundingBox();
    assert.ok(rect.y>=0&&rect.y+rect.height<=900,JSON.stringify(rect));
    await noOverflow();
    await shot('print-desktop');
  });
  await check('keyboard navigation restores hidden header',async()=>{
    await page.evaluate(()=>{document.activeElement?.blur();scrollBy(0,160);});
    await page.waitForFunction(()=>document.body.classList.contains('ncn-chrome-hidden'));
    await page.keyboard.press('Tab');
    await page.waitForFunction(()=>!document.body.classList.contains('ncn-chrome-hidden'));
  });
  for(const path of ['/','/2025/05/tu-van.html','/vong-quay-may-man/']){
    await check('shared chrome: '+path,async()=>{
      await open(path);
      await page.evaluate(()=>{const spacer=document.createElement('div');spacer.dataset.ncnQa='scroll-space';spacer.style.height='1400px';document.body.append(spacer);});
      await scrollChrome();
      await noOverflow();
    });
  }
  await check('game keeps one aligned navigation control',async()=>{
    await open('/flappy-bird/');
    assert.equal(await page.locator('#ncn-game-menu').count(),1);
    await page.locator('#ncn-game-menu').click();
    await page.waitForSelector('body.ncn-game-menu-open');
    assert.equal(await page.locator('body.ncn-chrome-hidden').count(),0);
    await page.keyboard.press('Escape');
    await noOverflow();
  });
  await check('cash retains nine denominations and comma ERP in a narrower glass card',async()=>{
    await open('/2024/02/kiem-quy.html');
    await page.waitForSelector('#ncn-cash-app[data-cq-mounted]');
    await page.locator('#cq-erp').fill('1234567');
    assert.equal(await page.locator('#cq-erp').inputValue(),'1,234,567');
    await page.locator('#cq-qty-500000').fill('2');
    assert.equal(await page.locator('#cq-rows tr').count(),9);
    assert.equal(await page.locator('#cq-qty-500').count(),0);
    assert.match(await page.locator('#cq-actual').textContent(),/1.000.000/);
    const box=await page.locator('#ncn-cash-app').boundingBox();
    const table=await page.locator('.cq-table-scroll').boundingBox();
    assert.ok(box.width<=480.5,JSON.stringify(box));assert.ok(table.width<=400.5,JSON.stringify(table));
    await noOverflow();await shot('cash-compact');
  });
  const legacy=JSON.parse(await readFile('docs/print-workspace-baseline.json','utf8')).legacy;
  for(const path of [...legacy,'2024/01/in-fifo.html']){
    await check('legacy workspace: '+path,async()=>{
      await open('/'+path);await page.waitForSelector('.ncn-workspace-bar');
      const bar=await page.locator('.ncn-workspace-bar').boundingBox();
      assert.ok(bar.width>300,JSON.stringify(bar));
      const rail=page.locator('.ncn-workspace-fields');
      assert.equal(await rail.evaluate(node=>getComputedStyle(node).overflowY),'visible');
      await noOverflow();
    });
  }
  await fresh(390,844);
  await check('mobile: switch preview/input without losing typed data',async()=>{
    await open('/sticker/?mau=ptg&co=1');await page.waitForSelector('.ncn-workspace-bar');
    const workspace=page.locator('.ncn-workspace-focus'),bar=workspace.locator('.ncn-workspace-bar');
    await page.waitForTimeout(200);
    assert.equal(await workspace.locator('.ncn-workspace-fields').isVisible(),false);
    await bar.locator('[data-ncn-pane=fields]').click();
    const input=workspace.locator('input[data-field-index="0"]').first();await input.fill('NCN MOBILE');
    await bar.locator('[data-ncn-pane=paper]').click();
    assert.equal(await workspace.locator('.ncn-workspace-paper').isVisible(),true);
    await bar.locator('[data-ncn-pane=fields]').click();
    assert.equal(await input.inputValue(),'NCN MOBILE');
    assert.equal(await workspace.locator('.ncn-workspace-paper').isVisible(),false);
    await noOverflow();await shot('print-mobile-input');
  });
  for(const path of ['/popup-a7/?mau=tag1','/ban-hang/','/trang-tri/']){
    await check('mobile editor navigation: '+path,async()=>{
      await open(path);
      if(!await page.locator('.ncn-workspace-bar').isVisible()){
        await page.waitForSelector('[data-model]');
        await page.locator('[data-model]').first().click();
      }
      await page.waitForSelector('.ncn-workspace-bar');
      await page.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
      assert.equal(await page.locator('.ncn-workspace-fields').isVisible(),true);
      await noOverflow();
    });
  }
  for(const path of ['/2024/01/in-fifo.html','/2022/07/phieu-tu-van-tra-gop.html','/2024/02/kiem-quy.html']){
    await check('mobile compact form: '+path,async()=>{
      await open(path);
      const switcher=page.locator('.ncn-workspace-bar [data-ncn-pane=fields]');
      if(await switcher.count())await switcher.click();
      await noOverflow();
    });
  }
  await check('reduced motion removes chrome animation',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#ncn-topbar').evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  });
}finally{
  await writeFile(out+'/results.json',JSON.stringify({base:production?'Production public pages; no authenticated session':'Local public source; synthetic public announcement only',results},null,2));
  await browser.close();await new Promise(done=>server.close(done));
}
if(results.some(result=>!result.ok))process.exitCode=1;
console.log('Browser scenarios: '+results.length+' passed.');
