# Shared website account

The website, quiz profile, `/premium/`, `/in-event/` and `/in-gvgs/` use one Netlify Identity client and the account dialog in `public/assets/ncn-account.js`. Authentication callbacks are consumed once on the page where they arrive. VIP authorization is still checked independently by each private server endpoint.

Existing Identity accounts keep their user ID, manual roles and paid membership ledger. The old Google Apps Script username/password database is not copied. Old website members create a shared account once with the same email; the previous local profile is only an email/name hint. Quiz history continues to use the verified email. Passwords are never sent to the old authentication API by the new interface.

The dialog follows Identity's existing signup settings, including automatic confirmation or email confirmation, without changing those settings. Membership prices, transfer information, SePay processing and server permission checks are unchanged.

Members open the header avatar → **Quản lý tài khoản** to edit their display name and avatar or inspect **Thông tin VIP**. The same panel is available from each Arcade game's **Tài khoản NCN** button. The profile shows the verified email (read-only), join date and name; the VIP card shows paid expiry/remaining days, manual grants, administrator access or expiry/block status from the existing ledger. VIP dates use Vietnam time and the billing endpoint's server clock. Renewal links use the existing `/premium/` flow.

Photo selection previews a centered crop locally. Saving uploads at most a 768px high-quality JPEG crop to the authenticated, same-origin `ncn-profile` function; Sharp decodes it and stores a metadata-free 768px WebP in `ncn-member-avatars-v1`. Small sources are never enlarged. Uploads allow at most 1.2 MB of JSON and keep the existing one-megapixel decode limit. Legacy 192px photos stay readable; their owner can choose the original again from the ranking viewer’s update button, which opens this same account panel. Public immutable URLs identify image contents by SHA-256 and contain no email or account ID. Previews and signed-out users cannot upload. The existing Identity SDK updates only `data.full_name` and optionally `data.avatar_url`; name-only saves preserve the photo and other metadata. Neither member edits nor photo uploads write roles, passwords, email, membership or payment data. Header, session display hints and all six Arcade games refresh after a profile update. Closing discards unsaved edits, and signing out during an upload cannot attach the pending photo to another account.

Run `node --test tests/*.test.cjs tests/*.test.mjs` and `node tests/browser/ncn-account.mjs`. The browser suite uses a synthetic HTTPS origin and intercepted Identity, email and payment routes; it never creates real accounts or orders. `node tests/browser/ncn-scroll-ui.mjs` also verifies FIFO's full-width entry table, all 48 screen circles and its original print dimensions.

`node tests/browser/ncn-profile.mjs` covers the actual avatar and score handlers with a synthetic Identity and paid ledger, profile editing, expiry, manual VIP, upload retry, phone/dark layouts and logout during upload. Its screenshots are fixtures, not production members.

Photo uploads allow 45 seconds and retry one transient failure with the same
image. Content-hash storage remains idempotent; display metadata is changed only
once after a confirmed upload and an unchanged owner session.
