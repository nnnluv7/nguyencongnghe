import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {createBillingHandler,createWebhookHandler,BANK} from '../../netlify/lib/ncn-billing-api.mjs';
import {preparePublicTools} from '../../netlify/lib/ncn-public-copy.mjs';
import {memoryStore,arcadeEngineFixture} from '../fixtures/arcade-store.mjs';
const root=resolve(process.env.NCN_BUILT_TEST?'dist':'public'),origin='https://ncn-donate.test',out=resolve('artifacts/donate'+(process.env.NCN_BUILT_TEST?'-built':''));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
const results=[],errors=[],calls=[],externalWrites=[],ledger=memoryStore(),secret='fixture-donate-only-'.repeat(4);
const user={id:'fixture-supporter',email:'supporter@example.test',name:'Người ủng hộ thử',vip:false,admin:false};
const raw={id:user.id,email:user.email,confirmed_at:'2026-11-01',created_at:'2026-11-01',app_metadata:{roles:[]},user_metadata:{full_name:user.name}};
const jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,email:user.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const verify=req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?user:null;
const handler=createBillingHandler({production:()=>true,verify:async req=>verify(req),store:()=>ledger,config:()=>({enabled:true,secret})});
await mkdir(out,{recursive:true});const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1100}});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url()),headers=await request.allHeaders(),method=request.method();
 if(url.origin!==origin){if(method!=='GET')externalWrites.push(request.url());return route.abort();}
 const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 const req=new Request(request.url(),{method,headers,...(method==='POST'?{body:request.postData()||''}:{})});
 if(url.pathname==='/.netlify/functions/ncn-billing'){
  calls.push({route:url.searchParams.get('route'),method});const response=await handler(req),data=await response.json();
  if(data.order)data.order.qrUrl=origin+'/test-qr.svg';
  return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:JSON.stringify(data)});
 }
 if(url.pathname==='/test-qr.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280"><rect width="280" height="280" fill="white"/><text x="140" y="140" text-anchor="middle">QR KIỂM THỬ</text></svg>'});
 if(url.pathname.startsWith('/.netlify/identity/')){
  const action=url.pathname.split('/').at(-1);
  if(action==='settings')return json({autoconfirm:true,external:{email:true}});
  if(action==='token')return json({access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:raw});
  if(action==='user')return json(raw);
  if(action==='logout')return json({});
 }
 if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-scores')?arcadeEngineFixture(url):{items:[],total:0,online:1});
 try{let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error();if((await stat(file)).isDirectory())file+='/index.html';let bytes=await readFile(file);if(file.endsWith('.html'))bytes=Buffer.from(preparePublicTools(bytes.toString()));return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:bytes});}catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function open(path='/donate/'){await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}}
try{
 await check('everyone can discover both VIP tools and Donate without a role',async()=>{
  await open('/');for(const id of ['event','gvgs'])assert.equal(await page.locator('#ncn-tool-grid [data-ncn-tool='+id+']').isVisible(),true);
  await page.locator('#ncn-menu-open').click();assert.equal(await page.locator('#ncn-sidebar a[href="/donate/#reg"]').count(),1);await page.locator('#ncn-menu-close').click();assert.equal(await page.locator('.ncn-footer-donate').count(),1);
 });
 await check('Donate shows branded prices, trial rules and login without creating an order',async()=>{
  await open();await page.locator('#donate-create:not([disabled])').waitFor();
  const text=await page.locator('#ncn-billing-app').innerText();assert.match(text,/29\.000đ/);assert.match(text,/49\.000đ/);assert.match(text,/3 lượt dùng thử chung/);assert.doesNotMatch(text,/mientay2\.pro|160439/i);
  assert.equal(await page.locator('#donate-order').isVisible(),false);assert.equal(calls.some(c=>c.route==='create-order'),false);
  await page.locator('#donate-create').click();await page.locator('[data-account-form=login]').waitFor({state:'visible'});
  const form=page.locator('[data-account-form=login]');await form.locator('[name=email]').fill(user.email);await form.locator('[name=password]').fill('Fixture123!');await form.locator('[type=submit]').click();await page.waitForFunction(()=>NCNAccount.state.user?.id==='fixture-supporter'&&!NCNAccount.state.busy);
 });
 await check('a 60-day two-pack QR is owned by the logged-in account and uses the server amount',async()=>{
  await page.locator('input[value=vip60]').check();await page.getByLabel('Số gói Donate').selectOption('2');await page.locator('#donate-create').click();
  await page.locator('#donate-order').waitFor({state:'visible'});assert.equal(await page.locator('#donate-amount').innerText(),'98.000đ');assert.equal(await page.locator('#donate-owner').innerText(),user.email);assert.match(await page.locator('#donate-description').innerText(),/^NCN NCN[A-F0-9]{20}$/);
  assert.equal(calls.filter(c=>c.route==='create-order').length,1);await page.screenshot({path:out+'/donate-desktop.png',fullPage:true});
 });
 await check('a verified receipt updates the same account to supporter and restores unlimited tools',async()=>{
  const description=await page.locator('#donate-description').innerText(),now=Date.now();
  const local=new Date(now+7*3600000).toISOString().slice(0,19).replace('T',' '),data={id:90001,gateway:BANK.bank,accountNumber:BANK.account,transferType:'in',transferAmount:98000,content:description,transactionDate:local,referenceCode:'fixture-browser-only'};
  const body=JSON.stringify(data),stamp=String(Math.floor(now/1000));const webhook=createWebhookHandler({production:()=>true,store:()=>ledger,now:()=>now,config:()=>({secret})});
  const res=await webhook(new Request(origin+'/.netlify/functions/ncn-sepay-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-sepay-timestamp':stamp,'x-sepay-signature':'sha256='+createHmac('sha256',secret).update(stamp+'.'+body).digest('hex')},body}));assert.equal(res.status,200);
  await page.locator('#donate-check').click();await page.locator('#donate-status').filter({hasText:'ĐÃ GHI NHẬN'}).waitFor();await page.waitForFunction(()=>NCNAccount.state.user?.vipSource==='payment');assert.equal(await page.locator('#pay-tools').isVisible(),true);assert.equal(await page.locator('#donate-qr').isVisible(),false);
 });
 await check('Donate fits desktop, narrow phones and both themes',async()=>{
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:844});for(const theme of ['light','dark']){
   await page.evaluate(value=>NCN_APPEARANCE.set(value),theme);const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(bounds.scroll<=width+1&&bounds.body<=width+1,JSON.stringify(bounds));await page.screenshot({path:out+'/donate-'+width+'-'+theme+'.png',fullPage:true});
  }}
 });
 assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);console.log('Donate: '+results.length+' scenarios passed with isolated Identity and SePay.');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors,externalWrites},null,2));await context.close();await browser.close();}
