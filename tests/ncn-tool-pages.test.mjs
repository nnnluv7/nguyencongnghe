import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLASS_COLORS} from '../public/assets/ncn-wheel/app.js';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
test('retained tool controls have their final screen styles before the body starts',()=>{
  for(const path of ['ban-hang/index.html','2024/04/qrcode-generator-tao-ma-qrcode.html','2024/01/ban-kiem-ke-san-pham-theo-file-excel.html','2024/01/in-fifo.html','2025/05/tu-van.html','vong-quay-may-man/index.html']){
    const html=read(path);assert.ok(html.indexOf('tool-pages.css?v=20261024-tools-2')<html.indexOf('</head>'),path);
    assert.match(html,/<body[^>]*ncn-refined-tool/);
  }
});
test('wheel initial SVG already uses the same glass gradients as its running renderer',()=>{
  const html=read('vong-quay-may-man/index.html'),svg=html.match(/<svg id="lw-wheel"[\s\S]*?<\/svg>/)[0];
  assert.equal((svg.match(/<linearGradient /g)||[]).length,8);assert.equal((svg.match(/class="lw-sector"/g)||[]).length,8);
  for(const [light,color] of GLASS_COLORS){assert.ok(svg.includes('stop-color="'+light+'"'));assert.ok(svg.includes('stop-color="'+color+'"'));}
  assert.equal(/<path[^>]*fill="#[0-9a-f]+"/i.test(svg),false);
  assert.equal(html.includes('class="lw-list-actions"'),false);
});
test('FIFO retains the exact 48-label print artwork while its wrappers are rendered statically',()=>{
  const html=read('2024/01/in-fifo.html');
  const start=html.indexOf('<div id="printMe">');let depth=0,end=start;
  for(const tag of html.slice(start).matchAll(/<\/?div\b[^>]*>/g)){
    depth+=tag[0].startsWith('</')?-1:1;
    if(depth===0){end=start+tag.index+tag[0].length;break;}
  }
  const sheet=html.slice(start,end);
  assert.equal((sheet.match(/<textarea/g)||[]).length,48);
  assert.equal(createHash('sha256').update(sheet).digest('hex'),'2c474a9253357d03984e85569275fbc01dd74e708b52755322519fd9b784628f');
  assert.equal((html.match(/class="ncn-mobile-table-scroll"/g)||[]).length,1);
  assert.equal((html.match(/class="ncn-mobile-sheet-viewport"/g)||[]).length,1);
});
test('modern form markup retains every existing calculation and stocktaking control',()=>{
  for(const [path,ids] of [
    ['2024/04/qrcode-generator-tao-ma-qrcode.html',['textCode','qrcode']],
    ['2024/01/ban-kiem-ke-san-pham-theo-file-excel.html',['input','start','previous','next','current','total','masanpham','tensanpham','soluong','qrcode']],
    ['2025/05/tu-van.html',['cb1','cb2','cb3','cb4','nhomhang','giagoc','giaban','phidongtien','tratruoc','kieutratruoc','laisuat','goi','tratruocfn','nolai','gopmoithang','tongtien','chenhlech']]
  ]){const html=read(path);for(const id of ids)assert.ok(html.includes('id="'+id+'"'),path+': '+id);}
});
test('flight starts with the same NCN shell, search, account and current configuration as every page',()=>{
  const html=read('flappy-bird/index.html');
  assert.match(html,/<img src="\/assets\/ncn-theme\/logo\.png"/);
  assert.equal((html.match(/class="ncn-nav-link"/g)||[]).length,JSON.parse(read('assets/ncn-theme/config.json')).tools.length+2);
  for(const id of ['ncn-site-shell','ncn-menu-open','ncn-sidebar','ncn-topbar','ncn-search-dialog','ncn-account-host'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.equal(html.includes('site-bridge.'),false);
  const config=JSON.parse(html.match(/<script id="ncn-initial-config" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(config,JSON.parse(read('assets/ncn-theme/config.json')));
});
