import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {normalizeSocialMetadata,SOCIAL_IMAGE,SITE_ORIGIN} from '../netlify/lib/ncn-social-meta.mjs';
import {articleHTML} from '../netlify/lib/ncn-library-page.mjs';

const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1];
const values=(html,key)=>[...html.split('</head>')[0].matchAll(/<meta\b[^>]*>/g)].map(m=>m[0]).filter(t=>(attr(t,'property')||attr(t,'name'))===key).map(t=>attr(t,'content'));
const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(dir+'/'+e.name):dir+'/'+e.name))).flat();

test('crawler HTML has one escaped, consistent social image instead of competing inherited brands',()=>{
  const html='<html><head><title>A &amp; B</title><link rel="canonical" href="/ban-hang/"><meta property="og:image" content="/assets/vendor/a46656098850edccf4.png"><meta content="/other.png" property="og:image"><meta property="og:title" content="Cũ"><meta property="og:title" content="Khác"><meta name="twitter:image" content="https://old.test/image.png"></head><body>Keep this body exactly.</body></html>';
  const result=normalizeSocialMetadata(html,{title:'A & B "NCN"',description:'Chia sẻ <dễ đọc>'});
  assert.deepEqual(values(result,'og:image'),[SOCIAL_IMAGE]);assert.deepEqual(values(result,'twitter:image'),[SOCIAL_IMAGE]);
  assert.deepEqual(values(result,'og:title'),['A &amp; B &quot;NCN&quot;']);assert.deepEqual(values(result,'og:description'),['Chia sẻ &lt;dễ đọc&gt;']);
  assert.deepEqual(values(result,'og:locale'),['vi_VN']);assert.deepEqual(values(result,'twitter:domain'),['nguyencongnghe.com']);
  assert.ok(result.includes('<body>Keep this body exactly.</body>'));assert.equal(normalizeSocialMetadata(result),result);
});

test('real article covers remain distinct and missing or unsafe covers use the local NCN image',()=>{
  const html='<head><title>NCN</title></head><body>Original</body>';
  for(const image of ['',undefined,'javascript:alert(1)','https://www.chuyengia.vip/chuyengia.png'])assert.deepEqual(values(normalizeSocialMetadata(html,{image}),'og:image'),[SOCIAL_IMAGE]);
  const result=normalizeSocialMetadata(html,{image:'/assets/vendor/article.png',url:'/bai-viet/vi-du/',type:'article'});
  assert.deepEqual(values(result,'og:image'),[SITE_ORIGIN+'/assets/vendor/article.png']);assert.deepEqual(values(result,'twitter:image'),values(result,'og:image'));
  assert.deepEqual(values(result,'og:url'),[SITE_ORIGIN+'/bai-viet/vi-du/']);assert.deepEqual(values(result,'og:type'),['article']);assert.equal(values(result,'og:image:width').length,0);
});

test('managed articles publish their current title, canonical and cover before any JavaScript runs',async()=>{
  const articleShell=()=>readFile('netlify/lib/ncn-library/article-shell.html','utf8');
  const item={title:'Tiêu đề & mới',summary:'Mô tả đã sửa',href:'/bai-viet/thu/',id:'test',datetime:'2026-10-29T00:00:00Z'};
  for(const image of ['', '/assets/vendor/article.png']){
    const html=await articleHTML({articleShell},{...item,image},'Nội dung bài viết',[]);
    assert.deepEqual(values(html,'og:title'),['Tiêu đề &amp; mới']);assert.deepEqual(values(html,'og:description'),[item.summary]);
    assert.deepEqual(values(html,'og:url'),[SITE_ORIGIN+item.href]);assert.deepEqual(values(html,'twitter:domain'),['nguyencongnghe.com']);
    assert.deepEqual(values(html,'og:image'),[image?SITE_ORIGIN+image:SOCIAL_IMAGE]);assert.deepEqual(values(html,'twitter:image'),values(html,'og:image'));
    assert.ok(html.includes('rel="canonical" href="'+SITE_ORIGIN+item.href+'"'));assert.ok(html.includes('Nội dung bài viết'));
  }
});

test('all public sources have one absolute OG/Twitter set, correct route and no retired share image',async()=>{
  const pages=(await walk('public')).filter(p=>p.endsWith('.html'));
  assert.equal(pages.length,122);
  for(const path of pages){
    const html=await readFile(path,'utf8'),url=new URL(path==='public/index.html'?'/':'/'+path.slice(7).replace(/index\.html$/,''),SITE_ORIGIN).href;
    for(const key of ['og:title','og:url','og:description','og:image','twitter:title','twitter:description','twitter:image'])assert.equal(values(html,key).length,1,path+' '+key);
    assert.deepEqual(values(html,'og:url'),[url],path);assert.deepEqual(values(html,'og:image'),values(html,'twitter:image'),path);
    const image=new URL(values(html,'og:image')[0]);assert.ok(['https:','http:'].includes(image.protocol));assert.doesNotMatch(image.href,/a46656098850edccf4|chuyengia/i);
    if(image.origin===SITE_ORIGIN)assert.ok((await stat('public'+decodeURIComponent(image.pathname))).isFile(),path+' share image');
    assert.equal(values(html,'twitter:domain')[0],'nguyencongnghe.com',path);
  }
});

test('the chat-compatible NCN PNG is 1200 × 630 and stays below 150 KB',async()=>{
  const bytes=await readFile('public'+new URL(SOCIAL_IMAGE).pathname);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);assert.ok(bytes.length<150000,bytes.length+' bytes');
});

test('retired barcode loads are absent, actual QR consumers and exam history keep their dependencies',async()=>{
  for(const file of (await walk('public')).filter(p=>p.endsWith('.html'))){const html=await readFile(file,'utf8');assert.ok(!html.includes('aa6e8dfded6a0c4cb4.js'),file);if(!file.endsWith('/p/lich-su-thi.html'))for(const script of ['82a51e5c929898de8e.js','61f5ec9b240aa960ca.js','0ca0b0d3937c316ea2.js'])assert.ok(!html.includes(script),file);}
  for(const path of ['2022/12/qrcode.html','2024/01/ban-kiem-ke-san-pham-theo-file-excel.html','2024/04/qrcode-generator-tao-ma-qrcode.html'])assert.ok((await readFile('public/'+path,'utf8')).includes('8d243afceff6c25537.js'),path);
  const history=await readFile('public/p/lich-su-thi.html','utf8');assert.ok(history.includes('0ca0b0d3937c316ea2.js'));assert.ok(history.includes('b638b6b6b0e4f4118c.js'));
  const lookup=JSON.parse(await readFile('public/assets/asset-map.json','utf8'));for(const path of new Set(Object.values(lookup)))assert.ok((await stat('public'+path)).isFile(),path);
});
