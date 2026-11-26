import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createStoriesHandler} from '../lib/ncn-stories-api.mjs';
import {engagementKey} from '../lib/ncn-engagement-api.mjs';

export default (req,context)=>createStoriesHandler({
  production:()=>context?.deploy?.context==='production',
  store:()=>getStore({name:'ncn-community-stories-v1',consistency:'strong'}),
  removeCommunity:id=>getStore({name:'ncn-community-engagement-v1',consistency:'strong'}).delete(engagementKey('story',id)),
  verify:request=>verifyIdentity(request,getIdentityConfig())
})(req);
