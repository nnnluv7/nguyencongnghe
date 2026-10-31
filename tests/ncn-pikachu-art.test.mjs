import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {SPECIES} from '../public/pikachu/core.js';

test('twenty distinct editable character symbols match the existing saved-game species IDs',async()=>{
 const svg=await readFile('public/pikachu/tiles.svg','utf8');
 const symbols=[...svg.matchAll(/<symbol\b[^>]*id="p(\d+)"[^>]*>([\s\S]*?)<\/symbol>/g)];
 assert.equal(symbols.length,SPECIES.length);assert.equal(new Set(symbols.map(x=>x[2])).size,20);
 assert.deepEqual(symbols.map(x=>Number(x[1])),SPECIES.map((_,i)=>i+1));
 assert.equal(/<(?:filter|image|foreignObject|script)\b|https?:\/\/(?!www\.w3\.org)/i.test(svg),false,'The vector masters must be local and self-contained');
});

test('the generated Retina atlas has a content hash, transparent pixels and the exact current vector source',async()=>{
 const css=await readFile('public/pikachu/tile-art.css','utf8'),svg=await readFile('public/pikachu/tiles.svg','utf8');
 assert.ok(css.includes(createHash('sha256').update(svg).digest('hex')),'Run node scripts/build-pikachu-art.mjs after changing the vector master');
 const url=css.match(/url\("([^"]+)"\)/)?.[1];assert.match(url,/^\/pikachu\/art\/[a-f0-9]{16}\.webp$/);
 const bytes=await readFile('public'+url),metadata=await sharp(bytes).metadata();
 assert.equal(metadata.width,1280);assert.equal(metadata.height,1024);assert.equal(metadata.hasAlpha,true);
 assert.ok(url.includes(createHash('sha256').update(bytes).digest('hex').slice(0,16)));
 assert.equal((await readdir('public/pikachu/art')).filter(x=>x.endsWith('.webp')).length,1,'No retired generated textures should ship');
 const page=await readFile('public/pikachu/index.html','utf8');assert.ok(page.includes('href="'+url+'" data-pk-art'));assert.ok(page.includes('/pikachu/tile-art.css'));
 const headers=await readFile('public/_headers','utf8');assert.match(headers,/\/pikachu\/art\/\*[\s\S]*?max-age=31536000, immutable/);
});
