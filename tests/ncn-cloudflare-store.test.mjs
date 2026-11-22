import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createStoreFactory} from '../functions/_cf/store.mjs';
import {createCounterHandler, cleanupPresence, vietnamDay} from '../netlify/lib/ncn-visitor-counter.mjs';
import {createStoriesHandler, cleanupStories} from '../functions/_cf/stories.mjs';
import {createAnnouncementsHandler} from '../netlify/lib/ncn-announcements-api.mjs';

// Fake D1Database backed by real SQLite, so the adapter's actual SQL
// (INSERT ... ON CONFLICT DO NOTHING, UPDATE ... WHERE etag = ?, LIKE with
// ESCAPE, keyset pagination) is exercised, not re-implemented.
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../functions/_cf/schema.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind(...params) {
          return {
            first: () => stmt.get(...params) ?? null,
            all: () => ({results: stmt.all(...params)}),
            run: () => ({meta: {changes: stmt.run(...params).changes}}),
          };
        },
      };
    },
  };
}

function fakeR2() {
  const objects = new Map();
  return {
    objects,
    async get(key) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      const copy = new Uint8Array(bytes);
      return {arrayBuffer: async () => copy.buffer};
    },
    async put(key, value) {
      objects.set(key, value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value));
    },
    async delete(key) { objects.delete(key); },
  };
}

function env() {
  return {NCN_DB: fakeD1(), NCN_BUCKET: fakeR2()};
}

test('store: JSON round-trip and CAS via onlyIfNew/onlyIfMatch', async () => {
  const store = createStoreFactory(env())('test-v1');
  assert.equal(await store.get('missing', {type: 'json'}), null);
  assert.equal((await store.setJSON('a', {n: 1}, {onlyIfNew: true})).modified, true);
  assert.deepEqual(await store.get('a', {type: 'json'}), {n: 1});
  assert.equal((await store.setJSON('a', {n: 2}, {onlyIfNew: true})).modified, false);
  assert.deepEqual(await store.get('a', {type: 'json'}), {n: 1});
  const meta = await store.getWithMetadata('a', {type: 'json'});
  assert.equal(meta.data.n, 1);
  assert.equal(typeof meta.etag, 'string');
  assert.equal((await store.setJSON('a', {n: 3}, {onlyIfMatch: 'stale-etag'})).modified, false);
  assert.equal((await store.setJSON('a', {n: 3}, {onlyIfMatch: meta.etag})).modified, true);
  assert.deepEqual(await store.get('a', {type: 'json'}), {n: 3});
  const meta2 = await store.getWithMetadata('a', {type: 'json'});
  assert.notEqual(meta2.etag, meta.etag);
  // Unconditional write always wins.
  assert.equal((await store.setJSON('a', {n: 4})).modified, true);
  assert.deepEqual(await store.get('a', {type: 'json'}), {n: 4});
  // get() without a type returns the stored text (Blobs behaviour).
  assert.equal(await store.get('a'), '{"n":4}');
  // getMetadata exposes etag; null for a missing key.
  assert.equal((await store.getMetadata('a')).etag, (await store.getWithMetadata('a', {type: 'json'})).etag);
  assert.equal(await store.getMetadata('missing'), null);
});

test('store: text values, delete, and metadata', async () => {
  const store = createStoreFactory(env())('test-v1');
  assert.equal((await store.set('online/1/abc', '1', {onlyIfNew: true})).modified, true);
  assert.equal(await store.get('online/1/abc'), '1');
  assert.equal((await store.set('online/1/abc', '1', {onlyIfNew: true})).modified, false);
  await store.set('with-meta', 'x', {metadata: {createdAt: '2026-11-22T00:00:00.000Z'}});
  assert.deepEqual((await store.getMetadata('with-meta')).metadata, {createdAt: '2026-11-22T00:00:00.000Z'});
  await store.delete('online/1/abc');
  assert.equal(await store.get('online/1/abc'), null);
  assert.equal(await store.getWithMetadata('online/1/abc'), null);
});

