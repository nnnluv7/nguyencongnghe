import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Core from '../netlify/lib/ncn-gvgs-private/core.cjs';
import loadGV2Assets from '../netlify/lib/ncn-gvgs-private/gv2-assets.cjs';
import {createHandler} from '../netlify/lib/ncn-event-api.mjs';

const publicDirectory=fileURLToPath(new URL('../public',import.meta.url));
const gv2=loadGV2Assets(publicDirectory);
const product={code:'123456',name:'Máy giặt LG Inverter 9 kg',qty:1,originalPrice:10990000,eventPrice:7990000};
const settings={format:'popup-gv2-a4',period:'TỪ 16/10 ĐẾN 18/10',quota:'10 SUẤT/NGÀY'};

test('uses the original gv-2 template, artwork and both embedded fonts',()=>{
  const catalogue=JSON.parse(readFileSync(publicDirectory+'/assets/ncn-popup/catalogue.json','utf8'));
  assert.deepEqual(gv2.layout,catalogue.layouts.find(item=>item.id==='gv-2'));
  const printed=Core.printable([product],settings,{gv2});
  const background=readFileSync(publicDirectory+'/assets/ncn-popup/media/gv2-c58265ed88eabe63.png').toString('base64');
  assert.ok(printed.html.includes('data:image/png;base64,'+background));
  assert.equal((printed.html.match(/data:font\/woff2;base64,/g)||[]).length,2);
  assert.ok(!/url\(["']?\//.test(printed.html),'downloaded printout must work without asset requests');
  for(const value of [product.name,'10.990.000','7.990.000',settings.period,settings.quota])assert.ok(printed.html.includes('value="'+value+'"'));
});

test('A4 and A5 retain source proportions and print only requested copies',()=>{
  for(const [format,paper,width,height] of [['popup-gv2-a4','A4',210,297],['popup-gv2-a5','A5',148,210]]){
    const printed=Core.printable([{...product,qty:2},{...product,code:'789',name:'Tủ lạnh',qty:1}],{...settings,format},{gv2});
    assert.equal(printed.labels,3);assert.equal(printed.pages,3);assert.equal(printed.perPage,1);
    assert.equal(printed.paper,paper);
    assert.ok(printed.html.includes('@page{size:'+paper+' portrait;margin:0}'));
    assert.ok(printed.html.includes('width:'+width+'mm;height:'+height+'mm'));
    assert.equal((printed.html.match(/class="ncn-sheet"/g)||[]).length,3);
    assert.equal((printed.html.match(/data-code="123456"/g)||[]).length,2);
    assert.equal((printed.html.match(/data:image\/png;base64,/g)||[]).length,1);
  }
});

test('escapes input including replacement tokens and allows empty optional lines',()=>{
  const name='LG $& $` $\' "<script>alert(1)</script>';
  const printed=Core.printable([{...product,name}],{format:'popup-gv2-a4'},{gv2});
  assert.ok(printed.html.includes('value="'+Core.esc(name)+'"'));
  assert.ok(!printed.html.includes('<script>'));
  assert.equal((printed.html.match(/value=""/g)||[]).length,2);
  assert.throws(()=>Core.printable([product],{...settings,quota:'x'.repeat(81)},{gv2}));
  assert.throws(()=>Core.printable([{...product,qty:1501}],settings,{gv2}));
  assert.throws(()=>Core.printable([{...product,eventPrice:11990000}],settings,{gv2}));
});

test('old popup and sticker formats remain available',()=>{
  const assets={font:'dGVzdA==',frame:'dGVzdA==',qr:()=>({size:1,get:()=>true})};
  for(const [format,perPage] of [['popup-a5',2],['popup-full',1],['sticker-small',6],['sticker-medium',2],['sticker-large',1]]){
    const printed=Core.printable([{...product,qty:3}],{format},assets);
    assert.equal(printed.labels,3);assert.equal(printed.perPage,perPage);assert.equal(printed.pages,Math.ceil(3/perPage));
  }
});

function request(payload){return new Request('https://nguyencongnghe.com/.netlify/functions/ncn-gvgs?route=print',{method:'POST',headers:{origin:'https://nguyencongnghe.com','content-type':'application/json'},body:JSON.stringify(payload)});}
function handler(user){return createHandler({production:()=>true,verify:async()=>user,store:()=>({get:async key=>key==='campaign-demo'?{items:[product]}:null}),print:(items,options)=>Core.printable(items,options,{gv2})});}

test('VIP prints current server prices and the new campaign text',async()=>{
  const response=await handler({id:'vip-test',vip:true})(request({items:[{...product,name:'Tampered',eventPrice:1}],settings:{...settings,catalogueId:'demo'}}));
  assert.equal(response.status,200);
  const printed=await response.json();
  assert.ok(printed.html.includes('value="7.990.000"'));
  assert.ok(printed.html.includes('value="'+product.name+'"'));
  assert.ok(printed.html.includes('value="10 SUẤT/NGÀY"'));
  assert.ok(!printed.html.includes('Tampered'));
});

test('new template retains login, VIP and catalogue requirements',async()=>{
  for(const [user,status] of [[null,401],[{id:'normal'},403],[{id:'vip-test',vip:true},400]]){
    const response=await handler(user)(request({items:[product],settings}));
    assert.equal(response.status,status);
  }
});
