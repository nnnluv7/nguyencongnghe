import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getStore} from '@netlify/blobs';
import {readLibrary,publicCatalog} from './ncn-library-api.mjs';
import {readGenkNews,mergeNews} from './ncn-news.mjs';
import {readPublicStories} from './ncn-stories-public.mjs';

const read=path=>JSON.parse(readFileSync(join(process.cwd(),path),'utf8'));
export const publicSeed=read('netlify/lib/ncn-library/seed.json');
export const newsSeed=read('netlify/lib/ncn-news/genk-seed.json');
const store=name=>getStore({name,consistency:'strong'});
export const currentNews=()=>readGenkNews(store('ncn-genk-feed-v1'),newsSeed);
export async function currentPublicState({stories=false}={}){
  const now=Date.now();
  const [library,news,notices,photos]=await Promise.all([
    readLibrary(store('ncn-site-library-v1')),currentNews(),
    store('ncn-site-announcements-v1').get('announcements',{type:'json'}).catch(()=>null),
    stories?readPublicStories(store('ncn-community-stories-v1'),now).catch(()=>[]):Promise.resolve([])
  ]);
  return {index:library?.data,catalog:mergeNews(publicCatalog(publicSeed,library?.data),news),notices:notices?.items||[],stories:photos,now};
}
