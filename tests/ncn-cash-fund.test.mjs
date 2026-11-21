import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCashFundHandler } from '../netlify/lib/ncn-cash-fund-api.mjs';
import { verifyIdentity } from '../netlify/lib/ncn-event-api.mjs';
import { preparePublicTools, publicToolConfig } from '../netlify/lib/ncn-public-copy.mjs';
import { orderTools } from '../public/assets/ncn-theme/menu.js';
import { memoryStories } from './fixtures/ncn-stories.mjs';

const origin = 'https://ncn.test';
const now = Date.parse('2026-11-14T17:00:00Z');
const staff = { id: 'fixture-staff', name: 'Nhân viên thử nghiệm', email: 'staff@example.test', cashFund: true };
const admin = { id: 'fixture-admin', name: 'Quản trị thử nghiệm', email: 'admin@example.test', admin: true };
const member = { id: 'fixture-member', name: 'Thành viên thường', email: 'member@example.test' };
const receipt = (change = {}) => ({
  id: randomUUID(), owner: staff.id, type: 'in', date: '2026-11-15', note: 'Phiếu thử', amount: 500000, ...change
});

function fixture({ production = true, store = memoryStories() } = {}) {
  const handler = createCashFundHandler({
    production: () => production,
    store: () => store,
    verify: async req => ({ staff, admin, member, renamed: { ...staff, name: 'Tên mới', email: 'new@example.test' }, vip: { id: 'fixture-vip', vip: true } })[req.headers.get('X-Fixture-User')],
    now: () => now
  });
  const call = (data, { user = 'staff', query = '', method = data ? 'POST' : 'GET', source = origin } = {}) =>
    handler(new Request(origin + '/.netlify/functions/ncn-cash-fund' + query, {
      method,
      headers: { 'X-Fixture-User': user, Origin: source, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {})
    }));
  return { call, store };
}

test('every verified member can use a private personal ledger, while guests and previews cannot', async () => {
  const { call, store } = fixture();
  for (const [user, status] of [['guest', 401]]) {
    assert.equal((await call(undefined, { user })).status, status);
    assert.equal((await call(receipt(), { user })).status, status);
  }
  assert.equal((await call(receipt(), { source: 'https://elsewhere.test' })).status, 403);
  assert.equal((await call(undefined, { method: 'DELETE' })).status, 405);
  assert.equal((await fixture({ production: false }).call()).status, 503);
  assert.equal(store.entries.size, 0);
  const response = await call(undefined, { user: 'admin' });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(await response.json(), { balance: 0, entries: [], next: null, owner: { id: admin.id, name: admin.name } });
  for (const user of ['vip', 'member', 'staff']) assert.equal((await call(undefined, { user })).status, 200);

  const req = new Request(origin, { headers: { Cookie: 'nf_jwt=fixture' } });
  const verify = roles => verifyIdentity(req, { url: origin }, async () => Response.json({
    ...staff, confirmed_at: '2026-11-14', app_metadata: { roles },
    user_metadata: { roles: ['quy-st', 'admin'] }
  }), { includeCashFund: true });
  assert.equal((await verify(['vip'])).cashFund, false);
  assert.equal((await verify(['quy-st'])).cashFund, true);
});

test('concurrent receipts update the same balance and retries save a single entry', async () => {
  const { call } = fixture();
  const first = receipt();
  const same = await Promise.all([call(first), call(first)]);
  assert.deepEqual(same.map(res => res.status).sort(), [200, 201]);
  for (const res of same) {
    const { entry } = await res.json();
    assert.equal(entry.balanceBefore, 0);
    assert.equal(entry.balanceAfter, 500000);
    assert.ok(!('actorId' in entry));
  }

  const payouts = await Promise.all([
    call(receipt({ type: 'out', amount: 400000 })),
    call(receipt({ type: 'out', amount: 400000 }))
  ]);
  assert.deepEqual(payouts.map(res => res.status).sort(), [201, 409]);
  const state = await (await call()).json();
  assert.equal(state.balance, 100000);
  assert.deepEqual(state.entries.map(({ balanceBefore, balanceAfter }) => [balanceBefore, balanceAfter]), [
    [500000, 100000], [0, 500000]
  ]);
  assert.equal((await call({ ...first, amount: 2 })).status, 409);
  assert.equal((await call({ ...first, owner: admin.id })).status, 409);
});

