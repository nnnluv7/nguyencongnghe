import test from 'node:test';
import assert from 'node:assert/strict';
import {quizProfile} from '../public/assets/ncn-account.js';
import {canUseVip,isVipToolURL} from '../public/assets/ncn-vip-access.js';
import {startAccountPrefetch,takeAccountPrefetch,takeToolPrefetch} from '../public/assets/ncn-account-prefetch.js';
import {setAccessView} from '../public/assets/ncn-access-view.js';

test('VIP visibility requires a verified direct grant and excludes old account and payment grants',()=>{
  for(const user of [null,{}, {id:'ordinary'}, {id:'old',vip:true}, {id:'old',vip:true,vipSource:'account'}, {id:'paid',vip:true,vipSource:'payment'}, {vip:true,vipSource:'manual'}, {id:'revoked',vip:false,vipSource:'manual'}])assert.equal(canUseVip(user),false);
  assert.equal(canUseVip({id:'vip',vip:true,vipSource:'manual'}),true);
  assert.equal(canUseVip({id:'admin',admin:true}),true);
  for(const href of ['/in-event','/in-event/','/in-gvgs/index.html','https://nguyencongnghe.com/in-gvgs/?q=1'])assert.equal(isVipToolURL(href),true);
  for(const href of ['/popup-a7/','/in-eventual/','/tin-tuc-cong-nghe/?q=in-event'])assert.equal(isVipToolURL(href),false);
});

test('legacy profiles cannot authenticate and history requires the verified account email',()=>{
  const legacy={username:'Tên cũ',email:'old@example.test',admin:true};
  assert.equal(quizProfile(null,legacy),null);
  assert.equal(quizProfile({email:legacy.email},legacy),null);
  assert.deepEqual(quizProfile({id:'verified',email:'OLD@example.test'},legacy),{id:'verified',email:'OLD@example.test',username:'Tên cũ'});
  assert.deepEqual(quizProfile({id:'verified',email:'other@example.test'},legacy),{id:'verified',email:'other@example.test',username:'other@example.test'});
});

test('verified profile keeps its identity and has no browser-supplied authorization fields',()=>{
  assert.deepEqual(quizProfile({id:'same-vip-id',email:'vip@example.test',name:'Tên VIP',admin:true,vip:true},{email:'vip@example.test',username:'Tên cũ',admin:true}),{id:'same-vip-id',email:'vip@example.test',username:'Tên VIP'});
});

const {PROFILE_KEY,displayProfile,readDisplayProfile,saveDisplayProfile}=await import('../public/assets/ncn-account-session.js');
const now=1792828000000;
const cookie=id=>'nf_jwt=header.'+Buffer.from(JSON.stringify({sub:id,exp:now/1000+3600})).toString('base64url')+'.fixture';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('navigation profile retains display text but cannot carry VIP or admin authorization',()=>{
  const storage=memory(),user={id:'same-user',email:'vip@example.test',name:'<img src=x>',vip:true,admin:true,roles:['admin'],token:'private'};
  saveDisplayProfile(storage,user,now);
  const profile=readDisplayProfile(storage,cookie(user.id),now+1000);
  assert.deepEqual(profile,{id:user.id,email:user.email,name:user.name});
  assert.equal(JSON.stringify(profile).includes('admin'),false);
  assert.equal(JSON.stringify(profile).includes('private'),false);
  assert.deepEqual(displayProfile(user),profile);
});
test('display hint is rejected for another account, an expired session or an old snapshot',()=>{
  const storage=memory();saveDisplayProfile(storage,{id:'member',email:'member@example.test'},now);
  assert.equal(readDisplayProfile(storage,cookie('other'),now),null);
  assert.equal(readDisplayProfile(storage,'',now),null);
  assert.equal(readDisplayProfile(storage,cookie('member'),now+31*60000),null);
  storage.setItem(PROFILE_KEY,'broken');assert.equal(readDisplayProfile(storage,cookie('member'),now),null);
});
test('logout removes the display hint and blocked storage never creates a session',()=>{
  const storage=memory();saveDisplayProfile(storage,{id:'member',email:'member@example.test'},now);saveDisplayProfile(storage,null,now);
  assert.equal(storage.getItem(PROFILE_KEY),undefined);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  assert.doesNotThrow(()=>saveDisplayProfile(blocked,{id:'a',email:'a@example.test'},now));
  assert.equal(readDisplayProfile(blocked,cookie('a'),now),null);
});

