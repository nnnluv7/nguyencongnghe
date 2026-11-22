import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/.netlify/identity/[[path]].js';
import {createVerify, identityBase} from '../functions/_cf/identity.mjs';

const BASE = 'https://strong-vacherin-52625e.netlify.app/.netlify/identity';

// The sandbox blocks outbound fetch from the worker, so the live proxy path
// is verified here with a mocked global fetch instead (and must be re-checked
// on the preview deployment).
test('identity proxy: GET forwards path + query to the Netlify origin', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({url, init});
    return new Response(JSON.stringify({external: {}}), {status: 200, headers: {'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': '18'}});
  };
  try {
    const res = await onRequest({
      env: {NCN_IDENTITY_BASE: BASE},
      params: {path: ['settings']},
      request: new Request('https://nguyencongnghe.pages.dev/.netlify/identity/settings?x=1', {headers: {Cookie: 'nf_jwt=abc.def.ghi'}})
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, BASE + '/settings?x=1');
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.redirect, 'manual');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), JSON.stringify({external: {}}));
    // Framing headers are dropped (fetch already decoded the body).
    assert.equal(res.headers.get('content-encoding'), null);
    assert.equal(res.headers.get('content-length'), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('identity proxy: POST forwards the body, redirects pass through, errors 503', async () => {
  const realFetch = globalThis.fetch;
  try {
    // POST with a body.
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = {url, init};
      return new Response('{}', {status: 200});
    };
    await onRequest({
      env: {NCN_IDENTITY_BASE: BASE + '/'},
      params: {path: ['token']},
      request: new Request('https://nguyencongnghe.pages.dev/.netlify/identity/token', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({grant_type: 'refresh_token'})})
    });
    assert.equal(seen.url, BASE + '/token');
    assert.equal(seen.init.method, 'POST');
    assert.equal(new TextDecoder().decode(seen.init.body), JSON.stringify({grant_type: 'refresh_token'}));

    // A 302 (e.g. /authorize -> OAuth provider) passes through untouched.
    globalThis.fetch = async () => new Response(null, {status: 302, headers: {Location: 'https://accounts.google.com/o/oauth2/auth?x=1'}});
    const redirect = await onRequest({
      env: {NCN_IDENTITY_BASE: BASE},
      params: {path: ['authorize']},
      request: new Request('https://nguyencongnghe.pages.dev/.netlify/identity/authorize?provider=google')
    });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), 'https://accounts.google.com/o/oauth2/auth?x=1');

    // Unreachable origin -> 503 JSON, not a thrown error.
    globalThis.fetch = async () => { throw new Error('boom'); };
    const down = await onRequest({
      env: {NCN_IDENTITY_BASE: BASE},
      params: {path: ['settings']},
      request: new Request('https://nguyencongnghe.pages.dev/.netlify/identity/settings')
    });
    assert.equal(down.status, 503);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('identity proxy: unset base -> 503', async () => {
  const res = await onRequest({
    env: {},
    params: {path: ['settings']},
    request: new Request('https://nguyencongnghe.pages.dev/.netlify/identity/settings')
  });
  assert.equal(res.status, 503);
});

test('hybrid verify: reads the user from <base>/user with the nf_jwt cookie', async () => {
  assert.equal(identityBase({NCN_IDENTITY_BASE: BASE + '/'}), BASE);
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({url, init});
    return new Response(JSON.stringify({
      id: 'u1', email: 'a@example.com', confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: {roles: ['vip']}, user_metadata: {full_name: 'Anh A'}
    }), {status: 200});
  };
  try {
    const verify = createVerify({NCN_IDENTITY_BASE: BASE});
    const user = await verify(new Request('https://nguyencongnghe.pages.dev/.netlify/functions/ncn-event?route=me', {headers: {Cookie: 'nf_jwt=header.payload.sig'}}));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, BASE + '/user');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer header.payload.sig');
    assert.deepEqual(user, {id: 'u1', email: 'a@example.com', name: 'Anh A', admin: false, vip: true});
    // No cookie -> null, no fetch.
    const anon = await verify(new Request('https://nguyencongnghe.pages.dev/.netlify/functions/ncn-event?route=me'));
    assert.equal(anon, null);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('hybrid verify: 401 from Identity -> null; unset base -> 503', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', {status: 401});
  try {
    const verify = createVerify({NCN_IDENTITY_BASE: BASE});
    const user = await verify(new Request('https://nguyencongnghe.pages.dev/x', {headers: {Cookie: 'nf_jwt=bad.token.here'}}));
    assert.equal(user, null);
  } finally {
    globalThis.fetch = realFetch;
  }
  const noBase = createVerify({});
  await assert.rejects(
    () => noBase(new Request('https://nguyencongnghe.pages.dev/x', {headers: {Cookie: 'nf_jwt=header.payload.sig'}})),
    e => e.status === 503
  );
});
