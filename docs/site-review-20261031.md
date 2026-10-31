# Desktop Arcade and public page review — 31 October 2026

The eight games now share an explicit `ncn-game-page` desktop layout. The page
can use up to 1,760 px instead of 1,440 px; duplicated inner gutters no longer
shrink Pikachu and Khối Sắc 3D. Landscape arenas grow with the display height.
Portrait and square boards retain their original aspect ratios and receive more
space, larger controls and readable score labels. Desktop fullscreen places
secondary controls beside Bubble and Blast rather than above/below the board.
Phone layouts and print styles remain outside these desktop media queries.

Gold Miner no longer derives its normal page width from `innerHeight - 310`.
That formula reduced a 1,024 px laptop's mine to about 717 px. CSS now gives the
board 960 px at that viewport, without an inline width changing on resize.

Bubble had a separate layout bug: `bb-reduced` was both the app's reduced-motion
flag and the help dialog's flex label. The label's unscoped rule changed the
whole app into a flex row when reduced motion was enabled. It now applies only
inside the dialog. The actual reduced-motion behavior remains enabled.

Pikachu's fullscreen welcome also allowed horizontal scrolling when the rotated
mascot extended outside its panel. It now clips horizontal artwork overflow
while keeping vertical scrolling for short-screen menus.

## Observed board sizes

The isolated compiled Chromium fixture measures CSS pixels. These are board
dimensions, not enlarged screenshot pixels; canvas renderers and input
coordinates retain their own sizing logic.

| Game | Previous at 1,440 × 900 | Updated at 1,440 × 900 |
|---|---:|---:|
| Rắn Lướt | 1,392 × 650 | 1,392 × 738 |
| Flappy Bird | 1,392 × 648 | 1,392 × 738 |
| Pikachu | 800 × 667 | 1,078 × 898 |
| Cá lớn nuốt cá bé | 1,392 × 650 | 1,392 × 738 |
| Khối Sắc 3D | 293 × 586 | 364 × 728 |
| Đào vàng | 928 × 396 | 1,376 × 860 |
| NCN Blast | 642 × 642 | 875 × 875 |
| Bắn Trứng | 528 × 744 | 660 × 930 |

Normal pages remain scrollable. Fullscreen fits the viewport and keeps game
actions accessible; it does not stretch a portrait board into a landscape shape.

## Removed startup work and obsolete source

- Managed Markdown articles no longer load the legacy jQuery/Blogger runtime,
  Excel script declaration or the tool-only VIP initializer. The server renders
  sanitized Markdown; NCN theme, account bridge, legacy modal aliases and print
  controls remain. Original legacy tools retain their required dependencies.
- Comparing the same compiled asset graph before/after this article-shell edit
  removes eight startup JavaScript resources: 143,681 raw bytes, or 44,809 bytes
  with Node's default gzip (102,424 → 57,615 compressed JS bytes). This is an
  asset-size comparison, not a production speed or real-user timing claim.
- The Arcade stylesheet is now its own content-hashed bundle shared by the hub
  and all eight games. Changing games reuses that stylesheet instead of fetching
  its full contents in each game's separate CSS bundle. CSS ordering is retained.
- Retired the unreferenced old cash editor JS/CSS (5,366 source bytes). Neither
  file was requested by current pages, so this reduces the deployment contents
  rather than claiming an additional first-load saving.
- Byte-identical print images/fonts were inspected. Some are active catalogued
  print assets with SHA-256 checks and saved-document URLs. Preview thumbnails
  already converge to one generated content hash. Those assets remain intact.
- Snake's abandoned online client is not imported by the current solo game; it
  contributes no startup request. This review does not change Render services.

## Verification

- Static scan of all 123 public HTML files: no duplicate DOM IDs, duplicate
  script loads or missing local startup resource references.
- All-page compiled browser layout: 128 scenarios passed, including all 123
  routes at desktop/phone widths and shared search, cards and first paint.
- All 24 primary tools completed the simulated 150 ms / 200,000 bytes/s frontend
  load check without uncaught errors. Observed first paint was 692–1,332 ms;
  these fixture measurements exclude real CDN and server latency.
- `tests/browser/ncn-game-layout.mjs` checks every game at seven widths (320,
  390, 820, 1,024, 1,280, 1,440 and 1,920 px), reduced motion, real starts,
  resource loads and actual fullscreen at three desktop sizes. Its fixture
  blocks external traffic and uses synthetic profile/score responses.
- The asset check verifies every compiled page's local resources, import maps,
  SRI and the shared NCN/Arcade stylesheets. Unit and browser regressions cover
  scrolling, shared accounts, leaderboards, mobile/fullscreen and saved games.
- 351 unit checks, 18 Bubble scenarios, shared Arcade/scroll regressions and
  Pikachu, Gold and Blast fullscreen/input checks passed. Eight glass checks
  preserve geometry/print pixels, and all 16 Netlify Function archives package.

Reproduce with `node scripts/build-public.mjs`,
`node --test tests/*.test.cjs tests/*.test.mjs`,
`node tests/ncn-performance-build.mjs`, and the relevant compiled browser suites
(`NCN_BUILT_TEST=1`). The game layout check always reads `dist/`.
