import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createScoresHandler} from '../lib/ncn-scores-api.mjs';
import {scorePhoto} from '../lib/ncn-score-photos.mjs';

export default (req,context)=>createScoresHandler({
 production:()=>context?.deploy?.context==='production',
 store:()=>getStore({name:'ncn-game-scores-v1',consistency:'strong'}),
 verify:req=>verifyIdentity(req,getIdentityConfig(),fetch,{includeAvatar:true}),
 photo:scorePhoto
})(req);
