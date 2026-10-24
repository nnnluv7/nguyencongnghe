# Shared account continuity and Liquid Glass controls

Account buttons in the header inherited native browser borders while the surrounding menu already used Liquid Glass. The new shared controls style the dropdown, login/register segments, inputs and primary action consistently in light and dark mode.

Full page navigation previously rendered guest controls immediately, then called the shared profile endpoint, the private tool's permission endpoint, and finally its app endpoint. Premium performed another copy of the shared profile request. Unchanged profile refreshes also repainted controls and caused another private permission check.

The account now restores only a short-lived display hint from sessionStorage while the server verifies the session. The hint contains id, email and name; it is matched to the current cookie subject and is never copied into authenticated state, quiz identity, administrative controls or private access decisions. No token, password, entitlement or private tool content is cached there.

Concurrent profile refreshes share one request. Quiet refreshes within 15 seconds reuse the already verified in-memory result, while sign-in, manual verification, entitlement activation and restored browser pages can force a fresh check. Unchanged users no longer trigger account-change events or replace active controls. Transient network failures keep an existing verified editor open; explicit authentication failures and logout clear the account.

Event and GVGS use the shared verified account and request their server-protected app directly, avoiding a redundant permission request. The initial gate uses a neutral loading state instead of displaying signed-out actions. Periodic/visibility role refresh belongs to the shared account. Revocation or account/admin-role changes clear private tools, and all private APIs retain their existing server checks.

Verification includes display-hint expiry/subject mismatch/role exclusion, the existing account/browser fixture suite, delayed session restoration across navigation, concurrent refresh deduplication, retained editor input, transient failures, cross-tab logout, revoked VIP access, and responsive Liquid Glass screenshots. Identity and payment interactions in those browser tests use a synthetic HTTPS origin and no production account writes.
