import {getStore} from '@netlify/blobs';
import {getIdentityConfig} from '@netlify/identity';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createPushHandler,pushCredentials,PUSH_STORE} from '../lib/ncn-push.mjs';
export default (req,context)=>createPushHandler({production:()=>context?.deploy?.context==='production',store:()=>getStore({name:PUSH_STORE,consistency:'strong'}),verify:req=>verifyIdentity(req,getIdentityConfig()),credentials:()=>pushCredentials()})(req);
