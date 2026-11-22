// Small standalone Worker that replaces the three Netlify scheduled
// functions (their `export const config = {schedule}` has no Pages
// equivalent). Each cron trigger fetches the corresponding Pages Function
// URL on the production site; the Function itself checks production() and
// returns 204 immediately on non-production deployments.
//
// Deploy separately from the Pages project:
//   cd worker && wrangler deploy
// (Needs a Cloudflare API token / login; not done yet — see IMPLEMENTATION.md.)

const ROUTES = {
  '*/15 * * * *': '/.netlify/functions/ncn-genk-sync',
  '*/5 * * * *': '/.netlify/functions/ncn-stories-cleanup',
  '0 * * * *': '/.netlify/functions/ncn-visitors-cleanup',
};

export default {
  async scheduled(event, env) {
    const base = (env.NCN_PAGES_URL || '').replace(/\/$/, '');
    const path = ROUTES[event.cron];
    if (!base || !path) return;
    const res = await fetch(base + path, {
      method: 'GET',
      headers: {'User-Agent': 'ncn-cron/1.0'},
    });
    console.log(`NCN cron ${event.cron} -> ${path}: ${res.status}`);
    if (!res.ok) throw new Error(`NCN cron ${event.cron} failed with ${res.status}`);
  },
  async fetch() {
    return new Response('NCN cron worker (scheduled only)', {
      status: 200,
      headers: {'Content-Type': 'text/plain; charset=utf-8'},
    });
  },
};
