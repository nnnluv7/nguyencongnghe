import { getStore, getDeployStore } from '@netlify/blobs';
import { createCounterHandler } from '../lib/ncn-visitor-counter.mjs';

const STORE = 'ncn-visitors-v1';
export default async function handler(request, context) {
  // Preview and branch deployments must not modify live visitor totals.
  const store = () => context?.deploy?.context === 'production'
    ? getStore({ name: STORE, consistency: 'strong' })
    : getDeployStore({ name: STORE, consistency: 'strong' });
  return createCounterHandler(store)(request);
}
