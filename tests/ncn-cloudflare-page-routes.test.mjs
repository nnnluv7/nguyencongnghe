import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLegacyRoutes, resolvePageRoute} from '../functions/_cf/page-routes.mjs';

const pages = JSON.parse(readFileSync(new URL('../netlify/lib/ncn-shell/pages.json', import.meta.url), 'utf8'));
const seed = JSON.parse(readFileSync(new URL('../netlify/lib/ncn-library/seed.json', import.meta.url), 'utf8'));
const legacy = buildLegacyRoutes(seed);

test('legacy routes: derived table matches public/_redirects exactly', () => {
  const rules = {};
  for (const line of readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[1].includes('legacy=')) rules[parts[0]] = parts[1].split('legacy=')[1];
  }
  assert.equal(Object.keys(rules).length, 120);
  assert.deepEqual(legacy, rules);
  // No legacy URL collides with a site page.
  assert.equal(Object.keys(legacy).filter(p => p in pages).length, 0);
});

test('page routes: legacy articles', () => {
  const href = '/2020/11/visual-c-aio-v52-bo-thu-vien-day-du-2020.html';
  const id = legacy[href];
  assert.ok(id);
  for (const variant of [href, href.slice(0, -5), href.slice(0, -5) + '/']) {
    assert.deepEqual(resolvePageRoute(variant, pages, legacy), {name: 'ncn-library-page', search: '?legacy=' + encodeURIComponent(id)}, variant);
  }
  // Every legacy URL resolves to its own id.
  for (const [path, itemId] of Object.entries(legacy)) {
    assert.deepEqual(resolvePageRoute(path, pages, legacy), {name: 'ncn-library-page', search: '?legacy=' + encodeURIComponent(itemId)}, path);
  }
});

test('page routes: home and news index', () => {
  assert.deepEqual(resolvePageRoute('/', pages), {name: 'ncn-library-page', search: '?view=home'});
  assert.deepEqual(resolvePageRoute('/index.html', pages), {name: 'ncn-library-page', search: '?view=home'});
  assert.deepEqual(resolvePageRoute('/tin-tuc-cong-nghe/', pages), {name: 'ncn-library-page', search: '?view=index'});
  // /tin-tuc-cong-nghe/index.html 301s to /tin-tuc-cong-nghe/ on Netlify, so
  // it falls through to the _redirects 301 instead of rendering directly.
  assert.equal(resolvePageRoute('/tin-tuc-cong-nghe/index.html', pages), null);
  // No trailing slash: not a page route, falls through to static serving.
  assert.equal(resolvePageRoute('/tin-tuc-cong-nghe', pages), null);
});

test('page routes: bai-viet slugs', () => {
  assert.deepEqual(resolvePageRoute('/bai-viet/hello-world/', pages), {name: 'ncn-library-page', search: '?slug=hello-world'});
  assert.deepEqual(resolvePageRoute('/bai-viet/hello-world', pages), {name: 'ncn-library-page', search: '?slug=hello-world'});
  assert.equal(resolvePageRoute('/bai-viet/', pages), null);
  assert.equal(resolvePageRoute('/bai-viet/a/b', pages), null);
});

test('page routes: site pages from pages.json', () => {
  const sample = '/2020/10/shrink-volume-32-phan-mem-chia-o-cung.html';
  assert.deepEqual(resolvePageRoute(sample, pages), {name: 'ncn-site-page', search: '?page=' + encodeURIComponent(pages[sample])});
  // /404.html is itself a site page in the map (Netlify rewrites it too).
  assert.deepEqual(resolvePageRoute('/404.html', pages), {name: 'ncn-site-page', search: '?page=404.html'});
  // Every pages.json key resolves to its own file.
  for (const [path, file] of Object.entries(pages)) {
    const route = resolvePageRoute(path, pages, legacy);
    assert.ok(route, path);
    assert.equal(route.name, 'ncn-site-page', path);
    assert.equal(route.search, '?page=' + encodeURIComponent(file), path);
  }
});

test('page routes: non-page paths fall through', () => {
  for (const path of [
    '/.netlify/functions/ncn-visitors',
    '/.netlify/identity/settings',
    '/assets/ncn-theme/site.css',
    '/_ncn-shells/index.html',
    '/robots.txt',
    '/does-not-exist',
    '/2020/10/no-such-article.html',
    '/tin-tuc-cong-nghe/unknown',
  ]) assert.equal(resolvePageRoute(path, pages, legacy), null, path);
});
