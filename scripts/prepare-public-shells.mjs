import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {renderPublicHTML} from '../netlify/lib/ncn-public-render.mjs';
import {publicCatalog} from '../netlify/lib/ncn-library-api.mjs';
const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'));
const rows=publicCatalog(seed),managed=new Set(seed.filter(x=>x.managedPage).map(x=>x.sourcePath)),pages={};
async function files(dir){let all=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())all.push(...await files(path));else if(item.name.endsWith('.html'))all.push(path);}return all;}
const marker=(html,id,name)=>html.replace(new RegExp('(<(?:div|p|span|select)\\b[^>]*id="'+id+'"[^>]*>)([\\s\\S]*?)(</(?:div|p|span|select)>)'),(all,start,content,end)=>content.includes('<!-- NCN:'+name+':start -->')?all:start+'<!-- NCN:'+name+':start -->'+content+'<!-- NCN:'+name+':end -->'+end);
let count=0;
for(const file of [...await files('public'),'netlify/lib/ncn-library/article-shell.html']){
 let html=await readFile(file,'utf8');if(!html.includes('id="ncn-announcement"'))continue;
 if(html.includes('id="ncn-home"')){
  html=marker(html,'ncn-articles','articles');
  const config=JSON.parse(html.match(/<script id="ncn-initial-config"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const buttons=[{id:'',name:'Tất cả'},...config.groups].map(g=>'<button type="button" data-ncn-group="'+g.id+'" aria-pressed="'+!g.id+'">'+g.name+'</button>').join('');
  html=html.replace(/(<div id="ncn-home-filters"[^>]*>)[\s\S]*?<\/div>/,(_,start)=>start+buttons+'</div>');
  html=html.replace('<span data-ncn-icon="search"></span><input id="ncn-tool-query"','<span data-ncn-icon="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg></span><input id="ncn-tool-query"');
  html=html.replace('Các công cụ của NCN.',config.tools.length+' / '+config.tools.length+' công cụ · Chọn ngôi sao để ghim lối tắt.');
 }
 if(html.includes('id="ncn-library"')){
  for(const [id,name] of [['ncn-featured-results','featured'],['ncn-library-results','results'],['ncn-library-count','count'],['ncn-library-page','page'],['ncn-library-label','labels']])html=marker(html,id,name);
  html=html.replace('<div data-story-items class="ncn-story-items"></div>','<div data-story-items class="ncn-story-items"><!-- NCN:stories:start --><!-- NCN:stories:end --></div>');
  html=html.replace('aria-live="polite">Đang tải Story…</p>','aria-live="polite"><!-- NCN:story-status:start -->Ảnh của thành viên sẽ xuất hiện tại đây.<!-- NCN:story-status:end --></p>');
  if(!html.includes('id="ncn-library-source"'))html=html.replace('<label>Nhóm nội dung<select','<label class="ncn-library-source-filter">Nguồn<select id="ncn-library-source"><option value="">Tất cả nguồn</option><option value="ncn">NCN</option><option value="genk">GenK</option></select></label><label>Nhóm nội dung<select');
 }
 if(html.includes('id="ncn-home"')||html.includes('id="ncn-library"'))html=renderPublicHTML(html,rows).replace(/<script>window\.NCN_NOTICE_SNAPSHOT=[\s\S]*?<\/script>/,'');

 const path=relative('public',file).replaceAll('\\','/');
 if(file.startsWith('public/')&&!managed.has(path)&&!['index.html','thu-vien/index.html'].includes(path)){
  pages['/'+path]=path;
  if(path.endsWith('/index.html')){const route='/'+path.slice(0,-10);pages[route]=path;pages[route.slice(0,-1)]=path;}
  else if(path.endsWith('.html')){const route='/'+path.slice(0,-5);pages[route]=path;pages[route+'/']=path;}
 }
 if(html.includes('id="ncn-home"')||html.includes('id="ncn-library"'))await writeFile(file,html);count++;
}
await mkdir('netlify/lib/ncn-shell',{recursive:true});await writeFile('netlify/lib/ncn-shell/pages.json',JSON.stringify(pages,null,2)+'\n');
let redirects=await readFile('public/_redirects','utf8');redirects=redirects.replace(/\n# BEGIN NCN PUBLIC SHELL[\s\S]*?# END NCN PUBLIC SHELL\n?/,'').trimEnd()+'\n';
for(const [route,page] of Object.entries(pages)){pages[route.normalize('NFC')]=page;pages[route.normalize('NFD')]=page;}
await writeFile('netlify/lib/ncn-shell/pages.json',JSON.stringify(pages,null,2)+'\n');
redirects+='\n# BEGIN NCN PUBLIC SHELL\n'+Object.entries(pages).map(([route,page])=>encodeURI(route)+'  /.netlify/functions/ncn-site-page?page='+encodeURIComponent(page)+'  200!').join('\n')+'\n# END NCN PUBLIC SHELL\n';await writeFile('public/_redirects',redirects);
console.log({prepared:count,publicShells:new Set(Object.values(pages)).size,routes:Object.keys(pages).length});
