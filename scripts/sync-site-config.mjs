// Keep the existing static first paint and the hydrated tool catalogue in sync.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {orderTools} from '../public/assets/ncn-theme/menu.js';
const read=path=>readFile(path,'utf8'),config=JSON.parse(await read('public/assets/ncn-theme/config.json'));
async function pages(dir){const all=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())all.push(...await pages(path));else if(item.name.endsWith('.html'))all.push(path);}return all;}
const games=config.tools.filter(t=>t.group==='arcade');if(!games.length)throw Error('Register arcade games in the shared configuration first.');
const json=JSON.stringify(config).replace(/</g,'\\u003c');let count=0;
for(const path of [...await pages('public'),'netlify/lib/ncn-library/article-shell.html']){
 let html=await read(path),before=html;
 html=html.replace(/(<script id="ncn-(?:initial|game)-config" type="application\/json">)[\s\S]*?(<\/script>)/g,(_,a,b)=>a+json+b);
 // Existing static menus remain complete even before any module downloads.
 html=html.replace(/(<nav id="ncn-(?:navigation|game-nav)"[^>]*>)([\s\S]*?)(<\/nav>)/g,(_,open,content,close)=>{
  const template=content.match(/<a\b[^>]*href="\/thu-vien\/"[^>]*>[\s\S]*?<\/a>/)?.[0];
  if(!template)throw Error('Missing library link in '+path);
  let next=content;
  for(const game of games){
   if(next.includes('href="'+game.href+'"'))continue;
   const fish='<ellipse cx="13" cy="12" rx="8" ry="6"/><path d="m5 12-4-5v10ZM17 10h.01M11 6l2-3 3 4M10 17l3 4 3-4"/>';
   const icon=game.icon==='fish'?fish:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>';
   let link=template.replace('href="/thu-vien/"','href="'+game.href+'"').replace(/Thư viện bài viết/g,game.title).replace(/ aria-current="page"/g,'').replace(/<svg[\s\S]*?<\/svg>/,'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon+'</svg>');
   if(path==='public'+game.href+'index.html')link=link.replace('<a ','<a aria-current="page" ');
   next=next.replace(template,link+template);
  }
  return open+next+close;
 });
 if(html.includes('id="ncn-tool-grid"')){
  // Arcade entries were previously missing from the static grid. Add both so
  // the server's card count and first paint match client-side hydration.
  for(const tool of config.tools.filter(t=>t.group==='arcade'))if(!html.includes('data-ncn-pin="'+tool.id+'"')){
   const old=config.tools.find(t=>t.id==='vip'),card=html.match(/<article class="ncn-tool-card[^>]*><a class="ncn-tool-link" href="\/premium\/"[\s\S]*?<\/article>/)?.[0];
   if(!card)throw Error('Missing tool card template in '+path);let next=card;
   for(const [a,b]of [[old.href,tool.href],[old.title,tool.title],[old.description,tool.description],['data-ncn-pin="vip"','data-ncn-pin="'+tool.id+'"'],['ncn-tone-amber','ncn-tone-'+tool.tone]])next=next.replaceAll(a,b);
   html=html.replace(/(<div id="ncn-tool-grid"[^>]*>)([\s\S]*?)(<\/div>\s*<p id="ncn-tool-count")/,(_,a,b,c)=>a+b+next+c);
   // The count node precedes the grid in some retained shells.
   if(!html.includes('data-ncn-pin="'+tool.id+'"'))html=html.replace(card,card+next);
  }
  html=html.replace(/\d+ \/ \d+ công cụ · Chọn ngôi sao để ghim lối tắt\./,config.tools.length+' / '+config.tools.length+' công cụ · Chọn ngôi sao để ghim lối tắt.');
  // Cloned cards must follow the hydrated catalogue's order. A new, taller
  // arcade card in a different row otherwise shifts the homepage on hydration.
  html=html.replace(/(<div id="ncn-tool-grid"[^>]*>)((?:\s*<article\b[\s\S]*?<\/article>)+\s*)(<\/div>)/,(_,open,content,close)=>{
   const cards=new Map([...content.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card])=>[card.match(/data-ncn-pin="([^"]+)"/)?.[1],card]));
   if(config.tools.some(tool=>!cards.has(tool.id)))throw Error('Missing initial tool card in '+path);
   return open+orderTools(config.tools).map(tool=>cards.get(tool.id)).join('')+close;
  });
 }
 if(html!==before){await writeFile(path,html);count++;}
}
console.log('Shared configuration and initial navigation synchronized in '+count+' pages.');
