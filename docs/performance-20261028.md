# Public page performance — 28 October 2026

The public homepage loaded 17 parser-blocking classic scripts, including the
931,715-byte SheetJS reader, barcode/QR libraries, jQuery and retired Blogger
widgets. Every navigation also revalidated the separate shared assets. Public
page Functions explicitly disabled CDN caching and read the public catalogue,
cached news and announcements before sending HTML.

The comparison site, `https://mientay.pro/`, returned an upstream connection
failure in the inspection environment on both attempts. No comparative speed
claim is made about that site.

## Implementation

- `node scripts/build-public.mjs` produces `dist/` from the editable `public/`
  sources. Netlify publishes `dist` and packages the generated public asset
  manifest with the page Functions. Source files remain readable and editable.
- Public ES modules are minified, share compiled dependencies and preload their
  static dependency graphs. An import map sends both current and legacy account
  imports to the same account/Identity implementation.
- Classic scripts retain their exact bytes, integrity checks and global bindings,
  with ordered `defer` so parsing and first paint can proceed during downloads.
  The two portal pages retain the small legacy account bridge while dropping
  unused Blogger, quiz, barcode, QR and spreadsheet code.
- SheetJS loads only in the actual spreadsheet consumers: Sticker, Popup,
  sales/decor tools, inventory, legacy print import, Event and GVGS. Spreadsheet
  import/export in the private editors remains available.
- Stylesheets are minified into ordered groups. The NCN appearance stylesheet is
  shared across home, library, print editors and games; page-specific styles
  retain their original cascade order. Print CSS and form controls are preserved.
- Content-hashed build assets receive a one-year immutable browser cache. Source
  URLs and HTML still revalidate. Netlify invalidates its static cache on atomic
  deployment, so a changed source produces a fresh asset URL automatically.
- Only successful anonymous public page shells use the CDN cache: 60 seconds for
  tools, 15 seconds for the home/library listings. A listing's cache lifetime is
  shortened before its nearest Story expiry. There is no stale-while-revalidate
  window. Listings may reflect a CMS edit after up to 15 seconds; tool catalogue
  snapshots after up to 60 seconds. The live notice endpoint still refreshes.
- Managed article bodies/deletion status, authentication, VIP, payments, profile
  writes, score operations, admin endpoints, failures and degraded shells keep
  their no-store policies. Existing immutable photo reads are unchanged. No
  account data enters the public asset manifest.
- The public catalogue API starts its index and news reads together instead of
  adding their network round trips sequentially.

## Verification

The local mobile comparison serves identical server-rendered NCN content in
Chromium at 390 × 844, 150 ms latency and 200,000 download bytes/second, with
gzip and isolated local endpoints. These are frontend simulation results,
not real-user field measurements or measurements of mientay.pro.

| Metric | Previous homepage | Optimized homepage |
|---|---:|---:|
| First contentful paint, cold load | 6.364 s | 1.216 s |
| DOM content loaded, cold load | 14.249 s | 1.633 s |
| Compressed JavaScript body bytes | 453,954 | 41,717 |
| Parser-blocking classic scripts | 17 | 0 |
| Stylesheet requests including visitor footer | 10 | 5 |
| First contentful paint, repeated navigation | 6.476 s | 0.280 s |
| JavaScript transferred on repeated navigation | 464,754 bytes | 0 bytes |

Validation passed: 253 unit checks, all 121 compiled pages' local assets/SRI/import
maps, 126 layout scenarios, 18 shared account scenarios, 14 member profile
scenarios, 17 shared Arcade scenarios, 80 scroll/input scenarios, and all 16 real
Netlify Function archives. Browser fixtures cannot write production accounts,
content, photos, payments or scores.

Run `node tests/browser/ncn-performance.mjs` after a build to reproduce the
frontend comparison. `NCN_BUILT_TEST=1` makes the account, profile, Arcade,
layout and scroll suites exercise compiled output. The dedicated production
asset workflow builds and packages before checking those compiled pages.
