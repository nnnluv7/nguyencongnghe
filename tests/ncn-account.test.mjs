import test from 'node:test';
import assert from 'node:assert/strict';
import {quizProfile} from '../public/assets/ncn-account.js';
import {canUseVip,isVipToolURL} from '../public/assets/ncn-vip-access.js';

test('VIP visibility requires a verified direct grant and excludes old account and payment grants',()=>{
  for(const user of [null,{}, {id:'ordinary'}, {id:'old',vip:true}, {id:'old',vip:true,vipSource:'account'}, {id:'paid',vip:true,vipSource:'payment'}, {vip:true,vipSource:'manual'}, {id:'revoked',vip:false,vipSource:'manual'}])assert.equal(canUseVip(user),false);
  assert.equal(canUseVip({id:'vip',vip:true,vipSource:'manual'}),true);
  assert.equal(canUseVip({id:'admin',admin:true}),true);
  for(const href of ['/in-event','/in-event/','/in-gvgs/index.html','https://nguyencongnghe.com/in-gvgs/?q=1'])assert.equal(isVipToolURL(href),true);
  for(const href of ['/popup-a7/','/in-eventual/','/thu-vien/?q=in-event'])assert.equal(isVipToolURL(href),false);
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
