import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createStoriesHandler} from '../lib/ncn-stories-api.mjs';

export default (req,context)=>createStoriesHandler({
  production:()=>context?.deploy?.context==='production',
  store:()=>getStore({name:'ncn-community-stories-v1',consistency:'strong'}),
  verify:request=>verifyIdentity(request,getIdentityConfig())
})(req);
