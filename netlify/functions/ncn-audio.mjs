import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {BANK} from '../lib/ncn-billing-api.mjs';
import {createAudioHandler} from '../lib/ncn-audio-api.mjs';
import {AUDIO_STORE} from '../lib/ncn-audio-orders.mjs';

export default (req,context)=>createAudioHandler({
 production:()=>context?.deploy?.context==='production',
 paymentReady:()=>Boolean(process.env.SEPAY_WEBHOOK_SECRET?.length>=32),
 bank:BANK,
 verify:request=>verifyIdentity(request,getIdentityConfig(),fetch,{includeAudio:true}),
 store:()=>getStore({name:AUDIO_STORE,consistency:'strong'})
})(req);
