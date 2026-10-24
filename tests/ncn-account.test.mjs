import test from 'node:test';
import assert from 'node:assert/strict';
import {quizProfile} from '../public/assets/ncn-account.js';

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
