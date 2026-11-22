// Pages Functions dispatcher for /.netlify/functions/<name>.
//
// This module is the Cloudflare counterpart of the 18 files in
// netlify/functions/*.mjs: it wires the SAME lib handlers (netlify/lib/*,
// untouched) with Cloudflare dependencies instead of Netlify ones:
//   - store: D1+R2 via ./store.mjs (Blobs-compatible, CAS via etag)
//   - verify: Netlify Identity on the still-live Netlify origin (./identity.mjs)
//   - production: NCN_ENVIRONMENT === 'production' (env var, per environment)
//   - config: env vars (SEPAY_WEBHOOK_SECRET, NCN_PAYMENTS_ENABLED)
//   - asset/print: private templates embedded at build time (./private-assets.mjs)
//   - file reads of public/: ASSETS binding (./assets.mjs)
//   - photo: no-sharp validator serving original bytes (./photo.mjs)
//   - stories: ported handler without sharp (./stories.mjs)
//
// The URL path is kept identical to Netlify, so the frontend, _redirects
// rewrites, avatar/story URLs and the SePay webhook URL need no changes.
//
// Differences from the Netlify wiring (all intentional, see IMPLEMENTATION.md):
// - ncn-visitors-cleanup gains the production() guard the other two scheduled
//   functions already have (on Netlify it relied on the scheduler only
//   calling published deploys; the HTTP endpoint itself was unguarded).
// - Avatar responses from ncn-profile/ncn-scores get their Content-Type fixed
//   by sniffing the stored bytes, because originals are stored (not WebP).

import QRCode from 'qrcode/lib/core/qrcode.js';
import EventCore from '../../netlify/lib/ncn-event-private/core.cjs';
import GvgsCore from '../../netlify/lib/ncn-gvgs-private/core.cjs';
import {createAnnouncementsHandler} from '../../netlify/lib/ncn-announcements-api.mjs';
import arcadeHandler from '../../netlify/functions/ncn-arcade.mjs';
import {createAudioHandler} from '../../netlify/lib/ncn-audio-api.mjs';
import {AUDIO_STORE} from '../../netlify/lib/ncn-audio-orders.mjs';
import {BANK, createBillingHandler} from '../../netlify/lib/ncn-billing-api.mjs';
import {createCashFundHandler} from '../../netlify/lib/ncn-cash-fund-api.mjs';
import {createHandler as createEventHandler} from '../../netlify/lib/ncn-event-api.mjs';
import {PAYMENT_STORE} from '../../netlify/lib/ncn-membership.mjs';
import {syncGenkNews} from '../../netlify/lib/ncn-news.mjs';
import {createLibraryPageHandler, injectCatalog} from '../../netlify/lib/ncn-library-page.mjs';
import {createLibraryHandler} from '../../netlify/lib/ncn-library-api.mjs';
import {createProfileHandler} from '../../netlify/lib/ncn-profile-api.mjs';
import {createScoresHandler} from '../../netlify/lib/ncn-scores-api.mjs';
import {createSePayRouter} from '../../netlify/lib/ncn-sepay-router.mjs';
import {createSitePageHandler} from '../../netlify/lib/ncn-site-page.mjs';
import {optimizePublicResponse} from '../../netlify/lib/ncn-public-assets.mjs';
import {createCounterHandler, cleanupPresence} from '../../netlify/lib/ncn-visitor-counter.mjs';
import seed from '../../netlify/lib/ncn-library/seed.json';
import originalBodies from '../../netlify/lib/ncn-library/original-markdown.json';
import pages from '../../netlify/lib/ncn-shell/pages.json';
import {createStoreFactory} from './store.mjs';
import {createVerify} from './identity.mjs';
import {createPublicState} from './public-state.mjs';
import {createAssetReader} from './assets.mjs';
import {cfScorePhoto, sniffImage} from './photo.mjs';
import {createStoriesHandler, cleanupStories} from './stories.mjs';
import loadGV2Assets from './gv2.mjs';
import {EVENT_ASSETS, GVGS_ASSETS, LIBRARY_ASSETS, SHELL_MANIFEST} from './private-assets.mjs';

const jsonHeaders = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'};
const notFound = () => new Response(JSON.stringify({error: 'Không tìm thấy chức năng.'}), {status: 404, headers: jsonHeaders});

