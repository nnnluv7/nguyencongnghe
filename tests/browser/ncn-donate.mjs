import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createBillingHandler} from '../../netlify/lib/ncn-billing-api.mjs';
import {arcadeEngineFixture} from '../fixtures/arcade-store.mjs';
const root=resolve(process.env.NCN_BUILT_TEST?'dist':'public'),origin='https://ncn-donate.test',out=resolve('artifacts/donate'+(process.env.NCN_BUILT_TEST?'-built':''));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
const results=[],errors=[],calls=[],externalWrites=[];
const handler=createBillingHandler({production:()=>true,verify:async()=>null,store:()=>{throw Error('Public account checks must not touch storage');},config:()=>({})});
await mkdir(out,{recursive:true});const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin){if(request.method()!=='GET')externalWrites.push(request.url());return route.abort();}
 const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(url.pathname==='/.netlify/functions/ncn-billing'){
  calls.push({route:url.searchParams.get('route'),amount:url.searchParams.get('amount'),method:request.method()});
  const response=await handler(new Request(request.url(),{method:request.method(),headers:await request.allHeaders()}));return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 }
 if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-scores')?arcadeEngineFixture(url):{items:[],total:0,online:1});
 if(url.pathname.startsWith('/.netlify/identity/'))return json({autoconfirm:true,external:{email:true}});
 try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error();if((await stat(file)).isDirectory())file+='/index.html';return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function open(path='/premium/'){await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}}
try{
 await check('Donate is absent from home, menus, footers, account dropdowns and tool pages',async()=>{
  for(const path of ['/','/2024/01/in-fifo.html','/thu-vien/','/arcade/','/pikachu/','/in-event/','/in-gvgs/','/premium/']){
   await open(path);await page.locator('#ncn-menu-open').click();await page.locator('#ncn-sidebar').waitFor({state:'visible'});
   assert.equal(await page.locator('a[href="/premium/"],[data-ncn-tool="vip"],[data-ncn-pin="vip"],.ncn-footer-donate,.ncn-donate-button,#donate-form,#donate-qr').count(),0,path);
   assert.doesNotMatch(await page.locator('body').innerText(),/donate|ủng hộ NCN/i,path);await page.locator('#ncn-menu-close').click();
  }
 });
 await check('the old premium URL retains only the shared account and private historical receipts',async()=>{
  await open();assert.equal(await page.locator('#pay-auth').isVisible(),true);assert.equal(await page.locator('#pay-history-panel').isVisible(),false);assert.equal(await page.locator('#pay-admin').isVisible(),false);assert.equal(await page.locator('#ncn-account-dialog').isVisible(),false);
  assert.equal(await page.locator('[data-pay-plan],[data-donate-amount],img[src*="vietqr"]').count(),0);
  await page.locator('#pay-auth [data-ncn-account-open="login"]').click();assert.doesNotMatch(await page.locator('#ncn-account-dialog').innerText(),/donate|ủng hộ NCN/i);await page.locator('[data-account-close]').click();
 });
 await check('home and account layouts still fit desktop and phone widths in both themes',async()=>{
  for(const path of ['/','/premium/'])for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:844});await open(path);
   for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.ncnTheme=value,theme);
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(bounds.scroll<=width+1&&bounds.body<=width+1,JSON.stringify(bounds));
   }
  }
 });
 assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);assert.equal(calls.some(c=>c.route==='donation'||c.method==='POST'),false);console.log('Retired Donate UI: '+results.length+' scenarios passed; no payment requests.');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors,externalWrites},null,2));await context.close();await browser.close();}
