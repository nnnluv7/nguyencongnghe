import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

// Only synthetic input on a local server; never opens the system print dialog.
const root=resolve(process.env.NCN_PRINT_AUDIT_ROOT||'dist'),out=resolve('artifacts/print-defaults');
const generated=new Map(),cases=[];
for(const group of ['ncn-sticker','ncn-popup']){
  const data=JSON.parse(await readFile('public/assets/'+group+'/catalogue.json','utf8'));
  const core=await import('../../public/assets/'+group+'/core.js');
  for(const layout of data.layouts){
    const indices=layout.fields.flatMap((f,i)=>f.placeholder===''&&/0/.test(f.example)?[i]:[]);
    if(!indices.length)continue;
    const path='/__print-defaults/'+layout.id+'.html';
    generated.set(path,core.renderDocument(layout,[core.defaultRow(layout)],{fontCSS:data.fontCSS,preview:true,editable:true}));
    cases.push({path,layout,indices});
  }
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/.netlify/')){
      res.writeHead(200,{'Content-Type':mime['.json']});res.end(JSON.stringify({items:[],total:0,online:0,user:null,profile:null}));return;
    }
    if(generated.has(url.pathname)){res.writeHead(200,{'Content-Type':mime['.html']});res.end(generated.get(url.pathname));return;}
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    assert.ok(path===root||path.startsWith(root+sep));
    if((await stat(path)).isDirectory())path+='/index.html';
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
let checkedFields=0;
try{
  const gallery=await browser.newPage();
  await gallery.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  for(const {path,layout,indices} of cases){
    await gallery.goto(base+path);
    for(const i of indices){
      const input=gallery.locator('input[data-ncn-copy="0"][data-field="'+i+'"]');
      assert.equal(await input.inputValue(),layout.fields[i].initial,layout.id);
      assert.equal(await input.getAttribute('placeholder'),'',layout.id);
      assert.equal(await input.getAttribute('aria-label'),layout.fields[i].label,layout.id);
      checkedFields++;
    }
  }
  await gallery.close();assert.equal(checkedFields,131);assert.equal(cases.length,58);
  for(const width of [1280,390])for(const [path,app] of [['/sticker/?mau=gg2&co=1','ncn-sticker-app'],['/popup-a7/?mau=btn-gach','ncn-popup-app']]){
    const page=await browser.newPage({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,acceptDownloads:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.stack));
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    await page.locator('#'+app+'[data-ready=true]').waitFor();
    const frame=page.frameLocator('#st-preview'),name=frame.locator('[data-ncn-copy="0"][data-field="0"]'),price=frame.locator('[data-ncn-copy="0"][data-field="1"]');
    await price.waitFor();
    const original=await price.inputValue();assert.ok(/00\.000\.000/.test(original));
    assert.equal(await price.getAttribute('placeholder'),'');
    assert.equal(await name.inputValue(),'');assert.equal(await name.getAttribute('placeholder'),'TÊN SẢN PHẨM');
    if(width<960)await price.tap();else await price.click();
    // Replace a single middle digit, preserving the rest of the real value.
    await price.press('Home');await price.press('ArrowRight');await price.press('Shift+ArrowRight');await price.press('7');
    const edited=original.slice(0,1)+'7'+original.slice(2);
    assert.equal(await price.inputValue(),edited);
    assert.equal(await price.evaluate(n=>n.selectionStart),2,'caret must survive synchronized fields');
    assert.equal(await page.locator('#st-field-1').inputValue(),edited);
    assert.equal(await frame.locator('[data-ncn-copy="1"][data-field="1"]').inputValue(),original,'sibling label must keep its default');
    await price.fill('');await name.click();
    assert.equal(await price.inputValue(),'');assert.equal(await price.getAttribute('placeholder'),'','cleared price must not show ghost zeros');
    await name.fill('SẢN PHẨM QA');await price.fill('12.345.000đ');
    if(width<960)await page.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
    assert.equal(await page.locator('#st-field-0').inputValue(),'SẢN PHẨM QA');
    // Touch/desktop users can opt into changing the remaining grouped labels.
    const fieldPanel=page.locator('.ncn-print-fields');
    if(!await fieldPanel.evaluate(n=>n.open))await fieldPanel.locator('summary').click();
    await page.locator('.ncn-direct-link-toggle input').check();
    if(width<960)await page.locator('.ncn-workspace-bar [data-ncn-pane=paper]').click();
    const grouped=frame.locator('[data-ncn-copy="1"][data-field="2"]');await grouped.fill('9.999.000đ');
    assert.equal(await frame.locator('[data-ncn-copy="2"][data-field="2"]').inputValue(),'9.999.000đ');
    assert.notEqual(await frame.locator('[data-ncn-copy="0"][data-field="2"]').inputValue(),'9.999.000đ');
    // Restore untouched defaults so they do not require product names to export.
    await grouped.fill(await frame.locator('[data-ncn-copy="0"][data-field="2"]').inputValue());
    if(width<960)await page.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
    const downloadReady=page.waitForEvent('download');await page.locator('#st-download').click();
    const download=await downloadReady,filename=out+'/'+app+'-'+width+'.html';await download.saveAs(filename);
    const html=await readFile(filename,'utf8');
    assert.ok(html.includes('SẢN PHẨM QA'));assert.ok(html.includes('12.345.000đ'));
    assert.equal(/data-ncn-copy=|<script\b/.test(html),false,'offline document stays passive');
    assert.equal(/(?:src|url)\s*[(=]\s*["']?\/assets\//i.test(html),false,'fonts and artwork stay embedded');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:out+'/'+app+'-'+width+'.jpg',type:'jpeg',quality:75});await page.close();
    console.log('PASS editor '+path+' at '+width+'px: caret, hints, clearing, copies, grouped edits and download');
  }
  console.log('PASS '+checkedFields+' real numeric defaults across '+cases.length+' layouts; source '+root);
}finally{await browser.close();await new Promise(done=>server.close(done));}
