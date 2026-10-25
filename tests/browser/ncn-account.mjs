const seedLibraryForFixture=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'));
import {publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {chromium} from 'playwright';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

// Entirely synthetic HTTPS origin: no Identity, email, billing or website writes.
const origin='https://ncn-account.test',root=resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
const users=new Map(),tokens=new Map(),calls=[];
let autoconfirm=true,disableSignup=false,orderUser=null,confirmedUser=null,createHold=null,sessionHold=null,profileFailure=false,assetHold=null,logoutHold=null;
const functionCalls=[];
const member=(email='member@example.test',name='Thành viên')=>({id:'fixture-'+email,email,name,password:'Example123!',confirmed:true,vip:false,admin:false});
const existing=member('vip@example.test','VIP hiện có');existing.vip=true;users.set(existing.email,existing);
const raw=u=>({id:u.id,email:u.email,confirmed_at:u.confirmed?'2026-10-24T00:00:00Z':null,created_at:'2026-10-24T00:00:00Z',app_metadata:{roles:u.admin?['admin']:[]},user_metadata:{full_name:u.name,roles:['admin','vip']}});
const view=u=>u?.confirmed?{id:u.id,email:u.email,name:u.name,admin:u.admin,vip:u.vip,vipSource:u.vip?'paid':null,vipExpiresAt:u.vip?'2026-12-24T00:00:00Z':null}:null;
function session(u){
  const token=Buffer.from(JSON.stringify({alg:'fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,email:u.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';tokens.set(token,u);
  return {access_token:token,refresh_token:'refresh-'+u.id,token_type:'bearer',expires_in:3600,user:raw(u)};
}
const browser=await chromium.launch();
let checks=0;
async function fixtureContext(){
  const context=await browser.newContext();
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin){if(req.method()==='POST')throw new Error('Unexpected external write: '+url.origin);return route.abort();}
    const reply=(body,status=200,type='application/json')=>route.fulfill({status,contentType:type,body:typeof body==='string'?body:JSON.stringify(body)});
    const body=req.postData()||'',headers=await req.allHeaders();
    const cookie=decodeURIComponent((headers.cookie||'').match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1]||'');
    const user=tokens.get((headers.authorization||'').replace(/^Bearer /,''))||tokens.get(cookie);
    if(url.pathname.startsWith('/.netlify/identity/')){
      const action=url.pathname.split('/').at(-1);calls.push({action,body});
      const data=body.startsWith('{')?JSON.parse(body):Object.fromEntries(new URLSearchParams(body));
      if(action==='settings')return reply({autoconfirm,disable_signup:disableSignup,external:{email:true}});
      if(action==='token'){
        const u=users.get(data.username)||[...users.values()].find(u=>'refresh-'+u.id===data.refresh_token);
        if(!u||data.grant_type==='password'&&u.password!==data.password)return reply({error_description:'Email hoặc mật khẩu chưa đúng.'},400);
        return reply(session(u));
      }
      if(action==='user'){
        if(!user)return reply({msg:'Unauthorized'},401);
        if(req.method()==='PUT'){if(data.password)user.password=data.password;}
        return reply(raw(user));
      }
      if(action==='signup'){
        if(disableSignup)return reply({msg:'Signup disabled'},403);
        const u=member(data.email,data.data.full_name);u.password=data.password;u.confirmed=autoconfirm;users.set(u.email,u);confirmedUser=u;
        return reply(raw(u));
      }
      if(action==='recover'||action==='logout'){if(action==='logout'&&logoutHold){logoutHold.started();await logoutHold.wait;}return reply({});}
      if(action==='verify'){
        const u=confirmedUser||existing;u.confirmed=true;if(data.password)u.password=data.password;return reply(session(u));
      }
      throw new Error('Unmocked Identity action '+action);
    }
    if(url.pathname.startsWith('/.netlify/functions/')){
      const tool=url.pathname.split('/').at(-1),action=url.searchParams.get('route');functionCalls.push({tool,action});
      if(tool==='ncn-library'&&action==='list')return reply({items:publicCatalog(seedLibraryForFixture)});
      if(tool==='ncn-announcements')return reply({items:[]});
      if(tool==='ncn-visitors')return reply({total:1,online:1});
      if(tool==='ncn-billing'){
        if(action==='plans')return reply({ready:true,plans:[{id:'vip30',amount:30000},{id:'vip60',amount:55000}]});
        if(action==='me'){if(sessionHold){sessionHold.started();await sessionHold.wait;}if(profileFailure)return reply({error:'Temporary connection failure'},503);return reply({user:view(user)});}
        if(action==='orders')return view(user)?reply({orders:[]}):reply({error:'Unauthorized'},401);
        if(action==='create-order'){
          if(!view(user))return reply({error:'Unauthorized'},401);orderUser=user.id;calls.push({action:'create-order',userId:user.id,body});
          if(createHold){createHold.started();await createHold.wait;}
          return reply({order:{id:'NCNAAAAAAAAAAAAAAAAAAAA',planId:'vip30',name:'VIP 30 ngày',amount:30000,status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),bankName:'Ngân hàng thử',bankAccount:'0000',payeeName:'FIXTURE',description:'FIXTURE ONLY',qrUrl:'https://vietqr.app/img?fixture=1'}});
        }
        if(action==='order')return reply({error:'Fixture has no persisted order'},404);
        throw new Error('Unmocked billing action '+action);
      }
      if(tool==='ncn-event'||tool==='ncn-gvgs'){
        const verified=view(user),allowed=!!(verified&&(verified.vip||verified.admin));
        if(action==='me')return reply({user:verified,allowed});
        if(!allowed)return reply({error:'VIP required'},403);
        if(action==='app')return reply({user:verified,html:'<div data-private-fixture="'+tool+'">Công cụ VIP<input id="fixture-edit" aria-label="Ghi chú thử"></div><button id="ev-vip-logout">Đăng xuất</button>'});
        if(action==='asset'){if(url.searchParams.get('name')==='core'&&assetHold){assetHold.started();await assetHold.wait;}return reply('/* fixture: no private business data */',200,'text/javascript');}
      }
      throw new Error('Unmocked function '+tool+' '+action);
    }
    try{
      let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep)&&file!==root)throw new Error('Outside public');
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      return route.fulfill({status:200,contentType:types[extname(file)]||'application/octet-stream',body:await readFile(file)});
    }catch{return reply('Not found',404,'text/plain');}
  });
  return context;
}
async function open(context,path='/'){
  const page=await context.newPage();await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.NCNAccount?.state.ready);return page;
}
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
async function login(page,email=existing.email,password=existing.password){
  await page.evaluate(()=>window.openModal?window.openModal('login'):window.NCNAccount.open('login'));
  const form=page.locator('[data-account-form=login]');await form.locator('[name=email]').fill(email);await form.locator('[name=password]').fill(password);await form.locator('[type=submit]').click();
  try{await page.waitForFunction(()=>!document.getElementById('ncn-account-dialog').open&&!!window.NCNAccount.state.user);}
  catch(error){
    await mkdir('artifacts/account',{recursive:true});await page.screenshot({path:'artifacts/account/login-failure.jpg',type:'jpeg',quality:80});
    console.log(await page.evaluate(()=>({message:document.getElementById('ncn-account-message')?.textContent,state:{ready:NCNAccount.state.ready,busy:NCNAccount.state.busy,signingOut:NCNAccount.state.signingOut,user:NCNAccount.state.user,error:NCNAccount.state.error?.message},hasSessionCookie:/(?:^|;\s*)nf_jwt=/.test(document.cookie)})));throw error;
  }
}
let context;
try{
  context=await fixtureContext();
  await context.addInitScript(()=>{if(!sessionStorage.getItem('legacy-seed')){localStorage.setItem('qz_user',JSON.stringify({username:'Tên cũ',email:'old@example.test',roles:['admin','vip']}));sessionStorage.setItem('legacy-seed','1');}});
  const home=await open(context);
  await check('old browser profile is a prefill hint and cannot sign in or grant roles',async()=>{
    assert.equal(await home.evaluate(()=>NCNAccount.state.user),null);assert.equal(await home.evaluate(()=>QuizSystem.user),null);
    await home.evaluate(()=>openModal('reg'));
    assert.equal(await home.locator('[data-account-form=register] [name=email]').inputValue(),'old@example.test');
    assert.equal(await home.locator('.auth-modal').count(),0);assert.equal(await home.locator('#ncn-account-dialog').count(),1);
  });
  let registered;
  await check('registration creates one website account and signs in when autoconfirm is enabled',async()=>{
    const f=home.locator('[data-account-form=register]');await f.locator('[name=name]').fill('<img src=x onerror=alert(1)>');await f.locator('[name=email]').fill('new@example.test');await f.locator('[name=password]').fill('Example123!');await f.locator('[name=repeat]').fill('Example123!');await f.locator('[type=submit]').click();
    await home.waitForFunction(()=>!document.getElementById('ncn-account-dialog').open&&!!NCNAccount.state.user);
    registered=users.get('new@example.test');assert.equal(await home.evaluate(()=>QuizSystem.user.email),registered.email);
    assert.equal(await home.locator('#auth-header-desktop img').count(),0);
    const sent=JSON.parse(calls.find(c=>c.action==='signup').body);assert.deepEqual(Object.keys(sent.data),['full_name']);
    assert.equal(await home.evaluate(()=>NCNAccount.state.user.admin),false);
  });
  const premium=await open(context,'/premium/');
  await check('same website account buys VIP without a second login or registration form',async()=>{
    await premium.waitForFunction(()=>document.getElementById('pay-email').textContent==='new@example.test');
    assert.equal(await premium.locator('#pay-auth').isVisible(),false);assert.equal(await premium.locator('[data-pay-form]').count(),0);
    await premium.locator('[data-pay-plan=vip30]').click();await premium.locator('#pay-checkout').waitFor({state:'visible'});
    assert.equal(orderUser,registered.id);assert.equal(JSON.parse(calls.find(c=>c.action==='create-order').body).planId,'vip30');
  });
  const event=await open(context,'/in-event/');
  await check('shared member session is recognized but only server VIP unlocks private tools',async()=>{
    await event.waitForFunction(()=>document.getElementById('vip-account').textContent==='new@example.test');
    assert.equal(await event.locator('[data-vip-auth]').isVisible(),false);assert.equal(await event.locator('[data-private-fixture]').count(),0);
    registered.vip=true;await event.locator('#vip-check').click();await event.locator('[data-private-fixture=ncn-event]').waitFor();
  });
  const gvgs=await open(context,'/in-gvgs/');
  await check('paid entitlement and the same identity open both Event and Giờ Vàng',async()=>{
    await gvgs.locator('[data-private-fixture=ncn-gvgs]').waitFor();assert.equal(await gvgs.evaluate(()=>NCN_VIP.user.id),registered.id);
  });
  await check('logout propagates across tabs, clears private apps and discards a pending checkout response',async()=>{
    let release,started;const wait=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>started=resolve);createHold={wait,started};
    await premium.locator('[data-pay-plan=vip30]').click();await requested;
    await home.evaluate(()=>NCNAccount.signOut());release();createHold=null;
    await premium.waitForFunction(()=>!NCNAccount.state.user&&!document.getElementById('pay-auth').hidden);
    await event.waitForFunction(()=>window.NCNAccount?.state.ready&&!document.querySelector('[data-private-fixture]'));
    await gvgs.waitForFunction(()=>window.NCNAccount?.state.ready&&!document.querySelector('[data-private-fixture]'));
    assert.equal(await home.evaluate(()=>QuizSystem.user),null);
    await premium.waitForFunction(()=>!document.querySelector('[data-pay-plan=vip30]').disabled);assert.equal(await premium.locator('#pay-checkout').isVisible(),false);
  });
  await check('existing VIP accounts retain identity and entitlement after shared login',async()=>{
    await login(home);await home.reload();await home.waitForFunction(()=>window.NCNAccount?.state.ready&&NCNAccount.state.user?.vip);assert.equal(await home.evaluate(()=>NCNAccount.state.user.id),existing.id);
    await event.reload();await event.locator('[data-private-fixture=ncn-event]').waitFor();assert.equal(await event.evaluate(()=>NCN_VIP.user.id),existing.id);
  });
  await check('full navigation keeps profile text while one shared session request is pending',async()=>{
    let release,started;const wait=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>started=resolve);sessionHold={wait,started};
    const before=functionCalls.filter(c=>c.tool==='ncn-billing'&&c.action==='me').length;
    const navigation=home.goto(origin+'/premium/',{waitUntil:'domcontentloaded'});await requested;await navigation;
    await home.waitForFunction(()=>NCNAccount.state.profile?.email==='vip@example.test'&&!NCNAccount.state.ready);
    assert.equal(await home.evaluate(()=>NCNAccount.state.user),null);
    assert.equal(await home.locator('#auth-header-desktop [data-ncn-account-open]').count(),0);
    assert.match(await home.locator('#auth-header-desktop').textContent(),/vip@example.test/);
    assert.equal(await home.locator('#pay-auth').isVisible(),false);
    assert.equal(await home.locator('[data-pay-plan=vip30]').isEnabled(),false);
    assert.equal(await home.locator('#ncn-account-dialog').isVisible(),false);
    release();sessionHold=null;await home.waitForFunction(()=>NCNAccount.state.ready&&NCNAccount.state.user?.vip);
    await home.waitForFunction(()=>document.getElementById('pay-email').textContent==='vip@example.test');
    assert.equal(functionCalls.filter(c=>c.tool==='ncn-billing'&&c.action==='me').length-before,1);
  });
  await check('parallel refreshes share one request and retain the live private input',async()=>{
    await event.locator('#fixture-edit').fill('KEEP THIS VALUE');
    const before=functionCalls.filter(c=>c.tool==='ncn-billing'&&c.action==='me').length;
    const privateBefore=functionCalls.filter(c=>c.tool==='ncn-event'&&['me','app'].includes(c.action)).length;
    await event.evaluate(async()=>{window.sameUserEvents=0;document.addEventListener('ncn-account-change',()=>window.sameUserEvents++);await Promise.all([NCNAccount.refresh({force:true}),NCNAccount.refresh({force:true}),NCNAccount.refresh({force:true})]);});
    assert.equal(functionCalls.filter(c=>c.tool==='ncn-billing'&&c.action==='me').length-before,1);
    assert.equal(functionCalls.filter(c=>c.tool==='ncn-event'&&['me','app'].includes(c.action)).length,privateBefore);
    assert.equal(await event.evaluate(()=>window.sameUserEvents),0);
    assert.equal(await event.locator('#fixture-edit').inputValue(),'KEEP THIS VALUE');
    assert.equal(functionCalls.filter(c=>['ncn-event','ncn-gvgs'].includes(c.tool)&&c.action==='me').length,0);
  });
  await check('a transient profile failure keeps the session and private editor open',async()=>{
    profileFailure=true;await event.evaluate(()=>NCNAccount.refresh({force:true}).catch(()=>{}));
    assert.equal(await event.evaluate(()=>NCNAccount.state.user.id),existing.id);
    assert.equal(await event.locator('#fixture-edit').inputValue(),'KEEP THIS VALUE');
    assert.equal(await event.locator('#ncn-account-dialog').isVisible(),false);
    profileFailure=false;await event.evaluate(()=>NCNAccount.refresh({force:true}));
    assert.equal(await event.locator('[data-ncn-account-retry]').count(),0);
  });
  await check('server revocation still clears the private app and manual retry rechecks entitlement',async()=>{
    existing.vip=false;await event.evaluate(()=>{window.revocationMarker=true;NCNAccount.refresh({force:true}).catch(()=>{});});
    await event.waitForFunction(()=>!window.revocationMarker&&window.NCNAccount?.state.ready&&!NCNAccount.state.user?.vip&&document.getElementById('vip-gate')?.dataset.ncnGateState==='member'&&!document.querySelector('[data-private-fixture]'));
    assert.equal(await event.locator('[data-vip-auth]').isVisible(),false);
    existing.vip=true;await event.locator('#vip-check').click();await event.locator('[data-private-fixture=ncn-event]').waitFor();
  });
  await check('logout during private-script loading clears content before the session ends and never restores it',async()=>{
    let releaseAsset,startAsset,releaseLogout,startLogout;
    const assetWait=new Promise(resolve=>releaseAsset=resolve),assetRequested=new Promise(resolve=>startAsset=resolve);
    const logoutWait=new Promise(resolve=>releaseLogout=resolve),logoutRequested=new Promise(resolve=>startLogout=resolve);
    assetHold={wait:assetWait,started:startAsset};logoutHold={wait:logoutWait,started:startLogout};
    const page=await open(context,'/in-event/');await assetRequested;
    try{
      await page.evaluate(()=>{window.logoutMarker='same-document';window.logoutPromise=NCNAccount.signOut();});await logoutRequested;
      assert.equal(await page.locator('[data-private-fixture]').count(),0);
      assert.equal(await page.evaluate(()=>window.logoutMarker),'same-document');
    }finally{releaseAsset();releaseLogout();assetHold=null;logoutHold=null;}
    await page.waitForFunction(()=>!window.logoutMarker&&window.NCNAccount?.state.ready&&!NCNAccount.state.user&&!document.querySelector('[data-private-fixture]'));
    await page.reload();await page.waitForFunction(()=>window.NCNAccount?.state.ready&&!NCNAccount.state.user);
    assert.equal(await page.locator('[data-private-fixture]').count(),0);await page.close();
  });
  await check('recovery uses the shared Identity service',async()=>{
    await home.evaluate(()=>NCNAccount.open('recovery'));const f=home.locator('[data-account-form=recovery]');await f.locator('[name=email]').fill(existing.email);await f.locator('[type=submit]').click();await home.waitForFunction(()=>document.getElementById('ncn-account-message').textContent.includes('nhận được thư'));
    assert.ok(calls.some(c=>c.action==='recover'&&JSON.parse(c.body).email===existing.email));await home.evaluate(()=>NCNAccount.close());
  });
  await context.close();context=await fixtureContext();confirmedUser=existing;
  await check('recovery callback works on the homepage and resets the shared password',async()=>{
    const page=await open(context,'/#recovery_token=fixture-recovery');const f=page.locator('[data-account-form=reset]');await f.waitFor({state:'visible'});assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'');
    await f.locator('[name=password]').fill('Changed123!');await f.locator('[name=repeat]').fill('Changed123!');await f.locator('[type=submit]').click();await page.waitForFunction(()=>document.getElementById('ncn-account-message').textContent.includes('Đã lưu mật khẩu'));
    assert.equal(existing.password,'Changed123!');await page.evaluate(()=>NCNAccount.close());await page.evaluate(()=>NCNAccount.signOut());
  });
  await context.close();context=await fixtureContext();confirmedUser=member('invite@example.test');users.set(confirmedUser.email,confirmedUser);
  await check('invitation callback accepts a password and establishes the shared session',async()=>{
    const page=await open(context,'/premium/#invite_token=fixture-invite');const f=page.locator('[data-account-form=reset]');await f.waitFor({state:'visible'});await f.locator('[name=password]').fill('Invite123!');await f.locator('[name=repeat]').fill('Invite123!');await f.locator('[type=submit]').click();await page.waitForFunction(()=>NCNAccount.state.user?.email==='invite@example.test'&&!NCNAccount.state.resetPending);
    assert.equal(confirmedUser.password,'Invite123!');await page.close();
  });
  await context.close();context=await fixtureContext();autoconfirm=false;
  await check('confirmation-required signup stays signed out until a valid callback',async()=>{
    const page=await open(context,'/premium/');await page.evaluate(()=>NCNAccount.open('register'));const f=page.locator('[data-account-form=register]');await f.locator('[name=name]').fill('Cần xác nhận');await f.locator('[name=email]').fill('confirm@example.test');await f.locator('[name=password]').fill('Confirm123!');await f.locator('[name=repeat]').fill('Confirm123!');await f.locator('[type=submit]').click();await page.waitForFunction(()=>document.getElementById('ncn-account-message').textContent.includes('Mở email xác nhận'));
    assert.equal(await page.evaluate(()=>NCNAccount.state.user),null);
    await page.goto(origin+'/2024/01/in-fifo.html#confirmation_token=fixture-confirm');await page.waitForFunction(()=>window.NCNAccount?.state.ready&&NCNAccount.state.user?.email==='confirm@example.test');assert.equal(new URL(page.url()).pathname,'/2024/01/in-fifo.html');
  });
  await context.close();context=await fixtureContext();autoconfirm=true;disableSignup=true;
  await check('registration closed and narrow-screen dialog behave consistently',async()=>{
    const page=await open(context);await page.setViewportSize({width:390,height:844});await page.evaluate(()=>NCNAccount.open('register'));await page.waitForFunction(()=>NCNAccount.state.settings?.disableSignup);assert.equal(await page.locator('[data-account-form=register]').isVisible(),false);
    assert.equal(await page.locator('[data-account-mode=register]').isVisible(),false);
    const sizes=await page.locator('#ncn-account-dialog').evaluate(n=>({width:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth}));assert.ok(sizes.width<=362&&sizes.scroll<=sizes.client+1,JSON.stringify(sizes));
    await mkdir('artifacts/account',{recursive:true});await page.screenshot({path:'artifacts/account/shared-login-mobile.png'});
  });
  await check('premium account buttons and dialogs share Liquid Glass in light, dark and mobile views',async()=>{
    disableSignup=false;const page=await open(context,'/premium/');await page.setViewportSize({width:1280,height:900});
    await page.evaluate(()=>document.querySelector('.ncn-account-menu').open=true);
    const login=page.locator('#auth-header-desktop [data-ncn-account-open=login]');
    const style=await login.evaluate(node=>({radius:parseFloat(getComputedStyle(node).borderRadius),background:getComputedStyle(node).backgroundImage}));
    assert.ok(style.radius>20&&style.background.includes('gradient'),JSON.stringify(style));
    await page.screenshot({path:'artifacts/account/account-dropdown-liquid-glass.png'});
    await page.evaluate(()=>NCNAccount.open('login'));await page.screenshot({path:'artifacts/account/account-login-liquid-glass.png'});
    await page.evaluate(()=>document.documentElement.dataset.ncnTheme='dark');
    await page.screenshot({path:'artifacts/account/account-login-dark.png'});
    await page.setViewportSize({width:390,height:844});
    const bounds=await page.locator('#ncn-account-dialog').evaluate(node=>({width:node.getBoundingClientRect().width,scroll:node.scrollWidth,client:node.clientWidth}));
    assert.ok(bounds.width<=362&&bounds.scroll<=bounds.client+1,JSON.stringify(bounds));
    await page.screenshot({path:'artifacts/account/account-login-mobile.png'});
  });
  console.log('Shared account: '+checks+' scenarios passed; all external writes blocked.');
}finally{await context?.close();await browser.close();}
