// Hybrid Netlify Identity for Cloudflare.
//
// The site keeps using Netlify Identity (GoTrue) as its only auth system.
// verifyIdentity() in netlify/lib/ncn-event-api.mjs only ever uses
// `config.url` (it fetches `<url>/user` with the nf_jwt cookie), so on
// Cloudflare we simply point it at the still-live Netlify origin:
//
//   NCN_IDENTITY_BASE=https://strong-vacherin-52625e.netlify.app/.netlify/identity
//
// Set the variable in wrangler.toml [vars] (done) and in the Pages dashboard.
// If it is unset, verifyIdentity fails closed with 503, exactly like a
// Netlify deploy with Identity disabled.
//
// The browser side needs no change: the minified GoTrue client always calls
// same-origin /.netlify/identity, and functions/.netlify/identity/[[path]].js
// proxies those calls to the same Netlify origin server-side.

import {verifyIdentity} from '../../netlify/lib/ncn-event-api.mjs';

export function identityBase(env) {
  return (env?.NCN_IDENTITY_BASE || '').replace(/\/$/, '');
}

// Mirrors the per-function verify deps in netlify/functions/*.mjs, with the
// identity base taken from env instead of @netlify/identity's getIdentityConfig().
export function createVerify(env) {
  const url = identityBase(env);
  return function verify(req, options) {
    return verifyIdentity(req, {url}, fetch, options);
  };
}