test('store: binary values round-trip through R2', async () => {
  const e = env();
  const store = createStoreFactory(e)('test-v1');
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  assert.equal((await store.set('bin/1', bytes.buffer, {onlyIfNew: true})).modified, true);
  assert.equal(e.NCN_BUCKET.objects.has('test-v1/bin/1'), true);
  const back = await store.get('bin/1', {type: 'arrayBuffer'});
  assert.deepEqual(new Uint8Array(back), bytes);
  const meta = await store.getWithMetadata('bin/1', {type: 'arrayBuffer'});
  assert.deepEqual(new Uint8Array(meta.data), bytes);
  assert.equal(typeof meta.etag, 'string');
  // Overwriting a binary key with JSON drops the stale R2 object.
  await store.setJSON('bin/1', {replaced: true});
  assert.equal(e.NCN_BUCKET.objects.has('test-v1/bin/1'), false);
  assert.deepEqual(await store.get('bin/1', {type: 'json'}), {replaced: true});
  // Buffer values (what the stories/profile handlers pass) work too.
  await store.set('bin/2', Buffer.from([9, 8, 7]));
  assert.deepEqual(new Uint8Array(await store.get('bin/2', {type: 'arrayBuffer'})), new Uint8Array([9, 8, 7]));
  await store.delete('bin/2');
  assert.equal(e.NCN_BUCKET.objects.has('test-v1/bin/2'), false);
});

test('store: list prefix, LIKE escaping, and paginated iteration', async () => {
  const store = createStoreFactory(env())('test-v1');
  await store.setJSON('a_b-1', {});
  await store.setJSON('axb-1', {});
  await store.setJSON('a%b-1', {});
  const listed = await store.list({prefix: 'a_b'});
  assert.deepEqual(listed.blobs.map(b => b.key), ['a_b-1']);
  const listedPct = await store.list({prefix: 'a%b'});
  assert.deepEqual(listedPct.blobs.map(b => b.key), ['a%b-1']);
  // 250 keys across the paginated iterator (page size 100).
  for (let i = 0; i < 250; i++) await store.setJSON('bulk/' + String(i).padStart(3, '0'), {i});
  const pages = [];
  for await (const page of store.list({prefix: 'bulk/', paginate: true})) pages.push(page.blobs.length);
  assert.deepEqual(pages, [100, 100, 50]);
  const all = await store.list({prefix: 'bulk/'});
  assert.equal(all.blobs.length, 250);
  assert.equal(all.blobs[0].key, 'bulk/000');
  assert.equal(all.blobs[249].key, 'bulk/249');
});

test('visitor counter runs on the D1 store (CAS increments + cleanup)', async () => {
  const getStore = createStoreFactory(env());
  const handler = createCounterHandler(() => getStore('ncn-visitors-v1'));
  const session = '67aa6075-c764-4ea3-ae22-7a190d800001';
  const origin = 'https://nguyencongnghe.pages.dev';
  const beat = async id => handler(new Request(origin + '/.netlify/functions/ncn-visitors', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id, visit: true}),
  }));
  const first = await (await beat(session)).json();
  assert.equal(first.online >= 1, true);
  // Same session again: online stays, total does not double-count.
  await beat(session);
  const stats = await (await handler(new Request(origin + '/.netlify/functions/ncn-visitors'))).json();
  assert.equal(stats.total, 1);
  assert.equal(stats.today, 1);
  assert.equal(stats.online, 1);
  // A second session counts separately.
  await beat('67aa6075-c764-4ea3-ae22-7a190d800002');
  const stats2 = await (await handler(new Request(origin + '/.netlify/functions/ncn-visitors'))).json();
  assert.equal(stats2.total, 2);
  assert.equal(stats2.online, 2);
  // Cleanup with a far-future clock removes the stale presence buckets.
  const removed = await cleanupPresence(getStore('ncn-visitors-v1'), Date.now() + 60 * 60 * 1000);
  assert.equal(removed >= 1, true);
  assert.equal(vietnamDay(Date.now()).length, 10);
});

