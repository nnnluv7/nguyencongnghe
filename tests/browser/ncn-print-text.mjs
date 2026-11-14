import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {withDeliveryTemplate} from '../../public/assets/ncn-store-tools/delivery.js';

// Render real print documents, including rotated forms, rather than checking
// only that the surrounding editor fits the viewport.
const root=resolve('public'),out=resolve('artifacts/print-text');
await mkdir(out,{recursive:true});
const generated=new Map(),cases=[];
generated.set('/__print-text/boundary-control.html','<!doctype html><style>.ncn-sheet{width:400px;height:400px}.test-frame{border:2px solid;width:90px;height:35px;font:20px/24px Arial}.rotated{transform:rotate(-90deg);margin:100px}</style><section class="ncn-sheet"><div class="test-frame">FIRST LINE<br>SECOND LINE<br>THIRD LINE</div><div class="test-frame rotated">ROTATED<br>SECOND LINE<br>THIRD LINE</div><input type="text" style="width:70px" value="TEXT THAT CANNOT FIT IN THIS FIELD"></section>');
for(const group of ['ncn-sticker','ncn-popup','ncn-store-tools']){
  const source=JSON.parse(await readFile(root+'/assets/'+group+'/catalogue.json','utf8'));
  const data=group==='ncn-store-tools'?withDeliveryTemplate(source):source;
  const core=await import('../../public/assets/'+group+'/core.js');
  for(const layout of data.layouts)for(const paper of ['A4','A5']){
    const row=core.defaultRow(layout);
    row.values=layout.fields.map((f,i)=>f.type==='checkbox'?'1':String(row.values[i]||f.example||''));
    const preview=paper==='A4',path='/__print-text/'+group+'-'+layout.id+'-'+paper+'.html';
    generated.set(path,core.renderDocument(layout,[row],{paper,fontCSS:data.fontCSS,preview,editable:preview}));
    cases.push({name:group+'/'+layout.id+'/'+paper,path,shot:preview});
  }
}
const require=createRequire(import.meta.url);
const Event=require('../../netlify/lib/ncn-event-private/core.cjs');
const GVGS=require('../../netlify/lib/ncn-gvgs-private/core.cjs');
const gv2=require('../../netlify/lib/ncn-gvgs-private/gv2-assets.cjs')(root);
const assets={
  font:(await readFile('netlify/lib/ncn-event-private/mt2-mincap.woff2')).toString('base64'),
  frame:(await readFile('netlify/lib/ncn-event-private/stick.png')).toString('base64'),
  qr:()=>({size:21,get:(x,y)=>(x+y)%2===0}),gv2
};
const product={code:'QA-001',name:'SẢN PHẨM KIỂM TRA',originalPrice:10990000,eventPrice:7990000,qty:1};
for(const width of [88.635,136.26,198.437]){
  const path='/__print-text/event-'+width+'.html';
  generated.set(path,Event.printable([product],{width,height:width,cut:true},assets).html);
  cases.push({name:'event/'+width,path,shot:true});
}
for(const format of ['popup-gv2-a4','popup-gv2-a5','popup-a5','popup-full','sticker-small','sticker-medium','sticker-large']){
  const path='/__print-text/gvgs-'+format+'.html';
  generated.set(path,GVGS.printable([product],{format,period:'24–25/10/2026',quota:'2 suất'},assets).html);
  cases.push({name:'gvgs/'+format,path,shot:true});
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(generated.has(url.pathname)){
      res.writeHead(200,{'Content-Type':mime['.html']});res.end(generated.get(url.pathname));return;
    }
    if(url.pathname.startsWith('/.netlify/functions/')){
      res.writeHead(200,{'Content-Type':mime['.json']});res.end(JSON.stringify({items:[],total:0,online:0}));return;
    }
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+sep))throw Error('Outside public root');
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const results=[];