const currentCookie=(subject='prefetch-member',expires=Date.now()+3600000)=>'nf_jwt=fixture.'+Buffer.from(JSON.stringify({sub:subject,exp:Math.floor(expires/1000)})).toString('base64url')+'.fixture';
const prefetchWindow=(fetcher,hash='')=>({fetch:fetcher,location:{hash},atob,AbortSignal});
test('the early server check is reused exactly once and never stores an authenticated profile',async()=>{
  let calls=0;
  const response=Response.json({user:{id:'verified-on-server'}});
  const win=prefetchWindow((url,options)=>{
    calls++;assert.equal(url,'/.netlify/functions/ncn-billing?route=me');
    assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
    return Promise.resolve(response);
  }),doc={cookie:currentCookie()};
  // The head script is serialized, so it must have no module-scope dependencies.
  const start=Function('return ('+startAccountPrefetch.toString()+')')();
  start(win,doc);start(win,doc);assert.equal(calls,1);
  assert.deepEqual(Object.keys(win.NCNAccountPrefetch).sort(),['response','token']);
  assert.equal(await takeAccountPrefetch(win,doc),response);
  assert.equal(takeAccountPrefetch(win,doc),null);assert.equal(win.NCNAccountPrefetch,undefined);
});
test('guests, expiring sessions and account callbacks do not start an early account request',()=>{
  let calls=0;
  for(const [cookie,hash] of [['',''],['nf_jwt=broken',''],[currentCookie('expired',Date.now()-1000),''],[currentCookie('near-expiry',Date.now()+30000),''],[currentCookie(),'#recovery_token=fixture']]){
    const win=prefetchWindow(()=>{calls++;return Promise.resolve(Response.json({}));},hash);
    startAccountPrefetch(win,{cookie});assert.equal(win.NCNAccountPrefetch,undefined);
  }
  assert.equal(calls,0);
});
test('logout or a changed session discards the earlier account response',()=>{
  for(const cookie of ['',currentCookie('other')]){
    const win=prefetchWindow(()=>Promise.resolve(Response.json({user:{id:'old-user'}}))),doc={cookie:currentCookie()};
    startAccountPrefetch(win,doc);doc.cookie=cookie;
    assert.equal(takeAccountPrefetch(win,doc),null);assert.equal(win.NCNAccountPrefetch,undefined);
  }
});

test('authenticated tool data starts alongside the account check and is consumed only by the matching session',async()=>{
  for(const endpoint of ['/.netlify/functions/ncn-event?route=app','/.netlify/functions/ncn-gvgs?route=app','/.netlify/functions/ncn-cash-fund','/.netlify/functions/ncn-library?route=app&view=library']){
    const urls=[],win=prefetchWindow(url=>{urls.push(url);return Promise.resolve(Response.json({endpoint:url}));}),doc={cookie:currentCookie()};
    startAccountPrefetch(win,doc,endpoint);assert.deepEqual(urls,['/.netlify/functions/ncn-billing?route=me',endpoint]);
    assert.equal((await (await takeToolPrefetch(win,doc,endpoint)).json()).endpoint,endpoint);
    assert.equal(takeToolPrefetch(win,doc,endpoint),null);
    delete win.NCNAccountPrefetch;startAccountPrefetch(win,doc,endpoint);doc.cookie=currentCookie('other');
    assert.equal(takeToolPrefetch(win,doc,endpoint),null);
  }
});
test('tool prefetch rejects external URLs and endpoints that are not a read-only opening request',()=>{
  for(const endpoint of ['https://example.test/collect','/.netlify/functions/ncn-library?route=delete','/.netlify/functions/ncn-event?route=print']){
    const urls=[],win=prefetchWindow(url=>{urls.push(url);return Promise.resolve(Response.json({}));});
    startAccountPrefetch(win,{cookie:currentCookie()},endpoint);
    assert.deepEqual(urls,['/.netlify/functions/ncn-billing?route=me']);assert.equal(win.NCNToolPrefetch,undefined);
  }
});
test('access controls stay inert until their authenticated opening request succeeds',()=>{
  const root={dataset:{},setAttribute(){}},gate={},content={};
  setAccessView({root,gate,content},'pending');assert.equal(gate.hidden,true);assert.equal(content.hidden,false);assert.equal(content.inert,true);
  setAccessView({root,gate,content},'ready');assert.equal(content.inert,false);
  setAccessView({root,gate,content},'blocked');assert.equal(gate.hidden,false);assert.equal(content.hidden,true);
});
