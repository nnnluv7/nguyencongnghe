# Shared website account

The website, quiz profile, `/premium/`, `/in-event/` and `/in-gvgs/` use one Netlify Identity client and the account dialog in `public/assets/ncn-account.js`. Authentication callbacks are consumed once on the page where they arrive. VIP authorization is still checked independently by each private server endpoint.

Existing Identity accounts keep their user ID, manual roles and paid membership ledger. The old Google Apps Script username/password database is not copied. Old website members create a shared account once with the same email; the previous local profile is only an email/name hint. Quiz history continues to use the verified email. Passwords are never sent to the old authentication API by the new interface.

The dialog follows Identity's existing signup settings, including automatic confirmation or email confirmation, without changing those settings. Membership prices, transfer information, SePay processing and server permission checks are unchanged.

Run `node --test tests/*.test.cjs tests/*.test.mjs` and `node tests/browser/ncn-account.mjs`. The browser suite uses a synthetic HTTPS origin and intercepted Identity, email and payment routes; it never creates real accounts or orders. `node tests/browser/ncn-scroll-ui.mjs` also verifies FIFO's full-width entry table, all 48 screen circles and its original print dimensions.
