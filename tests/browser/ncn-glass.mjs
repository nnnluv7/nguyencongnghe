import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {transform} from 'esbuild';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';

// Exercise the published bundle, then serve its previous common CSS to compare
// real page geometry and print pixels. All data and requests stay in this fixture.
const root=resolve('dist'),out=resolve('artifacts/glass');
await mkdir(out,{recursive:true});
const site=await readFile('public/assets/ncn-theme/site.css','utf8'),notice=await readFile('public/assets/ncn-theme/announcements.css','utf8');
const previous=site.replace(/\/\* NCN glass contrast, 20261029:[\s\S]*?\/\* END NCN GLASS CONTRAST 20261029 \*\//,'');
assert.notEqual(previous,site,'The comparison must actually omit the glass refinement');
const compile=async css=>(await transform('\n'+css+'\n'+notice,{loader:'css',minify:true,legalComments:'none',target:['chrome100','safari15']})).code;
const currentCSS=await compile(site),oldCSS=await compile(previous);
const cssPath='/assets/ncn-built/styles/'+createHash('sha256').update(currentCSS).digest('hex').slice(0,16)+'.css';
assert.equal(await readFile(root+cssPath,'utf8'),currentCSS,'Test the actual final common CSS bundle');
const catalog=publicCatalog(JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'))),errors=[],results=[];
let baseline=false;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),json=value=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname.startsWith('/.netlify/identity/'))return json({disable_signup:false,external:{email:true}});
 if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-library')?{items:catalog}:url.pathname.endsWith('ncn-announcements')?{items:[]}:url.pathname.endsWith('ncn-billing')?{user:null}:{items:[],online:1,total:1});
 if(url.pathname===cssPath&&baseline){res.writeHead(200,{'Content-Type':'text/css'});return res.end(oldCSS);}
 try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('Outside fixture');if((await stat(file)).isDirectory())file+='/index.html';let body=await readFile(file);if(file.endsWith('.html'))body=renderPublicHTML(body.toString(),catalog);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
