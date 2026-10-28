import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {renderPublicHTML} from '../../netlify/lib/ncn-public-render.mjs';
import {injectCatalog} from '../../netlify/lib/ncn-library-page.mjs';
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {optimizePublicHTML} from '../../netlify/lib/ncn-public-assets.mjs';

// Reproducible local comparison of exactly the same public content. This is a
// throttled frontend benchmark, not a claim about a visitor's real connection.
const root=resolve('public'),dist=resolve('dist'),out=resolve('artifacts/performance');await mkdir(out,{recursive:true});
const catalog=publicCatalog(JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8')));
const html=injectCatalog(renderPublicHTML(await readFile(root+'/index.html','utf8'),catalog,{notices:[{text:'NCN · Kiểm tra tốc độ tải trang'}]}),catalog);
const optimized=optimizePublicHTML(html),requests=[];
const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1'),headers={'Content-Security-Policy':"connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-src 'self'; form-action 'none'",'Cache-Control':url.pathname.startsWith('/assets/ncn-built/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'};
  let body,type;
  if(['/before/','/after/'].includes(url.pathname)){body=Buffer.from(url.pathname==='/before/'?html:optimized);type='text/html';}
  else if(url.pathname.startsWith('/.netlify/')){type='application/json';body=Buffer.from(JSON.stringify(url.pathname.includes('announcements')?{items:[{text:'NCN · Kiểm tra tốc độ tải trang'}]}:url.pathname.includes('library')?{items:catalog}:{user:null,items:[],total:1,online:1}));headers['Cache-Control']='no-store';}
  else{const base=url.pathname.startsWith('/assets/ncn-built/')?dist:root,path=resolve(base,'.'+decodeURIComponent(url.pathname));assert.ok(path.startsWith(base+sep));assert.equal((await stat(path)).isFile(),true);body=await readFile(path);type=mime[extname(path)]||'application/octet-stream';}
  if(/javascript|css|html|json|svg/.test(type)){body=gzipSync(body);headers['Content-Encoding']='gzip';}
  headers['Content-Type']=type;headers['Content-Length']=body.length;requests.push({path:url.pathname,bytes:body.length});res.writeHead(200,headers);res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),results=[];
try{
 for(const version of ['before','after']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:100000,connectionType:'cellular4g'});
  for(const navigation of ['cold','repeat']){
   await page.goto(base+'/'+version+'/'+(navigation==='repeat'?'?visit=2':''),{waitUntil:'load'});await page.waitForFunction(()=>window.NCNAccount?.state.ready);
   const metrics=await page.evaluate(()=>{const all=performance.getEntriesByType('resource'),scripts=all.filter(x=>x.initiatorType==='script'||/\.js(?:\?|$)/.test(x.name)),styles=all.filter(x=>/\.css(?:\?|$)/.test(x.name));return {fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,domContentLoaded:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,scriptRequests:scripts.length,scriptBytes:scripts.reduce((n,x)=>n+x.encodedBodySize,0),scriptTransfer:scripts.reduce((n,x)=>n+x.transferSize,0),styleRequests:styles.length,styleBytes:styles.reduce((n,x)=>n+x.encodedBodySize,0),styleTransfer:styles.reduce((n,x)=>n+x.transferSize,0),blockingScripts:[...document.scripts].filter(x=>x.src&&x.type!=='module'&&!x.defer&&!x.async).length};});
   assert.equal(await page.locator('#ncn-articles a').count(),4);assert.equal(await page.locator('#ncn-tool-grid article').count(),22);assert.equal(await page.locator('#ncn-account-dialog').count(),1);
   if(version==='after'){assert.equal(metrics.blockingScripts,0);assert.equal(errors.length,0);}
   results.push({version,navigation,...metrics});console.log(JSON.stringify(results.at(-1)));
  }
  if(version==='after')await page.screenshot({path:out+'/home-built-phone.jpg',type:'jpeg',quality:85});
  await context.close();
 }
 const before=results.find(x=>x.version==='before'&&x.navigation==='cold'),after=results.find(x=>x.version==='after'&&x.navigation==='cold');
 assert.ok(after.scriptBytes<before.scriptBytes*.35,'Public homepage must remove at least 65% of compressed JavaScript');
 assert.ok(after.styleRequests<before.styleRequests,'Stylesheets must be consolidated');
 assert.ok(after.domContentLoaded<before.domContentLoaded,'The same throttled content must become interactive sooner');
}finally{await writeFile(out+'/results.json',JSON.stringify({simulation:{latencyMs:150,downloadBytesPerSecond:200000,viewport:'390×844'},results},null,2));await browser.close();await new Promise(done=>server.close(done));}
