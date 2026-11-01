import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {createBillingHandler,BANK} from '../../netlify/lib/ncn-billing-api.mjs';
import {arcadeEngineFixture} from '../fixtures/arcade-store.mjs';
const root=resolve(process.env.NCN_BUILT_TEST?'dist':'public'),origin='https://ncn-donate.test',out=resolve('artifacts/donate'+(process.env.NCN_BUILT_TEST?'-built':''));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
const results=[],errors=[],calls=[],externalWrites=[];let qrFailure=false,apiFailure=false,held=null;
const qrImage=await QRCode.toBuffer('NCN DONATE BROWSER TEST ONLY',{width:240,margin:2});
const handler=createBillingHandler({production:()=>true,verify:async()=>null,store:()=>{throw Error('Anonymous donations must not touch storage');},config:()=>({})});
await mkdir(out,{recursive:true});const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin){if(request.method()!=='GET')externalWrites.push(request.url());if(url.origin==='https://vietqr.app')return qrFailure?route.abort():route.fulfill({contentType:'image/png',body:qrImage});return route.abort();}
 const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(url.pathname==='/.netlify/functions/ncn-billing'){
  calls.push({route:url.searchParams.get('route'),amount:url.searchParams.get('amount'),method:request.method()});
  if(url.searchParams.get('route')==='donation'&&held&&url.searchParams.get('amount')===held.amount){const pending=held;pending.started();await pending.wait;}
  if(apiFailure)return json({error:'Kết nối thử đang gián đoạn.'},503);
  const response=await handler(new Request(request.url(),{method:request.method(),headers:await request.allHeaders()}));return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 }
 if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-scores')?arcadeEngineFixture(url):{items:[],total:0,online:1});
 if(url.pathname.startsWith('/.netlify/identity/'))return json({autoconfirm:true,external:{email:true}});
 try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error();if((await stat(file)).isDirectory())file+='/index.html';return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function open(path='/premium/'){await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}}
async function amount(value){await page.locator('#donate-amount').fill(value);await page.locator('#donate-submit').click();}
async function qrReady(value){await page.waitForFunction(amount=>{const img=document.getElementById('donate-qr');return !img.hidden&&img.complete&&img.naturalWidth>0&&new URL(img.src).searchParams.get('amount')===amount;},value);}
try{
 await check('donation is immediately available to guests with an open amount and no registration or plan purchase',async()=>{
  await open();await qrReady(null);assert.equal(await page.locator('#pay-auth').isVisible(),true);assert.equal(await page.locator('#ncn-account-dialog').isVisible(),false);assert.equal(await page.locator('[data-pay-plan]').count(),0);assert.equal(calls.some(c=>c.route==='create-order'),false);
  assert.equal(await page.locator('#donate-bank-account').textContent(),BANK.account);
 });
 await check('preset, arbitrary and open amounts produce the correct QR without opening account prompts',async()=>{
  await page.locator('[data-donate-amount="20000"]').click();await qrReady('20000');await amount('12345');await qrReady('12345');assert.match(await page.locator('#donate-selected').innerText(),/12\.345/);
  await amount('1');await qrReady('1');await page.locator('[data-donate-amount=""]').click();await qrReady(null);assert.equal(await page.locator('#ncn-account-dialog').isVisible(),false);
 });
 await check('editing the amount hides a stale QR and rejects zero, negative and fractional values without preparing a transfer',async()=>{
  for(const value of ['0','-2','1.2','hello']){const before=calls.length;await page.locator('#donate-amount').fill(value);assert.equal(await page.locator('#donate-qr').isVisible(),false);await page.locator('#donate-submit').click();assert.equal(calls.length,before);assert.equal(await page.locator('#donate-amount').evaluate(el=>el.validity.customError),true);}
  await amount('7777');await qrReady('7777');
 });
 await check('a delayed earlier amount never replaces the most recent selected QR',async()=>{
  let release,started;const wait=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>started=resolve);held={amount:'4321',wait,started};
  await page.locator('#donate-amount').fill('4321');await page.locator('#donate-submit').click();await requested;
  await page.locator('[data-donate-amount="50000"]').click();await qrReady('50000');release();held=null;
  assert.equal(new URL(await page.locator('#donate-qr').getAttribute('src')).searchParams.get('amount'),'50000');
 });
 await check('an unavailable QR image keeps the bank details, copy actions and a direct image link',async()=>{
  qrFailure=true;await amount('11223');await page.locator('#donate-qr-error').waitFor();assert.equal(await page.locator('#donate-bank-account').textContent(),BANK.account);assert.equal(await page.locator('[data-donate-copy]').count(),2);assert.equal(await page.locator('#donate-qr-open').isVisible(),true);qrFailure=false;await amount('11224');await qrReady('11224');
 });
 await check('a failed preparation request leaves manual transfer information and supports a fresh retry',async()=>{
  apiFailure=true;await amount('6543');await page.locator('#pay-message.pay-error').waitFor();assert.equal(await page.locator('#donate-bank-account').textContent(),BANK.account);assert.equal(await page.locator('#donate-qr').isVisible(),false);apiFailure=false;await amount('6544');await qrReady('6544');
 });
 await check('the donation page fits 320px and iPhone screens, desktop and dark mode with no horizontal overflow',async()=>{
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width>760?1100:844});for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.ncnTheme=value,theme);
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(bounds.scroll<=width+1&&bounds.body<=width+1,JSON.stringify(bounds));
    await page.screenshot({path:out+'/'+theme+'-'+width+'.png',fullPage:true});
   }
  }
 });
 await check('the invitation stays in normal page flow across tools, articles, the library and games and disappears in print',async()=>{
  await page.setViewportSize({width:1280,height:900});
  for(const path of ['/','/2024/01/in-fifo.html','/thu-vien/','/arcade/','/pikachu/','/in-event/','/in-gvgs/']){
   await open(path);const link=page.locator('#ncn-footer .ncn-footer-donate');assert.equal(await link.count(),1,path);assert.equal(await link.getAttribute('href'),'/premium/');assert.equal(await link.evaluate(el=>getComputedStyle(el).position),'static');
   await page.emulateMedia({media:'print'});assert.equal(await link.isVisible(),false,path);await page.emulateMedia({media:'screen'});
  }
 });
 assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);assert.equal(calls.some(c=>c.method==='POST'),false);console.log('Donation UI: '+results.length+' scenarios passed; no production accounts or payments.');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors,externalWrites},null,2));await context.close();await browser.close();}
