import { getStore } from '@netlify/blobs';
import { cleanupPresence } from '../lib/ncn-visitor-counter.mjs';

// Called by Netlify Scheduler only on a published deploy.
export const config = { schedule: '@hourly' };
export default async function handler() {
  const removed = await cleanupPresence(getStore({ name: 'ncn-visitors-v1', consistency: 'strong' }));
  console.info(`NCN visitor counter: removed ${removed} stale presence records`);
  return new Response(null, { status: 204 });
}
