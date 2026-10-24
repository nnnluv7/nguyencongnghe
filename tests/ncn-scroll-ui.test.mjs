import test from 'node:test';
import assert from 'node:assert/strict';
import {createScrollDirection} from '../public/assets/ncn-theme/scroll-ui.js';

test('downward scrolling hides chrome; a short upward gesture reveals it',()=>{
  const scroll=createScrollDirection();
  assert.equal(scroll.move(12),false);
  assert.equal(scroll.move(12),true);
  assert.equal(scroll.move(-6),true);
  assert.equal(scroll.move(-6),false);
});
test('direction changes and trackpad jitter do not flicker the header',()=>{
  const scroll=createScrollDirection();
  for(let i=0;i<20;i++){assert.equal(scroll.move(2),false);assert.equal(scroll.move(-2),false);}
  assert.equal(scroll.move(.5),false);
  assert.equal(scroll.move(30),true);
  assert.equal(scroll.move(-1),true);
  assert.equal(scroll.move(1),true);
  assert.equal(scroll.move(-12),false);
});
test('the top of the page, open menus and keyboard navigation restore chrome',()=>{
  const scroll=createScrollDirection();
  assert.equal(scroll.move(50),true);
  assert.equal(scroll.move(3,{atTop:true}),false);
  assert.equal(scroll.move(50,{locked:true}),false);
  assert.equal(scroll.move(4),false);
  assert.equal(scroll.move(30),true);
  assert.equal(scroll.reset(),false);
  assert.equal(scroll.move(4),false);
});
test('invalid or horizontal-only movement cannot hide navigation',()=>{
  const scroll=createScrollDirection();
  for(const delta of [NaN,undefined,Infinity,-Infinity,0])assert.equal(scroll.move(delta),false);
});
