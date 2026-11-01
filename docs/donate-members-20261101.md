# NCN donations and member tools — 2026-11-01

The existing `/premium/` route now accepts voluntary donations. Presets are conveniences; visitors can enter any positive whole VND amount within the QR field's 13-digit limit, or leave it blank and choose an amount in their banking app. Guests and members use the same page. QR preparation is a public, read-only request and creates no order, account, membership or transfer. The existing VietinBank receiving details are retained. Bank transfer details remain readable if either QR preparation or the external QR image fails.

Every page and the dynamic article shell have a static DONATE button in the header and a matching footer invitation. The heart, rose-tinted glass, directional rim and white label distinguish this action from the blue menu and neutral tools. It is visible before scripts load, including on phones where the previous link was hidden. Narrow toolbars use two rows to retain search, the live clock, theme and account controls without overlap. The menu and homepage catalogue use the same wording. There are no donation popups, floating banners, shared-page payment requests or polling. These links are hidden in print; the existing full-screen game surfaces contain no donation controls.

## Access

A fresh Netlify Identity `/user` response still verifies the session, email confirmation and banned status. A confirmed, unbanned NCN member can open Event and Giờ Vàng VIP without buying, renewing or donating. Browser metadata and cached display profiles do not open the tools. Account status requests and both tool functions no longer read the historical payment ledger. Only server-owned ADMIN roles allow publishing, deleting catalogues and downloading the administrative bridge; ordinary member print prices still come from the server catalogue.

`withMemberVip` expresses the current member policy. `withPaidVip` remains a historical receipt helper and is not used to authorize production tool routes. `/plans` returns no active paid plans, and POST `/create-order` returns 410 so an old cached page cannot keep selling a retired subscription. Existing member, order and transaction records are not rewritten or removed.

## Receipts

Authenticated users can expand their historical receipt list. ADMIN can expand the transaction and old-plan records, including the existing legacy reconciliation flow. A previously issued order can still settle with signed SePay notifications and its existing idempotent grant marker. These old grants do not decide current tool access.

A properly signed incoming transfer to the configured bank/account containing `NCN DONATE` and no old order code is recorded as `donated`, using the actual bank amount. It never creates a user grant. Replays, conflicting provider IDs and reused bank references retain the existing checks. Donations cannot later be reconciled into legacy orders. QR generation works even when payment-plan enablement is off or the SePay secret has not been configured; no successful donation is claimed from browser actions alone.

## Validation

- All Node unit suites, including real member access, confirmation/bans, guest restrictions, ADMIN separation, retired order creation, arbitrary/open donation amounts, signed webhook replays, duplicate bank references, donation/legacy separation and old receipt settlement.
- Production build and all-page asset/SRI checks.
- Isolated compiled-browser donation, shared-account and profile suites: custom/preset amounts, invalid values, stale responses, QR/API failure recovery, cross-page login/logout, retained avatars/scores, 320px phones, iPhone-size screens, desktop, dark mode and print.
- Header action checks cover eleven viewport widths, both themes, a minimum 44px target, full visible label, text contrast, navigation overlap and direct guest navigation to the donation page.
- No production accounts, scores, bank transfers or payment receipts are created by the tests.
