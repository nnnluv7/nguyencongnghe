import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createEngagementHandler} from '../lib/ncn-engagement-api.mjs';
import {createEngagementResolver} from '../lib/ncn-engagement-targets.mjs';
import {publicSeed,newsSeed} from '../lib/ncn-public-state.mjs';

const store=name=>getStore({name,consistency:'strong'});
const resolveTarget=createEngagementResolver({seed:publicSeed,newsSeed,library:()=>store('ncn-site-library-v1'),news:()=>store('ncn-genk-feed-v1'),stories:()=>store('ncn-community-stories-v1')});
export default (req,context)=>createEngagementHandler({
  production:()=>context?.deploy?.context==='production',
  store:()=>store('ncn-community-engagement-v1'),resolveTarget,
  verify:request=>verifyIdentity(request,getIdentityConfig())
})(req);
