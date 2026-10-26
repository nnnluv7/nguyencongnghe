# Cá lớn nuốt cá bé — NCN Arcade

`/ca-lon-nuot-ca-be/` is an original browser game inspired by childhood fish-eating
arcade games. All fish, scenery, sprites, cover artwork and sounds are drawn or
synthesized locally; no original Feeding Frenzy assets or third-party runtime
services are used.

Six regions grow the player from size 24 to 118. Food has at most 90% of the
player's size; fish above 112% are dangerous, with a harmless neutral band in
between. Eating has a generous collision radius, while predator contact is
stricter. Fourteen species include clownfish, angelfish, butterflyfish, pink
reef fish, wrasse and blue tangs. The ecosystem targets 90 fish, bounded at 120,
and replenishes nearby edible schools instead of leaving a phone viewport empty.
About 82% of ordinary spawns are edible. Sharks do not spawn in the first two
regions, and initial predators are kept away from the player. There are eight
seconds of opening protection and four after damage. Growth remains a six-region
journey with gradually rising food targets; the final region requires eight large
catches. Local records and their storage format are preserved.

Desktop mouse and arrows/WASD keep their controls. Phones have an always-visible,
fixed left joystick, a right dash button and optional touch-drag steering in the
sea. The chosen heading keeps moving after release, like NCN Snake. Separate
pointer IDs allow steering and a second-finger dash together. Pointer cancellation,
pause and restart clear held input. On phones, play begins with an immediate
scroll to the board, and the board height fits the visible viewport so controls
remain reachable even on short screens. Space/Shift dashes; P/Esc pause. Shared
navigation, account, help and tab switching pause the simulation, with explicit
resume. Reduced effects and muted-by-default optional sound remain available.

Fish bodies are shaded with rounded highlights, a darker rim/belly, patterned
skins, detailed wet eyes and separate animated fins/tails. Species have different
body silhouettes. The player has a persistent marker, a bite animation and a bright
rim. Lighting and patterns are baked into a bounded sprite cache (at most 24
384×320 canvases), then composed with moving fins; they are not regenerated for
every fish on every frame. This is a 3D appearance rendered in Canvas 2D, with no
WebGL engine or external asset downloads. Nearby predator rings are never dropped
because of a prey-hint limit. Phone zoom shows more of the surrounding ecosystem, and the camera follows the player through ocean edges so the fish stays away from the HUD and thumb controls.

The existing NCN Liquid Glass shell owns navigation, account/ADMIN verification,
announcements, clock, theme and scrolling. The game owns only its Canvas scene
and a bounded browser-local record under `ncn:fish:record:v1`. Scores are local,
not an online leaderboard or an authentication/permission source. Server-side
content and user data are unchanged by gameplay.

Registration updates shared config, initial menus/cards, Library metadata,
sitemap and whitelisted public-shell routes. `scripts/sync-site-config.mjs`
now handles every registered arcade entry instead of a single hardcoded game.

Run `node --test tests/ncn-fish.test.mjs` for deterministic simulation and routing
coverage, and `node tests/browser/ncn-fish.mjs` for isolated desktop/phone/touch
and shared-shell checks. CI also runs the existing site checks. No production
account or game writes are needed for validation.

The mobile follow-up is covered by deterministic density, beginner progression,
neutral-fish and forgiving-collision checks, as well as real browser touch input,
coasting after release, simultaneous steering/dash, pause/resume and short-screen
control placement. The existing public account, search, wheel-scrolling, theme,
record and storage-denial regressions remain enabled.
