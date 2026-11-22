// Pure page-routing table for the root middleware (functions/_middleware.js).
//
// Page URLs (home, news index, /bai-viet/<slug>, the 279 site pages in
// netlify/lib/ncn-shell/pages.json, and the 120 legacy-article URLs) are
// rendered by Functions, but they are NOT routed through _redirects:
// Cloudflare applies _redirects rules only to static asset responses, so a
// 200 rewrite to /.netlify/functions/* resolves the target as a static file
// and 404s (verified against the Pages docs and in wrangler pages dev). The
// middleware owns this routing instead.
//
// Legacy articles: the 40 seed items with a sourcePath each own 3 URL
// variants (href, href without .html, href without .html + '/'), matching
// the 120 `?legacy=` rules in public/_redirects exactly (verified by test).
// The table is derived from the seed here so the middleware needs no
// build-time step; the test cross-checks it against _redirects.
//
// Returns {name, search} for the internal function call, or null to fall
// through to static serving (context.next()), where the remaining _redirects
// 301s and static 200 rewrites still apply.

const HOME = new Set(['/', '/index.html']);
// NOTE: /tin-tuc-cong-nghe/index.html is deliberately NOT here — on Netlify
// it 301s to /tin-tuc-cong-nghe/ (kept in the Cloudflare _redirects), so it
// falls through to static serving instead of rendering directly.
const INDEX = new Set(['/tin-tuc-cong-nghe/']);

export function buildLegacyRoutes(seed) {
  const routes = {};
  for (const item of seed) {
    if (!item.sourcePath || !item.href || !item.id) continue;
    const base = item.href.endsWith('.html') ? item.href.slice(0, -5) : item.href;
    for (const variant of [item.href, base, base + '/']) routes[variant] = item.id;
  }
  return routes;
}

export function resolvePageRoute(pathname, pages, legacy) {
  if (HOME.has(pathname)) return {name: 'ncn-library-page', search: '?view=home'};
  if (INDEX.has(pathname)) return {name: 'ncn-library-page', search: '?view=index'};
  if (pathname.startsWith('/bai-viet/')) {
    // Mirrors the Netlify :slug placeholder: one non-empty segment.
    const slug = pathname.slice('/bai-viet/'.length).replace(/\/$/, '');
    if (slug && !slug.includes('/')) return {name: 'ncn-library-page', search: '?slug=' + encodeURIComponent(slug)};
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(pages, pathname)) {
    return {name: 'ncn-site-page', search: '?page=' + encodeURIComponent(pages[pathname])};
  }
  if (legacy && Object.prototype.hasOwnProperty.call(legacy, pathname)) {
    return {name: 'ncn-library-page', search: '?legacy=' + encodeURIComponent(legacy[pathname])};
  }
  return null;
}
