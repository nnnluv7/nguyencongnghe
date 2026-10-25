import {getStore} from '@netlify/blobs';
import {syncGenkNews} from '../lib/ncn-news.mjs';

export default async (_req,context)=>{
  if(context?.deploy?.context!=='production')return new Response(null,{status:204});
  await syncGenkNews(getStore({name:'ncn-genk-feed-v1',consistency:'strong'}));
  return new Response(null,{status:204});
};
export const config={schedule:'*/15 * * * *'};
