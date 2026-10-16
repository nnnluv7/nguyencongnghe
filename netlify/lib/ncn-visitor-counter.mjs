/** Site counters on Netlify Blobs. One visit = one anonymous browser-tab session. */
export const ONLINE_BUCKET_MS = 30_000;
const ONLINE_BUCKETS = 4; // Approx. 2 minutes of activity.
const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function vietnamDay(now = Date.now()) {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function increment(store, key) {
  // Compare-and-swap avoids lost increments from concurrent function calls.
  for (let attempt = 0; attempt < 20; attempt++) {
    const previous = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const current = Number(previous?.data?.count || 0);
    const options = previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true };
    const result = await store.setJSON(key, { count: current + 1 }, options);
    if (result.modified) return;
  }
  throw new Error('Counter write conflict');
}

async function countOnline(store, now) {
  const currentBucket = Math.floor(now / ONLINE_BUCKET_MS);
  const buckets = Array.from({ length: ONLINE_BUCKETS }, (_, i) => currentBucket - i);
  const pages = await Promise.all(buckets.map(bucket => store.list({ prefix: `online/${bucket}/` })));
  const sessions = new Set();
  for (const page of pages) for (const blob of page.blobs) sessions.add(blob.key.split('/').pop());
  return sessions.size;
}

async function statistics(store, now) {
  const day = vietnamDay(now);
  const [total, today, online] = await Promise.all([
    store.get(`counts/total`, { type: 'json', consistency: 'strong' }),
    store.get(`counts/day/${day}`, { type: 'json', consistency: 'strong' }),
    countOnline(store, now),
  ]);
  return { online, total: Number(total?.count || 0), today: Number(today?.count || 0), date: day };
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export function createCounterHandler(getStore, clock = Date.now) {
  return async function handler(request) {
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const store = getStore();
      if (request.method === 'GET') return json(await statistics(store, clock()));
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origin denied' }, 403);
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'JSON required' }, 415);
      const bodyText = await request.text();
      if (bodyText.length > 512) return json({ error: 'Request too large' }, 413);
      const body = JSON.parse(bodyText);
      const id = String(body.id || '');
      if (!SESSION_PATTERN.test(id) || typeof body.visit !== 'boolean') return json({ error: 'Invalid session' }, 400);
      const now = clock();
      const day = vietnamDay(now);
      // Presence is bucketed; updates to the same bucket are idempotent.
      await store.set(`online/${Math.floor(now / ONLINE_BUCKET_MS)}/${id}`, '1', { onlyIfNew: true });
      if (body.visit) {
        const firstEver = await store.set(`visit/${id}`, day, { onlyIfNew: true });
        if (firstEver.modified) await increment(store, 'counts/total');
      }
      // A session crossing midnight contributes once to each day's visits.
      const firstToday = await store.set(`day/${day}/${id}`, '1', { onlyIfNew: true });
      if (firstToday.modified) await increment(store, `counts/day/${day}`);
      return json(await statistics(store, now));
    } catch (error) {
      console.error('NCN visitor counter:', error);
      return json({ error: 'Counter temporarily unavailable' }, 503);
    }
  };
}

export async function cleanupPresence(store, now = Date.now()) {
  const cutoff = Math.floor(now / ONLINE_BUCKET_MS) - 8;
  let removed = 0;
  for await (const page of store.list({ prefix: 'online/', paginate: true })) {
    for (const blob of page.blobs) {
      const bucket = Number(blob.key.split('/')[1]);
      if (Number.isSafeInteger(bucket) && bucket < cutoff) {
        await store.delete(blob.key);
        removed++;
      }
    }
  }
  return removed;
}
