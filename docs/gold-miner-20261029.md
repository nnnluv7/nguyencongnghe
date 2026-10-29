# Đào vàng tuổi thơ — 29/10/2026

Adds `/dao-vang/` to the existing NCN Arcade, home tools, site menu, Library, search, sitemap and server-rendered shell routes. The shared appearance, account, notice controller and current site stylesheet remain in place. The Arcade catalogue now has seven games; Gold Miner uses the same server-issued runs, guest/member identity, photos, score queue and per-mode leaderboard.

## Play

Original Canvas/SVG artwork: bearded miner, wooden winch, desert mine, gold, rocks, diamonds, bags, moles, TNT and rope claw. Original Web Audio effects, muted by default. No Flash, iframe, external game asset, or additional runtime package.

The claw swings continuously. Space / Down / mouse click / Thả móc drops it. Up / D / Thuốc nổ destroys a carried object. P pauses, F opens native or fallback full screen; phones have large controls and normal vertical page scrolling over the mine. Global menu, dialogs, tab switching and blur pause the game.

Each stage lasts 60 seconds. Larger items pull more slowly. Money is awarded only when banked; an unfinished payload at the deadline is discarded. Reaching the target allows continued mining until timeout or mine exhaustion. Spendable cash carries forward; gross mined cash is the ranking score and never falls when buying supplies. Classic has 100 stages and five mine palettes. Daily has five deterministic stages seeded by the Vietnamese date.

The shop offers carried dynamite and next-stage strength, luck, rock value and diamond value upgrades. Bag rewards are seeded. TNT chains through nearby barrels and destroys adjacent ore. Save version 1 validates economy, geometry, clock, hook payload and stage limits. Restored gameplay starts paused. Shop purchases survive a reload; storage failures leave quick play usable. Reduced motion preserves essential gameplay while removing decorative motion.

“Bắt đầu đào vàng” uses the normal Arcade profile flow. “Chơi nhanh” plays locally without creating a score run or submitting a result. Public production QA uses quick play to avoid test leaderboard entries.

## Validation

- 22 deterministic engine tests: all 100 generated mines, collision ordering, swept diamond catches, weight and strength, cash accounting, deadlines, explosives, bags, shops, boost expiry, save restoration and completion bounds.
- Actual score handler test for Gold classic/daily partitioning, shared identity and plausibility rejection.
- Thirteen browser scenarios in source and compiled output: 320px–desktop layout, actual gold haul, guest score submission in a synthetic fixture, precise carried-object restore, persisted shop purchase, deadline, daily win, page wheel/menu pause, phone portrait/landscape full screen, blocked storage/dark/reduced motion and runtime errors. All API writes stay inside the synthetic fixture.
- Existing shared Arcade/profile tests include Gold; layout audit includes all 122 public pages. Netlify packaging and production asset checks remain required.

Mechanic reference: GameFools, “How to Play the Original Gold Miner Today,” https://www.gamefools.com/blog/post/how-to-play-the-original-gold-miner-today-and-why-it-is-still-one-of-the-best-casual-games . The implementation and art are new NCN work; third-party game assets are not bundled.

## Fullscreen correction

Opening full screen from the welcome state previously let the welcome selector override the mine aspect ratio. Its absolutely positioned canvas and overlay then contributed no intrinsic height; the mine collapsed to a 1px border in both native and fallback full screen. The immersive mine selector now has sufficient specificity to retain its aspect ratio, and a bounded welcome minimum height keeps the phone start controls visible. Normal-page geometry and game rules are unchanged.

Regression coverage first reproduces the 1px failure on the old CSS, then verifies native fullscreen at 1440×900, 2048×1307 and 1280×720 before starting, while playing, paused and back at welcome with a saved run. Separate fallback checks cover desktop and 390×844, 320×640, 844×390 and 667×375 phones, alongside the existing playing tests. Both source and compiled output run the same coverage.