// The profile/scores handlers hard-code Content-Type: image/webp because the
// Netlify pipeline re-encodes avatars to WebP. On Cloudflare the original
// bytes are stored, so sniff the real type and fix the header.
async function fixAvatarContentType(request, response) {
  const route = new URL(request.url).searchParams.get('route');
  if (route !== 'avatar' || !response.ok) return response;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const info = sniffImage(bytes);
  if (!info || info.mime === 'image/webp') {
    return new Response(bytes, {status: response.status, headers: response.headers});
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Type', info.mime);
  return new Response(bytes, {status: response.status, headers});
}

function assetGetter(map) {
  return name => {
    const file = map[name];
    if (file === undefined) throw new Error('Missing private asset ' + name);
    return file;
  };
}

export async function handleFunctionRequest(context, segments) {
  const {request, env} = context;
  const name = segments.length === 1 ? segments[0] : null;
  if (!name) return notFound();

  const getStore = createStoreFactory(env);
  const verify = createVerify(env);
  const production = () => env.NCN_ENVIRONMENT === 'production';
  const {currentPublicState, currentNews} = createPublicState(storeName => getStore(storeName));
  // Created lazily: functions that never touch static assets must not fail
  // when ASSETS is unavailable.
  let assets;
  const assetReader = () => (assets || (assets = createAssetReader(env, request)));

  switch (name) {
    case 'ncn-announcements':
      return createAnnouncementsHandler({
        production,
        verify: req => verify(req),
        store: () => getStore('ncn-site-announcements-v1')
      })(request);

    case 'ncn-arcade':
      return arcadeHandler(request);

    case 'ncn-audio':
      return createAudioHandler({
        production,
        paymentReady: () => Boolean(env.SEPAY_WEBHOOK_SECRET?.length >= 32),
        bank: BANK,
        verify: req => verify(req, {includeAudio: true}),
        store: () => getStore(AUDIO_STORE)
      })(request);

    case 'ncn-billing':
      return createBillingHandler({
        production,
        verify: req => verify(req, {includeAvatar: true, includeJoined: true}),
        store: () => getStore(PAYMENT_STORE),
        config: () => ({enabled: env.NCN_PAYMENTS_ENABLED === 'true', secret: env.SEPAY_WEBHOOK_SECRET || ''})
      })(request);

    case 'ncn-cash-fund':
      return createCashFundHandler({
        production,
        verify: req => verify(req),
        store: () => getStore('ncn-cash-fund-v1')
      })(request);

    case 'ncn-event':
      return createEventHandler({
        production,
        verify: req => verify(req),
        memberStore: () => getStore(PAYMENT_STORE),
        store: () => getStore('ncn-event-vip-v1'),
        asset: assetGetter(EVENT_ASSETS),
        print: (items, settings) => EventCore.printable(items, settings, {
          frame: EVENT_ASSETS['stick.png'],
          font: EVENT_ASSETS['mt2-mincap.woff2'],
          qr: code => QRCode.create(code, {errorCorrectionLevel: 'M'}).modules
        })
      })(request);

    case 'ncn-genk-sync': {
      if (!production()) return new Response(null, {status: 204});
      await syncGenkNews(getStore('ncn-genk-feed-v1'));
      return new Response(null, {status: 204});
    }

    case 'ncn-gvgs': {
      let gv2Assets;
      return createEventHandler({
        production,
        verify: req => verify(req),
        memberStore: () => getStore(PAYMENT_STORE),
        store: () => getStore('ncn-gvgs-vip-v1'),
        asset: assetGetter(GVGS_ASSETS),
        print: (items, settings) => GvgsCore.printable(items, settings, {
          gv2: String(settings.format || '').startsWith('popup-gv2-') ? (gv2Assets || (gv2Assets = loadGV2Assets())) : null,
          frame: EVENT_ASSETS['stick.png'],
          font: EVENT_ASSETS['mt2-mincap.woff2'],
          qr: code => QRCode.create(code, {errorCorrectionLevel: 'M'}).modules
        })
      })(request);
    }

    case 'ncn-library-page': {
      const handler = createLibraryPageHandler({
        state: currentPublicState,
        production,
        seed,
        store: () => getStore('ncn-site-library-v1'),
        homeShell: () => assetReader().readShell('index.html'),
        indexShell: () => assetReader().readShell('tin-tuc-cong-nghe/index.html'),
        articleShell: () => LIBRARY_ASSETS['article-shell.html'],
        original: path => assetReader().readShell(path)
      });
      return optimizePublicResponse(await handler(request), SHELL_MANIFEST);
    }

    case 'ncn-library':
      return createLibraryHandler({
        production,
        seed,
        originalBodies,
        news: currentNews,
        verify: req => verify(req),
        store: () => getStore('ncn-site-library-v1'),
        app: view => LIBRARY_ASSETS[view === 'library' ? 'admin-library.html' : 'admin-hub.html']
      })(request);

    case 'ncn-profile': {
      const response = await createProfileHandler({
        production,
        verify: req => verify(req),
        store: () => getStore('ncn-member-avatars-v1'),
        photo: cfScorePhoto
      })(request);
      return fixAvatarContentType(request, response);
    }

    case 'ncn-scores': {
      const response = await createScoresHandler({
        production,
        store: () => getStore('ncn-game-scores-v1'),
        verify: req => verify(req, {includeAvatar: true}),
        photo: cfScorePhoto
      })(request);
      return fixAvatarContentType(request, response);
    }

    case 'ncn-sepay-webhook':
      return createSePayRouter({
        production,
        store: () => getStore(PAYMENT_STORE),
        audioStore: () => getStore(AUDIO_STORE),
        config: () => ({secret: env.SEPAY_WEBHOOK_SECRET || ''})
      })(request);

    case 'ncn-site-page': {
      const handler = createSitePageHandler({
        pages,
        html: page => assetReader().readShell(page),
        state: currentPublicState,
        inject: injectCatalog
      });
      return optimizePublicResponse(await handler(request), SHELL_MANIFEST);
    }

    case 'ncn-stories-cleanup': {
      if (!production()) return new Response(null, {status: 204});
      await cleanupStories(getStore('ncn-community-stories-v1'));
      return new Response(null, {status: 204});
    }

    case 'ncn-stories':
      return createStoriesHandler({
        production,
        store: () => getStore('ncn-community-stories-v1'),
        verify: req => verify(req)
      })(request);

    case 'ncn-visitors-cleanup': {
      if (!production()) return new Response(null, {status: 204});
      const removed = await cleanupPresence(getStore('ncn-visitors-v1'));
      console.info(`NCN visitor counter: removed ${removed} stale presence records`);
      return new Response(null, {status: 204});
    }

    case 'ncn-visitors':
      return createCounterHandler(() => getStore('ncn-visitors-v1'))(request);

    default:
      return notFound();
  }
}
