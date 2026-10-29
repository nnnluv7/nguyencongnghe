import {escapeHTML} from '../../public/assets/ncn-library/content.js';

export const SITE_ORIGIN='https://nguyencongnghe.com';
export const SOCIAL_IMAGE=SITE_ORIGIN+'/assets/ncn-theme/share-ncn-20261029.png';
const decode=value=>String(value||'').replace(/&(amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi,(all,key)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>','#39':"'"}[key]??(key.startsWith('#')?String.fromCodePoint(Math.min(0x10ffff,parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10)||0)):all)));
const attr=(tag,name)=>decode(tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\x27])([\\s\\S]*?)\\1','i'))?.[2]);
const absolute=(value,fallback)=>{try{const url=new URL(value,SITE_ORIGIN);return ['http:','https:'].includes(url.protocol)?url.href:fallback;}catch{return fallback;}};
export const socialImage=value=>!value||/a46656098850edccf4|chuyengia\.(?:vip|png)/i.test(value)?SOCIAL_IMAGE:absolute(value,SOCIAL_IMAGE);

// Social crawlers read the original HTML, often without executing JavaScript.
// Emit exactly one consistent OG/Twitter set, including for managed articles.
export function normalizeSocialMetadata(html,options={}){
  return html.replace(/<head\b[^>]*>([\s\S]*?)<\/head>/i,(whole,head)=>{
    const tags=[...head.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
    const value=key=>attr(tags.find(t=>attr(t,'property')===key||attr(t,'name')===key)||'','content');
    const canonical=[...head.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).find(t=>attr(t,'rel')==='canonical');
    const title=options.title??value('og:title')??'';
    const label=title||decode(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])||'NCN';
    const description=(options.description??value('description'))||'Công cụ cho ngày làm việc trên nguyencongnghe.com.';
    const url=absolute(options.url||attr(canonical||'','href')||value('og:url')||'/',SITE_ORIGIN+'/');
    const image=socialImage(options.image??value('og:image'));
    const type=options.type||value('og:type')||'website';
    const meta=(key,content,property=false)=>'<meta '+(property?'property':'name')+'="'+key+'" content="'+escapeHTML(content)+'">';
    const lines=[
      '<link rel="canonical" href="'+escapeHTML(url)+'">',meta('description',description),
      meta('og:type',type,true),meta('og:site_name','nguyencongnghe.com',true),
      meta('og:title',label,true),meta('og:description',description,true),meta('og:url',url,true),
      meta('og:image',image,true),meta('og:image:alt',image===SOCIAL_IMAGE?'NCN · nguyencongnghe.com':label,true),
      ...(image===SOCIAL_IMAGE?[meta('og:image:type','image/png',true),meta('og:image:width','1200',true),meta('og:image:height','630',true)]:[]),
      meta('og:locale','vi_VN',true),meta('twitter:card','summary_large_image'),
      meta('twitter:title',label),meta('twitter:description',description),meta('twitter:domain','nguyencongnghe.com'),
      meta('twitter:image',image),meta('twitter:image:alt',image===SOCIAL_IMAGE?'NCN · nguyencongnghe.com':label)
    ];
    head=head.replace(/<meta\b[^>]*>\n?/gi,tag=>{
      const key=attr(tag,'property')||attr(tag,'name');
      return /^(?:og:|twitter:|description$|generator$)/i.test(key)||attr(tag,'http-equiv').toLowerCase()==='access-control-allow-origin'?'':tag;
    }).replace(/<link\b[^>]*>\n?/gi,tag=>attr(tag,'rel')==='canonical'?'':tag);
    head=head.replace(/\n?<!-- NCN SOCIAL:start -->\s*<!-- NCN SOCIAL:end -->\n?/g,'\n');
    return whole.slice(0,whole.indexOf('>')+1)+head.trimEnd()+'\n<!-- NCN SOCIAL:start -->\n'+lines.join('\n')+'\n<!-- NCN SOCIAL:end -->\n</head>';
  });
}
