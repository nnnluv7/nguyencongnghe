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
  await page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:75});
  console.log('Screenshot: '+name);
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
    const assets=['assets/ncn-theme/scroll-ui.js','assets/ncn-theme/announcements.js','assets/ncn-theme/announcements.css','assets/ncn-direct/style.css','assets/ncn-direct/workspace.js','assets/ncn-insurance/style.css','assets/ncn-cash/style.css'];
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
  for(const width of [1280,390])for(const path of ['/sticker/','/popup-a7/','/popup-a4-a5-a6/','/ban-hang/','/trang-tri/']){
    await check('model selection starts at the editor: '+path+' '+width,async()=>{
      await fresh(width,900);await open(path);await page.waitForSelector('[data-model]');
      const prefix=path==='/ban-hang/'||path==='/trang-tri/'?'nt':'st';
      for(let repeat=0;repeat<2;repeat++){
        if(repeat){await page.locator('#'+prefix+'-change-model').click();await page.waitForSelector('.st-catalogue:not([hidden])');}
        const choice=path==='/sticker/'&&!repeat?page.locator('[data-model="grq"][data-variant="0"]'):page.locator('[data-model]').last();
        await choice.click();
        await page.waitForFunction(prefix=>{
          const workspace=document.getElementById(prefix+'-workspace'),rect=workspace.getBoundingClientRect();
          const space=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ncn-chrome-space'))||100;
          return !workspace.hidden&&document.querySelector('.st-catalogue').hidden&&rect.top>=space-4&&rect.top<=space+32;
        },prefix,{timeout:3000});
        // Fonts, iframe loading and pending smooth scrolls must not move it again.
        await page.waitForTimeout(650);
        const position=await page.locator('#'+prefix+'-workspace').evaluate(node=>({top:node.getBoundingClientRect().top,space:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ncn-chrome-space'))||100}));
        assert.ok(position.top>=position.space-4&&position.top<=position.space+32,JSON.stringify(position));
        const print=await page.locator('.ncn-print-primary').boundingBox();
        assert.ok(print.y>=0&&print.y+print.height<=900,JSON.stringify(print));
        assert.equal(await page.locator('.ncn-workspace-paper').isVisible(),true);
        await noOverflow();
      }
    });
  }
  await fresh();
  await open('/sticker/?mau=ptg&co=1');
  await page.waitForSelector('.ncn-workspace-bar');
  await check('desktop: full paper and one compact control rail',async()=>{
    const rail=page.locator('.st-editor-grid>.ncn-workspace-fields');
    assert.equal(await rail.evaluate(node=>getComputedStyle(node).position),'sticky');
    assert.equal(await rail.evaluate(node=>getComputedStyle(node).overflowY),'auto');
    assert.equal(await rail.locator('.ncn-workspace-bar .ncn-print-primary').count(),1);
    assert.equal(await rail.locator('.ncn-workspace-switch').isVisible(),false);
    assert.equal(await rail.locator('.ncn-print-fields').evaluate(node=>node.open),false);
    assert.equal(await rail.locator('.ncn-print-help').evaluate(node=>node.open),true);
    const stage=await page.locator('.ncn-direct-stage').evaluate(node=>({height:node.clientHeight,content:node.scrollHeight}));
    assert.ok(stage.content<=stage.height+1,JSON.stringify(stage));
    assert.equal(await rail.locator('.ncn-print-settings').evaluate(node=>node.open),false);
    await rail.locator('.ncn-print-fields>summary').click();
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
  await check('pointer focus, iframe gestures and measurement resize cannot pin the header',async()=>{
    await page.evaluate(()=>scrollTo(0,0));
    await page.locator('#ncn-announcement-pause').click();
    const paper=await page.locator('.ncn-direct-stage').boundingBox();
    await page.mouse.move(paper.x+100,paper.y+100);
    await page.mouse.wheel(0,160);
    await page.waitForFunction(()=>document.body.classList.contains('ncn-chrome-hidden'));
    await page.evaluate(()=>dispatchEvent(new Event('resize')));
    await page.waitForTimeout(350);
    assert.equal(await page.locator('body.ncn-chrome-hidden').count(),1);
    await page.mouse.wheel(0,-60);
    await page.waitForFunction(()=>!document.body.classList.contains('ncn-chrome-hidden'));
    await page.mouse.wheel(0,100);
    await page.waitForFunction(()=>document.body.classList.contains('ncn-chrome-hidden'));
    await shot('scroll-down');
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
  await check('insurance: cash-sized form preserves all calculation and insurance choices',async()=>{
    await open('/2025/05/tu-van.html');
    const box=await page.locator('#ncn-insurance-app').boundingBox();
    assert.ok(box.width<=480.5,JSON.stringify(box));
    await page.locator('#giaban').fill('10000000');
    await page.locator('#giagoc').fill('10000000');
    assert.equal((await page.locator('#gopmoithang').textContent()).replace(/\D/g,''),'1178000');
    for(const [id,group] of [['cb1','bhkv'],['cb2','bhrv'],['cb3','bhmr'],['cb4','bh11']]){
      await page.locator('#'+id).check();
      assert.equal(await page.locator('tr.'+group).first().isVisible(),true);
      await page.locator('#'+id).uncheck();
      assert.equal(await page.locator('tr.'+group).first().isVisible(),false);
    }
    await noOverflow();await shot('insurance-compact');
  });
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
  await check('cash print preview keeps report values and a working close action',async()=>{
    await page.locator('#cq-print').click();
    const dialog=page.locator('dialog.ncn-print-dialog[open]');
    await dialog.locator('.ncn-print-primary').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('dialog.ncn-print-dialog .ncn-print-primary').disabled);
    assert.match(await dialog.locator('iframe').evaluate(frame=>frame.contentDocument.body.textContent),/1.000.000/);
    await noOverflow();await shot('cash-print-preview');
    await dialog.getByRole('button',{name:'← Quay lại chỉnh sửa'}).click();
    assert.equal(await page.locator('dialog.ncn-print-dialog').count(),0);
  });
  const legacy=JSON.parse(await readFile('docs/print-workspace-baseline.json','utf8')).legacy;
  for(const path of [...legacy,'2024/01/in-fifo.html']){
    await check('legacy workspace: '+path,async()=>{
      await open('/'+path);await page.waitForSelector('.ncn-workspace-bar');
      const bar=await page.locator('.ncn-workspace-bar').boundingBox();
      assert.ok(bar.width>=230,JSON.stringify(bar));
      const rail=page.locator('.ncn-workspace-fields');
      assert.equal(await rail.evaluate(node=>getComputedStyle(node).overflowY),'auto');
      assert.equal(await rail.locator('.ncn-workspace-bar .ncn-print-primary').count(),1);
      const viewport=page.locator('.ncn-workspace-paper .ncn-print-stage,.ncn-workspace-paper .ncn-mobile-sheet-viewport');
      await page.waitForFunction(()=>{
        const stage=document.querySelector('.ncn-workspace-paper .ncn-print-stage,.ncn-workspace-paper .ncn-mobile-sheet-viewport');
        return stage&&stage.clientHeight>0;
      });
      const fit=await viewport.evaluate(node=>({height:node.clientHeight,content:node.scrollHeight}));
      assert.ok(fit.content<=fit.height+1,JSON.stringify(fit));
      await noOverflow();
      await page.emulateMedia({media:'print'});
      assert.equal(await rail.isVisible(),false);
      assert.equal(await page.locator('#printMe,.row-container').first().isVisible(),true);
      if(path==='2022/07/phieu-tu-van-tra-gop.html')await page.pdf({path:out+'/legacy-print.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
      await page.emulateMedia({media:'screen'});
    });
  }
  // Render the exact four private dialog shells with synthetic paper only.
  // No authenticated account or price API is involved in these fixtures.
  for(const width of [1280,390])for(const group of ['ncn-event-private','ncn-gvgs-private'])for(const role of ['admin','vip']){
    await check('private print shell: '+group+'/'+role+' '+width,async()=>{
      await fresh(width,900);await page.goto(base+'/');
      const source=await readFile('netlify/lib/'+group+'/'+role+'.html','utf8');
      const dialog=source.match(/<dialog\b[\s\S]*?<\/dialog>/)[0];
      const gvgs=group==='ncn-gvgs-private';
      await page.setContent('<head><link rel="stylesheet" href="'+base+'/assets/ncn-event.css">'+(gvgs?'<link rel="stylesheet" href="'+base+'/assets/ncn-gvgs.css">':'')+'<link rel="stylesheet" href="'+base+'/assets/ncn-theme/site.css"><link rel="stylesheet" href="'+base+'/assets/ncn-direct/style.css"></head><body class="ncn-modern ncn-event-page'+(gvgs?' ncn-gvgs-page':'')+'"><div id="ncn-event-app">'+dialog+'</div></body>');
      await page.evaluate(async()=>{
        const dialog=document.querySelector('dialog'),frame=dialog.querySelector('iframe');
        frame.srcdoc='<html><style>body{margin:0}.sheet{width:794px;height:1123px;background:white;color:black}</style><body><div class="sheet">NCN · Bản in kiểm tra</div></body></html>';
        dialog.showModal();
        const {installPrintWorkspaces}=await import('/assets/ncn-direct/workspace.js');installPrintWorkspaces();
      });
      await page.locator('.ncn-print-help').waitFor({state:'attached'});
      assert.equal(await page.locator('#ev-print').isVisible(),true);
      assert.equal(await page.locator('#ev-close').isVisible(),true);
      const boxes=await page.locator('dialog').evaluate(node=>({dialog:node.getBoundingClientRect().toJSON(),rail:node.querySelector('aside').getBoundingClientRect().toJSON(),stage:node.querySelector('.ncn-print-stage').getBoundingClientRect().toJSON()}));
      assert.ok(boxes.dialog.width<=width,JSON.stringify(boxes));
      assert.ok(boxes.rail.right<=boxes.dialog.right+1,JSON.stringify(boxes));
      if(width===1280)assert.ok(boxes.stage.right<=boxes.rail.left,JSON.stringify(boxes));
      else assert.ok(boxes.rail.bottom<=boxes.stage.top+1,JSON.stringify(boxes));
      await noOverflow();
      if(group==='ncn-gvgs-private'&&role==='vip')await shot('vip-print-'+width);
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
  for(const path of [...legacy.map(path=>'/'+path),'/2024/01/in-fifo.html','/2024/02/kiem-quy.html','/2025/05/tu-van.html']){
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
