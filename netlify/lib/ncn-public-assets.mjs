import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// The build creates only public asset mappings. Account data and private editor
// code never enter this manifest or a cached HTML response.
let deployed;
try{deployed=JSON.parse(readFileSync(join(process.cwd(),'netlify/lib/ncn-shell/assets.generated.json'),'utf8'));}catch{}
export const assetPath=value=>String(value||'').split(/[?#]/)[0];
const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'=["\x27]([^"\x27]*)["\x27]','i'))?.[1]||'';
export function localAssetPath(value,html){
  if(!value||/^(?:data:|#|\/\/)/.test(value))return '';
  const canonical=[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]).find(tag=>attr(tag,'rel')==='canonical');
  try{let base='https://nguyencongnghe.com/';if(canonical&&!attr(canonical,'href').includes('@@'))base=new URL(attr(canonical,'href'),base).href;const url=new URL(value,base);return url.origin==='https://nguyencongnghe.com'?url.pathname:'';}catch{return '';}
}
export const stylesheetKey=html=>[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]).filter(tag=>attr(tag,'rel')==='stylesheet'&&localAssetPath(attr(tag,'href'),html)).map(tag=>localAssetPath(attr(tag,'href'),html)+'|'+attr(tag,'media')).join('\n');

export function optimizePublicHTML(html,manifest=deployed){
  if(!manifest||html.includes('id="ncn-built-importmap"'))return html;
  const portal=/id="ncn-(?:home|library)"/.test(html);
  const modern=portal||/id="(?:ncn-(?:sticker|popup|store|cash|warehouse)-app|vip-app)"/.test(html);
  const excel=/id="(?:ncn-(?:sticker|popup|store)-app|vip-app)"|src="\/assets\/(?:inventory|print-import)\.js/.test(html);
  // The large spreadsheet reader belongs only to the actual Excel importers.
  // Article pages, games, calculators and account screens never call XLSX.
  html=html.replace(/<script\b[^>]*src=["']\/assets\/vendor\/125962e77eb283b9aa\.js[^"']*["'][^>]*><\/script>/gi,tag=>excel?'<link data-ncn-spreadsheet href="'+(manifest.classic['/assets/vendor/125962e77eb283b9aa.js']||'/assets/vendor/125962e77eb283b9aa.js')+'"'+(attr(tag,'integrity')?' integrity="'+attr(tag,'integrity')+'"':'')+'>':'');
  html=html.replace(/<link\b[^>]*\bdata-ncn-spreadsheet\b[^>]*>/gi,tag=>{
    const href=attr(tag,'href'),target=manifest.classic[localAssetPath(href,html)];return target?tag.replace(href,target):tag;
  });
  // These Blogger, jQuery, barcode and spreadsheet libraries are not used by
  // either portal. Editors retain their original scripts and execution order.
  if(modern)html=html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,(tag,src)=>{
    // Keep the tiny legacy account bridge: bookmarked login callers and the
    // old quiz profile still use the same verified NCN account on these pages.
    if(['/assets/site-config.js','/assets/js/b638b6b6b0e4f4118c.js'].includes(assetPath(src)))return tag;
    if(!portal&&['/assets/js/04eaf19c4b9f842a27.js','/assets/site-bridge.js'].includes(assetPath(src)))return tag;
    return /^\/assets\/(?:js\/|vendor\/|site-bridge\.js)/.test(src)||portal&&src.startsWith('/assets/ncn-vip-auth.js')?'':tag;
  });
  const css=manifest.styles[stylesheetKey(html)];
  if(css){let first=true;html=html.replace(/<link\b[^>]*>/gi,tag=>{
    if(attr(tag,'rel')!=='stylesheet'||!localAssetPath(attr(tag,'href'),html))return tag;
    if(!first)return '';first=false;return (Array.isArray(css)?css:[css]).map((href,i)=>'<link'+(i===0?' id="ncn-site-style"':'')+' rel="stylesheet" href="'+href+'">').join('\n');
  });}
  html=html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\n?/gi,'');
  const entries=new Set();
  html=html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,(tag,src)=>{
    const path=localAssetPath(src,html),module=attr(tag,'type')==='module',target=module?manifest.modules[path]:manifest.classic[path];
    if(!target)return tag;
    if(module)entries.add(target);
    let result=tag.replace(src,target);
    // There are no executable inline dependants in the saved pages. Ordered
    // defer allows parsing/painting to continue while classic dependencies load.
    if(!module&&!/\b(?:defer|async)\b/.test(result))result=result.replace('<script','<script defer');
    return result;
  });
  const imports={};
  for(const [source,target] of Object.entries(manifest.imports))imports[source]=target;
  const preload=new Set();
  const visit=path=>{if(preload.has(path))return;preload.add(path);for(const child of manifest.dependencies[path]||[])visit(child);};
  entries.forEach(visit);
  const catalogues=Object.entries(manifest.catalogues||{}).filter(([,data])=>html.includes('id="'+data.app+'"')).map(([source,data])=>'<link rel="preload" as="fetch" crossorigin="anonymous" data-ncn-catalogue="'+source+'" href="'+data.href+'">').join('\n');
  const head='<script id="ncn-built-importmap" type="importmap">'+JSON.stringify({imports}).replace(/</g,'\\u003c')+'</script>\n'+[...preload].map(path=>'<link rel="modulepreload" href="'+path+'">').join('\n')+'\n'+catalogues+'\n'+(manifest.logo?'<link data-ncn-logo-asset href="'+manifest.logo+'">\n':'');
  // Import maps must precede every module/preload, including dynamic imports in
  // old quiz scripts, so every page shares exactly one account/Identity module.
  html=html.replace(/<head([^>]*)>/i,(_,attrs)=>'<head'+attrs+'>\n'+head);
  html=html.replace(/href="https:\/\/i\.ibb\.co\/vg5gwhS\/Bie-u-tru-ng-NCN-co-ng-nghe-to-i-gia-n\.png"/g,'href="/assets/ncn-theme/logo.png"');
  if(manifest.logo)html=html.replace(/(<img\b[^>]*src=")\/assets\/ncn-theme\/logo\.png(")/g,'$1'+manifest.logo+'$2');
  if(manifest.icon)html=html.replace(/<link\b[^>]*>/gi,tag=>/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/.test(attr(tag,'rel'))&&attr(tag,'href')==='/assets/ncn-theme/logo.png'?tag.replace('/assets/ncn-theme/logo.png',manifest.icon):tag);
  html=html.replace(/<img\b[^>]*class="[^"]*\bhuongdan\b[^"]*"[^>]*>/g,tag=>/\bloading=/.test(tag)?tag:tag.replace('<img','<img loading="lazy" decoding="async"'));
  return html;
}

export async function optimizePublicResponse(response,manifest=deployed){
  if(!manifest||!response.headers.get('content-type')?.startsWith('text/html')||!response.body)return response;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  return new Response(optimizePublicHTML(await response.text(),manifest),{status:response.status,statusText:response.statusText,headers});
}
