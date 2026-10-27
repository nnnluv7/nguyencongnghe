# Bắn Bóng Tuổi Thơ

`/ban-bong/` is the sixth free NCN Arcade game. It uses the existing website
account, guest avatar/profile, game navigation and public score service. No new
service, credentials, database or paid infrastructure is needed.

## Rules and modes

The pure deterministic engine in `public/ban-bong/core.js` uses a staggered hex
grid. Shots collide with the first bubble/ceiling and reflect from side walls.
Three or more connected balls of the same colour burst; any group disconnected
from the ceiling falls. Consecutive matches multiply points, up to ×5. Colours
that disappear from the board disappear from the next-ball queue too.

- **Hành trình:** 60 stages through six colour worlds. Misses eventually add a
  row, with a shorter allowance in later stages. Reaching the lower line loses.
- **Thư giãn:** the same 60-stage journey without pressure rows or a timer.
  Shooting without matching can still fill the board to its lower boundary.
- **Hôm nay:** five deterministic stages shared by everyone on the same Vietnam
  calendar date. Its public ranking is separate for each day. An old daily save
  is not offered as a continuation on the next date.

Each stage has one rainbow ball (adopts the hit colour) and one area bomb.
Swapping the current/next ball costs no shot and does not create new colours.
One to three stars reflect stage accuracy. Journey and Relax progress are
separate. Stage transitions retain a run's cumulative score; restarting starts
with zero, while unlocked stages and stars remain.

## Interaction and rendering

Touch/drag aims and release fires. Mouse hover/click works too. ←/→ aim, Space
or ↑ shoots, X swaps, 1/2 select specials, P pauses and F opens fullscreen.
Inputs in forms and open site menus/dialogs do not control the game. Interrupted
pointer gestures never shoot. Shared menus, tab hiding and page exit pause play.

Canvas marbles use cached shaded textures, colour symbols, reflected aim dots,
pop particles and falling balls. Assets are original canvas/SVG, with no remote
game images, libraries or sound downloads. Audio is generated after interaction.
Reduced-effects and sound choices persist locally.

The existing fullscreen/wake-lock controller now accepts class names, retaining
the Blocks defaults. The new game uses its own layout classes, native fullscreen
when available and a fixed-layout fallback otherwise. Wake Lock is requested
only while fullscreen is active and released on exit/backgrounding. A denied or
unsupported request is visible and does not block gameplay.

## Saving and public scores

`ncn-bubble-save-v1`, `ncn-bubble-progress-v1` and `ncn-bubble-prefs-v1` are new
keys; other games' saves are untouched. Saves validate grid geometry, counters,
palette, mode/date and stage bounds. Storage denial leaves play available and
shows that local progress cannot be saved. Replacing a live save asks for an
explicit in-game choice.

The shared score key is `bubble`, with `journey`, `relax` and `daily` modes. The
existing opaque player/run binding, top-ten preview, complete paginated board
and offline submission queue apply. A restored local save without its original
Arcade run remains playable locally; a new run enrolls it in public ranking.
The score guard remains a casual-client plausibility check, not authoritative
anti-cheat verification.

## Verification

- `node --test tests/ncn-bubble.test.mjs`: hex geometry, first collisions and
  reflections, matching/falling, offset-preserving row additions, queue/specials,
  end stages, save validation and randomized cell conservation.
- `node tests/browser/ncn-bubble.mjs`: responsive layouts, real earned scores
  through the actual score handler, guest/member profiles, pointer/keyboard
  input, pause/reload, daily dates, locked stages, specials, fullscreen/wake lock,
  reduced effects and storage denial on a synthetic HTTPS origin.
- Shared Arcade/profile tests include all six games. Tests never create
  production accounts, avatars or scores.

Run `node scripts/sync-site-config.mjs` after changing the website catalogue and
`node scripts/sync-arcade-nav.mjs` after changing the Arcade catalogue. These keep
the initial HTML navigation and hydrated views consistent.