const context=async(width=1280)=>{const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());return ctx;};
const open=async(ctx,path)=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+path);await p.waitForFunction(()=>window.NCNAccount?.state.ready);await p.evaluate(()=>document.fonts.ready);return p;};
const paint=p=>p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const check=async(name,fn)=>{await fn();results.push({name,ok:true});console.log('PASS '+name);};
const style=(p,selector)=>p.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {width:s.outlineWidth,color:s.outlineColor,offset:s.outlineOffset,blur:s.backdropFilter,background:s.backgroundColor};});
const routes=[['/','#ncn-topbar'],['/thu-vien/','#ncn-topbar'],['/2024/01/in-fifo.html','#fifo-print'],['/arcade/','.ncn-scoreboard'],['/2022/07/phieu-tu-van-tra-gop.html','#ncn-topbar']];
try{
 await check('shared contours work on desktop and phone in light and dark themes',async()=>{
  for(const width of [1280,390]){const ctx=await context(width);
   for(const [path,target] of routes){const p=await open(ctx,path);
    for(const theme of ['light','dark']){await p.evaluate(theme=>document.documentElement.dataset.ncnTheme=theme,theme);await p.mouse.move(0,0);await paint(p);const s=await style(p,target);assert.equal(s.width,'1px',path+' '+theme);assert.equal(s.offset,'-1px');assert.ok(theme==='dark'?s.color.includes('221, 238, 252'):s.color.includes('14, 20, 28'),JSON.stringify(s));const size=await p.evaluate(()=>({viewport:innerWidth,actual:document.documentElement.scrollWidth}));assert.ok(size.actual<=size.viewport+1,JSON.stringify(size));}
    if(path==='/2024/01/in-fifo.html'){await p.screenshot({path:out+'/fifo-dark-'+width+'.jpg',fullPage:true,quality:80});await p.evaluate(()=>document.documentElement.dataset.ncnTheme='light');await p.screenshot({path:out+'/fifo-light-'+width+'.jpg',fullPage:true,quality:80});}
    await p.close();
   }await ctx.close();
  }
 });
 await check('keyboard focus is visible and pressed controls retain a stronger contour',async()=>{
  const ctx=await context(),p=await open(ctx,'/2024/01/in-fifo.html');await p.keyboard.press('Tab');await p.locator('#fifo-scan').focus();const focused=await style(p,'#fifo-scan');assert.equal(focused.width,'3px');assert.equal(focused.offset,'3px');await p.locator('#fifo-scan').blur();await p.mouse.move(0,0);
  const normal=await style(p,'#fifo-print');await p.locator('#fifo-print').evaluate(el=>el.setAttribute('aria-pressed','true'));assert.notEqual((await style(p,'#fifo-print')).color,normal.color);await ctx.close();
 });
 await check('accessibility preferences increase contrast and remove translucent chrome',async()=>{
  const ctx=await context(),p=await open(ctx,'/');const normal=await style(p,'#ncn-topbar');
  await p.emulateMedia({contrast:'more'});const high=await style(p,'#ncn-topbar');assert.notEqual(high.color,normal.color);assert.equal(high.blur,'none');assert.match(high.background,/^rgb\(/,'High-contrast chrome must be opaque');
  await p.emulateMedia({contrast:'no-preference'});const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});assert.equal((await style(p,'#ncn-topbar')).blur,'none');assert.equal((await style(p,'#ncn-topbar')).color,high.color);
  await p.emulateMedia({forcedColors:'active'});assert.equal(await p.evaluate(()=>matchMedia('(forced-colors:active)').matches),true);assert.equal((await style(p,'#ncn-topbar')).width,'1px');await ctx.close();
 });
 await check('the refinement preserves control and content geometry at both breakpoints',async()=>{
  for(const width of [1280,390])for(const [path] of routes){const boxes=[];
   for(const old of [true,false]){baseline=old;const ctx=await context(width),p=await open(ctx,path);await paint(p);boxes.push(await p.locator('#ncn-topbar,main h1,#fifo-scan,#fifo-print,.ncn-scoreboard').evaluateAll(els=>els.map(el=>({id:el.id||el.className,box:el.getBoundingClientRect().toJSON()}))));await ctx.close();}
   assert.deepEqual(boxes[1],boxes[0],path+' '+width+' layout changed');
  }baseline=false;
 });
 await check('FIFO and legacy print pixels remain identical to the previous common CSS',async()=>{
  for(const path of ['/2024/01/in-fifo.html','/2022/07/phieu-tu-van-tra-gop.html']){const shots=[],paper=[];
   for(const old of [true,false]){baseline=old;const ctx=await context(),p=await open(ctx,path);
    if(path.includes('fifo')){await p.locator('#fifo-date').fill('2026-10-29');await p.locator('#fifo-quick-color').fill('ĐEN 128GB');await p.locator('#fifo-scan').fill('000000000000001');await p.locator('#fifo-scan').press('Enter');await p.locator('#fifo-scan').blur();}
    await p.emulateMedia({media:'print'});await paint(p);shots.push(await p.screenshot({path:out+'/'+(path.includes('fifo')?'fifo':'legacy')+'-print-'+(old?'before':'after')+'.png',fullPage:true}));paper.push(await p.locator('#printMe,.row-container').first().evaluate(el=>el.getBoundingClientRect().toJSON()));await ctx.close();
   }assert.deepEqual(paper[1],paper[0],path+' paper geometry');assert.ok(shots[1].equals(shots[0]),path+' print pixels changed');
  }baseline=false;
 });
 await check('no browser exceptions occur',async()=>assert.deepEqual(errors,[]));
}finally{await writeFile(out+'/results.json',JSON.stringify({scope:'Local compiled-site fixtures; no production data writes',results,errors},null,2));await browser.close();await new Promise(done=>server.close(done));}
console.log('Glass browser checks: '+results.length+' passed.');
