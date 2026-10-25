# Cá lớn nuốt cá bé — NCN Arcade

`/ca-lon-nuot-ca-be/` is an original browser game inspired by childhood fish-eating
arcade games. All fish, scenery, sprites, cover artwork and sounds are drawn or
synthesized locally; no original Feeding Frenzy assets or third-party runtime
services are used.

Six regions grow the player from size 20 to 86. A prey ring uses the same 82%
size rule as collision handling. Small prey unlock gradually; large fish remain
part of the ecosystem rather than growing in lockstep with the player. The final
region requires eight large catches. Three lives, post-hit protection, a finite
shield, collectible hearts/pearls, a replenishable dash and bounded combo/fever
timers create a complete run and replay loop.

Mouse, arrows/WASD and touch drag share the same movement input. Space/Shift or
the onscreen control dashes; P/Esc pause. Opening shared navigation, the account
menu, help or a different tab pauses the simulation. Continuing is explicit.
Reduced effects, muted-by-default optional audio, keyboard focus and responsive
layouts are supported.

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
