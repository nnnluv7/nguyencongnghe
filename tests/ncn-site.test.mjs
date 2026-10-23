import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../public');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):[join(dir,entry.name)]);}
const pages=files(root).filter(path=>path.endsWith('.html'));
const redirects=readFileSync(join(root,'_redirects'),'utf8').split('\n').filter(line=>line.trim()&&!line.startsWith('#')).map(line=>line.trim().split(/\s+/));
const stripScripts=source=>source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
test('all public pages have one navigation and no duplicate DOM IDs',()=>{
  for(const path of pages){
    const source=readFileSync(path,'utf8'),markup=stripScripts(source);
    const ids=(markup.match(/<[a-z][^>]*>/gi)||[]).map(tag=>tag.match(/\sid="([^"]+)"/)?.[1]).filter(Boolean);
    assert.equal(new Set(ids).size,ids.length,path);
    if(path===join(root,'flappy-bird/index.html')){
      assert.equal(ids.filter(id=>id==='ncn-game-sidebar').length,1,path);
      continue;
    }
    assert.equal(ids.filter(id=>id==='ncn-site-shell').length,1,path);
    assert.equal(ids.filter(id=>id==='ncn-footer').length,1,path);
    assert.equal([...source.matchAll(/<script[^>]+src="\/assets\/ncn-theme\/theme\.js[^"<>]*"/g)].length,1,path);
    assert.equal(source.includes('id="ncn-appearance-style"'),false,path);
  }
});
test('local script, stylesheet and image references resolve',()=>{
  for(const path of pages){
    const markup=readFileSync(path,'utf8');
    const tags=markup.match(/<(?:script|link|img)\b[^>]*>/gi)||[];
    for(const tag of tags){
      if(/^<link/i.test(tag)&&!tag.includes('rel="stylesheet"'))continue;
      const ref=tag.match(/\b(?:src|href)="([^"]+)"/)?.[1];
      if(!ref||/^(?:[a-z]+:|\/\/|#)/i.test(ref))continue;
      const pathname=decodeURIComponent(ref.split(/[?#]/)[0]);
      const target=pathname.startsWith('/')?join(root,pathname):resolve(dirname(path),pathname);
      assert.ok(existsSync(target)||redirects.some(([from])=>from===pathname),path+': '+ref);
    }
  }
});
test('retired editor URLs redirect to a single existing editor',()=>{
  for(const [from,to] of [['/p/sticker.html','/sticker/'],['/p/popup-a7.html','/popup-a7/'],['/p/popup-a4-a5-a6.html','/popup-a4-a5-a6/']]){
    assert.equal(existsSync(join(root,from)),false);
    assert.ok(existsSync(join(root,to,'index.html')));
    assert.ok(redirects.some(([a,b,status])=>a===from&&b===to&&status==='301'));
  }
});
test('shared catalogue deletion controls are only in ADMIN templates',()=>{
  for(const tool of ['event','gvgs']){
    const dir=resolve(root,'../netlify/lib/ncn-'+tool+'-private');
    const admin=readFileSync(join(dir,'admin.html'),'utf8'),vip=readFileSync(join(dir,'vip.html'),'utf8');
    assert.equal((admin.match(/id="ev-delete-catalogue"/g)||[]).length,1);
    assert.equal((admin.match(/id="ev-clear-prices"/g)||[]).length,1);
    assert.equal(vip.includes('id="ev-delete-catalogue"'),false);
    assert.equal(vip.includes('id="ev-clear-prices"'),false);
  }
});
test('every page discovers final styles in its head and includes one shared announcement bar',()=>{
  for(const path of pages){
    const source=readFileSync(path,'utf8'),headEnd=source.indexOf('</head>');
    for(const match of source.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g))assert.ok(match.index<headEnd,path+': stylesheet discovered after body starts');
    assert.equal((source.match(/id="ncn-announcement"/g)||[]).length,1,path);
    assert.equal((source.match(/src="\/assets\/ncn-theme\/announcements\.js[^"<>]*"/g)||[]).length,1,path);
    assert.equal(source.includes('/assets/js/d4f21841d43fe64968.js'),false,path);
    if(!path.includes('flappy-bird'))assert.ok(source.includes('site.css?v=20261024-first-paint-1'),path);
  }
});
test('cash and private editor layouts are compact before any script executes',()=>{
  const cash=readFileSync(join(root,'2024/02/kiem-quy.html'),'utf8');
  assert.ok(cash.includes('class="cq-compact"'));assert.ok(cash.includes('class="cq-compact-grid"'));assert.equal(cash.includes('class="cq-workspace"'),false);
  for(const tool of ['event','gvgs'])for(const name of ['admin','vip']){
    const template=readFileSync(resolve(root,'../netlify/lib/ncn-'+tool+'-private/'+name+'.html'),'utf8');
    assert.ok(template.includes('class="ncn-stock-import"'));assert.ok(template.includes('ncn-workspace-compact'));
  }
});
test('initial page configuration matches the latest shared catalogue',()=>{
  const config=JSON.parse(readFileSync(join(root,'assets/ncn-theme/config.json'),'utf8'));
  for(const path of pages){
    if(path===join(root,'flappy-bird/index.html'))continue;
    const source=readFileSync(path,'utf8'),match=source.match(/<script id="ncn-initial-config" type="application\/json">([\s\S]*?)<\/script>/);
    assert.ok(match,path);assert.deepEqual(JSON.parse(match[1]),config,path);
  }
});