const ADMIN = {id: 'admin-1', email: 'admin@ncn.test', name: 'Admin', admin: true, vip: true};
const MEMBER = {id: 'member-1', email: 'member@ncn.test', name: 'Member', admin: false, vip: false};

test('announcements handler runs on the D1 store (CAS add/delete)', async () => {
  const getStore = createStoreFactory(env());
  const handler = createAnnouncementsHandler({
    production: () => true,
    verify: async () => ADMIN,
    store: () => getStore('ncn-site-announcements-v1'),
  });
  const origin = 'https://nguyencongnghe.pages.dev';
  const list = await (await handler(new Request(origin + '/.netlify/functions/ncn-announcements?route=list'))).json();
  assert.deepEqual(list.items, []);
  const added = await (await handler(new Request(origin + '/.netlify/functions/ncn-announcements?route=add', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({text: 'Hello CF', version: null}),
  }))).json();
  assert.equal(added.items?.length, 1);
  const listed = await (await handler(new Request(origin + '/.netlify/functions/ncn-announcements?route=list'))).json();
  assert.equal(listed.items[0].text, 'Hello CF');
  const deleted = await (await handler(new Request(origin + '/.netlify/functions/ncn-announcements?route=delete', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({id: listed.items[0].id, version: added.version}),
  }))).json();
  assert.deepEqual(deleted.items, []);
});

test('ported stories handler: create/list/image/delete on the D1+R2 store', async () => {
  const e = env();
  const getStore = createStoreFactory(e);
  const handler = createStoriesHandler({
    production: () => true,
    store: () => getStore('ncn-community-stories-v1'),
    verify: async () => MEMBER,
  });
  const origin = 'https://nguyencongnghe.pages.dev';
  const png = readFileSync(new URL('../public/assets/ncn-theme/logo.png', import.meta.url));
  const created = await handler(new Request(origin + '/.netlify/functions/ncn-stories?route=create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({
      requestId: '67aa6075-c764-4ea3-ae22-7a190d800001',
      caption: 'Hello from Cloudflare',
      image: png.toString('base64'),
    }),
  }));
  assert.equal(created.status, 201);
  const {item} = await created.json();
  assert.equal(item.width, 1972);
  assert.equal(item.height, 798);
  assert.equal(item.caption, 'Hello from Cloudflare');
  const listed = await (await handler(new Request(origin + '/.netlify/functions/ncn-stories?route=list'))).json();
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].id, item.id);
  // Image and thumbnail both serve the original bytes with the sniffed type.
  for (const size of ['', '&size=thumb']) {
    const res = await handler(new Request(`${origin}/.netlify/functions/ncn-stories?route=image&id=${item.id}${size}`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/png');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), png);
  }
  // Cleanup does not remove the live story.
  assert.deepEqual(await cleanupStories(getStore('ncn-community-stories-v1')), {removed: 0});
  const deleted = await handler(new Request(origin + '/.netlify/functions/ncn-stories?route=delete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({id: item.id}),
  }));
  assert.equal(deleted.status, 200);
  const listedAfter = await (await handler(new Request(origin + '/.netlify/functions/ncn-stories?route=list'))).json();
  assert.deepEqual(listedAfter.items, []);
  assert.equal(e.NCN_BUCKET.objects.size, 0);
});

test('ported stories handler rejects non-images', async () => {
  const getStore = createStoreFactory(env());
  const handler = createStoriesHandler({
    production: () => true,
    store: () => getStore('ncn-community-stories-v1'),
    verify: async () => MEMBER,
  });
  const origin = 'https://nguyencongnghe.pages.dev';
  const res = await handler(new Request(origin + '/.netlify/functions/ncn-stories?route=create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({
      requestId: '67aa6075-c764-4ea3-ae22-7a190d800001',
      caption: 'not an image',
      image: Buffer.from('hello, not an image at all').toString('base64'),
    }),
  }));
  assert.equal(res.status, 400);
});
