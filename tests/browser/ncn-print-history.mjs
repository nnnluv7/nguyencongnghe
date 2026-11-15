import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

// Use the real history implementation in both engines. UA emulation alone
// cannot catch WebKit restoring a child document instead of the catalogue.
const engine=process.env.NCN_PRINT_BROWSER||'chromium',root=resolve('dist'),out=resolve('artifacts/print-history/'+engine);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/.netlify/')){res.writeHead(200,{'Content-Type':types['.json']});res.end(JSON.stringify({items:[],online:0,total:0,user:null,profile:null,external:{email:true}}));return;}
    let file=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(file===root||file.startsWith(root+sep));
    if((await stat(file)).isDirectory())file+='/index.html';
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await mkdir(out,{recursive:true});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await ({chromium,webkit}[engine]).launch(),results=[];
const cases=[
  ['/ban-hang/','sales-doi-tra-bao-hanh','nt',null],
  ['/ban-hang/','sales-bh-giao-hang','nt',2],
  ['/sticker/','gg2','st',0],
  ['/popup-a7/','btn-gach','st',0],
  ['/trang-tri/','decor-buom-2','nt',null]
];
try{
  for(const width of [390,1280])for(const [path,id,prefix,field]of cases){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    try{
      await page.goto(base+'/');await page.goto(base+path);
      const card=page.locator('[data-card-model="'+id+'"]');await card.waitFor();
      const start=await page.evaluate(()=>history.length),value='THỬ QUAY VỀ';
      for(let cycle=0;cycle<3;cycle++){
        await card.locator('[data-variant]').first().click();
        const frame=page.frameLocator('#'+prefix+'-preview');
        await page.waitForFunction(prefix=>{
          const doc=document.getElementById(prefix+'-preview').contentDocument;
          return doc?.readyState==='complete'&&doc.querySelector('.ncn-sheet')?.childElementCount>0;
        },prefix);
        assert.equal(await page.evaluate(prefix=>{
          const frame=document.getElementById(prefix+'-preview'),doc=frame.contentDocument,script=doc.createElement('script');
          script.textContent='window.__ncnInjectedScript=true';doc.head.append(script);script.remove();
          return !frame.contentWindow.__ncnInjectedScript&&doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content.includes("script-src 'none'");
        },prefix),true,'preview callbacks work without allowing embedded scripts');
        if(field!==null){
          const input=frame.locator('[data-ncn-copy="0"][data-field="'+field+'"]').first();
          if(!cycle)await input.fill(value);else assert.equal(await input.inputValue(),value,'return keeps the draft');
          assert.equal(await page.locator('#'+prefix+'-field-'+field).inputValue(),value,'typing in the preview immediately updates the editor state');
        }
        if(width===390)await page.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
        const settings=page.locator('.ncn-print-settings');
        if(!await settings.evaluate(node=>node.open))await settings.locator('summary').first().click();
        for(const paper of ['A5','A4']){
          const generation=await page.locator('#'+prefix+'-preview').evaluate(frame=>frame.contentDocument.documentElement.getAttribute('data-ncn-direct-generation'));
          await page.locator('#'+prefix+'-paper').selectOption(paper);
          await page.waitForFunction(({prefix,generation})=>{
            const doc=document.getElementById(prefix+'-preview').contentDocument;
            return doc?.readyState==='complete'&&doc.documentElement.getAttribute('data-ncn-direct-generation')!==generation&&doc.querySelector('.ncn-sheet')?.childElementCount>0;
          },{prefix,generation});
        }
        if(width===390)await page.locator('.ncn-workspace-bar [data-ncn-pane=paper]').click();
        const historySize=await page.evaluate(()=>history.length);
        console.log(JSON.stringify({engine,width,path,id,cycle,start,historySize}));
        assert.equal(historySize,start+1,'preview updates must not add child-frame history entries');
        if(cycle===1)await page.locator('#'+prefix+'-change-model').click();else await page.goBack();
        await page.waitForURL(base+path);
        await card.waitFor({state:'visible'});
        assert.equal(await page.locator('#'+prefix+'-workspace').evaluate(node=>node.hidden),true,'one Back/Choose click must return to the catalogue');
      }
      // An already-open tab can retain child history made by an older build.
      // A swallowed traversal must never leave Choose locked indefinitely.
      await card.locator('[data-variant]').first().click();
      await page.waitForFunction(prefix=>document.getElementById(prefix+'-preview').contentDocument.querySelector('.ncn-sheet')?.childElementCount>0,prefix);
      for(let i=0;i<2;i++)await page.evaluate(({prefix,i})=>new Promise(resolve=>{
        const frame=document.getElementById(prefix+'-preview');frame.addEventListener('load',resolve,{once:true});
        frame.srcdoc='<!doctype html><html><body><p>Old cached preview '+i+'</p></body></html>';
      }),{prefix,i});
      await page.locator('#'+prefix+'-change-model').click();
      await page.waitForURL(base+path,{timeout:5000});await card.waitFor({state:'visible'});
      await card.locator('[data-variant]').first().click();
      await page.waitForFunction(prefix=>document.getElementById(prefix+'-preview').contentDocument.querySelector('.ncn-sheet')?.childElementCount>0,prefix);
      assert.deepEqual(errors,[]);results.push({path,id,width,ok:true});
      await page.screenshot({path:out+'/'+id+'-'+width+'.jpg',type:'jpeg',quality:75});
      console.log('PASS '+engine+' '+path+id+' '+width+'px: one Back, one Choose, repeated reopen, paper changes and draft');
    }catch(error){await page.screenshot({path:out+'/failure-'+id+'-'+width+'.jpg',type:'jpeg',quality:75}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
}finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close();await new Promise(done=>server.close(done));}