function inspectText(){
  const problems=[],seen=new Set();
  const context=document.createElement('canvas').getContext('2d');
  const describe=n=>n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(typeof n.className==='string'&&n.className?'.'+n.className.trim().replace(/\s+/g,'.'):'');
  const add=(type,node,text,detail)=>{
    const key=[type,describe(node),text].join('|');if(seen.has(key))return;seen.add(key);
    problems.push({type,element:describe(node),text:text.slice(0,150),...detail});
  };
  const roots=document.querySelectorAll('.ncn-sheet,.sheet,#printMe,.row-container');
  for(const root of roots){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const text=node.textContent.trim(),parent=node.parentElement;
      if(!text||!parent||parent.closest('script,style,textarea,svg'))continue;
      const ps=getComputedStyle(parent);
      if(ps.display==='none'||ps.visibility==='hidden'||!parent.getClientRects().length)continue;
      const range=document.createRange();range.selectNodeContents(node);
      context.font=[ps.fontStyle,ps.fontWeight,ps.fontSize,ps.fontFamily].join(' ');
      const metrics=context.measureText(ps.textTransform==='uppercase'?text.toUpperCase():text);
      const fontHeight=metrics.fontBoundingBoxAscent+metrics.fontBoundingBoxDescent;
      // Condensed display fonts have large ascent/descent boxes. Test visible
      // glyph ink, not empty font leading that browsers legitimately clip.
      const rotated=(()=>{for(let el=parent;el&&el!==root;el=el.parentElement){
        const transform=getComputedStyle(el).transform;
        if(transform!=='none'){const m=new DOMMatrix(transform);if(Math.abs(m.b)>.001||Math.abs(m.c)>.001)return true;}
      }return false;})();
      const outside=(r,b,{horizontal=true,vertical=true}={})=>{
        const top=rotated||!fontHeight?r.top:r.top+r.height*(metrics.fontBoundingBoxAscent-metrics.actualBoundingBoxAscent)/fontHeight;
        const bottom=rotated||!fontHeight?r.bottom:r.top+r.height*(metrics.fontBoundingBoxAscent+metrics.actualBoundingBoxDescent)/fontHeight;
        return horizontal&&(r.left<b.left-1.2||r.right>b.right+1.2)||vertical&&(top<b.top-1.2||bottom>b.bottom+1.2);
      };
      for(let ancestor=parent;ancestor&&ancestor!==root.parentElement;ancestor=ancestor.parentElement){
        const style=getComputedStyle(ancestor),b=ancestor.getBoundingClientRect();
        const framed=['Top','Right','Bottom','Left'].every(side=>parseFloat(style['border'+side+'Width'])>0);
        const horizontal=framed||ancestor===root||['hidden','clip'].includes(style.overflowX);
        // Internal display-font boxes may have empty leading outside their
        // line box. Flag vertical clipping when content actually scrolls, or
        // visible ink leaves a printed border/the physical sheet.
        const vertical=framed||ancestor===root||(['hidden','clip'].includes(style.overflowY)&&ancestor.scrollHeight>ancestor.clientHeight+2);
        if(!horizontal&&!vertical)continue;
        if([...range.getClientRects()].some(r=>r.width&&r.height&&outside(r,b,{horizontal,vertical}))){
          add('text outside frame',ancestor,text,{font:ps.font,box:{width:b.width,height:b.height},scroll:{width:ancestor.scrollWidth,height:ancestor.scrollHeight}});break;
        }
      }
    }
    for(const input of root.querySelectorAll('input[type=text],textarea')){
      if(!input.value||!input.getClientRects().length)continue;
      const style=getComputedStyle(input);
      context.font=[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
      const ink=context.measureText(style.textTransform==='uppercase'?input.value.toUpperCase():input.value);
      const contentHeight=input.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
      if(input.scrollWidth>input.clientWidth+2||(input.tagName==='TEXTAREA'?input.scrollHeight>input.clientHeight+2:ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent>contentHeight+2)){
        add('input text clipped',input,input.value,{font:getComputedStyle(input).font,box:{width:input.clientWidth,height:input.clientHeight},scroll:{width:input.scrollWidth,height:input.scrollHeight}});
      }
    }
  }
  return {roots:roots.length,problems,fonts:[...document.fonts].filter(f=>f.status==='error').map(f=>f.family)};
}

