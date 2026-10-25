import {escapeHTML,renderMarkdown} from '../../public/assets/ncn-library/content.js';
import {mergedLibrary,publicCatalog,readLibrary} from './ncn-library-api.mjs';
import {renderPublicHTML} from './ncn-public-render.mjs';

const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function injectCatalog(html,items){
  return html.replace(/<script\b[^>]*src="\/assets\/catalog\.js"[^>]*><\/script>/,'<script>window.CG_CATALOG='+json(items)+';window.NCN_LIBRARY_SNAPSHOT=true;</script>');
}
function dateLabel(value){try{return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));}catch{return '';}}
function metadata(html,item){
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHTML(item.title)+' | NCN</title>');
  html=html.replace(/(<meta\b[^>]*)(?:name|property)="(og:title|twitter:title|description|og:description|twitter:description)"([^>]*>)/g,(tag,pre,key,tail)=>tag.replace(/content="[^"]*"/,'content="'+escapeHTML(key.includes('title')?item.title:item.summary)+'"'));
  html=html.replace(/<meta\b[^>]*(?:name|property)="(?:og:url|twitter:domain)"[^>]*>/g,tag=>tag.replace(/content="[^"]*"/,'content="'+escapeHTML('https://nguyencongnghe.com'+item.href)+'"'));
  if(item.image)html=html.replace(/<meta\b[^>]*(?:name|property)="(?:og:image|twitter:image)"[^>]*>/g,tag=>tag.replace(/content="[^"]*"/,'content="'+escapeHTML(new URL(item.image,'https://nguyencongnghe.com').href)+'"'));
  return html;
}
export async function articleHTML(deps,item,body,catalog){
  let html=await deps.articleShell();
  const rendered=renderMarkdown(body),hasCover=item.image&&!rendered.includes('src="'+escapeHTML(item.image)+'"');
  const tokens={TITLE:escapeHTML(item.title),SUMMARY:escapeHTML(item.summary),BODY:rendered,DATE:escapeHTML(dateLabel(item.datetime)),DATETIME:escapeHTML(item.datetime),ID:escapeHTML(item.id),IMAGE:hasCover?'<img class="ncn-managed-cover" src="'+escapeHTML(item.image)+'" alt="">':'',URL:escapeHTML('https://nguyencongnghe.com'+item.href)};
  html=html.replace(/@@(TITLE|SUMMARY|BODY|DATE|DATETIME|ID|IMAGE|URL)@@/g,(_,name)=>tokens[name]);
  return injectCatalog(metadata(html,item),catalog);
}
async function statusHTML(deps,catalog,status){
  const removed=status===410;
  let html=await deps.articleShell();
  html=html.replace(/@@(TITLE|SUMMARY|BODY|DATE|DATETIME|ID|IMAGE|URL)@@/g,(_,name)=>({TITLE:removed?'Bài viết đã được gỡ':'Chưa tìm thấy bài viết',BODY:'<p>'+(removed?'Bài viết này hiện không còn được công khai.':'Bài viết chưa được đăng hoặc đường dẫn chưa đúng.')+'</p><p><a href="/thu-vien/">← Quay lại Thư viện</a></p>',URL:'https://nguyencongnghe.com/thu-vien/'}[name]||''));
  return injectCatalog(html.replace('</head>','<meta name="robots" content="noindex"></head>'),catalog);
}
export function createLibraryPageHandler(deps){return async req=>{
  try{
    if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405,headers});
    const url=new URL(req.url),initial=deps.state?await deps.state({stories:url.pathname.includes('thu-vien')||url.searchParams.get('view')==='index'}):{},old=!deps.state&&deps.production()?await readLibrary(deps.store()):null,index=initial.index||old?.data,catalog=initial.catalog||publicCatalog(deps.seed,index);
    const render=html=>injectCatalog(renderPublicHTML(html,catalog,{...initial,query:url.searchParams}),catalog);
    const internal=url.pathname==='/.netlify/functions/ncn-library-page';
    const originalRoute=deps.seed.find(x=>x.managedPage&&[x.href,x.href.replace(/\.html$/,''),x.href.replace(/\.html$/,'/')].includes(url.pathname));
    if(['/','/index.html'].includes(url.pathname)||internal&&url.searchParams.get('view')==='home')return new Response(req.method==='HEAD'?null:render(await deps.homeShell()),{headers});
    if(['/thu-vien','/thu-vien/','/thu-vien/index.html'].includes(url.pathname)||internal&&url.searchParams.get('view')==='index')return new Response(req.method==='HEAD'?null:render(await deps.indexShell()),{headers});
    const legacy=originalRoute?.id||(internal?url.searchParams.get('legacy'):null),slug=url.pathname.match(/^\/bai-viet\/([^/]+)\/?$/)?.[1]||(internal?url.searchParams.get('slug'):null);
    const items=mergedLibrary(deps.seed,index),item=legacy?items.find(x=>x.id===legacy&&x.kind==='legacy'&&x.managedPage):items.find(x=>x.kind==='article'&&x.slug===slug);
    if(!item||item.status==='draft')return new Response(req.method==='HEAD'?null:await statusHTML(deps,catalog,404),{status:404,headers});
    if(['purging','purged'].includes(item.status)||item.status==='trash'&&item.pageRemoved)return new Response(req.method==='HEAD'?null:await statusHTML(deps,catalog,410),{status:410,headers});
    let html;
    if(item.mode==='original'){
      const base=deps.seed.find(x=>x.id===item.id);if(!base?.sourcePath)throw Error('Missing original');
      html=await deps.original(base.sourcePath);
      html=html.replace(/(<h1\b[^>]*id="ncn-library-page-title"[^>]*>)[\s\S]*?<\/h1>/,(_,start)=>start+escapeHTML(item.title)+'</h1>');
      html=injectCatalog(metadata(html,item),catalog);
    }else{
      const content=await deps.store().get(item.bodyKey,{type:'json'});if(typeof content?.body!=='string')throw Error('Missing content');
      html=await articleHTML(deps,item,content.body,catalog);
    }
    return new Response(req.method==='HEAD'?null:renderPublicHTML(html,catalog,initial),{headers});
  }catch{return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Thư viện NCN</title><p>Thư viện đang kết nối lại. Anh tải lại trang sau ít phút nhé.</p><a href="/">Về trang chủ</a></html>',{status:503,headers});}
};}
