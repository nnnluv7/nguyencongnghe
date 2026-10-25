import test from 'node:test';
import assert from 'node:assert/strict';
import {toolbarDateTime} from '../public/assets/ncn-theme/clock.js';

test('the shared toolbar shows Vietnam date and 24-hour time independently of host timezone',()=>{
  const value=toolbarDateTime(new Date('2026-10-25T03:20:45Z'));
  assert.equal(value.shortDate,'25/10/2026');assert.equal(value.time,'10:20:45');assert.match(value.date,/CN/);
});
test('toolbar date and weekday roll over together at midnight in Vietnam',()=>{
  const value=toolbarDateTime(new Date('2026-10-25T17:00:00Z'));
  assert.equal(value.shortDate,'26/10/2026');assert.equal(value.time,'00:00:00');assert.match(value.date,/Th(?:ứ)?\s*2/);
});
