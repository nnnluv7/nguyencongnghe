import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createAnnouncementsHandler} from '../lib/ncn-announcements-api.mjs';

export default (request,context)=>createAnnouncementsHandler({
  production:()=>context?.deploy?.context==='production',
  verify:req=>verifyIdentity(req,getIdentityConfig()),
  store:()=>getStore({name:'ncn-site-announcements-v1',consistency:'strong'})
})(request);
