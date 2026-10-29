import {readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {basename} from 'node:path';
import {normalizeSocialMetadata,SITE_ORIGIN,SOCIAL_IMAGE} from '../netlify/lib/ncn-social-meta.mjs';

const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(dir+'/'+e.name):dir+'/'+e.name))).flat();
const seed=JSON.parse(await readFile('netlify/lib/ncn-library/seed.json','utf8'));
const pages=[...(await walk('public')).filter(p=>p.endsWith('.html')),'netlify/lib/ncn-library/article-shell.html'];
const barcode='/assets/vendor/aa6e8dfded6a0c4cb4.js',qr='/assets/vendor/8d243afceff6c25537.js';
const quiz=['/assets/js/82a51e5c929898de8e.js','/assets/js/61f5ec9b240aa960ca.js','/assets/js/0ca0b0d3937c316ea2.js'];
const removedScripts={};let saved=0;
for(const file of pages){
  const before=await readFile(file,'utf8');let html=before;
  const sources=[...html.matchAll(/<script\b[^>]*src=["']([^"'?#]+)[^"']*["'][^>]*><\/script>/gi)].map(m=>m[1]);
  const executable=html.replace(/<script\b[^>]*src=["'][^"']*["'][^>]*><\/script>/gi,'')+'\n'+(await Promise.all(sources.filter(s=>s.startsWith('/assets/')&&![qr,barcode].includes(s)).map(s=>readFile('public'+s,'utf8')))).join('\n');
  const needsQR=/\bnew\s+QRCode\b|\bQRCode\./.test(executable);
  const needsBarcode=/\bJsBarcode\s*\(/.test(executable);
  const needsQuiz=html.includes('id="history-page-container"')||/\binitQuizModule\s*\(/.test(html);
  const needsDate=sources.some(s=>!s.endsWith('/b9891f589cc0f98f96.js')&&/\/7dae16256c6f0c31eb\.js$/.test(s));
  html=html.replace(/<script\b[^>]*src=["']([^"'?#]+)[^"']*["'][^>]*><\/script>/gi,(tag,src)=>{
    if(src===barcode&&!needsBarcode||src===qr&&!needsQR||quiz.includes(src)&&!needsQuiz||src==='/assets/js/b9891f589cc0f98f96.js'&&!needsDate){removedScripts[src]=(removedScripts[src]||0)+1;return '';}
    return tag;
  });
  const path=file.startsWith('public/')?file.slice(7):null;
  const item=seed.find(x=>x.managedPage&&x.sourcePath===path);
  const currentImage=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).find(t=>/(?:property|name)="og:image"/.test(t))?.match(/content="([^"]*)"/)?.[1];
  const url=path?SITE_ORIGIN+(path==='index.html'?'/':'/'+path.replace(/index\.html$/,'')):SITE_ORIGIN+'/thu-vien/';
  // Keep genuine article/game covers; replaced tool editors use NCN branding.
  const image=item?.image||(/\/(?:arcade|flappy-bird|ran-luot|ca-lon-nuot-ca-be|pikachu|xep-hinh|ban-bong|dao-vang|ghep-khoi)\//.test(url)?currentImage:SOCIAL_IMAGE);
  html=normalizeSocialMetadata(html,{url,image,...(item?{title:item.title,description:item.summary}:{})});
  html=html.replace(/<link\b[^>]*rel="(?:dns-prefetch|preconnect)"[^>]*>\n?/gi,tag=>/blogger|blogspot|blogblog|fonts\.gstatic|cdnjs\.cloudflare/.test(tag)?'':tag).replace(/<noscript>\s*<\/noscript>\n?/g,'');
  saved+=Buffer.byteLength(before)-Buffer.byteLength(html);if(html!==before)await writeFile(file,html);
}

// Delete only legacy files whose filenames are absent from every other tracked
// source, document and server template. The migration lookup is not a consumer.
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const text=await Promise.all(tracked.filter(p=>/\.(?:html|m?js|cjs|css|json|md|toml|yml|svg|py)$/.test(p)&&p!=='public/assets/asset-map.json').map(async p=>{try{return [p,await readFile(p,'utf8')];}catch{return [p,''];}}));
const candidates=(await walk('public/assets')).filter(p=>/^public\/assets\/(?:css|js|vendor)\//.test(p));
const retired=[];
for(const path of candidates){const name=basename(path);if(text.some(([p,s])=>p!==path&&s.includes(name)))continue;retired.push({path,bytes:(await stat(path)).size});}
for(const {path}of retired)await rm(path);
const map=JSON.parse(await readFile('public/assets/asset-map.json','utf8')),deleted=new Set(retired.map(x=>x.path.slice(6)));
for(const [key,value]of Object.entries(map))if(deleted.has(value))delete map[key];
await writeFile('public/assets/asset-map.json',JSON.stringify(map,null,2)+'\n');
console.log(JSON.stringify({pages:pages.length-1,removedScripts,htmlBytesRemoved:saved,retired,retiredBytes:retired.reduce((n,x)=>n+x.bytes,0)},null,2));
