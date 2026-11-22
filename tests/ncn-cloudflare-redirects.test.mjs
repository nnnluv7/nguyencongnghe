import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformRedirectsForCloudflare} from '../scripts/lib/cloudflare-redirects.mjs';

test('redirects transform: small synthetic file', () => {
  const input = [
    '# comment line',
    '/a  /b  301!',
    '/bai-viet/:slug/  /.netlify/functions/ncn-library-page?slug=:slug  200!',
    '/c  /d  200!',
    '/a  /b  301!',
    '/e  /f',
  ].join('\n');
  const {text, stats} = transformRedirectsForCloudflare(input);
  // The function rewrite is dropped (routed by the middleware instead);
  // the duplicate /a is removed; ! is stripped from the 3 kept lines.
  assert.deepEqual(stats, {total: 3, static: 3, dynamic: 0, strippedBang: 3, removedDuplicates: 1, droppedFunctionRewrites: 1});
  assert.equal(text.includes('!'), false);
  assert.equal(text.includes('/.netlify/functions/'), false);
  const lines = text.trim().split('\n');
  assert.equal(lines[0], '# comment line');
  assert.equal(lines.filter(l => l.startsWith('/a ')).length, 1);
  assert.ok(lines.includes('/e  /f'));
  assert.ok(lines.includes('/c  /d  200'));
});

test('redirects transform: real public/_redirects', () => {
  const input = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  const {text, stats} = transformRedirectsForCloudflare(input);
  // 452 rules: 410 function rewrites dropped, 6 duplicates were all function
  // rewrites (dropped before the dedupe check), 42 kept (37 301s + 5 static
  // 200 rewrites). Only the 4 301! rules survive to the !-strip step.
  assert.equal(stats.total, 42);
  assert.equal(stats.dynamic, 0);
  assert.equal(stats.static, 42);
  assert.equal(stats.strippedBang, 4);
  assert.equal(stats.removedDuplicates, 0);
  assert.equal(stats.droppedFunctionRewrites, 410);
  assert.equal(text.includes('!'), false, 'no ! suffix may survive');
  assert.equal(text.includes('/.netlify/functions/'), false, 'no function rewrite may survive');
  const rules = text.split('\n').filter(l => l && !l.startsWith('#'));
  assert.equal(rules.length, 42);
  // No duplicate sources.
  const sources = rules.map(l => l.split(/\s+/)[0]);
  assert.equal(new Set(sources).size, sources.length);
  // Key rules survive with their targets intact.
  assert.ok(rules.includes('/thu-vien  /tin-tuc-cong-nghe/  301'));
  assert.ok(rules.includes('/tin-tuc-cong-nghe/index.html  /tin-tuc-cong-nghe/  301'));
  assert.ok(rules.some(l => l.startsWith('/assets/ncn-theme/theme.css  /assets/ncn-theme/site.css  200')));
  // Every kept rule is a 301 or a static-target 200.
  for (const rule of rules) {
    const [, target, status] = rule.split(/\s+/);
    assert.ok(status === '301' || (status === '200' && !target.startsWith('/.netlify/')), rule);
  }
});
