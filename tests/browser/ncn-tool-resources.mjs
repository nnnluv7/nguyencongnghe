import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createHandler} from '../../netlify/lib/ncn-event-api.mjs';
import {memoryStore} from '../fixtures/arcade-store.mjs';

// Real Excel decoding, workbook downloads and private editor code, using fake
// local Identity/catalogue services. No account, price list or file is sent out.
const require=createRequire(import.meta.url),XLSX=require('../../public/assets/vendor/125962e77eb283b9aa.js');
const printCores={
 event:require('../../netlify/lib/ncn-event-private/core.cjs'),
 gvgs:require('../../netlify/lib/ncn-gvgs-private/core.cjs')
};
const printAssets={
 font:(await readFile('netlify/lib/ncn-event-private/mt2-mincap.woff2')).toString('base64'),
 frame:(await readFile('netlify/lib/ncn-event-private/stick.png')).toString('base64'),
 gv2:require('../../netlify/lib/ncn-gvgs-private/gv2-assets.cjs')(),
 qr:code=>require('qrcode/lib/core/qrcode.js').create(code,{errorCorrectionLevel:'M'}).modules
};
const root=resolve('dist'),origin='https://ncn-tool-resources.test',out=resolve('artifacts/tool-resources'),results=[],errors=[];await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const actor={id:'fixture-tool-admin',email:'tools@example.test',name:'Kiểm tra công cụ',admin:true,vip:true};
const jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:actor.id,email:actor.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const stores={event:memoryStore(),gvgs:memoryStore()},browser=await chromium.launch();let context,page,signedUser,excelRequests=0,failOnce=false;
const handlers=Object.fromEntries(Object.keys(printCores).map(name=>[name,createHandler({
 production:()=>true,
 verify:async req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?signedUser:null,
 store:()=>stores[name],
 asset:file=>readFile('netlify/lib/ncn-'+name+'-private/'+file,'utf8'),
 print:(items,settings)=>printCores[name].printable(items,settings,printAssets)
})]));
async function fixture({role,width=1280}={}){
 if(context)await context.close();
 signedUser=role?{...actor,admin:role==='admin',vipSource:role==='admin'?'admin':'manual'}:null;
 context=await browser.newContext({viewport:{width,height:width<600?844:960}});
 if(signedUser)await context.addCookies([{name:'nf_jwt',value:jwt,url:origin}]);
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!==origin){assert.equal(request.method(),'GET');return route.abort();}
  const headers=await request.allHeaders(),user=(headers.cookie||'').includes('nf_jwt='+jwt)?signedUser:null,json=(value,status=200)=>route.fulfill({status,contentType:mime['.json'],body:JSON.stringify(value)});
  if(url.pathname.startsWith('/.netlify/identity/'))return url.pathname.endsWith('/user')?json(user?{id:user.id,email:user.email,confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{roles:[user.admin?'admin':'vip']},user_metadata:{full_name:user.name}}:{msg:'Unauthorized'},user?200:401):json({disable_signup:false,external:{email:true}});
  if(url.pathname.startsWith('/.netlify/functions/')){
   const name=url.pathname.split('/').at(-1).replace('ncn-','');
   if(handlers[name]){const response=await handlers[name](new Request(request.url(),{method:request.method(),headers,...(request.method()==='POST'?{body:request.postData()}:{})}));return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
   return json(url.pathname.endsWith('ncn-billing')?{user}:{items:[],online:1,total:1});
  }
  if(/125962e77eb283b9aa/.test(url.pathname)){excelRequests++;if(failOnce){failOnce=false;return route.abort('failed');}}
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(path===root||path.startsWith(root+sep));if((await stat(path)).isDirectory())path+='/index.html';return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}
 });page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
}
async function check(name,fn){await fn();results.push({name,ok:true});console.log('PASS '+name);}
function workbook(rows){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'NCN');return Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));}
async function opened(path){await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);assert.equal(await page.evaluate(()=>!!window.XLSX),false);}
try{
 for(const [name,path,id,prefix]of [['ncn-sticker','/sticker/','ncn-sticker-app','st'],['ncn-popup','/popup-a7/','ncn-popup-app','st'],['ncn-store-tools','/ban-hang/','ncn-store-app','nt']])await check('Excel loads only on import and keeps real rows: '+path,async()=>{
  await fixture();const data=JSON.parse(await readFile('public/assets/'+name+'/catalogue.json','utf8')),core=await import('../../public/assets/'+name+'/core.js'),model=data.models.find(x=>(name!=='ncn-store-tools'||x.section==='sales')&&data.layouts.find(l=>l.id===x.variants[0].layout).fields.length),layout=data.layouts.find(x=>x.id===model.variants[0].layout);
  await opened(path+'?mau='+model.id);await page.locator('#'+id+'[data-ready=true]').waitFor();const before=excelRequests;
  const table=core.parseCSV(core.sampleCSV(layout));await page.locator('#'+prefix+'-file').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(table)});await page.locator('#'+prefix+'-status').filter({hasText:'Đã nhập'}).waitFor();assert.equal(excelRequests,before+1);assert.equal(await page.locator('#'+prefix+'-row-list [data-row]').count(),table.length-1);
 });
 await check('a failed Excel load keeps the chosen model and a second file selection retries',async()=>{
  await fixture();const data=JSON.parse(await readFile('public/assets/ncn-sticker/catalogue.json','utf8')),core=await import('../../public/assets/ncn-sticker/core.js'),model=data.models.find(x=>data.layouts.find(l=>l.id===x.variants[0].layout).fields.length),layout=data.layouts.find(x=>x.id===model.variants[0].layout),file={name:'retry.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(core.parseCSV(core.sampleCSV(layout)))};
  await opened('/sticker/?mau='+model.id);await page.locator('#ncn-sticker-app[data-ready=true]').waitFor();failOnce=true;await page.locator('#st-file').setInputFiles(file);await page.locator('#st-status').filter({hasText:'kết nối chậm'}).waitFor();await page.locator('#st-file').setInputFiles(file);await page.locator('#st-status').filter({hasText:'Đã nhập'}).waitFor();
 });
 await check('inventory exports its real sample after loading Excel on demand',async()=>{
  await fixture();await opened('/2024/01/ban-kiem-ke-san-pham-theo-file-excel.html');const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Tải file mẫu',exact:true}).click()]),book=XLSX.read(await readFile(await file.path()),{type:'buffer'}),rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});assert.equal(rows[1][0],'001234');
 });
 for(const name of ['event','gvgs'])await check('the authorized '+name+' editor imports stock and exports a workbook without eager Excel loading',async()=>{
  await fixture({role:'admin'});await opened('/in-'+name+'/');await page.locator('#vip-gate[data-ncn-gate-state=ready]').waitFor({state:'attached'});await page.locator('#ncn-event-app').waitFor();const before=excelRequests;
  const importer=page.locator('details.ncn-stock-import');if(await importer.count()&&await importer.getAttribute('open')===null)await importer.locator('summary').first().click();
  await page.locator('#ev-stock-file').setInputFiles({name:'ton-kho.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook([['Mã sản phẩm','Tên sản phẩm','Số lượng'],['001234','Sản phẩm thử',3]])});await page.locator('#ev-status').filter({hasText:'Đã đọc file tồn kho'}).waitFor();assert.equal(excelRequests,before+1);
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#ev-stock-template').click()]),book=XLSX.read(await readFile(await file.path()),{type:'buffer'}),rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});assert.equal(rows[0][0],'Mã sản phẩm');assert.equal(excelRequests,before+1);
 });
 for(const name of ['event','gvgs'])for(const role of ['admin','vip'])await check(name+' '+role+' can use the compact layout and reopen a real print',async()=>{
  const width=role==='admin'?1280:390;
  await stores[name].setJSON('campaign-fixture',{id:'fixture',name:'Điện máy cuối tuần',version:'fixture-1',updatedAt:'2026-11-14T00:00:00Z',items:[
   {code:'001234',name:'Tủ lạnh Inverter 300 lít',originalPrice:10990000,eventPrice:8990000},
   {code:'001235',name:'Máy giặt Inverter 10 kg',originalPrice:8490000,eventPrice:7290000}
  ]});
  await fixture({role,width});
  await opened('/in-'+name+'/');
  await page.locator('#ev-shared-info').filter({hasText:'Cập nhật'}).waitFor();
  assert.equal(await page.locator('.ncn-vip-source').count(),role==='admin'?1:0);
  const printToggle=page.locator(name==='gvgs'?'#ev-color':'#ev-cut');
  assert.equal(await printToggle.evaluate(input=>getComputedStyle(input).appearance),'auto');
  const campaign=await page.locator('#ev-saved-campaign').boundingBox(),search=await page.locator('#ev-search').boundingBox();
  const products=await page.locator('.ev-products').boundingBox(),history=await page.locator('.ev-history').boundingBox();
  if(width===1280){
   assert.ok(Math.abs(campaign.y-search.y)<4,'search is aligned with the campaign');
   assert.ok(history.x>=products.x+products.width&&Math.abs(history.y-products.y)<4,'history sits alongside the product list');
  }else{
   assert.ok(search.y>=campaign.y+campaign.height,'search stacks below the campaign');
   assert.ok(history.y>=products.y+products.height,'history follows the print controls');
  }
  const searchInput=page.locator('#ev-search');
  await searchInput.fill('001234');
  await page.getByRole('option',{name:/Tủ lạnh Inverter/}).click();
  await searchInput.fill('001235');
  await searchInput.press('Enter');
  const qty=page.locator('#ev-rows input').first();
  await qty.fill('2');
  await qty.press('Tab');
  assert.equal(await page.locator('#ev-label-count').textContent(),'3');
  const pageFits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  assert.ok(pageFits,'product rows do not overflow the viewport');
  await page.locator('#ev-size').selectOption(name==='gvgs'?'popup-gv2-a5':'136.26x136.26');
  await page.locator('#ev-preview').click();
  const dialog=page.locator('#ev-dialog[open]');
  await dialog.waitFor();
  const preview=page.frameLocator('#ev-preview-frame');
  const printedProduct=name==='gvgs'
   ?preview.locator('[data-code="001234"] input[value="Tủ lạnh Inverter 300 lít"]')
   :preview.getByText('Tủ lạnh Inverter 300 lít',{exact:true});
  await printedProduct.first().waitFor({state:'attached'});
  assert.equal(await printedProduct.count(),2);
  assert.match(await page.locator('#ev-preview-info').textContent(),name==='gvgs'?/3 bản · 3 trang A5/:/3 nhãn · 2 trang A4/);
  await dialog.locator('#ev-close').click();
  await page.locator('#ev-history').getByRole('button',{name:'Mở lại'}).click();
  await dialog.waitFor();
  await dialog.locator('#ev-close').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:out+'/'+name+'-'+width+'.jpg',type:'jpeg',fullPage:true,quality:82});
 });
 await check('original and optimized UI fonts retain Vietnamese, numbers and other-language text widths',async()=>{
  await fixture();await opened('/2024/02/kiem-quy.html');const index=JSON.parse(await readFile('public/assets/ncn-theme/font-subsets/manifest.json','utf8'));
  const differences=await page.evaluate(async index=>{const original='/assets/vendor/a699af1dea30b79931.ttf',full=new FontFace('NCNOriginal','url('+original+')'),ui=new FontFace('NCNSplit','url('+index.fonts[original].file+')',{unicodeRange:index.unicodeRange}),fallback=new FontFace('NCNSplit','url('+original+')',{unicodeRange:index.complementaryRange});for(const font of [full,ui,fallback])document.fonts.add(await font.load());const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');return ['Nguyễn Công Nghệ · Bảo Hiểm & Trả Chậm','Ă Â Đ Ê Ô Ơ Ư ă â đ ê ô ơ ư 1.234.567 ₫','Nguyễn'.normalize('NFD'),'Καλημέρα Привет NCN'].map(text=>{ctx.font='24px NCNOriginal';const a=ctx.measureText(text).width;ctx.font='24px NCNSplit';return Math.abs(a-ctx.measureText(text).width);});},index);assert.ok(differences.every(x=>x<.1),JSON.stringify(differences));
 });
 assert.deepEqual(errors,[]);
}catch(error){await page?.screenshot({path:out+'/failure.jpg',type:'jpeg',fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
