import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

// Render real print documents, including rotated forms, rather than checking
// only that the surrounding editor fits the viewport.
const root=resolve('public'),out=resolve('artifacts/print-text');
await mkdir(out,{recursive:true});
const generated=new Map(),cases=[];
for(const group of ['ncn-sticker','ncn-popup','ncn-store-tools']){
  const data=JSON.parse(await readFile(root+'/assets/'+group+'/catalogue.json','utf8'));
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
  const describe=n=>n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(typeof n.className==='string'&&n.className?'.'+n.className.trim().replace(/\s+/g,'.'):'');
  const add=(type,node,text,detail)=>{
    const key=[type,describe(node),text].join('|');if(seen.has(key))return;seen.add(key);
    problems.push({type,element:describe(node),text:text.slice(0,150),...detail});
  };
  const roots=document.querySelectorAll('.ncn-sheet,.sheet,#printMe,.row-container');
  const outside=(r,b)=>r.left<b.left-1.2||r.right>b.right+1.2||r.top<b.top-1.2||r.bottom>b.bottom+1.2;
  for(const root of roots){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const text=node.textContent.trim(),parent=node.parentElement;
      if(!text||!parent||parent.closest('script,style,textarea,svg'))continue;
      const ps=getComputedStyle(parent);
      if(ps.display==='none'||ps.visibility==='hidden'||!parent.getClientRects().length)continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(let ancestor=parent;ancestor&&ancestor!==root.parentElement;ancestor=ancestor.parentElement){
        const style=getComputedStyle(ancestor),b=ancestor.getBoundingClientRect();
        const framed=['Top','Right','Bottom','Left'].every(side=>parseFloat(style['border'+side+'Width'])>0);
        const clipped=['hidden','clip'].includes(style.overflowX)||['hidden','clip'].includes(style.overflowY);
        if(!framed&&!clipped&&ancestor!==root)continue;
        if([...range.getClientRects()].some(r=>r.width&&r.height&&outside(r,b))){
          add('text outside frame',ancestor,text,{font:ps.font,box:{width:b.width,height:b.height},scroll:{width:ancestor.scrollWidth,height:ancestor.scrollHeight}});break;
        }
      }
    }
    for(const input of root.querySelectorAll('input[type=text],textarea')){
      if(!input.value||!input.getClientRects().length)continue;
      if(input.scrollWidth>input.clientWidth+2||input.scrollHeight>input.clientHeight+2){
        add('input text clipped',input,input.value,{font:getComputedStyle(input).font,box:{width:input.clientWidth,height:input.clientHeight},scroll:{width:input.scrollWidth,height:input.scrollHeight}});
      }
    }
  }
  return {roots:roots.length,problems,fonts:[...document.fonts].filter(f=>f.status==='error').map(f=>f.family)};
}

try{
  // Bounded parallelism keeps each template independent and the audit fast.
  for(let start=0;start<cases.length;start+=4)await Promise.all(cases.slice(start,start+4).map(async item=>{
    const page=await browser.newPage({viewport:{width:820,height:1140}});
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    try{
      assert.equal((await page.goto(base+item.path)).status(),200,item.name);
      await page.evaluate(()=>document.fonts.ready);
      const screen=await page.evaluate(inspectText);
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
    await page.evaluate(()=>document.fonts.ready);
    await page.emulateMedia({media:'print'});
    const print=await page.evaluate(inspectText);
    results.push({name:'legacy/'+path,print});
    await page.screenshot({path:out+'/legacy-'+path.replaceAll('/','-')+'.jpg',type:'jpeg',quality:70,fullPage:true});
    console.log((print.problems.length?'REVIEW ':'PASS ')+'legacy/'+path+' · '+print.problems.length);
    await page.emulateMedia({media:'screen'});
  }
  await page.close();
}finally{
  await writeFile(out+'/results.json',JSON.stringify({results},null,2));
  await browser.close();await new Promise(done=>server.close(done));
}
const failures=results.filter(r=>(r.screen?.problems.length||r.print.problems.length||r.screen?.fonts.length||r.print.fonts.length));
console.log('Print documents: '+results.length+'; templates requiring review: '+failures.length);
if(process.env.NCN_PRINT_AUDIT_REPORT_ONLY!=='1')assert.deepEqual(failures.map(r=>r.name),[],'Print text must remain inside its frame in preview and print');
