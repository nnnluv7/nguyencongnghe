import {getStore} from '@netlify/blobs';
import {cleanupStories} from '../lib/ncn-stories-api.mjs';

export default async (_req,context)=>{
  if(context?.deploy?.context!=='production')return new Response(null,{status:204});
  await cleanupStories(getStore({name:'ncn-community-stories-v1',consistency:'strong'}));
  return new Response(null,{status:204});
};
export const config={schedule:'*/5 * * * *'};
