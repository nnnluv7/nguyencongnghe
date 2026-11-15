import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { createCashFundHandler } from '../../netlify/lib/ncn-cash-fund-api.mjs';
import { verifyIdentity } from '../../netlify/lib/ncn-event-api.mjs';
import { vietnamDate } from '../../public/assets/ncn-cash-fund/shared.js';
import { memoryStories } from '../fixtures/ncn-stories.mjs';

const origin = 'https://cash-fund.test';
const endpoint = '/.netlify/functions/ncn-cash-fund';
const identity = '/.netlify/identity/';
const tool = '/tien-quy-sieu-thi/';
const store = memoryStories();
const engine = process.env.NCN_TEST_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
const mediaTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'
};
const tokens = new Map();
const users = new Map(['quy-st', 'vip'].map(role => {
  const email = role + '@example.test';
  return [email, {
    id: role, email, confirmed_at: '2026-11-01T00:00:00Z', app_metadata: { roles: [role] },
    user_metadata: { full_name: 'Tài khoản thử nghiệm' }
  }];
}));
const userOf = header => tokens.get(header?.replace(/^Bearer /, ''));
const verify = req => verifyIdentity(req, { url: origin + identity }, async (_url, { headers }) => {
  const user = userOf(headers.Authorization);
  return Response.json(user || {}, { status: user ? 200 : 401 });
}, { includeCashFund: true });
const handler = createCashFundHandler({ production: () => true, store: () => store, verify });
let dropNextSave = false;

async function openPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const headers = new Headers(await request.allHeaders());
    const body = request.postDataBuffer();
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (url.pathname === identity + 'settings') return reply({ autoconfirm: true, external: { email: true } });
    if (url.pathname === identity + 'token') {
      const user = users.get(new URLSearchParams(body?.toString()).get('username'));
      if (!user) return reply({}, 401);
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const token = 'e30.' + Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url') + '.fixture';
      tokens.set(token, user);
      return reply({ access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname === identity + 'user') {
      const user = userOf(headers.get('authorization'));
      return reply(user || {}, user ? 200 : 401);
    }
    if (url.pathname === identity + 'logout') return reply({});
    if (url.pathname === endpoint) {
      const method = request.method();
      const response = await handler(new Request(url, { headers, method, ...(body ? { body } : {}) }));
      if (dropNextSave && method === 'POST' && response.status === 201) {
        dropNextSave = false;
        return route.abort();
      }
      return route.fulfill({
        status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()
      });
    }
    if (url.pathname === '/.netlify/functions/ncn-billing') {
      return reply({ user: await verify(new Request(url, { headers })), serverNow: new Date().toISOString() });
    }
    if (url.pathname.startsWith('/.netlify/')) return reply({ items: [], total: 1 });
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    try {
      return route.fulfill({
        contentType: mediaTypes[extname(path)] || 'application/octet-stream',
        body: await readFile(resolve('dist', '.' + path))
      });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  return page;
}

async function login(page, role) {
  await page.locator('#cf-login').click();
  const form = page.locator('[data-account-form="login"]');
  await form.locator('[name="email"]').fill(role + '@example.test');
  await form.locator('[name="password"]').fill('Fixture123!');
  await form.locator('[type="submit"]').click();
}

async function fits(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}

try {
  const desktop = await openPage({ width: 1360, height: 900 });
  await desktop.goto(origin + '/');
  await desktop.locator('#ncn-tool-grid [data-ncn-tool="cash-fund"]').waitFor();
  assert.equal(await desktop.locator('#ncn-tool-grid [data-ncn-pin="cash-fund"]').evaluate(pin =>
    pin.closest('article').previousElementSibling.querySelector('[data-ncn-pin]').dataset.ncnPin), 'cash');
  await desktop.locator('#ncn-menu-open').click();
  assert.equal(await desktop.locator('#ncn-navigation [data-ncn-tool="cash-fund"]').evaluate(link =>
    link.previousElementSibling.dataset.ncnTool), 'cash');
  await desktop.getByRole('link', { name: 'Tiền quỹ Siêu Thị', exact: true }).click();
  await login(desktop, 'quy-st');
  await desktop.locator('#cf-ledger').waitFor();
  assert.match(await desktop.locator('#cf-balance').innerText(), /0\s*₫/);
  await desktop.locator('[data-cf-receipt="in"]').click();
  const form = desktop.locator('#cf-receipt-form');
  assert.equal(await form.locator('[name="date"]').inputValue(), vietnamDate());
  await form.locator('[name="amount"]').fill('2.500.000');
  await form.locator('[name="note"]').fill('Nộp đầu kỳ <b>mẫu</b>');
  dropNextSave = true;
  await desktop.locator('#cf-save').click();
  await desktop.getByText('Chưa nhận được xác nhận.', { exact: false }).waitFor();
  await desktop.locator('#cf-save').click();
  await desktop.getByText('Đã lưu phiếu.', { exact: true }).waitFor();
  assert.match(await desktop.locator('#cf-balance').innerText(), /2\.500\.000\s*₫/);
  assert.equal(await desktop.locator('#cf-entries tr').count(), 1);
  assert.equal(await desktop.locator('#cf-entries .cf-entry-note').textContent(), 'Nộp đầu kỳ <b>mẫu</b>');
  assert.equal(await desktop.locator('#cf-entries b').count(), 0);
  await fits(desktop);

  const mobile = await openPage({ width: 360, height: 740 });
  await mobile.goto(origin + tool);
  await login(mobile, 'quy-st');
  const balance = mobile.locator('#cf-balance');
  await balance.waitFor();
  assert.match(await balance.innerText(), /2\.500\.000\s*₫/);
  await mobile.locator('#ncn-theme-toggle').click();
  assert.equal(await mobile.locator('html').getAttribute('data-ncn-theme'), 'dark');
  await mobile.locator('[data-cf-receipt="out"]').click();
  const expense = mobile.locator('#cf-receipt-form');
  await expense.locator('[name="amount"]').fill('250000');
  await expense.locator('[name="note"]').fill('Chi vật tư');
  await fits(mobile);
  await mobile.locator('#cf-save').click();
  await mobile.getByText('Đã lưu phiếu.', { exact: true }).waitFor();
  assert.match(await balance.innerText(), /2\.250\.000\s*₫/);
  await mobile.locator('#cf-filters [name="type"]').selectOption('out');
  await mobile.locator('#cf-filters [name="from"]').fill(vietnamDate());
  await mobile.locator('#cf-filters button').click();
  await mobile.locator('#cf-entries').getByText('Nộp đầu kỳ', { exact: false }).waitFor({ state: 'detached' });
  assert.equal(await mobile.locator('#cf-entries tr').count(), 1);
  assert.match(await mobile.locator('#cf-entries .cf-entry-balance').textContent(), /2\.500\.000.*2\.250\.000/);
  await fits(mobile);
  await mobile.locator('.ncn-account-menu summary').click();
  await mobile.locator('#ncn-account-host [data-ncn-account-signout]').click();
  await mobile.locator('#cf-login').waitFor();
  assert.equal(await mobile.locator('#cf-entries tr').count(), 0);
  await login(mobile, 'vip');
  await mobile.getByText('Tài khoản này cần được Admin cấp quyền quỹ.', { exact: true }).waitFor();
  assert.equal(await mobile.locator('#cf-ledger').isVisible(), false);
  console.log('Verified ordering, permissions, shared balances, a lost response retry, date and type filters, and phone layout.');
} finally {
  await browser.close();
}
