import { getIdentityConfig } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import { verifyIdentity } from '../lib/ncn-event-api.mjs';
import { createCashFundHandler } from '../lib/ncn-cash-fund-api.mjs';

export default (req, context) => createCashFundHandler({
  production: () => context?.deploy?.context === 'production',
  verify: request => verifyIdentity(request, getIdentityConfig(), fetch, { includeCashFund: true }),
  store: () => getStore({ name: 'ncn-cash-fund-v1', consistency: 'strong' })
})(req);
