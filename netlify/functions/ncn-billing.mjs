import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {PAYMENT_STORE} from '../lib/ncn-membership.mjs';
import {createBillingHandler} from '../lib/ncn-billing-api.mjs';

export default async(request,context)=>createBillingHandler({
  production:()=>context?.deploy?.context==='production',
  verify:req=>verifyIdentity(req,getIdentityConfig(),fetch,{includeAvatar:true,includeJoined:true}),
  store:()=>getStore({name:PAYMENT_STORE,consistency:'strong'}),
  config:()=>({enabled:process.env.NCN_PAYMENTS_ENABLED==='true',secret:process.env.SEPAY_WEBHOOK_SECRET||''})
})(request);
