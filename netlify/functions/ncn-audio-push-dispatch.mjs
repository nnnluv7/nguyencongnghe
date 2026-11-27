import {getStore} from '@netlify/blobs';
import {AUDIO_STORE} from '../lib/ncn-audio-orders.mjs';
import {dispatchAudioPush,pushCredentials,PUSH_STORE} from '../lib/ncn-push.mjs';
export default async(_req,context)=>{
 if(context?.deploy?.context!=='production')return new Response(null,{status:204});
 await dispatchAudioPush({audio:getStore({name:AUDIO_STORE,consistency:'strong'}),devices:getStore({name:PUSH_STORE,consistency:'strong'}),credentials:pushCredentials()});
 return new Response(null,{status:204});
};
export const config={schedule:'* * * * *'};
