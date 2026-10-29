# Share branding and unused assets — 29 October 2026

The sales page declared the retired CHUYENGIA.VIP PNG before its own image.
41 public pages still used that brand image, 67 had competing `og:image`
declarations, 96 had duplicate `og:title` declarations and 9 had no OG image.
Chat crawlers could therefore pick the old brand even though the live page
already displayed the approved NCN Liquid Glass interface.

## Result

- All 121 public HTML sources and the managed article template now publish one
  consistent OG/Twitter set in the initial HTML, with absolute image URLs,
  their actual canonical route, the NCN domain and Vietnamese locale.
- Tool and utility links use `share-ncn-20261029.png`, a 1200 × 630 PNG made
  from the existing NCN logo and glass colors. Actual article and game covers
  remain their own covers. No new image is requested during ordinary page load.
- The managed article renderer applies the same rule to current CMS titles,
  descriptions, covers and URLs; articles without a cover use the NCN fallback.
  It no longer inherits an unrelated article's social data.
- The 63,182-byte CHUYENGIA.VIP image and 99 other unreferenced legacy CSS,
  JavaScript and image files are removed, totaling 2,966,146 bytes. The migration
  lookup contains only retained files. The cleanup checks filenames against
  tracked browser code, server templates, documents and print catalogues.
- Barcode code that has no callers is removed from all pages. QR code is kept
  on actual QR consumers. Quiz engine/layout/question registries are kept on
  exam history instead of being loaded on unrelated pages. The shared account
  bridge, actual calculators, print dependencies and on-demand Excel stay intact.
- Compiled output removes 579 executable script references across 98 pages and
  122,831 HTML bytes across the full site. This is a site-wide total, not a
  claim that each visitor downloads 3 MB less. The earlier performance work's
  shared bundles and immutable caching remain in place.
- No CSS rule, business calculation, account permission or visible body markup
  changes. All 121 page bodies are byte-identical when excluded external script
  tags are ignored; the shared appearance CSS still hashes to
  `/assets/ncn-built/styles/2accb82bfcf7c76d.css`.

The compatibility calculator still has its existing internal domain adapter.
It is an active calculator dependency, not a second website theme or a network
request to that domain; removing it would break the approved calculator.

## Validation

- 273 unit checks, including social crawler HTML, dynamic CMS cover fallbacks,
  escaping, canonical routes, preserved QR/history dependencies and the PNG.
- Every compiled page's local assets, SRI, import map and shared appearance CSS.
- 126 browser layout scenarios covering all 121 pages at desktop/mobile widths,
  no uncaught runtime errors, and the approved glass control edge audit.
- Actual Excel import/export, retry and UI font metric browser checks.
- All 22 primary tool/game routes reach a ready state without runtime errors.
- Live read-only catalogue audit: 90 public entries, 50 unique internal content
  pages responding successfully, no retired assets referenced in their bodies.

The same isolated frontend simulation (390 × 844, 150 ms latency, 200,000
download bytes/second) recorded the following reductions; these are not
real-user field timings or guaranteed latency improvements:

| Route | Compressed JS before | Compressed JS after | Ready before | Ready after |
|---|---:|---:|---:|---:|
| Insurance / deferred payments | 222,602 B | 196,731 B | 4.122 s | 3.987 s |
| QR inventory | 129,599 B | 113,474 B | 3.575 s | 3.412 s |
| QR generator | 128,494 B | 112,369 B | 3.572 s | 3.306 s |

Ordinary tool/game pages already optimized in the preceding release keep their
existing JavaScript sizes. The new share image does not change the live UI.

## Chat cache

The website can correct its HTML and provide a new image URL, but cannot rewrite
an attachment already stored in a sent chat message. A chat service may retain
its old preview until its own cache refreshes. A fresh shared URL can request a
new preview; no chat messages or third-party accounts are modified here.

`scripts/prepare-social-image.mjs` recreates the PNG. The source cleanup script
is a maintenance task, not part of page startup or deployment; audit any live
CMS-only references before using it for a later cleanup.
