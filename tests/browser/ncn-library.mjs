const seedLibraryForFixture=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'));
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,stat,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const production=process.env.NCN_UI_BASE_URL==='https://nguyencongnghe.com';
const root=resolve('public'),out=resolve('artifacts/library/'+(production?'production':'source'));
await mkdir(out,{recursive:true});
const catalogue=JSON.parse((await readFile(root+'/assets/catalog.js','utf8')).replace(/^window.CG_CATALOG\s*=\s*/,'').trim().replace(/;$/,''));
const aliases={'/p/sticker.html':'/sticker/','/p/popup-a7.html':'/popup-a7/','/p/popup-a4-a5-a6.html':'/popup-a4-a5-a6/'};
function catalogueRows(items){
  const seen=new Set();return items.map(row=>({...row,link:aliases[row.link]||row.link})).filter(row=>{
    const path=new URL(row.link,'https://nguyencongnghe.com').pathname.replace(/\/index\.html$/,'/');
    const key=(aliases[path]||path).replace(/\/$/,'');if(seen.has(key)||key==='/thu-vien')return false;seen.add(key);return true;
  });
}
const baselineRows=catalogueRows(catalogue);
let rows=baselineRows,scannedPages=0;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/.netlify/identity/settings'){
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({autoconfirm:false,disable_signup:false,external:{email:true}}));return;
    }
    if(url.pathname.startsWith('/.netlify/functions/')){
      if(url.pathname.endsWith('ncn-stories')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({items:[]}));return;}
      if(url.pathname.endsWith('ncn-library')&&url.searchParams.get('route')==='list'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({items:publicCatalog(seedLibraryForFixture)}));return;}
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(url.pathname.endsWith('ncn-announcements')?{items:[{id:'qa',text:'NCN · Thư viện bài viết và hướng dẫn'}]}:{total:123,online:1}));return;
    }
    let file=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+sep))throw Error('Outside public root');
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=production?'https://nguyencongnghe.com':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:900}});
await context.route('**/*',route=>new URL(route.request().url()).hostname===new URL(base).hostname?route.continue():route.abort());
const results=[];let page;
async function check(name,action){
  try{await action();results.push({name,ok:true});console.log('PASS '+name);}
  catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}
}
async function open(route,{publishedOnly=false}={}){
  if(page)await page.close();page=await context.newPage();
  const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
  if(production&&publishedOnly&&[404,410].includes(response.status())){
    const latest=await fetch(base+'/.netlify/functions/ncn-library?route=list',{signal:AbortSignal.timeout(15000)});assert.equal(latest.status,200);
    const current=await latest.json();assert.ok(Array.isArray(current.items));
    assert.equal(catalogueRows(current.items).some(item=>item.link===route),false,'a missing page must no longer be published: '+route);
    console.log('Removed from the live catalogue during verification: '+route);return false;
  }
  assert.equal(response.status(),200,route);
  await page.waitForSelector('body.ncn-scroll-ready');
  return true;
}
async function fits(){
  const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.page<=size.viewport+1,JSON.stringify(size));
}
const darkExamples=new Set(['/2021/10/wps-office.html','/2020/11/visual-c-aio-v52-bo-thu-vien-day-du-2020.html','/2024/06/leica-lux-ra-mat-tren-iphone-gia-1-trieu-8-cho-nguoi-dung-tan-huong-may-anh-cua-nha-giau.html','/2024/01/word-counter-online-dem-so-tu-trong-mot-doan-van-ban.html','/2024/01/seo-toi-uu-link-bai-viet-va-link-hinh-anh.html','/2022/10/bhrv.html','/2024/05/bao-hiem-1-1.html','/2024/01/be-tap-lam-toan.html','/p/sm.html','/p/privacy-policy.html']);
try{
  await check('library search, filter and page count retain every catalogue entry',async()=>{
    await open('/thu-vien/');
    if(production){const snapshot=await page.evaluate(()=>window.CG_CATALOG);assert.ok(Array.isArray(snapshot));rows=catalogueRows(snapshot);}
    if(rows.length)await page.waitForSelector('#ncn-library-results a');else await page.locator('#ncn-library-results .ncn-empty').waitFor();
    assert.match(await page.locator('#ncn-library-count').innerText(),new RegExp('^'+rows.length+' nội dung'));
    assert.equal((await page.locator('#ncn-library-results').innerText()).includes('full-width'),false,'no template layout tokens in library excerpts');
    const searchBox=await page.locator('.ncn-library-search').boundingBox();
    assert.ok(searchBox.width>=600&&searchBox.height>=44&&searchBox.height<=80,'full desktop search surface');
    await page.screenshot({path:out+'/library-desktop.jpg',type:'jpeg',quality:75});
    const sample=production?rows[0]:rows.find(row=>row.link.includes('wps-office'));
    if(sample){
      await page.locator('#ncn-library-query').fill(production?sample.title:'WPS');
      await page.waitForFunction(link=>[...document.querySelectorAll('#ncn-library-results a')].some(a=>a.getAttribute('href')===link),sample.link);
      if(!production)assert.equal(await page.locator('#ncn-library-results a').count(),1);
    }
    await page.locator('#ncn-library-query').fill('');
    const labels=await page.locator('#ncn-library-label option').allTextContents();
    assert.ok(!labels.some(label=>/Fix-Title|Căn giữa tiêu đề|^post$|PrintMWG/.test(label)),'hide template-only flags');
    const categories=await page.locator('#ncn-library-label option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
    const category=production?categories[0]:'Phần mềm Windows';
    if(category){await page.locator('#ncn-library-label').selectOption(category);const filteredCount=parseInt(await page.locator('#ncn-library-count').innerText(),10);assert.ok(filteredCount>0&&filteredCount<=(production?rows.length:rows.length-1));}
    await page.locator('#ncn-library-label').selectOption('');
    if(await page.locator('#ncn-library-next').isEnabled()){
      await page.locator('#ncn-library-next').click();assert.match(await page.locator('#ncn-library-page').innerText(),/^Trang 2/);
    }else assert.equal(await page.locator('#ncn-library-results a').count(),rows.length);
    await page.setViewportSize({width:390,height:844});await fits();
    const mobileSearch=await page.locator('.ncn-library-search').boundingBox();
    assert.ok(mobileSearch.width>=300&&mobileSearch.height>=44,'full mobile search surface');
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250);
    await page.screenshot({path:out+'/library-mobile.jpg',type:'jpeg',quality:75});
  });
  const pages=rows.filter(row=>{
    const url=new URL(row.link,base);
    return url.origin===new URL(base).origin&&(url.pathname.startsWith('/bai-viet/')||baselineRows.some(item=>new URL(item.link,base).pathname===url.pathname));
  });scannedPages=pages.length;
  for(const [index,row] of pages.entries()){
    await check('library page '+(index+1)+'/'+pages.length+': '+row.link,async()=>{
      if(!await open(row.link,{publishedOnly:true}))return;await fits();
      assert.equal(await page.locator('#ncn-site-shell').count(),1,'one shared navigation shell');
      await page.locator('#ncn-toolbar-clock').waitFor();assert.equal(await page.locator('#ncn-toolbar-clock').count(),1,'one live toolbar clock on every Library page');
      const path=new URL(row.link,base).pathname,file=root+path+(path.endsWith('/')?'index.html':'');
      let source;try{source=await readFile(file,'utf8');}catch(error){if(!production||!path.startsWith('/bai-viet/'))throw error;source=await readFile('netlify/lib/ncn-library/article-shell.html','utf8');}
      const changed=/class="[^"]*ncn-library-page\b/.test(source);
      if(changed){
        assert.equal(await page.locator('#ncn-library-page-title').isVisible(),true);
        const titleBox=await page.locator('#ncn-library-page-title').boundingBox();
        const kickerBox=await page.locator('.ncn-library-kicker').boundingBox();
        assert.ok(kickerBox.height<70,'compact library kicker');
        assert.ok(titleBox.y>=kickerBox.y+kickerBox.height-1,'heading follows the library kicker');
        const managed=seedLibraryForFixture.some(item=>item.href===path&&item.managedPage)||path.startsWith('/bai-viet/');
        const currentTitle=production&&managed?await page.evaluate(link=>(window.CG_CATALOG||[]).find(item=>item.link===link)?.title,row.link):null;
        const expectedTitle=currentTitle||(!managed?catalogue.find(item=>(aliases[item.link]||item.link)===row.link)?.title:null)||row.title;
        const title=(await page.locator('#ncn-library-page-title').innerText()).replace(/\s+/g,' ').trim();
        if(production&&managed&&!currentTitle)assert.ok(title,'a newly unlisted page still has its own title');
        else assert.equal(title,expectedTitle.replace(/\s+/g,' ').trim());
        assert.equal(await page.locator('.entry-title:visible').count(),0,'no duplicate legacy article heading');
        assert.equal(await page.locator('#breadcrumb:visible').count(),0,'no legacy breadcrumb');
        assert.equal(await page.locator('#postBody').isVisible(),true);
        assert.equal((await page.locator('#postBody').innerText()).includes('(getCard)'),false,'static download cards');
        const expected=[...source.matchAll(/class="ncn-library-download" href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
        const downloads=await page.locator('.ncn-library-download').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
        if(!production)assert.deepEqual(downloads,expected);
        else for(const href of downloads)assert.ok(['http:','https:'].includes(new URL(href,base).protocol),'safe download destination');
      }
      await page.screenshot({path:out+'/'+String(index+1).padStart(2,'0')+'-desktop.jpg',type:'jpeg',quality:60});
      await page.setViewportSize({width:390,height:844});await fits();
      await page.screenshot({path:out+'/'+String(index+1).padStart(2,'0')+'-mobile.jpg',type:'jpeg',quality:65});
      if(darkExamples.has(row.link)){
        await page.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');await page.waitForTimeout(250);await fits();
        await page.screenshot({path:out+'/'+String(index+1).padStart(2,'0')+'-dark.jpg',type:'jpeg',quality:75});
      }
      if(changed&&source.includes('ncn-library-print')){
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.ncn-library-page-heading').isVisible(),false,'library heading stays off print artwork');
      }
    });
  }
  await check('word count still reacts to text editing',async()=>{
    await open('/2024/01/word-counter-online-dem-so-tu-trong-mot-doan-van-ban.html');
    await page.locator('#text-input').fill('xin chao anh');
    await page.waitForFunction(()=>document.querySelector('#word-count').textContent.includes('3'));
  });
  await check('SEO text converter still reacts to text editing',async()=>{
    await open('/2024/01/seo-toi-uu-link-bai-viet-va-link-hinh-anh.html');
    await page.locator('#text-input').fill('xin chào anh');
    await page.waitForFunction(()=>document.querySelector('#text-output').textContent.includes('xin-chao-anh'));
  });
  await check('legacy BHRV styles cannot alter shared account layout',async()=>{
    await open('/2022/10/bhrv.html');
    await page.locator('.ncn-account-menu>summary').click();
    await page.locator('#ncn-account-host [data-ncn-account-open=login]').click();
    await page.locator('#ncn-account-dialog').waitFor({state:'visible'});
    const intro=await page.locator('.ncn-account-intro').boundingBox();assert.ok(intro.height<100,'no old 215px paragraph boxes in login');
    const input=page.locator('#ncn-account-dialog input[name=email]').first();
    assert.equal(await input.evaluate(node=>getComputedStyle(node).borderTopLeftRadius),'16px');
    await page.screenshot({path:out+'/library-login-desktop.jpg',type:'jpeg',quality:75});
    await page.setViewportSize({width:390,height:844});await fits();
    await page.screenshot({path:out+'/library-login-mobile.jpg',type:'jpeg',quality:75});
  });
}finally{
  await writeFile(out+'/results.json',JSON.stringify({base,published:rows.length,pages:scannedPages,results},null,2));
  await browser.close();await new Promise(done=>server.close(done));
}
console.log('Library scenarios: '+results.length+' passed.');
