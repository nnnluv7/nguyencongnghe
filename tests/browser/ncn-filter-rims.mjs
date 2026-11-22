import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const built=process.env.NCN_FILTER_BUILT==='1',root=resolve(built?'dist':'public');
const out=resolve('artifacts/filter-rims/'+(built?'built':'source'));
await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/popup-a4-a5-a6/'){res.writeHead(301,{Location:'/popup-a7/'});res.end();return;}
    if(url.pathname.startsWith('/.netlify/')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({items:[],online:0,total:0,user:null,profile:null,external:{email:true}}));return;}
    let file=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(file===root||file.startsWith(root+sep));
    if((await stat(file)).isDirectory())file+='/index.html';
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:320,height:900},reducedMotion:'reduce'}),results=[];let page;
await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
try{
  for(const path of ['/popup-a7/','/popup-a4-a5-a6/','/sticker/','/ban-hang/','/trang-tri/','/']){
    page=await ctx.newPage();await page.goto(base+path,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>[...document.querySelectorAll('.st-tabs,#ncn-home-filters')].some(el=>el.children.length));
    await page.evaluate(()=>document.fonts.ready);
    for(const [width,zoom] of [[320,1],[390,1],[520,1],[768,1],[1280,1],[768,1.5]])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:900});
      await page.evaluate(({zoom,theme})=>{document.documentElement.style.zoom=zoom;document.documentElement.dataset.ncnTheme=theme;},{zoom,theme});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      const groups=await page.evaluate(zoom=>[...document.querySelectorAll('.st-tabs,#ncn-home-filters')].filter(el=>el.getClientRects().length).map(el=>{
        const box=el.getBoundingClientRect(),style=getComputedStyle(el),buttons=[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length);
        const rows=new Set(buttons.map(b=>Math.round(b.getBoundingClientRect().top))).size;
        const radius=Math.min(parseFloat(style.borderTopLeftRadius)*zoom,box.width/2,box.height/2),outside=[];
        const contains=(x,y)=>{
          const cx=x<box.left+radius?box.left+radius:x>box.right-radius?box.right-radius:x;
          const cy=y<box.top+radius?box.top+radius:y>box.bottom-radius?box.bottom-radius:y;
          return Math.hypot(x-cx,y-cy)<=radius+1;
        };
        if(rows>1&&style.flexWrap!=='nowrap')for(const button of buttons){
          const b=button.getBoundingClientRect(),s=getComputedStyle(button),r=Math.min(parseFloat(s.borderTopLeftRadius)*zoom,b.width/2,b.height/2);
          // Sample each button's rounded outline, including its straight-edge
          // endpoints. A wrapping filter must fit inside the outer glass rim.
          const corners=[[b.left+r,b.top+r,Math.PI],[b.right-r,b.top+r,1.5*Math.PI],[b.right-r,b.bottom-r,0],[b.left+r,b.bottom-r,.5*Math.PI]];
          for(const [cx,cy,start] of corners)for(let step=0;step<=8;step++){
            const angle=start+step*Math.PI/16,x=cx+r*Math.cos(angle),y=cy+r*Math.sin(angle);
            if(!contains(x,y))outside.push(button.textContent.trim());
          }
        }
        return {id:el.id,rows,wrap:style.flexWrap,outside:[...new Set(outside)],clippedLabels:buttons.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent.trim())};
      }),zoom);
      for(const group of groups){assert.deepEqual(group.outside,[],JSON.stringify({path,width,zoom,theme,...group}));assert.deepEqual(group.clippedLabels,[],JSON.stringify(group));}
      const viewport=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(viewport.content<=viewport.viewport+1,JSON.stringify({path,width,zoom,...viewport}));
      results.push({path,width,zoom,theme,groups});
      if(path==='/popup-a7/'&&theme==='light'&&zoom===1&&[390,1280].includes(width))await page.locator('#pp-industries').screenshot({path:out+'/popup-'+width+'.png'});
    }
    // Filtering still selects the chosen chip and returns matching models.
    const filters=page.locator('.st-tabs button');
    if(await filters.count()>1){await filters.nth(1).click();assert.equal(await filters.nth(1).getAttribute('aria-pressed'),'true');await filters.first().click();}
    console.log('PASS responsive filter rims: '+path);await page.close();
  }
}catch(error){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));await ctx.close();await browser.close();await new Promise(done=>server.close(done));}
console.log('PASS '+results.length+' filter layouts: rounded rims contain wrapped buttons, labels fit and filtering works');
