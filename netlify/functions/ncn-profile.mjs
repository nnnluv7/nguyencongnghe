import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {scorePhoto} from '../lib/ncn-score-photos.mjs';
import {createProfileHandler} from '../lib/ncn-profile-api.mjs';
export default (req,context)=>createProfileHandler({production:()=>context?.deploy?.context==='production',verify:request=>verifyIdentity(request,getIdentityConfig()),store:()=>getStore({name:'ncn-member-avatars-v1',consistency:'strong'}),photo:bytes=>scorePhoto(bytes,192)})(req);
