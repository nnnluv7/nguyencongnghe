// Same-origin proxy for Netlify Identity (GoTrue).
//
// The frontend's minified GoTrue client always calls /.netlify/identity on
// the current origin. That endpoint does not exist on Cloudflare, so this
// Function forwards the call server-side to the still-live Netlify origin
// (NCN_IDENTITY_BASE). No frontend change is needed: login, signup, email
// confirmation, password recovery and token refresh keep working, and the
// nf_jwt cookie the client sets stays same-site on the Cloudflare domain.
//
// Only the fixed Identity origin is ever proxied to; the request path is
// appended to it. Redirects (e.g. /authorize -> OAuth provider) are passed
// through untouched with redirect:'manual'.

export async function onRequest(context) {
  const base = (context.env.NCN_IDENTITY_BASE || '').replace(/\/$/, '');
  if (!base) {
    return new Response(JSON.stringify({error: 'Netlify Identity is not configured.'}), {
      status: 503, headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
  }
  const segments = context.params.path || [];
  const url = new URL(context.request.url);
  const target = base + '/' + segments.map(s => encodeURIComponent(s)).join('/') + url.search;

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.delete('content-length');
  const init = {method: context.request.method, headers, redirect: 'manual'};
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = await context.request.arrayBuffer();
  }
  let res;
  try {
    res = await fetch(target, init);
  } catch {
    return new Response(JSON.stringify({error: 'Identity service is unavailable.'}), {
      status: 503, headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
  }
  // fetch() already decodes the body; drop the now-wrong framing headers.
  const outHeaders = new Headers(res.headers);
  outHeaders.delete('content-encoding');
  outHeaders.delete('content-length');
  return new Response(res.body, {status: res.status, statusText: res.statusText, headers: outHeaders});
}
