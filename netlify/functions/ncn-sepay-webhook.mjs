import {getStore} from '@netlify/blobs';
import {PAYMENT_STORE} from '../lib/ncn-membership.mjs';
import {createWebhookHandler} from '../lib/ncn-billing-api.mjs';

export default async(request,context)=>createWebhookHandler({
  production:()=>context?.deploy?.context==='production',
  store:()=>getStore({name:PAYMENT_STORE,consistency:'strong'}),
  config:()=>({secret:process.env.SEPAY_WEBHOOK_SECRET||''})
})(request);
