import {getStore} from '@netlify/blobs';
import {PAYMENT_STORE} from '../lib/ncn-membership.mjs';
import {createSePayRouter} from '../lib/ncn-sepay-router.mjs';
import {AUDIO_STORE} from '../lib/ncn-audio-orders.mjs';

export default async(request,context)=>createSePayRouter({
  production:()=>context?.deploy?.context==='production',
  store:()=>getStore({name:PAYMENT_STORE,consistency:'strong'}),
  audioStore:()=>getStore({name:AUDIO_STORE,consistency:'strong'}),
  config:()=>({secret:process.env.SEPAY_WEBHOOK_SECRET||''})
})(request);
