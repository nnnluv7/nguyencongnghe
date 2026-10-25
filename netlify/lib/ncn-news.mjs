import {createHash} from 'node:crypto';
import {XMLParser,XMLValidator} from 'fast-xml-parser';

export const GENK_RSS='https://genk.vn/rss/home.rss';
const MAX=40,KEY='genk',LIMIT=750000;
const clean=value=>String(value??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[s]).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
function link(value,image=false){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
    if(image?!/^(?:genk\.mediacdn\.vn|genk\.vn|static\.mediacdn\.vn|cdn\.genk\.vn)$/.test(u.hostname):u.hostname!=='genk.vn')return '';
    u.hash='';if(!image)u.search='';return u.href;
  }catch{return '';}
}
export function parseGenkRSS(xml,now=Date.now()){
  if(typeof xml!=='string'||Buffer.byteLength(xml)>LIMIT||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid RSS');
  const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',processEntities:false,parseTagValue:false,trimValues:true}).parse(xml);
  if(!parsed.rss?.channel)throw Error('Missing RSS channel');
  const raw=parsed.rss.channel.item,rows=Array.isArray(raw)?raw:raw?[raw]:[],seen=new Set(),items=[];
  for(const row of rows.slice(0,200)){
    const href=link(row.link),title=clean(row.title).slice(0,200),date=Date.parse(row.pubDate);if(!href||!title||seen.has(href)||!Number.isFinite(date)||date>now+86400000)continue;
    const description=typeof row.description==='string'?row.description:'',thumb=description.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    const image=link(row['media:thumbnail']?.['@_url']||row.enclosure?.['@_url']||thumb,true);
    seen.add(href);items.push({id:'rss-genk-'+createHash('sha256').update(href).digest('hex').slice(0,20),title,link:href,thumbnail:image?{src:image,type:'image'}:null,summary:clean(description).slice(0,180),labels:['Tin công nghệ','GenK'],datetime:new Date(date).toISOString(),isPage:false,isArticle:true,source:'GenK',author:'GenK',date:'',featured:false});
  }
  if(!items.length)throw Error('Empty RSS');return items.sort((a,b)=>b.datetime.localeCompare(a.datetime)).slice(0,MAX);
}
export async function readGenkNews(store,fallback=[]){
  try{const value=await store.get(KEY,{type:'json'});return Array.isArray(value?.items)?value.items.slice(0,MAX):fallback;}catch{return fallback;}
}
export function mergeNews(items,news=[]){const links=new Set(items.map(x=>x.link));return [...items,...news.filter(x=>x.source==='GenK'&&!links.has(x.link)&&links.add(x.link))];}
export async function syncGenkNews(store,{fetcher=fetch,now=Date.now()}={}){
  const previous=await store.getWithMetadata(KEY,{type:'json'}),old=previous?.data;
  const requestHeaders={Accept:'application/rss+xml, application/xml, text/xml'};
  if(old?.etag)requestHeaders['If-None-Match']=old.etag;if(old?.lastModified)requestHeaders['If-Modified-Since']=old.lastModified;
  // Fixed official URL, no browser-supplied URL and no redirects to other hosts.
  const response=await fetcher(GENK_RSS,{headers:requestHeaders,redirect:'error',signal:AbortSignal.timeout(12000)});
  if(response.status===304)return {updated:false,count:old?.items?.length||0};
  if(!response.ok)throw Error('GenK RSS HTTP '+response.status);
  if(!/(?:xml|rss)/i.test(response.headers.get('content-type')||''))throw Error('Unexpected RSS content type');
  if(Number(response.headers.get('content-length')||0)>LIMIT)throw Error('RSS too large');
  const chunks=[],reader=response.body.getReader();let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT){await reader.cancel();throw Error('RSS too large');}chunks.push(value);}
  const items=parseGenkRSS(Buffer.concat(chunks).toString('utf8'),now),next={items,updatedAt:new Date(now).toISOString(),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
  const result=await store.setJSON(KEY,next,previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true});return {updated:result.modified,count:items.length};
}
