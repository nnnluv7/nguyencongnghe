// One in-flight server check, scoped to this page and the current cookie.
// No roles, account response or credentials are cached across navigations.
export function startAccountPrefetch(win, doc, toolEndpoint = null) {
  try {
    if (win.NCNAccountPrefetch || /(?:access_token|confirmation_token|recovery_token|invite_token|email_change_token)=/.test(win.location.hash)) return;
    const token = decodeURIComponent(doc.cookie.match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1] || '');
    const claims = JSON.parse(win.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof claims.sub !== 'string' || !(claims.exp * 1000 > Date.now() + 60000)) return;
    const response = win.fetch('/.netlify/functions/ncn-billing?route=me', {
      credentials: 'same-origin', cache: 'no-store', signal: win.AbortSignal.timeout(12000)
    });
    response.catch(() => {});
    win.NCNAccountPrefetch = { token, response };
    if (typeof toolEndpoint === 'string' && /^\/\.netlify\/functions\/ncn-[a-z-]+(?:\?route=app(?:&(?:view=[a-z-]+|bundle=1))?)?$/.test(toolEndpoint)) {
      const response = win.fetch(toolEndpoint, {
        credentials: 'same-origin', cache: 'no-store', signal: win.AbortSignal.timeout(20000)
      });
      response.catch(() => {});
      win.NCNToolPrefetch = { token, endpoint: toolEndpoint, response };
    }
  } catch { /* Guests and expired sessions use the normal session restore. */ }
}

export function takeToolPrefetch(win, doc, endpoint) {
  const pending = win.NCNToolPrefetch;
  delete win.NCNToolPrefetch;
  if (!pending || pending.endpoint !== endpoint) return null;
  try {
    const token = decodeURIComponent(doc.cookie.match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1] || '');
    return token && token === pending.token ? pending.response : null;
  } catch { return null; }
}

export function takeAccountPrefetch(win, doc) {
  const pending = win.NCNAccountPrefetch;
  delete win.NCNAccountPrefetch;
  if (!pending) return null;
  try {
    const token = decodeURIComponent(doc.cookie.match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1] || '');
    return token && token === pending.token ? pending.response : null;
  } catch { return null; }
}
