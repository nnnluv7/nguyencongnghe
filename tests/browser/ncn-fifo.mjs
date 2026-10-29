import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';

const built=!!process.env.NCN_BUILT_TEST,root=resolve(built?'dist':'public'),out=resolve('artifacts/fifo/'+(built?'built':'source'));
await mkdir(out,{recursive:true});
const catalog=publicCatalog(JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'))),requests=[],errors=[],results=[];
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.push({url:url.pathname,method:req.method,body:''});
  const request=requests.at(-1);req.on('data',bytes=>request.body+=bytes.toString());
  const json=value=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
  if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-library')?{items:catalog}:url.pathname.endsWith('ncn-announcements')?{items:[{id:'fifo-test',text:'NCN · Kiểm tra FIFO'}]}:url.pathname.endsWith('ncn-billing')?{user:null}:{online:1,total:1});
  try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('Outside fixture');if((await stat(file)).isDirectory())file+='/index.html';let body=await readFile(file);if(file.endsWith('.html'))body=renderPublicHTML(body.toString(),catalog);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1366,height:1000}});let page=await context.newPage();
await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());page.on('pageerror',error=>errors.push(error.message));
const open=async()=>{await page.goto(base+'/2024/01/in-fifo.html');await page.locator('#ncn-fifo-app[data-ready=true]').waitFor();};
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure.jpg',fullPage:true}).catch(()=>{});throw error;}};
const add=async value=>{await page.locator('#fifo-scan').fill(value);await page.locator('#fifo-scan').press('Enter');};
const assertFits=async()=>{const size=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.w+1,JSON.stringify(size));};
const xmlTemplate=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="IN FIFO TEM 105"><Table><Row ss:Index="7"><Cell ss:Index="3"><Data ss:Type="String">Hiển Thị</Data></Cell></Row><Row><Cell ss:Index="3"><Data ss:Type="String">Hiển Thị</Data></Cell><Cell ss:Index="11"><Data ss:Type="String">X</Data></Cell></Row><Row><Cell ss:Index="3"><Data ss:Type="String">Hiển Thị</Data></Cell></Row><Row ss:Index="12"><Cell ss:Index="2"><Data ss:Type="String">Hiện Tại</Data></Cell></Row><Row><Cell ss:Index="18"><Data ss:Type="String">X</Data></Cell></Row><Row ss:Index="16"><Cell ss:Index="11"><Data ss:Type="String">ĐEN 128GB</Data></Cell><Cell ss:Index="14"><Data ss:Type="String">000000000000001</Data></Cell></Row><Row ss:Index="63"><Cell ss:Index="14"><Data ss:Type="String">000000000000002</Data></Cell></Row></Table></Worksheet></Workbook>`;
try{
  await open();
  await check('FIFO starts independently of Excel and retired libraries',async()=>{
    assert.equal(await page.locator('#fifo-preview-sheet button[data-position]').count(),48);assert.equal(await page.locator('#printMe .fifo-label').count(),48);assert.equal(await page.locator('#fifo-print').isDisabled(),true);
    assert.equal(requests.some(x=>/125962|3fcb8ddc0ca85c73a0/.test(x.url)),false);assert.equal(await page.locator('script[src*="/assets/vendor/"],script[src*="/assets/js/"]').count(),0);await assertFits();
  });
  await check('scanner fills selected fixed slots, keeps leading zeros and never scrolls the main page',async()=>{
    await page.locator('#fifo-select-none').click();for(const i of [0,2,47])await page.locator('#fifo-position-'+i).click();await page.locator('#fifo-quick-color').fill('ĐEN 128GB');
    await page.locator('#fifo-scan').focus();const before=await page.evaluate(()=>scrollY);
    for(let i=1;i<=3;i++)await add('00000000000000'+i);
    assert.equal(await page.locator('#fifo-imei-0').inputValue(),'000000000000001');assert.equal(await page.locator('#fifo-imei-2').inputValue(),'000000000000002');assert.equal(await page.locator('#fifo-imei-47').inputValue(),'000000000000003');assert.equal(await page.locator('#fifo-print').innerText(),'In 3 tem');
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<2);await add('000000000000004');assert.match(await page.locator('#fifo-status').innerText(),/đã đủ IMEI/);assert.equal(await page.locator('#fifo-imei-47').inputValue(),'000000000000003');
    await page.locator('#fifo-position-2').click();assert.equal(await page.locator('#fifo-imei-2').inputValue(),'000000000000002');assert.equal(await page.locator('#printMe [data-position="3"] .fifo-label-imei').textContent(),'');assert.equal(await page.locator('#printMe [data-position="48"] .fifo-label-imei').textContent(),'0003');await page.locator('#fifo-position-2').click();
  });
  await check('hiding a line preserves the physical location of all remaining lines',async()=>{
    const target=page.locator('#fifo-preview-sheet [data-position="1"] .fifo-label-imei'),before=(await target.boundingBox()).y;
    await page.locator('#fifo-show-date').uncheck();await page.locator('#fifo-show-color').uncheck();assert.equal((await target.boundingBox()).y,before);await page.locator('#fifo-show-date').check();await page.locator('#fifo-show-color').check();
  });
  await check('paste overflow preserves the draft and clear is undoable',async()=>{
    await page.locator('#fifo-import-open').click();await page.locator('#fifo-paste').fill(Array.from({length:49},(_,i)=>'00000'+i).join('\n'));await page.locator('#fifo-apply-import').click();assert.match(await page.locator('#fifo-import-status').innerText(),/49 dòng/);assert.equal(await page.locator('#fifo-imei-0').inputValue(),'000000000000001');await page.locator('#fifo-import-close').click();
    await page.locator('#fifo-clear').click();assert.equal(await page.locator('#fifo-imei-0').inputValue(),'');await page.locator('#fifo-undo').click();assert.equal(await page.locator('#fifo-imei-0').inputValue(),'000000000000001');
  });
  await check('CSV imports without Excel, refresh retains the draft and manual date format',async()=>{
    await page.locator('#fifo-import-open').click();await page.locator('#fifo-import-mode').selectOption('replace');await page.locator('#fifo-paste').fill('Màu\tIMEI\nĐỎ 256GB\t000000000000011\n\t000000000000012');await page.locator('#fifo-apply-import').click();
    await page.locator('#fifo-date').fill('2026-10-29');await page.locator('#fifo-date-format').selectOption('dd/mm');await page.waitForTimeout(250);await page.reload();await page.locator('#ncn-fifo-app[data-ready=true]').waitFor();
    assert.equal(await page.locator('#fifo-imei-0').inputValue(),'000000000000011');assert.equal(await page.locator('#fifo-imei-2').inputValue(),'000000000000012');assert.equal(await page.locator('#printMe [data-position="3"] .fifo-label-color').textContent(),'ĐỎ 256GB');assert.equal(await page.locator('#fifo-date').inputValue(),'2026-10-29');assert.equal(await page.locator('#fifo-date-format').inputValue(),'dd/mm');assert.equal(requests.some(x=>/125962/.test(x.url)),false);
  });
  await check('the real Excel reader loads on selection and template masks retain absolute positions',async()=>{
    await page.locator('#fifo-import-open').click();await page.locator('#fifo-file').setInputFiles({name:'template-fixture.xls',mimeType:'application/vnd.ms-excel',buffer:Buffer.from(xmlTemplate)});await page.waitForFunction(()=>document.getElementById('fifo-import-status').textContent.includes('Đã đọc mẫu 48 tem'));
    await page.locator('#fifo-apply-import').click();assert.equal(await page.locator('#fifo-imei-0').inputValue(),'000000000000001');assert.equal(await page.locator('#fifo-imei-47').inputValue(),'000000000000002');assert.equal(await page.locator('#fifo-enabled-0').isChecked(),true);assert.equal(await page.locator('#fifo-enabled-47').isChecked(),true);assert.equal(await page.locator('#fifo-enabled-1').isChecked(),false);assert.equal(await page.locator('#fifo-print').innerText(),'In 2 tem');assert.equal(await page.locator('#fifo-date-format').inputValue(),'mm/dd');assert.equal(requests.filter(x=>/125962/.test(x.url)).length,1);
  });
  if(process.env.NCN_FIFO_REFERENCE)await check('the supplied XLSM reference imports through the same local-only reader',async()=>{
    await page.locator('#fifo-import-open').click();await page.locator('#fifo-file').setInputFiles(resolve(process.env.NCN_FIFO_REFERENCE));await page.waitForFunction(()=>document.getElementById('fifo-import-status').textContent.includes('Đã đọc mẫu 48 tem'));await page.locator('#fifo-apply-import').click();
    assert.ok(Number((await page.locator('#fifo-data-count').innerText()).split(' ')[0])>0);assert.equal(await page.locator('#fifo-date-format').inputValue(),'mm/dd');assert.equal(await page.locator('#fifo-only-filled').isChecked(),false);assert.equal(await page.locator('#fifo-print').isEnabled(),true);
  });
  await check('desktop and short phone screens keep controls, preview, and the 8 by 6 positions inside the viewport',async()=>{
    for(const width of [1366,820,390,320]){await page.setViewportSize({width,height:width<500?700:1000});await assertFits();const b=await page.locator('#fifo-preview-sheet').boundingBox(),last=await page.locator('#fifo-position-47').boundingBox();assert.ok(last.x>=b.x&&last.x+last.width<=b.x+b.width+.5);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/fifo-'+width+'.jpg',fullPage:true,quality:80});
      if(width<500){await page.locator('[aria-labelledby=fifo-list-title]').scrollIntoViewIfNeeded();assert.ok((await page.locator('#fifo-imei-0').boundingBox()).width>170);await page.screenshot({path:out+'/fifo-list-'+width+'.jpg',quality:80});await page.locator('[aria-labelledby=fifo-preview-title]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/fifo-preview-'+width+'.jpg',quality:80});}
    }
    await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.body.classList.contains('ncn-chrome-hidden'));
    await page.locator('#ncn-theme-toggle').click();await page.screenshot({path:out+'/fifo-dark-phone.jpg',fullPage:true,quality:80});await page.locator('#ncn-theme-toggle').click();await page.setViewportSize({width:1366,height:1000});
  });
  await check('print output is one plain A4/A5 sheet with exact first and last slot spacing',async()=>{
    await page.locator('#fifo-select-all').click();await page.locator('#fifo-only-filled').uncheck();await page.locator('#fifo-date').fill('2026-10-29');
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('#ncn-fifo-app').isVisible(),false);assert.equal(await page.locator('#ncn-site-shell').isVisible(),false);assert.equal(await page.locator('#printMe .fifo-label').count(),48);
    const metrics=await page.evaluate(()=>{const s=document.getElementById('printMe').getBoundingClientRect(),first=document.querySelector('#printMe [data-position="1"]').getBoundingClientRect(),last=document.querySelector('#printMe [data-position="48"]').getBoundingClientRect();return {width:s.width,dx:last.x-first.x,dy:last.y-first.y,firstX:first.x,firstY:first.y};});
    const mm=96/25.4;assert.ok(Math.abs(metrics.width-210*mm)<.1);assert.ok(Math.abs(metrics.dx-7*24.34*mm)<.1);assert.ok(Math.abs(metrics.dy-5*26.81*mm)<.1);assert.ok(Math.abs(metrics.firstX-3.97*mm)<.1);assert.ok(Math.abs(metrics.firstY-7.97*mm)<.1);
    await page.pdf({path:out+'/fifo-A4.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});await page.locator('.fifo-alignment summary').click();await page.locator('#fifo-paper').selectOption('A5');assert.equal(await page.locator('#fifo-print').isEnabled(),true);await page.emulateMedia({media:'print'});await page.pdf({path:out+'/fifo-A5.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
  });
  await check('invalid calibration and overlong print text remain editable and block an incorrect print',async()=>{
    await page.locator('#fifo-pitchX').fill('30');assert.equal(await page.locator('#fifo-print').isDisabled(),true);assert.match(await page.locator('#fifo-print-error').innerText(),/vượt khổ giấy/);await page.locator('#fifo-reset-alignment').click();await page.locator('#fifo-color-0').fill('MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM');assert.equal(await page.locator('#fifo-print').isDisabled(),true);assert.match(await page.locator('#fifo-print-error').innerText(),/quá dài/);await page.locator('#fifo-color-0').fill('ĐEN 128GB');assert.equal(await page.locator('#fifo-print').isEnabled(),true);
  });
  await check('blocked draft storage never blocks data entry or printing',async()=>{
    const ctx=await browser.newContext();await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await ctx.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError');};});const p=await ctx.newPage();p.on('pageerror',error=>errors.push(error.message));await p.goto(base+'/2024/01/in-fifo.html');await p.locator('#ncn-fifo-app[data-ready=true]').waitFor();await p.locator('#fifo-scan').fill('000000000000001');await p.locator('#fifo-scan').press('Enter');assert.equal(await p.locator('#fifo-print').isEnabled(),true);await ctx.close();
  });
  await check('there are no browser exceptions or HTTP transmissions containing the entered identifiers',async()=>{
    assert.deepEqual(errors,[]);const writes=requests.filter(r=>r.method!=='GET');assert.ok(writes.every(r=>r.url==='/.netlify/functions/ncn-visitors'));assert.ok(writes.every(r=>!r.body.includes('000000000000')));
  });
}finally{await writeFile(out+'/results.json',JSON.stringify({scope:'Isolated HTTP fixtures; no production writes',results,errors},null,2));await context.close();await browser.close();await new Promise(done=>server.close(done));}
console.log('FIFO browser cases: '+results.length+' passed.');
