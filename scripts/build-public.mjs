import {build,transform} from 'esbuild';
import {readFile,writeFile,readdir,mkdir,cp,rm} from 'node:fs/promises';
import {resolve,relative,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import wawoff2 from 'wawoff2';
import {assetPath,localAssetPath,stylesheetKey,optimizePublicHTML} from '../netlify/lib/ncn-public-assets.mjs';

const root=resolve('public'),output=resolve('dist'),assets='/assets/ncn-built/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,16);
async function files(dir){const list=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())list.push(...await files(path));else list.push(path);}return list;}
const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'=["\x27]([^"\x27]*)["\x27]','i'))?.[1]||'';
const styleGroup=src=>src==='/assets/ncn-arcade/arcade.css'?'arcade':src.startsWith('/assets/ncn-theme/')&&['site.css','announcements.css'].includes(src.split('/').pop())?'ncn':[
  '/assets/vendor/e8a621bed82faf2b49.css','/assets/vendor/c41950014110df0d51.css','/assets/css/9915bcaacd9d7a4ef9.css'
].includes(src)?'legacy-base':[
  '/assets/vendor/9693203622602734cb.css','/assets/css/9b16eee6c548ad8ad4.css'
].includes(src)?'legacy-icons':'page';

export async function buildPublic(){
  await rm(output,{recursive:true,force:true});await cp(root,output,{recursive:true});await mkdir(output+assets,{recursive:true});
  const paths=(await files(root)).sort(),htmlFiles=paths.filter(x=>x.endsWith('.html'));
  const templates=[...htmlFiles,resolve('netlify/lib/ncn-library/article-shell.html')];
  const htmls=await Promise.all(templates.map(path=>readFile(path,'utf8')));
  const scripts=paths.filter(x=>x.endsWith('.js')),sources=new Map(await Promise.all(scripts.map(async path=>[path,await readFile(path,'utf8')])));
  const entryPoints={};
  for(const [path,source] of sources)if(/^\s*(?:import(?:\s+|['"])|export\s+)/m.test(source))entryPoints[relative(root,path).slice(0,-3)]=path;
  for(const html of htmls)for(const match of html.matchAll(/<script\b[^>]*>/gi)){
    const tag=match[0],src=localAssetPath(attr(tag,'src'),html);
    if(attr(tag,'type')==='module'&&src.startsWith('/')&&sources.has(root+src))entryPoints[src.slice(1,-3)]=root+src;
  }
  const result=await build({entryPoints,outdir:output+assets,bundle:true,splitting:true,format:'esm',platform:'browser',target:['es2020'],minify:true,metafile:true,entryNames:'[dir]/[name]-[hash]',chunkNames:'shared/[name]-[hash]',legalComments:'none',logLevel:'silent',plugins:[{
    name:'canonical-local-modules',setup(api){api.onResolve({filter:/^(?:\.?\.?\/|\/)/},args=>{
      if(args.kind==='entry-point')return;
      const path=assetPath(args.path);
      if(args.path.startsWith('/'))return {path:root+path};
      if(path!==args.path)return {path:resolve(dirname(args.importer),path)};
    });}
  }]});
  const manifest={modules:{},imports:{},classic:{},styles:{},dependencies:{},catalogues:{},fonts:{}};
  const generatedAsset=async(folder,bytes,ext)=>{const url=assets+folder+'/'+hash(bytes)+'.'+ext;await mkdir(dirname(output+url),{recursive:true});await writeFile(output+url,bytes);return url;};
  manifest.logo=await generatedAsset('images',await sharp(root+'/assets/ncn-theme/logo.png').resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer(),'webp');
  manifest.icon=await generatedAsset('images',await sharp(root+'/assets/ncn-theme/logo.png').resize({width:192,height:192,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer(),'png');
  // WOFF2 preserves every glyph and metric of the existing Inter fonts. The
  // large original TTFs stay available to preserved print documents.
  const fontCSS=await readFile(root+'/assets/vendor/e8a621bed82faf2b49.css','utf8');
  const subsetIndex=JSON.parse(await readFile(root+'/assets/ncn-theme/font-subsets/manifest.json','utf8')),fontSubsets={};
  for(const match of fontCSS.matchAll(/url\((\/assets\/[^)]+\.ttf)\)/g)){
    const bytes=await readFile(root+match[1]),subset=subsetIndex.fonts[match[1]];
    if(subset.sourceSHA256!==createHash('sha256').update(bytes).digest('hex'))throw Error('Regenerate the UI font subsets after updating Inter.');
    manifest.fonts[match[1]]=await generatedAsset('fonts',Buffer.from(await wawoff2.compress(bytes)),'woff2');
    fontSubsets[match[1]]=await generatedAsset('fonts',await readFile(root+subset.file),'woff2');
  }
  const thumbnails=new Map();
  for(const [name,app] of [['ncn-sticker','ncn-sticker-app'],['ncn-popup','ncn-popup-app'],['ncn-store-tools','ncn-store-app']]){
    const source='/assets/'+name+'/catalogue.json',data=JSON.parse(await readFile(root+source,'utf8'));
    for(const model of data.models){const original=model.thumbnail;if(!thumbnails.has(original))thumbnails.set(original,await generatedAsset('thumbnails',await sharp(root+original).resize({width:480,height:448,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer(),'webp'));model.thumbnail=thumbnails.get(original);}
    // Only catalogue thumbnails change. Full-resolution print layouts, assets,
    // checksums and font CSS keep their original values.
    manifest.catalogues[source]={app,href:await generatedAsset('catalogues',Buffer.from(JSON.stringify(data)),'json')};
  }
  const urlOf=path=>'/'+relative(output,resolve(path)).replaceAll('\\','/');
  for(const [path,info] of Object.entries(result.metafile.outputs)){
    const url=urlOf(path);manifest.dependencies[url]=info.imports.filter(x=>x.kind==='import-statement'&&!x.external).map(x=>urlOf(x.path));
    if(info.entryPoint)manifest.modules['/'+relative(root,resolve(info.entryPoint)).replaceAll('\\','/')]=url;
  }
  Object.assign(manifest.imports,manifest.modules);
  // Versioned source imports in legacy scripts resolve to the same compiled
  // entry as modern tools; this prevents duplicate sign-in state and dialogs.
  for(const [path,source] of [...sources,...templates.map((path,i)=>[path,htmls[i]])]){
    const base='https://ncn.test/'+relative(root,path).replaceAll('\\','/');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*|src=)["']([/.][^"']+)["']/g)){
      const url=new URL(match[1],base),key=url.pathname+url.search;
      if(manifest.modules[url.pathname])manifest.imports[key]=manifest.modules[url.pathname];
    }
  }
  const classic=new Set();
  for(const html of htmls)for(const match of html.matchAll(/<script\b[^>]*>/gi)){
    const tag=match[0],src=localAssetPath(attr(tag,'src'),html);if(attr(tag,'type')!=='module'&&src.startsWith('/'))classic.add(src);
  }
  // A fresh tool can declare its on-demand reader without executing it during
  // source-page startup. Give that inert declaration the same immutable asset.
  for(const html of htmls)for(const match of html.matchAll(/<link\b[^>]*\bdata-ncn-spreadsheet\b[^>]*>/gi)){
    const src=localAssetPath(attr(match[0],'href'),html);if(src.startsWith('/'))classic.add(src);
  }
  for(const src of classic){
    // Exact copies retain SRI and global bindings used by the existing editors.
    const bytes=await readFile(root+src),url=assets+'classic/'+src.split('/').pop().slice(0,-3)+'-'+hash(bytes)+'.js';
    await mkdir(dirname(output+url),{recursive:true});await writeFile(output+url,bytes);manifest.classic[src]=url;
  }
  const styleCache=new Map();
  for(const html of htmls){
    const key=stylesheetKey(html);if(!key||manifest.styles[key])continue;
    // Keep the cascade order, but reuse the same NCN stylesheet across portals,
    // games and editors instead of redownloading it in every page's CSS bundle.
    const groups=[];
    for(const line of key.split('\n')){const kind=styleGroup(line.split('|')[0]);if(groups.at(-1)?.kind!==kind)groups.push({kind,lines:[]});groups.at(-1).lines.push(line);}
    const urls=[];
    for(const group of groups){
      const id=group.lines.join('\n');if(styleCache.has(id)){urls.push(styleCache.get(id));continue;}
      let source='';
      for(const line of group.lines){
        const [src,media]=line.split('|');let css=await readFile(root+src,'utf8');
        css=css.replace(/@font-face\s*\{([^}]+)\}/g,(whole,body)=>{
          const path=body.match(/url\((\/assets\/[^)]+\.ttf)\)/)?.[1];if(!fontSubsets[path])return whole;
          const face=(url,range)=>'@font-face{'+body.replace(/src\s*:[^;]+;/,'src:url("'+url+'") format("woff2");')+'unicode-range:'+range+';}';
          return face(fontSubsets[path],subsetIndex.unicodeRange)+face(manifest.fonts[path],subsetIndex.fonts[path].fallbackRange);
        });
        css=css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)(\s*format\(['"]truetype['"]\))?/g,(all,quote,ref)=>{const url=new URL(ref,'https://ncn.test'+src);if(manifest.fonts[url.pathname])return 'url("'+manifest.fonts[url.pathname]+'") format("woff2")';if(/^(?:[a-z]+:|\/|#)/i.test(ref))return all;return 'url("'+url.pathname+url.search+url.hash+'")';});
        source+=media?'\n@media '+media+'{\n'+css+'\n}':'\n'+css;
      }
      const {code}=await transform(source,{loader:'css',minify:true,legalComments:'none',target:['chrome100','safari15']});
      const url=assets+'styles/'+hash(code)+'.css';await mkdir(dirname(output+url),{recursive:true});await writeFile(output+url,code);styleCache.set(id,url);urls.push(url);
    }
    manifest.styles[key]=urls;
  }
  for(let i=0;i<htmlFiles.length;i++)await writeFile(output+'/'+relative(root,htmlFiles[i]),optimizePublicHTML(htmls[i],manifest));
  await writeFile('netlify/lib/ncn-shell/assets.generated.json',JSON.stringify(manifest));
  await writeFile(output+'/asset-build.json',JSON.stringify({version:1,modules:Object.keys(manifest.modules).length,styles:Object.keys(manifest.styles).length}));
  console.log('Built '+htmlFiles.length+' public pages, '+Object.keys(manifest.modules).length+' shared module entries, '+Object.keys(manifest.styles).length+' combined stylesheets.');
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await buildPublic();