test('accounts including Admin cannot read or spend each other\'s funds; the old shared ledger is preserved', async () => {
  const { call, store } = fixture();
  const oldLedger = { entries: [{ ...receipt(), actorId: staff.id, balanceBefore: 0, balanceAfter: 9000000 }] };
  await store.setJSON('ledger', oldLedger);
  const sharedID = receipt().id;
  assert.equal((await call(receipt({ id: sharedID }))).status, 201);
  for (const [user, account] of [['admin', admin], ['member', member]]) {
    const empty = await (await call(undefined, { user, query: '?owner=' + staff.id + '&key=ledger' })).json();
    assert.equal(empty.balance, 0);
    assert.deepEqual(empty.entries, []);
    assert.equal(empty.owner.id, account.id);
    assert.equal((await call(receipt({ owner: account.id, type: 'out', amount: 1 }), { user })).status, 409);
    assert.equal((await call(receipt({ owner: staff.id }), { user })).status, 409);
    assert.equal((await call(receipt({ id: sharedID, owner: account.id, amount: 100 }), { user })).status, 201);
    const own = await (await call(undefined, { user })).json();
    assert.equal(own.balance, 100);
    assert.equal(own.entries.length, 1);
  }
  const renamed = await (await call(undefined, { user: 'renamed' })).json();
  assert.equal(renamed.balance, 500000);
  assert.equal(renamed.entries.length, 1);
  assert.equal(renamed.owner.name, 'Tên mới');
  assert.deepEqual(await store.get('ledger'), oldLedger);
  assert.equal([...store.entries.keys()].filter(key => key.startsWith('personal/')).length, 3);
});

test('an interrupted acknowledgment returns the already saved receipt on retry', async () => {
  const store = memoryStories();
  const commit = store.setJSON.bind(store);
  store.setJSON = async (...args) => {
    const result = await commit(...args);
    store.setJSON = commit;
    throw new Error('Connection interrupted after the write');
  };
  const { call } = fixture({ store });
  const first = receipt();
  assert.equal((await call(first)).status, 503);
  assert.equal((await call(first)).status, 200);
  const { entries, balance } = await (await call()).json();
  assert.equal(entries.length, 1);
  assert.equal(balance, 500000);
});

test('history filters by the selected date and receipt type and paginates while new receipts arrive', async () => {
  const { call } = fixture();
  for (let index = 0; index < 32; index++) {
    const data = receipt({ date: '2026-11-14', amount: 100, note: 'Phiếu ' + index });
    assert.equal((await call(data)).status, 201);
  }
  const query = '?from=2026-11-14&to=2026-11-14&type=in';
  const first = await (await call(undefined, { query })).json();
  assert.equal(first.entries.length, 30);
  assert.equal(first.balance, 3200);
  assert.equal((await call(receipt({ type: 'out', amount: 1200, note: '<b>Thử</b>' }))).status, 201);
  const more = await (await call(undefined, { query: query + '&after=' + first.next })).json();
  assert.deepEqual(more.entries.map(entry => entry.note), ['Phiếu 1', 'Phiếu 0']);
  assert.equal(more.balance, 2000);
  assert.equal(more.next, null);
  const onlyExpenses = await (await call(undefined, { query: '?type=out' })).json();
  assert.deepEqual(onlyExpenses.entries.map(entry => entry.note), ['<b>Thử</b>']);
});

test('receipts validate VND amounts, dates in Vietnam, notes and the posting account', async () => {
  const { call, store } = fixture();
  for (const changes of [
    { amount: 0 }, { amount: -1 }, { amount: 10.5 }, { amount: '50.000' },
    { amount: Number.MAX_SAFE_INTEGER + 1 }, { date: '2026-11-16' }, { date: '2026-02-30' },
    { type: 'other' }, { note: '  ' }, { note: 'x'.repeat(501) }
  ]) assert.equal((await call(receipt(changes))).status, 400, JSON.stringify(changes));
  assert.equal((await call(receipt({ owner: 'old-session' }))).status, 409);
  assert.equal((await call(undefined, { query: '?from=2026-11-15&to=2026-11-14' })).status, 400);
  assert.equal(store.entries.size, 0);
});

test('Tiền quỹ Siêu Thị follows Kiểm quỹ in the initial and hydrated tools', async () => {
  const load = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const config = publicToolConfig(JSON.parse(await load('public/assets/ncn-theme/config.json')));
  const ids = orderTools(config.tools).map(tool => tool.id);
  assert.equal(ids[ids.indexOf('cash') + 1], 'cash-fund');
  const home = preparePublicTools(await load('public/index.html'));
  assert.match(home, /data-ncn-tool="cash"[^>]*>[\s\S]*?<\/a>\s*<a class="ncn-nav-link" href="\/tien-quy-sieu-thi\/" data-ncn-tool="cash-fund"/);
  assert.match(home, /data-ncn-pin="cash"[\s\S]*?<\/article>\s*<article[^>]*data-ncn-tool="cash-fund"/);
  const repeated = preparePublicTools(home);
  assert.equal([...repeated.matchAll(/ncn-tool-art-cash-fund/g)].length, 1);
  const page = preparePublicTools(await load('public/tien-quy-sieu-thi/index.html'));
  assert.match(page, /data-ncn-tool="cash-fund" aria-current="page"/);
});
