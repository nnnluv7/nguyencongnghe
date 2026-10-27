# NCN Arcade · 6 games, shared player profiles and public scores

`/arcade/` links Snake, Flight, Pikachu, Ocean, Color Blocks and Bubble Shooter. Each game has
the same glass navigation, player card and leaderboard, and links directly to
the other five games. The existing NCN account/theme/menu implementation is
retained. Each game's controls, local progress and record keys are retained.

## Identity and avatars

- `ncn-scores?route=profile` uses a fresh verified Netlify Identity session for
  members. The account name and available HTTPS profile picture are inherited;
  otherwise an animal portrait is selected automatically. No extra setup step.
- Guests choose a display name and an original SVG portrait, or upload an image.
  A random 256-bit `__Host-ncn_arcade` cookie (Secure, HttpOnly, SameSite=Lax,
  Path=/, one year) identifies the guest on this browser across all six games.
  Cookie reset/new device means a new guest; NCN accounts work across devices.
- Uploaded photos are cropped to 128px in the browser, decoded with a pixel
  limit, re-encoded to 96px WebP on the server and served by content hash.
  SVG uploads, arbitrary URLs, control characters and email display names are
  rejected. Raw Identity IDs, email, cookies and run secrets are never in rows.
- Every public ranking avatar is a keyboard/touch button opening a larger
  portrait with the player name. It works in Top 10, the full paginated list
  and fullscreen games without requiring login or starting a run. Close with
  the close button, Escape or the backdrop; the list keeps its place and games
  remain paused. Existing public avatar URLs are reused; no extra upload is stored.
- Renaming a guest updates their stored best-score entries across the Arcade.
  A guest run can finish under the NCN account if its owner signs in during play.
  Signing out does not permit a guest to claim another account's run.

## Results and pagination

The production-only Netlify function uses `ncn-game-scores-v1` with strong
consistency. No Render connection, database setup, new secret or provider is
required. Nonproduction writes are refused; all automated QA uses memory stores.

The server issues an opaque run ID bound to the verified member or guest,
game, mode and daily date. Issuance runs in parallel with the first game input.
Results update on end, pause and meaningful stage/checkpoint events. Pikachu, Bubble Shooter
and Blocks retain the run ID separately from their existing save formats.
Old local saves can still be played; starting a new run enrolls it in ranking.
Failed submissions remain queued for reconnection/manual retry, with an
in-memory fallback if local storage is blocked. Failed run issuance leaves a
playable local run and a visible explanation rather than claiming a cloud save.

Each game/mode has a separate best per player. Daily scores are additionally
separated by Vietnam date. Modes with different difficulty/time rules do not
mix. There is no combined raw-score sum across unrelated scoring systems.

The board shows ten players; the expanded dialog loads fifty more per page,
automatically when scrolling or via a button, until there are no more entries.
There is no hard total-player cutoff. An immutable score-order candidate key
is written before the per-player best pointer; conditional writes prevent a
lower concurrent best from replacing a higher one. Old candidates are pruned
after a successful replacement; interrupted/concurrent writes are deduplicated
by player when reading. Storage listing pages are combined and explicitly
sorted, without relying on undocumented storage ordering. This lists all keys
for a selected board (not all game data) before fetching that page's rows;
very large communities would benefit from an indexed SQL backend.

These are casual client-side games: nonce ownership, bounds, origin and score
rate checks reject simple abuse, but do not constitute authoritative anti-cheat
or a competitive/prize tournament system. There are no real-time opponents.

## Retired Snake multiplayer

The game no longer imports `online.js`/`lobby.js`, offers Facebook/room controls
or opens WebSockets. `ncn-arcade` returns `ready:false` / HTTP 410 so stale
clients cannot request new tickets. Legacy server/protocol code and its old
data remain archived, separate from the new board. No Render service or user
account is deleted or reconfigured by this change. Old online protocol unit
tests may still run; the retired multiplayer browser suite is no longer CI.

## Validation

- `node --test tests/ncn-scores.test.mjs`: real handler, uploaded photo decoder,
  identity/ownership/origin, retries/concurrency, separated modes, and pagination
  through 1,207 players without duplicates or a total cutoff.
- `node tests/browser/ncn-arcade.mjs`: actual handler on intercepted synthetic
  HTTPS, real guest-cookie/profile/photo flow, actual earned scores in all six
  games, member setup skip, expanded board, retry, storage denial, fullscreen
  dialog placement and delayed run issuance without lost input.
- Existing game, account, site/layout and actual Netlify archive checks remain
  in place. No tests seed or write production leaderboards or accounts.
