import {getStore} from '@netlify/blobs';
import {cleanupStories} from '../lib/ncn-stories-api.mjs';
import {cleanupEngagement,engagementKey} from '../lib/ncn-engagement-api.mjs';

export default async (_req,context)=>{
  if(context?.deploy?.context!=='production')return new Response(null,{status:204});
  const community=getStore({name:'ncn-community-engagement-v1',consistency:'strong'});
  await cleanupStories(getStore({name:'ncn-community-stories-v1',consistency:'strong'}),Date.now(),id=>community.delete(engagementKey('story',id)));
  await cleanupEngagement(community);
  return new Response(null,{status:204});
};
export const config={schedule:'*/5 * * * *'};
