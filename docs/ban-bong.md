# Bắn Trứng Khủng Long · NCN Arcade

The existing `/ban-bong/` game now offers 200 stages across 20 prehistoric
biomes. Its `bubble` game key, NCN account/guest profiles, public leaderboard,
shared navigation, fullscreen and screen wake lock remain integrated. No
other game's saves or rules change.

## Rules and challenge

- Match three adjacent eggs of one colour; unsupported eggs fall with the
  group. Side-wall reflections and free swapping remain.
- Later stages use denser mixed layouts, up to six colours and eleven initial
  rows. Large ready-made colour slabs are capped during generation.
- Journey/daily pressure comes from both missed matches and active foreground
  time. The countdown ranges from 90 seconds in the tutorial to 28 seconds
  in the final checkpoint; a successful match cannot turn back that clock.
- A timed row waits until any flying egg has landed. Pausing, dialogs, menus,
  switching apps and leaving the page freeze active time.
- Stone eggs appear from difficulty 31. They cannot colour-match or enter
  the ammunition queue, but fall when cut free and can be removed by a bomb.
- Journey rainbow eggs appear at five-stage milestones and bombs at ten-stage
  checkpoints, after the introductory supply. Later aiming guides are shorter.
- Relax mode keeps all 200 stages, both special eggs per stage and the full
  guide, with neither timer nor pressure rows. Daily mode stays five seeded
  stages with identical starting boards and special supplies for everyone.

## Rendering

`dinosaur.js` builds an original lit WebGL mascot without a 3D library, model
request or external asset. Its transparent 320×202 sprite is cached at 24fps;
reduced motion freezes its idle movement. Inactive welcome/result/pause screens
render only when changed, so a paused game does not keep repainting its 3D scene. Unsupported/lost WebGL uses a
shaded Canvas fallback and does not prevent play. Egg textures, spots, shell
particles, stone cracks, ferns and biome backdrops are cached Canvas artwork.
The cover and welcome art embed the same original mascot and have no external
SVG dependencies. The surrounding NCN Liquid Glass UI retains its shared theme.

## Compatibility and scores

Local keys remain `ncn-bubble-save-v1`, `ncn-bubble-progress-v1` and
`ncn-bubble-prefs-v1`; their validated game/progress payloads now use version 2.
Version 1 boards, counters and stars are migrated. Completed old stage 60 opens
stage 61, and an old final save becomes a cleared stage 60 that can advance.
Corrupt/out-of-bounds saves still fail closed; denied storage leaves play usable.

The score handler accepts campaign stages through 200 and daily stages through 5
for this game only; other games retain the existing 100-stage request bound.
Player/run ownership, score-rate checks, pending offline submissions and public
ranking history are preserved.

## Verification

- `node --test tests/ncn-bubble.test.mjs tests/ncn-scores.test.mjs`
- `node --test tests/*.test.mjs`
- `node tests/browser/ncn-bubble.mjs`
- `node scripts/build-public.mjs && node tests/ncn-performance-build.mjs`
- `NCN_BUILT_TEST=1 node tests/browser/ncn-bubble.mjs`

Browser fixtures use synthetic accounts and the real score handler, with no
production writes. They cover guest/member play, stage 200 completion, stage 60
migration, the timed fall/pause boundary, WebGL and fallback, touch gestures,
fullscreen/wake lock, blocked storage and discovery through NCN's eight-game hub.

## Embedded scrolling

In normal page mode, vertical wheel and trackpad gestures over the game scroll
the document directly, including the first gesture over a long overlay. Ctrl/Meta
zoom and horizontal gestures retain browser behavior. Scrolling cancels a held
aim gesture so releasing the mouse cannot accidentally fire an egg. A long saved-game welcome uses
safe end alignment so its heading remains reachable on small screens.
Fullscreen alone contains overlay overscroll and locks the surrounding page.
The canvas retains its touch aim/drag controls. The browser regression checks
normal wheel scrolling over the welcome, active canvas, pause and results,
a short screen with Continue visible, and the fullscreen enter/exit boundary.
