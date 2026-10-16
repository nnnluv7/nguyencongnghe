import test from 'node:test';
import assert from 'node:assert/strict';
import { createCounterHandler, cleanupPresence, vietnamDay, ONLINE_BUCKET_MS } from '../netlify/lib/ncn-visitor-counter.mjs';

const A = '67aa6075-c764-4ea3-ae22-7a190d800001';
const B = '67aa6075-c764-4ea3-ae22-7a190d800002';
function mockStore() {
  const values = new Map();
  let ver = 0;
  return {
    values,
    async set(key, data, { onlyIfNew = false, onlyIfMatch } = {}) {
      const old = values.get(key);
      if ((onlyIfNew && old) || (onlyIfMatch && old?.etag !== onlyIfMatch)) return { modified: false };
      values.set(key, { data, etag: `etag-${++ver}` });
      return { modified: true };
    },
    async setJSON(key, data, options) { return this.set(key, data, options); },
    async get(key) { return values.get(key)?.data ?? null; },
    async getWithMetadata(key) { return values.get(key) || null; },
    async list({ prefix, paginate } = {}) {
      const blobs = [...values.keys()].filter(k => k.startsWith(prefix || '')).map(key => ({ key }));
      return { blobs, directories: [] };
    },
    async delete(key) { values.delete(key); },
  };
}
const req = (id, visit = true) => new Request('https://nguyencongnghe.com/.netlify/functions/ncn-visitors', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://nguyencongnghe.com' }, body: JSON.stringify({ id, visit }),
});
test('date rolls over at midnight in Vietnam', () => {
  assert.equal(vietnamDay(Date.parse('2026-10-16T16:59:59Z')), '2026-10-16');
  assert.equal(vietnamDay(Date.parse('2026-10-16T17:00:00Z')), '2026-10-17');
});
test('sessions are idempotent, online expires and daily count resets', async () => {
  const store = mockStore();
  let now = Date.parse('2026-10-16T12:00:00Z');
  const handler = createCounterHandler(() => store, () => now);
  let data = await (await handler(req(A))).json();
  assert.deepEqual([data.online, data.total, data.today], [1, 1, 1]);
  data = await (await handler(req(A))).json();
  assert.deepEqual([data.online, data.total, data.today], [1, 1, 1]);
  data = await (await handler(req(B))).json();
  assert.deepEqual([data.online, data.total, data.today], [2, 2, 2]);
  now += 3 * 60 * 1000;
  data = await (await handler(new Request('https://nguyencongnghe.com/.netlify/functions/ncn-visitors'))).json();
  assert.deepEqual([data.online, data.total, data.today], [0, 2, 2]);
  now = Date.parse('2026-10-16T17:00:00Z');
  data = await (await handler(req(A, false))).json();
  assert.deepEqual([data.online, data.total, data.today], [1, 2, 1]);
});
test('invalid sessions and origins are rejected', async () => {
  const handler = createCounterHandler(() => mockStore());
  assert.equal((await handler(req('abc'))).status, 400);
  const wrongOrigin = new Request('https://nguyencongnghe.com/.netlify/functions/ncn-visitors', {
    method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ id: A, visit: true }),
  });
  assert.equal((await handler(wrongOrigin)).status, 403);
});
test('cleanup removes stale online records without touching totals', async () => {
  const s = mockStore();
  const now = Date.parse('2026-10-16T12:00:00Z');
  const bucket = Math.floor(now / ONLINE_BUCKET_MS);
  await s.set(`online/${bucket - 12}/${A}`, '1');
  await s.set(`online/${bucket}/${B}`, '1');
  await s.set('counts/total', { count: 99 });
  // Match the async-iterator contract for paginate:true.
  const originalList = s.list.bind(s);
  s.list = opts => opts.paginate ? { async *[Symbol.asyncIterator]() { yield await originalList(opts); } } : originalList(opts);
  assert.equal(await cleanupPresence(s, now), 1);
  assert.ok(s.values.has(`online/${bucket}/${B}`));
  assert.ok(s.values.has('counts/total'));
});
