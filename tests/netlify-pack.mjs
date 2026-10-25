import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,mkdtemp,stat,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {zipFunction} from '@netlify/zip-it-and-ship-it';

// Plain esbuild does not run Netlify's dependency tracer. Build actual Lambda
// archives, including native/external modules and each configured resource glob.
const source=await readFile('netlify.toml','utf8'),config={'*':{nodeVersion:'22.x'}};
for(const match of source.matchAll(/\[functions\."([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g)){
  const value={nodeVersion:'22.x'};
  for(const [key,property] of [['node_bundler','nodeBundler'],['external_node_modules','externalNodeModules'],['included_files','includedFiles']]){
    const field=match[2].match(new RegExp(key+'\\s*=\\s*(\\[[^\\]]*\\]|"[^"]*")'));
    if(field)value[property]=JSON.parse(field[1]);
  }
  config[match[1]]=value;
}
const output=await mkdtemp(join(tmpdir(),'ncn-netlify-pack-')),report=[];
await mkdir('artifacts/netlify-pack',{recursive:true});
try{
  for(const file of (await readdir('netlify/functions')).filter(name=>name.endsWith('.mjs')).sort()){
    const name=file.slice(0,-4),archive=await zipFunction(join('netlify/functions',file),output,{basePath:resolve('.'),config});
    assert.ok(archive,name+' is a valid Netlify Function');
    const bytes=(await stat(join(output,name+'.zip'))).size;assert.ok(bytes>0&&bytes<50*1024*1024,name+' archive size');
    report.push({name,bytes,ok:true});console.log('PASS Netlify archive '+name+' ('+bytes+' bytes)');
  }
  assert.equal(report.length,(await readdir('netlify/functions')).filter(name=>name.endsWith('.mjs')).length);
}finally{
  await writeFile('artifacts/netlify-pack/results.json',JSON.stringify(report,null,2));
  await rm(output,{recursive:true,force:true});
}
