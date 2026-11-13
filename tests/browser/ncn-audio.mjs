import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {createAudioHandler} from '../../netlify/lib/ncn-audio-api.mjs';
import {createSePayRouter} from '../../netlify/lib/ncn-sepay-router.mjs';
import {verifyIdentity} from '../../netlify/lib/ncn-event-api.mjs';
import {memoryStories} from '../fixtures/ncn-stories.mjs';

const origin='https://ncn-audio.test',identityPath='/.netlify/identity/',endpoint='/.netlify/functions/ncn-audio';
const root=resolve('dist'),out=resolve('artifacts/audio');
await mkdir(out,{recursive:true});
const store=memoryStories(),ledger=memoryStories(),now=Math.floor(Date.now()/1000)*1000,secret='isolated-browser-test-key-'.repeat(3);
const bank={bank:'VietinBank',account:'0000000000',name:'Tai khoan thu nghiem'};
const users=new Map(),tokens=new Map();
for(const role of ['audio','vip']){
 const email=role+'@example.test';
 users.set(email,{id:role,email,confirmed_at:'2026-11-01T00:00:00Z',app_metadata:{roles:[role]},user_metadata:{full_name:'Tài khoản '+role,roles:['audio','admin']}});
}
const fromBearer=headers=>tokens.get((headers.get('authorization')||'').replace(/^Bearer /,''));
const verify=req=>verifyIdentity(req,{url:origin+identityPath},async(_url,{headers})=>{
 const user=fromBearer(new Headers(headers));
 return Response.json(user||{}, {status:user?200:401});
},{includeAudio:true});
const audio=createAudioHandler({store:()=>store,production:()=>true,paymentReady:()=>true,bank,now:()=>now,verify});
const webhook=createSePayRouter({store:()=>ledger,audioStore:()=>store,bank,production:()=>true,now:()=>now,config:()=>({secret})});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
// Generated silence. The player decodes this locally during the test.
const sample=Buffer.from([
 '//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFX/+xLEKYPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFX/+xDEU4PAAAGkAAAAIAAA',
 'NIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVTEFNRTMuMTAwVf/7EsR9A8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVf/7EMSnA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//sS',
 'xNCDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFX/+xLE1YPAAAGkAAAAIAAANIAA',
 'AARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VUxBTUUzLjEwMFX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVf/7EsTVg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTW',
 'A8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sSxNWDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAE',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVX/+xLE1YPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVV',
 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ=='
].join(''),'base64');
const browser=await chromium.launch();
let page,mediaRequests=0;
async function context(viewport){
 const ctx=await browser.newContext({viewport});ctx.setDefaultTimeout(12000);
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  const reply=(data,status=200)=>route.fulfill({json:data,status});
  if(url.origin!==origin){
   assert.equal(method,'GET','No external writes');
   if(url.origin==='https://vietqr.app')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"/>'});
   return route.abort();
  }
  const headers=new Headers(await req.allHeaders()),raw=req.postDataBuffer();
  if(url.pathname.startsWith(identityPath)){
   const action=url.pathname.slice(identityPath.length);
   if(action==='settings')return reply({autoconfirm:true,disable_signup:false,external:{email:true}});
   if(action==='token'){
    const fields=new URLSearchParams(raw?.toString()),user=users.get(fields.get('username'));
    if(!user||fields.get('password')!=='Example123!')return reply({error_description:'Fixture credentials only'},400);
    const token='e30.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(now/1000)+3600})).toString('base64url')+'.fixture';
    tokens.set(token,user);
    return reply({access_token:token,refresh_token:'refresh-'+user.id,expires_in:3600,token_type:'bearer',user});
   }
   if(action==='user'){const user=fromBearer(headers);return reply(user||{},user?200:401);}
   if(action==='logout')return reply({});
   return reply({},404);
  }
  if(url.pathname==='/.netlify/functions/ncn-billing')return reply({user:await verify(new Request(url,{headers})),serverNow:new Date(now).toISOString()});
  if(url.pathname===endpoint){
   if(url.searchParams.get('route')==='sample')mediaRequests++;
   const res=await audio(new Request(url,{method,headers,...(raw?{body:raw}:{})}));
   return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
  }
  if(url.pathname.startsWith('/.netlify/functions/'))return reply({items:[],user:null,total:1,online:1});
  assert.equal(method,'GET');
  const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  try{return route.fulfill({status:200,contentType:types[extname(path)]||'application/octet-stream',body:await readFile(resolve(root,'.'+path))});}
  catch{return route.fulfill({status:404,body:'Missing fixture asset'});}
 });
 return ctx;
}
async function fits(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflows its viewport');}
async function login(p,role){
 await p.locator('#au-login').click();
 const form=p.locator('[data-account-form=login]');
 await form.locator('[name=email]').fill(role+'@example.test');
 await form.locator('[name=password]').fill('Example123!');
 await form.locator('[type=submit]').click();
 await p.waitForFunction(()=>!!window.NCNAccount?.state.user&&!document.getElementById('ncn-account-dialog').open);
}
const message=(p,selector,value)=>p.locator(selector).filter({hasText:value}).waitFor();
try{
 const guest=await context({width:390,height:844});
 page=await guest.newPage();
 await page.goto(origin+'/');
 await message(page,'#ncn-tool-grid article:first-child .ncn-new-badge','NEW');
 assert.equal(await page.locator('#ncn-tool-grid article:first-child a').getAttribute('href'),'/thu-audio/');
 await page.locator('#ncn-menu-open').click();
 assert.equal(await page.locator('#ncn-navigation a').first().getAttribute('href'),'/thu-audio/');
 await message(page,'#ncn-navigation a:first-of-type','NEW');
 await page.locator('#ncn-navigation a').first().click();
 await page.waitForFunction(()=>!document.getElementById('au-submit')?.disabled&&!!document.getElementById('au-submit'));
 await message(page,'.au-prices strong','100.000đ');
 await message(page,'.au-prices del','200.000đ');
 await fits(page);await page.setViewportSize({width:320,height:780});await fits(page);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:out+'/booking-mobile.png',fullPage:true});
 assert.equal(await page.locator('#au-sample-editor').isVisible(),false);
 const form=page.locator('#au-order-form'),script='Thu lời rao khuyến mãi cuối tuần.';
 await form.locator('[name=name]').fill('Khách thử nghiệm');
 await form.locator('[name=phone]').fill('0900123456');
 await form.locator('[name=script]').fill(script);
 await form.locator('[name=confirm]').check();
 await page.locator('#au-submit').click();
 await message(page,'#au-order-status','Chờ SePay');
 const code=await page.locator('#au-code').innerText();
 const qr=new URL(await page.locator('#au-qr').getAttribute('src'));
 assert.equal(qr.searchParams.get('des'),code);assert.equal(qr.searchParams.get('amount'),'100000');
 const body=JSON.stringify({id:1,gateway:bank.bank,accountNumber:bank.account,transferType:'in',transferAmount:100000,content:code,
  transactionDate:new Date(now+7*3600000).toISOString().slice(0,19).replace('T',' '),referenceCode:'fixture-audio'});
 const stamp=String(now/1000),signature=createHmac('sha256',secret).update(stamp+'.'+body).digest('hex');
 const received=await webhook(new Request(origin+'/.netlify/functions/ncn-sepay-webhook',{method:'POST',headers:{'Content-Type':'application/json','X-SePay-Timestamp':stamp,'X-SePay-Signature':'sha256='+signature},body}));
 assert.equal(received.status,200);
 await page.locator('#au-check').click();
 await message(page,'#au-order-status','Đã nhận chuyển khoản');
 await page.reload();await message(page,'#au-order-status','Đã nhận chuyển khoản');
 const buyer=page;
 console.log('PASS First menu entry, mobile booking, signed payment and order recovery');

 const vip=await context({width:1024,height:800});
 page=await vip.newPage();await page.goto(origin+'/thu-audio/#audio-history');await login(page,'vip');
 await message(page,'#au-history-message','chưa có quyền Audio');
 assert.equal(await page.locator('#au-sample-editor').isVisible(),false);
 assert.equal(await page.locator('#au-orders > *').count(),0);

 const staff=await context({width:1280,height:900});
 page=await staff.newPage();await page.goto(origin+'/thu-audio/#audio-history');await login(page,'audio');
 await page.locator('#au-sample-editor').waitFor();
 await page.locator('#au-orders summary').first().click();
 await message(page,'#au-orders .au-script-copy',script);
 await page.locator('#au-orders select').selectOption('recording');
 await page.locator('#au-orders textarea').fill('Đã nhận nội dung.');
 await page.getByRole('button',{name:'Lưu xử lý'}).click();
 await message(page,'#au-history-message','Đã lưu xử lý đơn.');
 await page.locator('#au-sample-form [name=title]').fill('Mẫu lời rao');
 await page.locator('#au-sample-form [type=file]').setInputFiles({name:'mau.mp3',mimeType:'audio/mpeg',buffer:sample});
 await page.getByRole('button',{name:'Tải mẫu lên'}).click();
 await message(page,'#au-sample-list','Mẫu lời rao');
 await buyer.reload();
 const player=buyer.locator('#au-samples audio[controls]');
 await player.waitFor();assert.equal(await player.getAttribute('preload'),'none');assert.equal(mediaRequests,0);
 await player.evaluate(audio=>audio.load());
 await buyer.waitForFunction(()=>document.querySelector('#au-samples audio')?.duration>0);
 await page.locator('#ncn-theme-toggle').click();
 await page.waitForFunction(()=>document.documentElement.dataset.ncnTheme==='dark');
 await fits(page);await page.screenshot({path:out+'/sample-editor-desktop.png',fullPage:true});
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Gỡ mẫu Mẫu lời rao'}).click();
 await message(page,'#au-samples','Chưa có audio mẫu.');
 await buyer.reload();await message(buyer,'#au-samples','Chưa có audio mẫu.');
 await message(buyer,'#au-order-status','Đang thu');
 console.log('PASS Role check, history, audio upload, public playback and removal');
}catch(error){
 await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
 throw error;
}finally{await browser.close();}
