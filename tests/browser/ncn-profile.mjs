import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {createProfileHandler} from '../../netlify/lib/ncn-profile-api.mjs';
import {createScoresHandler} from '../../netlify/lib/ncn-scores-api.mjs';
import {scorePhoto} from '../../netlify/lib/ncn-score-photos.mjs';
import {verifyIdentity} from '../../netlify/lib/ncn-event-api.mjs';
import {withPaidVip,memberKey} from '../../netlify/lib/ncn-membership.mjs';
import {memoryStore} from '../fixtures/arcade-store.mjs';

// Synthetic HTTPS Identity, membership ledger and real photo/score handlers.
// No production account, upload, payment, email or score is created.
const origin='https://ncn-profile.test',root=resolve(process.env.NCN_BUILT_TEST?'dist':'public'),out=resolve('artifacts/profile'+(process.env.NCN_BUILT_TEST?'-built':''));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const at=Date.parse('2026-10-26T12:00:00Z'),results=[],errors=[],updates=[],tokens=new Map();
const member={id:'fixture-member',email:'private@example.test',name:'Nguyễn Công Nghệ',password:'Example123!',roles:[],metadata:{full_name:'Nguyễn Công Nghệ',keep:'preserved',roles:['admin','vip']}};
const ledger=memoryStore(),photos=memoryStore(),scores=memoryStore();
await ledger.setJSON(memberKey(member.id),{userId:member.id,expiresAt:'2026-11-25T12:00:00Z',blocked:false});
let now=at,uploadHold=null,failUpload=false,holdMe=null,dropUploadOnce=false,uploadRequests=0;
const raw=user=>({id:user.id,email:user.email,confirmed_at:'2026-09-01T12:00:00Z',created_at:'2026-09-01T12:00:00Z',app_metadata:{roles:user.roles},user_metadata:user.metadata});
function session(user){const jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,email:user.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';tokens.set(jwt,user);return {access_token:jwt,refresh_token:'refresh-'+user.id,token_type:'bearer',expires_in:3600,user:raw(user)};}
const authenticated=req=>tokens.get(decodeURIComponent((req.headers.get('cookie')||'').match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1]||''));
const verify=req=>verifyIdentity(req,{url:origin+'/.netlify/identity'},async()=>{const user=authenticated(req);return user?Response.json(raw(user)):new Response('',{status:401});},{includeAvatar:true,includeJoined:true});
const profileHandler=createProfileHandler({production:()=>true,verify,store:()=>photos,photo:scorePhoto});
const scoreHandler=createScoresHandler({production:()=>true,verify,store:()=>scores,now:()=>now,photo:scorePhoto});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:1000}});
await mkdir(out,{recursive:true});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url()),headers=await request.allHeaders(),method=request.method(),body=request.postData()||'';
 if(url.origin!==origin){assert.notEqual(method,'POST','Unexpected external write');return route.abort();}
 const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 const req=new Request(request.url(),{method,headers,...(method==='POST'||method==='PUT'?{body}:{})});
 if(url.pathname.startsWith('/.netlify/identity/')){
  const action=url.pathname.split('/').at(-1),data=body.startsWith('{')?JSON.parse(body):Object.fromEntries(new URLSearchParams(body)),user=tokens.get((headers.authorization||'').replace(/^Bearer /,''))||authenticated(req);
  if(action==='settings')return json({autoconfirm:true,disable_signup:false,external:{email:true}});
  if(action==='token')return data.username===member.email&&data.password===member.password||data.refresh_token==='refresh-'+member.id?json(session(member)):json({error_description:'Sai tài khoản thử'},400);
  if(action==='user'){
   if(!user)return json({msg:'Unauthorized'},401);
   if(method==='PUT'){updates.push(structuredClone(data));if(data.data)Object.assign(user.metadata,data.data);user.name=user.metadata.full_name;}
   return json(raw(user));
  }
  if(action==='logout')return json({});
  throw new Error('Unmocked Identity route '+action);
 }
 if(url.pathname==='/.netlify/functions/ncn-profile'){
  if(url.searchParams.get('route')==='upload'){uploadRequests++;if(uploadHold){uploadHold.started();await uploadHold.wait;}if(failUpload)return json({error:'Ảnh chưa tải được. Thử lại nhé.'},503);}
  const response=await profileHandler(req);if(url.searchParams.get('route')==='upload'&&dropUploadOnce){dropUploadOnce=false;return route.abort('failed');}return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 }
 if(url.pathname==='/.netlify/functions/ncn-scores'){const response=await scoreHandler(req);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}
 if(url.pathname==='/.netlify/functions/ncn-billing'){if(holdMe){const held=holdMe;holdMe=null;const current=await withPaidVip(await verify(req),ledger,now);held.started();await held.wait;return json({user:current,serverNow:new Date(now).toISOString()});}return json({user:await withPaidVip(await verify(req),ledger,now),serverNow:new Date(now).toISOString()});}
 if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-announcements')?{items:[]}:{items:[],total:1,online:1});
 try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error();if((await stat(path)).isDirectory())path+='/index.html';return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function open(path='/arcade/'){await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});console.log(await page.locator('#ncn-account-message').textContent().catch(()=>''));await page.screenshot({path:out+'/failure.jpg',fullPage:true}).catch(()=>{});throw error;}}
