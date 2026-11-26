import {mergedLibrary,readLibrary} from './ncn-library-api.mjs';
import {readGenkArticle} from './ncn-news.mjs';

export function createEngagementResolver({seed,newsSeed=[],library,news,stories}){return async (kind,id,now=Date.now())=>{
  if(kind==='story'){
    const index=await stories().get('index',{type:'json'}),item=index?.items?.find(x=>x.id===id);
    return item?.state==='active'&&Date.parse(item.expiresAt)>now?{expiresAt:item.expiresAt}:null;
  }
  if(kind!=='article')return null;
  if(id.startsWith('rss-genk-'))return await readGenkArticle(news(),id,newsSeed)?{}:null;
  const index=await readLibrary(library()),item=mergedLibrary(seed,index?.data).find(x=>x.id===id);
  return item?.status==='published'&&(item.kind==='article'||item.kind==='legacy'&&item.managedPage&&!item.isPage)?{}:null;
};}
