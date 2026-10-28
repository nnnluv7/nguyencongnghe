import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// All network traffic stays on a disposable local server. Public pages, their
// real assets and simulated network conditions match between audit versions.
const root=resolve(process.env.NCN_TOOL_AUDIT_ROOT||'dist'),phase=process.env.NCN_TOOL_AUDIT_PHASE||'after',out=resolve('artifacts/performance-tools');
const config=JSON.parse(await readFile('public/assets/ncn-theme/config.json','utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');let body,type;
  const headers={'Content-Security-Policy':"connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-src 'self'; form-action 'none'",'Cache-Control':url.pathname.startsWith('/assets/ncn-built/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'};
  if(url.pathname.startsWith('/.netlify/')){
   const value=url.searchParams.get('route')==='plans'?{ready:true,plans:[{id:'vip30',amount:30000},{id:'vip60',amount:55000}]}:url.pathname.includes('identity')?{disable_signup:false,external:{email:true}}:url.pathname.includes('profile')?{profile:null,needsProfile:true}:url.pathname.includes('announcements')?{items:[]}:{user:null,profile:null,items:[],total:0,you:null,nextCursor:null,online:1};
   body=Buffer.from(JSON.stringify(value));type=mime['.json'];headers['Cache-Control']='no-store';
  }else{
   let path=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(path===root||path.startsWith(root+sep));if((await stat(path)).isDirectory())path+='/index.html';body=await readFile(path);type=mime[extname(path)]||'application/octet-stream';
  }
  if(/javascript|css|html|json|svg/.test(type)){body=gzipSync(body);headers['Content-Encoding']='gzip';}
  headers['Content-Type']=type;headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
await mkdir(out,{recursive:true});const browser=await chromium.launch(),results=[],queue=config.tools.filter(t=>!process.env.NCN_TOOL_AUDIT_FILTER||t.href.includes(process.env.NCN_TOOL_AUDIT_FILTER));
async function worker(){while(queue.length){const tool=queue.shift(),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 try{
  page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{window.__ncnLongTasks=[];new PerformanceObserver(list=>{window.__ncnLongTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration})));}).observe({type:'longtask',buffered:true});});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:100000,connectionType:'cellular4g'});
  const response=await page.goto(base+tool.href,{waitUntil:'domcontentloaded',timeout:45000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.NCNAccount?.state.ready,null,{timeout:20000});
  for(const selector of ['#ncn-sticker-app','#ncn-popup-app','#ncn-store-app'])if(await page.locator(selector).count())await page.locator(selector+'[data-ready=true]').waitFor({timeout:20000});
  if(await page.locator('#ncn-cash-app').count())await page.locator('#ncn-cash-app[data-cq-mounted=true]').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete),null,{timeout:20000});
  const metrics=await page.evaluate(()=>{const resources=performance.getEntriesByType('resource'),scripts=resources.filter(x=>/\.js(?:\?|$)/.test(x.name));return {fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,ready:performance.now(),scriptBytes:scripts.reduce((n,x)=>n+x.encodedBodySize,0),requests:resources.length,totalBytes:resources.reduce((n,x)=>n+x.encodedBodySize,0),largest:resources.slice().sort((a,b)=>b.encodedBodySize-a.encodedBodySize).slice(0,5).map(x=>({path:new URL(x.name).pathname,bytes:x.encodedBodySize})),longTasks:window.__ncnLongTasks};});
  results.push({path:tool.href,name:tool.title,...metrics,errors});console.log(JSON.stringify({path:tool.href,ready:Math.round(metrics.ready),fcp:Math.round(metrics.fcp||0),scriptBytes:metrics.scriptBytes,errors}));
  if(phase==='after')assert.deepEqual(errors,[],tool.href+' uncaught script errors');
 }catch(error){results.push({path:tool.href,name:tool.title,failure:error.message,errors});console.log('FAIL '+tool.href+' '+error.message);await page.screenshot({path:out+'/failure-'+tool.id+'.jpg',type:'jpeg'}).catch(()=>{});}
 finally{await context.close();}
}}
try{await Promise.all([worker(),worker()]);}finally{await writeFile(out+'/'+phase+'.json',JSON.stringify({phase,network:{latency:150,downloadBytesPerSecond:200000},results},null,2));await browser.close();await new Promise(done=>server.close(done));}
assert.equal(results.filter(x=>x.failure).length,0,'Every primary tool route must finish loading');