try{
  const control=await browser.newPage();
  await control.goto(base+'/__print-text/boundary-control.html');
  const detected=(await control.evaluate(inspectText)).problems;
  assert.ok(detected.some(p=>p.element==='div.test-frame'),'Audit must catch ordinary frame overflow');
  assert.ok(detected.some(p=>p.element==='div.test-frame.rotated'),'Audit must catch rotated frame overflow');
  assert.ok(detected.some(p=>p.type==='input text clipped'),'Audit must catch truncated input text');
  await control.close();
  // Bounded parallelism keeps each template independent and the audit fast.
  for(let start=0;start<cases.length;start+=4)await Promise.all(cases.slice(start,start+4).map(async item=>{
    const page=await browser.newPage({viewport:{width:820,height:1140}});
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    try{
      assert.equal((await page.goto(base+item.path)).status(),200,item.name);
      await page.evaluate(()=>document.fonts.ready);
      const screen=await page.evaluate(inspectText);
      assert.ok(screen.roots,item.name+': missing printable sheet');
      await page.emulateMedia({media:'print'});
      const print=await page.evaluate(inspectText);
      const result={...item,screen,print};results.push(result);
      if(item.shot)await page.screenshot({path:out+'/'+item.name.replaceAll('/','-')+'.jpg',type:'jpeg',quality:70,fullPage:true});
      console.log((screen.problems.length||print.problems.length?'REVIEW ':'PASS ')+item.name+' · '+screen.problems.length+'/'+print.problems.length);
    }finally{await page.close();}
  }));
  const legacy=JSON.parse(await readFile('docs/print-workspace-baseline.json','utf8')).legacy;
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  for(const path of [...legacy,'2024/01/in-fifo.html']){
    await page.goto(base+'/'+path,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#printMe,.row-container',{state:'attached'});
    await page.waitForLoadState('load');
    if(path==='2024/01/in-fifo.html'){
      await page.waitForSelector('#ncn-fifo-app[data-ready=true]');await page.locator('#fifo-date').fill('2026-10-25');await page.locator('#fifo-color-0').fill('ĐEN 256GB');await page.locator('#fifo-only-filled').uncheck();
      assert.equal(await page.locator('#printMe .is-printed').count(),48);
    }
    if(path==='2024/01/tao-ma-qrcode-chia-se-wifi-khong-can-nhap-mat-khau.html'){
      await page.locator('#tenwifi').fill('NCN QA');await page.locator('#loaiwifi').selectOption('2');await page.locator('#submitcode').click();
      await page.locator('#qrcode1 img').waitFor({state:'attached'});
    }
    await page.evaluate(()=>document.fonts.ready);
    await page.emulateMedia({media:'print'});
    const print=await page.evaluate(inspectText);
    results.push({name:'legacy/'+path,print});
    await page.screenshot({path:out+'/legacy-'+path.replaceAll('/','-')+'.jpg',type:'jpeg',quality:70,fullPage:true});
    console.log((print.problems.length?'REVIEW ':'PASS ')+'legacy/'+path+' · '+print.problems.length);
    await page.emulateMedia({media:'screen'});
  }
  await page.close();
  const delivery=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  await delivery.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await delivery.goto(base+'/ban-hang/',{waitUntil:'domcontentloaded'});
  const first=delivery.locator('#nt-cards .st-card').first();
  await first.waitFor();
  assert.equal(await first.locator('strong').innerText(),'BẢO HÀNH · GIAO HÀNG');
  await first.locator('.st-card-preview').click();
  await delivery.locator('.ncn-print-settings').evaluate(el=>el.open=true);
  await delivery.locator('.ncn-print-fields').evaluate(el=>el.open=true);
  await delivery.locator('#nt-field-2').fill('Nguyễn Thị Mai');
  for(const [paper,count,width,height] of [['A4',2,297,210],['A5',1,148,210]]){
    await delivery.locator('#nt-paper').selectOption(paper);
    await delivery.waitForFunction(({paper,count})=>{
      const doc=document.getElementById('nt-preview')?.contentDocument;
      if(!doc?.head?.textContent.includes('@page{size:'+paper))return false;
      const slips=[...doc.querySelectorAll('.delivery-slip')];
      return slips.length===count&&slips.every(el=>el.querySelector('[data-field="2"]').value==='Nguyễn Thị Mai');
    },{paper,count});
    const [download]=await Promise.all([delivery.waitForEvent('download'),delivery.locator('#nt-download').click()]);
    const filename='bao-hanh-giao-hang-'+paper.toLowerCase();
    const path='/__print-text/'+filename+'.html',html=await readFile(await download.path(),'utf8');
    assert.match(html,/data:image\/jpeg;base64,/);
    assert.doesNotMatch(html,/data-ncn-copy/);
    generated.set(path,html);
    const sheet=await browser.newPage({viewport:{width:1200,height:850}});
    await sheet.goto(base+path);
    await sheet.emulateMedia({media:'print'});
    const layout=await sheet.evaluate(()=>{
      const rect=el=>el?.getBoundingClientRect().toJSON();
      return {sheet:rect(document.querySelector('.ncn-sheet')),cut:rect(document.querySelector('.ncn-cut-line')),
        panels:[...document.querySelectorAll('.ncn-a5-panel')].map(el=>({panel:rect(el),slip:rect(el.firstElementChild)}))};
    });
    assert.equal(await sheet.locator('.ncn-sheet').count(),1);
    assert.equal(layout.panels.length,count);
    assert.equal(await sheet.locator('.delivery-fees').count(),count);
    assert.equal(await sheet.locator('.delivery-slip').first().evaluate(el=>getComputedStyle(el).borderTopStyle),'double');
    const near=(a,b)=>assert.ok(Math.abs(a-b)<.8,JSON.stringify({a,b}));
    const px=mm=>mm*96/25.4;
    near(layout.sheet.width,px(width));near(layout.sheet.height,px(height));
    for(const {panel,slip} of layout.panels){
      near(panel.width,px(width/count));near(panel.height,px(height));
      assert.ok(slip.bottom<=panel.bottom-px(6),JSON.stringify({panel,slip}));
      assert.ok(slip.right<=panel.right-px(6),JSON.stringify({panel,slip}));
    }
    if(count===2)near(layout.cut.x+layout.cut.width/2,layout.sheet.x+layout.sheet.width/2);
    else assert.equal(layout.cut,undefined);
    const print=await sheet.evaluate(inspectText);
    assert.deepEqual(print.problems,[]);
    const pdf=await sheet.pdf({path:out+'/'+filename+'.pdf',preferCSSPageSize:true,printBackground:true});
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1,'PDF must contain exactly one page');
    await sheet.screenshot({path:out+'/'+filename+'.png',clip:{x:layout.sheet.x,y:layout.sheet.y,width:Math.floor(layout.sheet.width),height:Math.floor(layout.sheet.height)}});
    await sheet.close();
    console.log('PASS delivery '+paper+' · '+count+' full-size '+(count===1?'slip':'slips'));
  }
  await delivery.close();
  const draft=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  await draft.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await draft.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Clipboard is unavailable');}}}));
  const draftURL=base+'/ban-hang/?mau=sales-bh-giao-hang&nhap=1',title='.delivery-slip h1 [data-delivery-text]';
  await draft.goto(draftURL);
  const paper=draft.frameLocator('#nt-preview'),titleBox=paper.locator(title).first();
  await titleBox.waitFor();
  assert.equal(await draft.locator('#nt-paper').inputValue(),'A5');
  const custom='PHIẾU THỬ <giữ nguyên chữ>';
  await titleBox.fill(custom);
  await draft.getByRole('button',{name:'Sao chép phần đã sửa'}).click();
  assert.ok((await draft.getByRole('textbox',{name:'Phần nội dung đã sửa'}).inputValue()).includes(custom));
  await draft.locator('#nt-paper').selectOption('A4');
  await draft.waitForFunction(({title,custom})=>{
    const fields=[...document.getElementById('nt-preview')?.contentDocument?.querySelectorAll(title)??[]];
    return fields.length===2&&fields.every(el=>el.textContent===custom);
  },{title,custom});
  await draft.getByRole('button',{name:'Xem bản in'}).click();
  await paper.getByRole('heading',{name:custom,exact:true}).first().waitFor();
  assert.equal(await paper.locator('[contenteditable]').count(),0);
  await draft.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
  const [draftFile]=await Promise.all([draft.waitForEvent('download'),draft.locator('#nt-download').click()]);
  const draftHTML=await readFile(await draftFile.path(),'utf8');
  assert.equal(draftHTML.split('PHIẾU THỬ &lt;giữ nguyên chữ&gt;').length-1,2);
  assert.doesNotMatch(draftHTML,/contenteditable|data-delivery-text/);
  await draft.reload();
  await paper.getByRole('heading',{name:custom,exact:true}).waitFor();
  await draft.goto(base+'/ban-hang/?mau=sales-bh-giao-hang');
  await paper.getByRole('heading',{name:'CHÍNH SÁCH BẢO HÀNH VÀ PHIẾU HẸN GIAO HÀNG',exact:true}).first().waitFor();
  assert.equal(await draft.locator('.delivery-draft-tools').count(),0);
  assert.equal(await paper.locator('[data-delivery-text]').count(),0);
  await draft.close();
  console.log('PASS delivery draft stays local, mirrors the A4 copies and exports passive text');
  // Exercise the actual entry points and downloads too: the app must use the
  // corrected catalogue, and its offline HTML must keep the same typography.
  for(const width of [1280,390])for(const [id,count] of [['sales-tv-tc',5],['sales-tv-bh',6],['sales-the-tt',5]]){
    const editor=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
    await editor.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await editor.goto(base+'/ban-hang/?mau='+id,{waitUntil:'domcontentloaded'});
    await editor.waitForFunction(()=>document.getElementById('ncn-store-app')?.dataset.ready==='true');
    await editor.frameLocator('#nt-preview').locator(id==='sales-the-tt'?'.ttz':'.fh').first().waitFor();
    if(width<960)await editor.locator('.ncn-workspace-bar [data-ncn-pane=fields]').click();
    await editor.locator('.ncn-print-settings').evaluate(n=>n.open=true);
    for(const paper of ['A4','A5']){
      const navigated=editor.waitForEvent('framenavigated',frame=>frame.parentFrame()===editor.mainFrame()&&frame.url()==='about:srcdoc');
      await editor.locator('#nt-paper').selectOption(paper);
      await navigated;
      await editor.waitForFunction(paper=>{
        const d=document.getElementById('nt-preview')?.contentDocument;
        return d?.querySelector('.ncn-sheet')&&d.head.textContent.includes('@page{size:'+paper);
      },paper);
      const frame=await (await editor.locator('#nt-preview').elementHandle()).contentFrame();
      await frame.evaluate(()=>document.fonts.ready);
      const screen=await frame.evaluate(inspectText);
      assert.equal(await frame.locator(id==='sales-the-tt'?'.ttz':'.fh').count(),count,id);
      const downloadReady=editor.waitForEvent('download');
      await editor.locator('#nt-download').click();
      const download=await downloadReady;
      const filename=id+'-'+width+'-'+paper+'.html';await download.saveAs(out+'/'+filename);
      const html=await readFile(out+'/'+filename,'utf8');
      assert.equal(/(?:src|url)\s*[(=]\s*["']?\/assets\//i.test(html),false,'Downloaded print must embed its artwork and fonts');
      const path='/__print-text/download-'+filename;generated.set(path,html);
      const offline=await browser.newPage({viewport:{width:820,height:1140}});
      await offline.goto(base+path);await offline.evaluate(()=>document.fonts.ready);
      assert.equal(await offline.locator('[data-ncn-copy],script').count(),0,'Downloaded forms stay passive');
      await offline.emulateMedia({media:'print'});
      const print=await offline.evaluate(inspectText);
      results.push({name:'download/'+id+'/'+width+'/'+paper,screen,print});
      await offline.pdf({path:out+'/'+filename.replace('.html','.pdf'),preferCSSPageSize:true,printBackground:true});
      await offline.close();
      console.log('CHECK download/'+id+'/'+width+'/'+paper+' · '+screen.problems.length+'/'+print.problems.length);
    }
    await editor.screenshot({path:out+'/editor-'+id+'-'+width+'.jpg',type:'jpeg',quality:75});
    await editor.close();
  }
}finally{
  await writeFile(out+'/results.json',JSON.stringify({results},null,2));
  await browser.close();await new Promise(done=>server.close(done));
}
const failures=results.filter(r=>(r.screen?.problems.length||r.print.problems.length||r.screen?.fonts.length||r.print.fonts.length));
console.log('Print documents: '+results.length+'; templates requiring review: '+failures.length);
assert.deepEqual(failures.map(r=>r.name),[],'Print text must remain inside its frame in preview and print');
