import assert from 'node:assert/strict';
import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(await readFile('netlify/lib/ncn-shell/assets.generated.json','utf8')),root=resolve('dist');
async function files(dir){let result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())result.push(...await files(path));else if(item.name.endsWith('.html'))result.push(path);}return result;}
const pages=await files(root);
for(const page of pages){
 const html=await readFile(page,'utf8');assert.equal((html.match(/id="ncn-built-importmap"/g)||[]).length,1,page);
 for(const tag of html.match(/<(?:script|link)\b[^>]*>/g)||[]){
  const src=tag.match(/(?:src|href)="(\/assets\/ncn-built\/[^"?#]+)"/)?.[1];if(!src)continue;
  const bytes=await readFile(root+src);assert.ok(bytes.length,page+': '+src);
  const integrity=tag.match(/integrity="(sha(?:256|384|512))-(.*?)"/);
  if(integrity)assert.equal(createHash(integrity[1]).update(bytes).digest('base64'),integrity[2],page+': copied script integrity');
 }
}
for(const [source,target] of Object.entries(manifest.modules)){assert.ok(source.startsWith('/'));assert.ok((await stat(root+target)).isFile());for(const dep of manifest.dependencies[target]||[])assert.ok((await stat(root+dep)).isFile(),dep);}
for(const [source,resource]of Object.entries(manifest.catalogues||{})){
 const original=JSON.parse(await readFile('public'+source,'utf8')),optimized=JSON.parse(await readFile(root+resource.href,'utf8'));
 for(const key of Object.keys(original).filter(x=>x!=='models'))assert.deepEqual(optimized[key],original[key],source+': full print data must stay intact');
 for(let i=0;i<original.models.length;i++){
  const {thumbnail:before,...model}=original.models[i],{thumbnail:after,...next}=optimized.models[i];assert.deepEqual(next,model);assert.ok((await stat(root+after)).size<(await stat('public'+before)).size||before.endsWith('.svg'),before+': preview should be smaller');
 }
}
const themeSets=[];
for(const path of ['/index.html','/thu-vien/index.html','/sticker/index.html','/arcade/index.html','/pikachu/index.html']){
 const html=await readFile(root+path,'utf8');themeSets.push(new Set([...html.matchAll(/href="(\/assets\/ncn-built\/styles\/[^"]+)"/g)].map(x=>x[1])));
}
assert.ok([...themeSets[0]].some(path=>themeSets.every(set=>set.has(path))),'Every portal, tool and game must reuse the same immutable NCN CSS');
const arcadeSets=[];
for(const path of ['/arcade/','/ran-luot/','/flappy-bird/','/pikachu/','/ca-lon-nuot-ca-be/','/xep-hinh/','/dao-vang/','/ghep-khoi/','/ban-bong/']){
 const html=await readFile(root+path+'index.html','utf8');
 arcadeSets.push(new Set([...html.matchAll(/href="(\/assets\/ncn-built\/styles\/[^"]+)"/g)].map(x=>x[1])));
}
const arcadeStyle=[...arcadeSets[0]].filter(path=>arcadeSets.every(set=>set.has(path)));
assert.ok(arcadeStyle.some(path=>!themeSets[0].has(path)),'All eight games and the hub must reuse one separately cached Arcade stylesheet');
await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/build.json',JSON.stringify({pages:pages.length,entries:Object.keys(manifest.modules).length,ok:true},null,2));
console.log('PASS '+pages.length+' built pages: local assets, SRI, shared styles and single import maps');
