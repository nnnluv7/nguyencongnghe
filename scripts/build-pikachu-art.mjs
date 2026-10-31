import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {SPECIES} from '../public/pikachu/core.js';

// Keep vector masters editable, but give Safari one decoded image for the
// whole board. A match never has to instantiate external SVG <use> trees.
export async function buildPikachuArt(){
 const root=resolve('public/pikachu'),source=await readFile(root+'/tiles.svg','utf8');
 const sourceHash=createHash('sha256').update(source).digest('hex');
 const inner=source.replace(/^\s*<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const columns=5,rows=Math.ceil(SPECIES.length/columns),cell=256;
 const tiles=await Promise.all(SPECIES.map(async(_,i)=>{
  if(!new RegExp('<symbol\\b[^>]*id="p'+(i+1)+'"').test(source))throw Error('Missing Pikachu species '+(i+1));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+cell+'" height="'+cell+'" viewBox="0 0 80 80">'+inner+'<use href="#p'+(i+1)+'"/></svg>';
  return {input:await sharp(Buffer.from(svg)).png().toBuffer(),left:i%columns*cell,top:Math.floor(i/columns)*cell};
 }));
 const atlas=await sharp({create:{width:columns*cell,height:rows*cell,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).webp({lossless:true,effort:6}).toBuffer();
 const digest=createHash('sha256').update(atlas).digest('hex').slice(0,16),href='/pikachu/art/'+digest+'.webp';
 await mkdir(root+'/art',{recursive:true});
 await writeFile('public'+href,atlas);
 // These are generated game textures, not user uploads or print documents.
 for(const file of await readdir(root+'/art'))if(/^[a-f0-9]{16}\.webp$/.test(file)&&file!==digest+'.webp')await rm(root+'/art/'+file);
 const css='/* Generated from tiles.svg; source-sha256: '+sourceHash+'; '+columns+'x'+rows+' cells at '+cell+'px. */\n.pk-tile-art{background-image:url("'+href+'");background-size:'+columns*100+'% '+rows*100+'%}\n';
 await writeFile(root+'/tile-art.css',css);
 const page=await readFile(root+'/index.html','utf8');
 const block='<!-- NCN PIKACHU ART:start -->\n<link rel="preload" as="image" type="image/webp" href="'+href+'" data-pk-art>\n<link rel="stylesheet" href="/pikachu/tile-art.css?v=20261031-classic-1">\n<!-- NCN PIKACHU ART:end -->';
 if(!page.includes('<!-- NCN PIKACHU ART:start -->'))throw Error('Missing Pikachu art discovery marker');
 await writeFile(root+'/index.html',page.replace(/<!-- NCN PIKACHU ART:start -->[\s\S]*?<!-- NCN PIKACHU ART:end -->/,block));
 return {href,sourceHash,columns,rows,cell,bytes:atlas.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildPikachuArt()));
