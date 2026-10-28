import {renderPublicHTML} from './ncn-public-render.mjs';
import {publicPageHeaders} from './ncn-public-cache.mjs';

export function createSitePageHandler(deps){return async req=>{
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405,headers});
  const url=new URL(req.url);let decoded='';try{decoded=decodeURIComponent(url.pathname);}catch{}
  const page=deps.pages[url.pathname]||deps.pages[decoded]||(url.pathname==='/.netlify/functions/ncn-site-page'?url.searchParams.get('page'):null);
  // Only static, public shells are allowed. Managed/deleted Library articles
  // always use their own handler and cannot be exposed through this endpoint.
  if(!page||!Object.values(deps.pages).includes(page))return new Response('Not found',{status:404,headers});
  try{
    const start=performance.now();let degraded=false;
    const [html,state]=await Promise.all([deps.html(page),deps.state().catch(()=>{degraded=true;return {catalog:[],notices:[],stories:[]};})]);
    const body=deps.inject(renderPublicHTML(html,state.catalog,state),state.catalog);
    return new Response(req.method==='HEAD'?null:body,{headers:{...(degraded?headers:publicPageHeaders()),'Server-Timing':'ncn;dur='+Math.round(performance.now()-start)}});
  }catch{return new Response('Trang đang kết nối lại. Vui lòng tải lại sau ít phút.',{status:503,headers});}
};}
