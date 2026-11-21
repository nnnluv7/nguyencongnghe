# Authenticated tool pages

Show the public tool layout on the first HTML response. Fetch access and data in the background. Do not add a full-page loading gate, spinner or “Mở công cụ của bạn” message.

- Use `publicToolFrame` and `setAccessView` from `public/assets/ncn-access-view.js`. Public frames contain no records, prices, roles or private editor code.
- Pages using `vip-app` and the shared VIP/Admin loaders receive this public layout through `preparePublicTools`, in both static builds and server-rendered responses.
- Declare a read-only opening endpoint with `data-ncn-access-endpoint` on the tool root. The common head starts it alongside the account request for an existing, unexpired session. Consume it with `takeToolPrefetch`; it is bound to the current cookie and consumed once.
- Keep controls inert until their authenticated endpoint succeeds. Show the normal sign-in, permission or retry view when appropriate. Clear all private content on logout or account changes.
- Use an em dash for an unknown balance, rather than zero. Do not cache financial data, authorization or private editor code in the public HTML or browser storage to skip verification.
