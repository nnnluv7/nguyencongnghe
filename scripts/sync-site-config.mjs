// Keep the existing static first paint and the hydrated tool catalogue in sync.
import {readFile,writeFile,readdir} from 'node:fs/promises';
const read=path=>readFile(path,'utf8'),config=JSON.parse(await read('public/assets/ncn-theme/config.json'));
async function pages(dir){const all=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())all.push(...await pages(path));else if(item.name.endsWith('.html'))all.push(path);}return all;}
const game=config.tools.find(t=>t.id==='ran-luot');if(!game)throw Error('Rắn Lướt must be registered in the shared configuration first.');
const json=JSON.stringify(config).replace(/</g,'\\u003c');let count=0;
for(const path of [...await pages('public'),'netlify/lib/ncn-library/article-shell.html']){
 let html=await read(path),before=html;
 html=html.replace(/(<script id="ncn-(?:initial|game)-config" type="application\/json">)[\s\S]*?(<\/script>)/g,(_,a,b)=>a+json+b);
 // Existing static menus remain complete even before any module downloads.
 html=html.replace(/(<nav id="ncn-(?:navigation|game-nav)"[^>]*>)([\s\S]*?)(<\/nav>)/g,(_,open,content,close)=>{
  if(content.includes('href="/ran-luot/"'))return open+content+close;
  const template=content.match(/<a\b[^>]*href="\/thu-vien\/"[^>]*>[\s\S]*?<\/a>/)?.[0];
  if(!template)throw Error('Missing library link in '+path);
  const link=template.replace('href="/thu-vien/"','href="/ran-luot/"').replace(/Thư viện bài viết/g,'Rắn Lướt NCN').replace(/<svg[\s\S]*?<\/svg>/,'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>');
  return open+content.replace(template,link+template)+close;
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
 }
 if(html!==before){await writeFile(path,html);count++;}
}
console.log('Shared configuration and initial navigation synchronized in '+count+' pages.');
