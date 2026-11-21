# Opening authenticated tools

Show the real blank form from its canonical template in the initial HTML. Do not build a second placeholder interface, a full-page waiting card or a spinner.

- Register the blank VIP form in `manifest.toolTemplates` during the build. The server and static pages use that same template; private data and executable editor code stay behind the authenticated endpoint.
- Use `setAccessView` to keep controls inert until the tool itself confirms access. The general account menu refresh runs in parallel and must not delay the tool.
- Declare `data-ncn-access-endpoint` with `?route=app&bundle=1` for the shared print tools. The authenticated opening response contains the form, core, UI and initial catalogue snapshot. Do not re-request each part separately.
- Reuse the canonical form when its hash matches. Release the consumed boot payload and remove temporary script nodes after execution.
- Keep writes and prints independently authorized on the server. Clear private content on logout, account changes and permission revocation. Never cache financial records or authorization in public HTML or browser storage.
- Keep an unknown cash balance as an em dash. Show real permission or connection errors with a retry action.
