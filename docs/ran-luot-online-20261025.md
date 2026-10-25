# Rắn Lướt: online play and public rankings

The website stays on Netlify. A single Node 22+ WebSocket service runs the authoritative arena. No new database or paid resource is required: persistent leaderboards and friend-room membership use a separate strongly consistent Netlify Blobs store, `ncn-arcade-v1`.

## Live host configuration

The confirmed workspace is **My Workspace** (`tea-dbf1taa9lscs738gtp1g`). Service `srv-dbf2cr2vcj2c73ejc2j0` was created on the free plan in Singapore. Its public origin is `https://ncn-ran-luot-online.onrender.com`; the initial deploy of `c6a2842` was verified live with HTTP health/key checks and an accepted WSS upgrade (no account joined).

Use **one** web service from `https://github.com/nnnluv7/nguyencongnghe`, branch `main`:

- Name: `ncn-ran-luot-online`
- Runtime: Node; region: Singapore; compute plan: `free`; one instance.
- Build: `npm ci --prefix server/arcade --omit=dev --ignore-scripts`
- Start: `node server/arcade/index.mjs`
- Environment: `NODE_VERSION=22`, `NCN_SITE_URL=https://nguyencongnghe.com`.
- Public readiness endpoint: `/health`. The process binds `0.0.0.0` and the host's `PORT`.

Confirm the specific deploy is `live`, then check `/health`, `/keys`, TLS and a WebSocket handshake. Add the returned HTTPS service origin to `netlify/lib/ncn-arcade/config.json` as `serverURL` and publish that commit. The frontend remains in solo mode while this value is null. Only the public origin is configured; no client or host API keys are placed in Git.

Render's free service can sleep after inactivity; the client waits for its health endpoint before requesting a short-lived join ticket. Do not upgrade to a paid plan without the owner's instruction. Keep one instance: room state is currently held in memory and cross-instance matchmaking is not implemented. Active runs end on a server restart; saved rankings persist on Netlify.

## Sign-in and Facebook setup

Email/password and Facebook use the same existing NCN account controller and Netlify Identity. All online joins are authenticated by a fresh Identity `/user` check, independent of cached browser display data. Facebook buttons appear only when Identity settings explicitly report `providers.facebook=true`.

The live settings checked on 25 October currently report `external.facebook=false`. To activate Facebook, the owner must configure the Facebook provider for this Netlify project's Identity service, including the Meta App's credentials and the redirect URI displayed by the provider configuration. Use that exact displayed URI; do not guess a callback from the site's domain. Complete any Meta requirements for public login using the owner's account. Keep App Secrets and OAuth tokens out of chat, source, screenshots and logs.

The application never promotes Facebook metadata or a browser-supplied role to VIP/ADMIN access. Provider linking and verified email are handled by Identity. The game does not request a Facebook friends graph: users invite friends with a room link instead.

## Server trust and records

- Netlify creates an Ed25519 signing keypair once, retained privately in Blobs with CAS. `/keys` exposes only its public key and ID. Join tickets contain an opaque hashed Identity ID, display name, room, skin, audience, unique run ID and two-minute expiry. They travel in the first WebSocket message, not in URLs, logs or local storage.
- The host verifies signature, audience, expiry and ticket replay, limits one active run per account, checks the website Origin, caps rooms/players and rate-limits input. Clients send only monotonically numbered angle/boost/phase intentions. Physics, collisions, timing and scores run at 30 Hz on the host. Food deltas and interpolated player snapshots drive rendering.
- The host signs terminal results using its own boot-time Ed25519 key. Netlify fetches that public key only from the explicitly configured host origin, then checks signatures and timestamps before updating best scores. Clients cannot submit their local solo score. Repeated or interrupted writes use maximum scores and stable run timestamps, so retries cannot inflate points.
- Public room: guest-readable daily and all-time top 50, with only display names, score, survival time and takedowns. Best-score storage is bounded to the top 1,000 accounts per board. Daily attribution uses the Vietnam date when a run begins. Email, Identity IDs, tokens and run IDs are not returned by leaderboard endpoints.
- Friend rooms: cryptographically random invitation codes, up to 128 registered members and 16 active players. Room boards are restricted to joined accounts and separate from the public-room board. Membership and invitations are never inferred from Facebook friends.
- Online runs last at most three minutes. Leaving, opening navigation/account controls, tab changes or connection loss ends the run; it does not freeze opponents. Idle network input expires. Solo/daily records and XP remain browser-local and separate from online rankings.

## Validation

`npm ci --prefix server/arcade --ignore-scripts --omit=dev`

`node --test tests/*.test.cjs tests/*.test.mjs tests/online-wire.mjs`

`node tests/browser/ncn-snake-online.mjs`

`node tests/browser/ncn-snake.mjs`

`node tests/browser/ncn-account.mjs`

`node tests/netlify-pack.mjs`

Tests use synthetic identities, local HTTP/WebSocket processes and an isolated in-memory store. They never create real accounts, publish real scores or enter production credentials. Facebook browser QA verifies the correct handoff to the Identity provider endpoint, not a real Meta sign-in or app approval.