async function manage(tab='profile'){if(await page.locator('#ncn-account-dialog[open]').count())await page.locator('[data-account-close]').click();await page.evaluate(()=>scrollTo(0,0));await page.locator('.ncn-account-menu>summary').click();await page.locator('#auth-header-desktop [data-ncn-account-open='+tab+']').click();await page.locator('.ncn-member-panel').waitFor();}
async function login(){const form=page.locator('[data-account-form=login]');await form.locator('[name=email]').fill(member.email);await form.locator('[name=password]').fill(member.password);await form.locator('[type=submit]').click();await page.waitForFunction(()=>!!NCNAccount.state.user&&!NCNAccount.state.busy);}
const photo=await sharp({create:{width:1024,height:900,channels:3,background:'#3187bc'}}).png().toBuffer();
let avatar;
try{
 await check('anonymous menu survives theme mounting and redirects account management to the shared login',async()=>{
  await open();assert.equal(await page.locator('.ncn-account-menu').count(),1);assert.equal(await page.locator('.ncn-account-menu>summary svg').count(),1);
  await page.locator('.ncn-account-menu>summary').click();await page.locator('#auth-header-desktop [data-ncn-account-open=login]').click();await page.locator('[data-account-close]').click();
  await page.evaluate(()=>NCNAccount.open('profile'));assert.equal(await page.locator('[data-account-form=login]').isVisible(),true);await login();
  assert.equal(await page.locator('[data-member-form]').isVisible(),true);assert.equal(await page.locator('#ncn-member-email').inputValue(),member.email);assert.equal(await page.locator('#ncn-member-email').getAttribute('readonly'),'');assert.equal(await page.locator('#ncn-member-since').innerText(),'1/9/2026');
  assert.equal(await page.evaluate(()=>NCNAccount.state.user.admin),false);
 });
 await check('VIP detail uses the existing server ledger and server time with a direct renewal link',async()=>{
  await page.locator('[data-member-tab=vip]').click();assert.equal(await page.locator('#ncn-member-vip-title').innerText(),'VIP đang hoạt động');assert.equal(await page.locator('#ncn-member-vip-remaining').innerText(),'30 ngày');assert.equal(await page.locator('#ncn-member-vip-expiry').innerText(),'25/11/2026');assert.equal(await page.locator('.ncn-member-vip-link').getAttribute('href'),'/premium/');
  await page.screenshot({path:out+'/vip-desktop.jpg',fullPage:true});await page.locator('[data-member-tab=profile]').click();
 });
 await check('saving an avatar uses the photo handler and updates only the member display metadata',async()=>{
  await page.locator('#ncn-member-name').fill('Công Nghệ Mới');await page.locator('#ncn-member-photo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:photo});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();
  assert.equal(photos.entries.size,0,'Choosing a photo alone must not upload it');await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();
  assert.equal(updates.length,1);assert.deepEqual(Object.keys(updates[0]),['data']);assert.deepEqual(Object.keys(updates[0].data).sort(),['avatar_url','full_name']);assert.equal(member.metadata.keep,'preserved');
  avatar=member.metadata.avatar_url;assert.match(avatar,/ncn-profile\?route=avatar&id=[a-f0-9]{64}$/);assert.equal(photos.entries.size,1);assert.equal(await page.locator('[data-account-avatar] img').getAttribute('src'),avatar);assert.equal(await page.evaluate(()=>NCNAccount.state.user.vip),true);assert.equal(await page.evaluate(()=>NCNAccount.state.user.admin),false);
  const saved=[...photos.entries.values()][0].data,dimensions=await sharp(saved).metadata();assert.equal(dimensions.width,768);assert.equal(dimensions.height,768);
  assert.equal((await ledger.get(memberKey(member.id))).expiresAt,'2026-11-25T12:00:00Z');await page.screenshot({path:out+'/profile-desktop.jpg',fullPage:true});await page.locator('#ncn-account-dialog').screenshot({path:out+'/profile-panel.png'});
 });
 await check('profile and VIP fit narrow phone screens and dark mode without horizontal overflow',async()=>{
  for(const width of [390,320]){await page.setViewportSize({width,height:844});for(const tab of ['profile','vip']){await page.locator('[data-member-tab='+tab+']').click();const bounds=await page.locator('#ncn-account-dialog').evaluate(el=>({x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.scroll<=bounds.client+1,JSON.stringify(bounds));await page.screenshot({path:out+'/'+tab+'-'+width+'.jpg',fullPage:true});}}
  await page.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');await page.screenshot({path:out+'/vip-dark-phone.jpg',fullPage:true});await page.locator('[data-member-tab=profile]').click();await page.screenshot({path:out+'/profile-dark-phone.jpg',fullPage:true});await page.evaluate(()=>document.documentElement.dataset.ncnTheme='light');await page.setViewportSize({width:1280,height:1000});
 });
 await check('name-only edits retain the saved avatar and a refreshed page restores both',async()=>{
  await page.locator('#ncn-member-name').fill('Tên dùng chung');await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();assert.deepEqual(updates.at(-1),{data:{full_name:'Tên dùng chung'}});assert.equal(member.metadata.avatar_url,avatar);
  await page.locator('[data-account-close]').click();await page.reload();await page.waitForFunction(()=>NCNAccount.state.user?.name==='Tên dùng chung');await manage();assert.equal(await page.locator('#ncn-member-name').inputValue(),'Tên dùng chung');assert.equal(await page.locator('.ncn-member-avatar img').getAttribute('src'),avatar);
 });
 await check('all six games automatically use the updated member profile and open the same account management',async()=>{
  for(const path of ['/ran-luot/','/flappy-bird/','/pikachu/','/ca-lon-nuot-ca-be/','/xep-hinh/','/ban-bong/']){
   await open(path);await page.locator('.ncn-score-player strong').filter({hasText:'Tên dùng chung'}).waitFor();assert.equal(await page.locator('.ncn-score-player img').getAttribute('src'),avatar);assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0);
   await page.locator('.ncn-score-player button').click();await page.locator('[data-member-form]').waitFor();assert.equal(await page.locator('#ncn-member-name').inputValue(),'Tên dùng chung');assert.equal(await page.locator('#ncn-account-dialog').count(),1);await page.locator('[data-account-close]').click();
  }
 });
 await check('a changed avatar alone publishes account changes and refreshes Arcade on the current page',async()=>{
  await manage();const second=await sharp({create:{width:300,height:360,channels:3,background:'#c184a7'}}).png().toBuffer();await page.locator('#ncn-member-photo').setInputFiles({name:'new.png',mimeType:'image/png',buffer:second});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();const previous=avatar;avatar=member.metadata.avatar_url;assert.notEqual(avatar,previous);await page.locator('[data-account-close]').click();await page.waitForFunction(a=>document.querySelector('.ncn-score-player img')?.src===a,avatar);
 });
 await check('a member upgrades a legacy 192px portrait through account management while points, identity and VIP stay intact',async()=>{
  if(await page.locator('#ncn-account-dialog[open]').count())await page.locator('[data-account-close]').click();
  const oldBytes=await sharp(photo).resize(192,192,{fit:'cover'}).webp().toBuffer(),hash=createHash('sha256').update(oldBytes).digest('hex'),oldAvatar=origin+'/.netlify/functions/ncn-profile?route=avatar&id='+hash;await photos.set('avatar/'+hash,oldBytes);member.metadata.avatar_url=oldAvatar;
  const cookie=(await context.cookies()).find(x=>x.name==='nf_jwt'),call=async(route,data)=>{const response=await scoreHandler(new Request(origin+'/.netlify/functions/ncn-scores?route='+route,{method:'POST',headers:{Origin:origin,Cookie:'nf_jwt='+cookie.value,'Content-Type':'application/json'},body:JSON.stringify(data)}));assert.equal(response.status,200);return response.json();};
  const started=await call('start',{game:'bubble',mode:'journey'});now+=20000;await call('score',{runId:started.runId,score:500,level:1});const bestKey='best/'+started.owner+'/bubble/journey',best=await scores.get(bestKey),paid=await ledger.get(memberKey(member.id));
  await open('/ban-bong/');await page.locator('#ncn-scoreboard .ncn-score-row.is-you .ncn-score-avatar-button').click();await page.locator('.ncn-avatar-quality').filter({hasText:'Quản lý tài khoản'}).waitFor();await page.locator('[data-avatar-upgrade]').click();await page.locator('[data-member-form]').waitFor();assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0);assert.equal(await page.locator('#ncn-member-name').inputValue(),'Tên dùng chung');
  await page.locator('#ncn-member-photo').setInputFiles({name:'original.png',mimeType:'image/png',buffer:photo});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();avatar=member.metadata.avatar_url;assert.notEqual(avatar,oldAvatar);assert.deepEqual(await scores.get(bestKey),best);assert.deepEqual(await ledger.get(memberKey(member.id)),paid);assert.equal(member.metadata.keep,'preserved');assert.deepEqual(Object.keys(updates.at(-1).data).sort(),['avatar_url','full_name']);
  await page.waitForFunction(value=>document.querySelector('#ncn-scoreboard .ncn-score-row.is-you img')?.src===value,avatar);const row=await scores.get(best.key);assert.equal(row.id,started.owner);assert.equal(row.score,500);assert.equal(row.avatar,avatar);await page.locator('[data-account-close]').click();await page.locator('#ncn-scoreboard .ncn-score-row.is-you .ncn-score-avatar-button').click();await page.waitForFunction(()=>document.querySelector('.ncn-avatar-image img')?.naturalWidth===768);assert.equal(await page.locator('.ncn-avatar-quality').isVisible(),false);await page.screenshot({path:out+'/member-avatar-hd.jpg'});await page.locator('[data-avatar-close]').click();
 });
 await check('a member upload whose response is lost retries the same image once and updates metadata only once',async()=>{
  await manage();const next=await sharp({create:{width:800,height:900,channels:3,background:'#397c64'}}).png().toBuffer(),before=updates.length,requests=uploadRequests,stored=photos.entries.size;await page.locator('#ncn-member-photo').setInputFiles({name:'retry-network.png',mimeType:'image/png',buffer:next});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();dropUploadOnce=true;await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();assert.equal(uploadRequests,requests+2);assert.equal(photos.entries.size,stored+1);assert.equal(updates.length,before+1);avatar=member.metadata.avatar_url;assert.equal(await page.evaluate(()=>NCNAccount.state.user.vip),true);assert.equal(await page.evaluate(()=>NCNAccount.state.user.admin),false);
 });
 await check('invalid files and a failed upload leave the saved profile intact and allow retry',async()=>{
  await manage();await page.locator('#ncn-member-photo').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.locator('#ncn-account-message').filter({hasText:'Chọn ảnh JPG'}).waitFor();
  const count=updates.length;await page.locator('#ncn-member-photo').setInputFiles({name:'retry.png',mimeType:'image/png',buffer:photo});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();failUpload=true;await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message.ncn-account-error').filter({hasText:'Thử lại'}).waitFor();assert.equal(updates.length,count);assert.equal(member.metadata.avatar_url,avatar);assert.equal(await page.locator('[data-member-form] [type=submit]').isEnabled(),true);
  failUpload=false;await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();avatar=member.metadata.avatar_url;
 });
 await check('background refresh preserves an unsaved draft; closing cancels the draft',async()=>{
  await page.locator('#ncn-member-name').fill('Chưa lưu');await page.evaluate(()=>NCNAccount.refresh({force:true}));assert.equal(await page.locator('#ncn-member-name').inputValue(),'Chưa lưu');await page.locator('[data-account-close]').click();await manage();assert.equal(await page.locator('#ncn-member-name').inputValue(),'Tên dùng chung');
 });
 await check('an older session response cannot overwrite a newly saved member profile',async()=>{
  let release,started;const wait=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>started=resolve);holdMe={wait,started};await page.evaluate(()=>{window.oldProfileRefresh=NCNAccount.refresh({force:true});});await requested;
  await page.locator('#ncn-member-name').fill('Hồ sơ mới nhất');await page.locator('[data-member-form] [type=submit]').click();await page.locator('#ncn-account-message').filter({hasText:'Đã cập nhật'}).waitFor();release();await page.evaluate(()=>window.oldProfileRefresh);assert.equal(await page.evaluate(()=>NCNAccount.state.user.name),'Hồ sơ mới nhất');assert.equal(await page.locator('#ncn-member-name').inputValue(),'Hồ sơ mới nhất');
 });
 await check('VIP refresh handles expiry and manual grants without changing the account profile',async()=>{
  await ledger.setJSON(memberKey(member.id),{userId:member.id,expiresAt:'2026-10-25T12:00:00Z',blocked:false});await page.locator('[data-member-tab=vip]').click();await page.locator('[data-member-refresh]').click();await page.locator('#ncn-member-vip-title').filter({hasText:'đã hết hạn'}).waitFor();assert.equal(await page.locator('#ncn-member-vip-remaining').innerText(),'0 ngày');
  member.roles=['vip'];await page.locator('[data-member-refresh]').click();await page.locator('#ncn-member-vip-plan').filter({hasText:'Admin cấp'}).waitFor();assert.equal(await page.locator('#ncn-member-vip-expiry').innerText(),'Không giới hạn');member.roles=[];
 });
 await check('signing out while a photo upload waits never attaches that photo or restores private fields',async()=>{
  await page.locator('[data-member-tab=profile]').click();await page.locator('#ncn-member-photo').setInputFiles({name:'last.png',mimeType:'image/png',buffer:photo});await page.locator('#ncn-account-message').filter({hasText:'Đã chọn ảnh'}).waitFor();
  let release,started;const wait=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>started=resolve);uploadHold={wait,started};const count=updates.length;await page.locator('[data-member-form] [type=submit]').click();await requested;assert.equal(await page.locator('#ncn-member-name').isDisabled(),true);
  await page.evaluate(()=>NCNAccount.signOut());release();uploadHold=null;await page.waitForFunction(()=>!NCNAccount.state.busy&&!NCNAccount.state.user);assert.equal(updates.length,count);assert.equal(await page.locator('#ncn-member-email').inputValue(),'');assert.equal(await page.locator('#ncn-member-name').inputValue(),'');assert.equal(await page.locator('[data-account-avatar] img').count(),0);assert.equal(await page.locator('.ncn-member-panel').isVisible(),false);
 });
 assert.deepEqual(errors,[]);console.log('Member profile: '+results.length+' scenarios passed; no production writes.');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await context.close();await browser.close();}
