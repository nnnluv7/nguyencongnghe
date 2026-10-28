# Tool page startup — 28 October 2026

The tool pages had a separate loading problem from the homepage. Sticker,
Popup A7, Popup A4/A5/A6, sales tools and decoration still ran the initializer
for the replaced editor, throwing `Cannot read properties of null (reading
'style')`. The shared logo was a 757,505-byte, 1972 × 798 PNG used in small
header icons, and legacy pages downloaded several 325–330 KB Inter TTF files.
Excel readers and full-size print images also competed with startup resources.

## Resulting behavior

- Modern editors, cash and warehouse pages load their own controllers and retain
  the shared account, print-guide and sharing controls. The obsolete editor and
  Blogger initializers are excluded from their production HTML.
- The shared logo uses a 20,528-byte WebP for display and a small PNG favicon.
  Both initial HTML and the theme use the same URL, avoiding a second request for
  the large original after hydration.
- Inter's common Latin/Vietnamese glyphs use 34–38 KB WOFF2 files. The complete
  original glyph coverage remains available on demand for other scripts. Glyph
  metrics and licensing are retained; the original source fonts stay intact.
- Model catalogues preload from the head and use immutable URLs. Their preview
  images are sized for the cards. Print layouts, image/font sources, checksums,
  field definitions and all other catalogue data remain unchanged.
- SheetJS is fetched once only when an Excel import/export is requested. This
  applies to the direct editors, inventory, legacy batch import, Event and GVGS.
  A failed library fetch can be retried without changing the selected model.
- Relative resources, including Flappy Bird's `core.js`, `game.js` and CSS, now
  receive the same fingerprinting and preloading as absolute source URLs.
- Hidden print-guide images use native lazy loading.

## Validation

- 255 unit tests; 121 compiled pages' references, integrity checks and shared CSS.
- 126 layout scenarios, including a runtime-error check on every compiled page.
- 80 scroll/input cases and 18 shared account cases.
- Actual workbook import in Sticker, Popup, sales tools, Event and GVGS; actual
  workbook downloads in inventory, Event and GVGS; network-failure retry.
- Browser comparisons of Vietnamese, decomposed Vietnamese, numbers, Greek and
  Cyrillic text widths against the original font.
- All 22 primary tool/game routes reach a ready state with no uncaught errors.
- All 16 real Netlify Function archives package successfully.

The browser services use isolated local fixtures. No production account,
workbook, price list, image, payment, notification or score is created.

Timing audits use a cold 390 × 844 Chromium context per route, 150 ms latency
and 200,000 download bytes/second. Readiness includes account initialization,
the tool catalogue when present, and completion of visible images. These are
frontend simulation results; origin network conditions are outside this test.

Run `node tests/browser/ncn-tools-performance.mjs` after building to reproduce
the route audit, and `node tests/browser/ncn-tool-resources.mjs` for actual Excel
and font checks. Font subsets can be recreated with the documented preparation
script; ordinary builds need no Python installation.

## Cold navigation audit

| Primary route | Previous ready time | Optimized ready time |
|---|---:|---:|
| /in-gvgs/ | 6.66 s | 1.53 s |
| /in-event/ | 15.73 s | 2.83 s |
| /2024/02/kiem-quy.html | 15.52 s | 3.09 s |
| /vong-quay-may-man/ | 4.96 s | 1.35 s |
| /2025/05/tu-van.html | 16.05 s | 4.45 s |
| /sticker/ | 17.89 s | 4.18 s |
| /popup-a7/ | 16.65 s | 3.08 s |
| /popup-a4-a5-a6/ | 17.27 s | 3.75 s |
| /ban-hang/ | 18.51 s | 3.17 s |
| /2020/10/kho-ver-52-all-tools-ho-tro-kho.html | 15.94 s | 3.02 s |
| /2024/01/in-fifo.html | 15.62 s | 3.69 s |
| /2024/01/ban-kiem-ke-san-pham-theo-file-excel.html | 17.12 s | 3.62 s |
| /2024/04/qrcode-generator-tao-ma-qrcode.html | 15.53 s | 3.61 s |
| /premium/ | 4.91 s | 1.22 s |
| /arcade/ | 4.99 s | 1.44 s |
| /flappy-bird/ | 5.09 s | 1.49 s |
| /trang-tri/ | 18.08 s | 2.76 s |
| /ran-luot/ | 5.10 s | 1.50 s |
| /ca-lon-nuot-ca-be/ | 5.17 s | 1.62 s |
| /pikachu/ | 5.18 s | 1.59 s |
| /xep-hinh/ | 5.14 s | 1.70 s |
| /ban-bong/ | 5.16 s | 1.73 s |
