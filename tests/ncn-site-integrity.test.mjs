import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {localAssetPath} from '../netlify/lib/ncn-public-assets.mjs';

const root=resolve('public');
async function walk(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())result.push(...await walk(path));else if(path.endsWith('.html'))result.push(path);}return result;}
const pages=await walk(root),exists=async path=>{try{return await stat(path);}catch{return null;}};
const redirects=await readFile('public/_redirects','utf8')+'\n'+await readFile('netlify.toml','utf8');
const virtual=new Set(['/assets/ncn-event.js','/assets/ncn-event-core.js','/assets/ncn-gvgs.js','/assets/ncn-gvgs-core.js']);
const attribute=(tag,key)=>tag.match(new RegExp('\\b'+key+'=["\x27]([^"\x27]*)["\x27]','i'))?.[1]||'';

test('every public page has unique element IDs, script loads and valid local startup assets',async()=>{
 for(const page of pages){
  const html=await readFile(page,'utf8');
  // Embedded JavaScript can contain HTML templates; only source DOM IDs count.
  const markup=html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi,'$1</script>');
  const ids=new Set(),scripts=new Set();
  for(const tag of markup.match(/<[a-z][^>]*>/gi)||[]){
   const id=attribute(tag,'id');if(id){assert.equal(ids.has(id),false,page+': duplicate id '+id);ids.add(id);}
   const kind=tag.match(/^<([a-z]+)/i)[1].toLowerCase();
   if(!['script','link','img','iframe'].includes(kind))continue;
   const ref=attribute(tag,kind==='link'?'href':'src'),path=localAssetPath(ref,html);
   if(!path||path.startsWith('/.netlify/'))continue;
   if(kind==='script'){assert.equal(scripts.has(path),false,page+': duplicate script '+path);scripts.add(path);}
   if(virtual.has(path)){assert.ok(redirects.includes(path),path+': required private editor route');continue;}
   assert.ok(await exists(root+decodeURIComponent(path)),page+': missing local '+kind+' '+path);
  }
 }
});

test('native managed articles retain NCN account and print controls without retired startup libraries',async()=>{
 const html=await readFile('netlify/lib/ncn-library/article-shell.html','utf8');
 for(const name of ['125962e77eb283b9aa','8ec8dce35a344a43af','59cde7058d21c3f959','8f3382422a2f53503f','cddfd474b7421a3a07','47d8666c3b6ae2a146','2ef0baed16077abedf','ncn-vip-auth.js'])assert.equal(html.includes(name),false,name+' must not load on a native article');
 for(const name of ['site-bridge.js','b638b6b6b0e4f4118c.js','04eaf19c4b9f842a27.js','ncn-theme/theme.js','ncn-theme/announcements.js'])assert.ok(html.includes(name),name+' compatibility must remain');
 assert.ok(pages.length>=123);
});
