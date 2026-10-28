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
const root=resolve('dist'),origin='https://ncn-tool-resources.test',out=resolve('artifacts/tool-resources'),results=[],errors=[];await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const actor={id:'fixture-tool-admin',email:'tools@example.test',name:'Kiểm tra công cụ',admin:true,vip:true};
const jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:actor.id,email:actor.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const handlers=Object.fromEntries(['event','gvgs'].map(name=>[name,createHandler({production:()=>true,verify:async req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?actor:null,store:()=>stores[name],asset:file=>readFile('netlify/lib/ncn-'+name+'-private/'+file,'utf8')})]));
const stores={event:memoryStore(),gvgs:memoryStore()},browser=await chromium.launch();let context,page,excelRequests=0,failOnce=false;
async function fixture(signed=false){
 if(context)await context.close();context=await browser.newContext({viewport:{width:1280,height:960}});if(signed)await context.addCookies([{name:'nf_jwt',value:jwt,url:origin}]);
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!==origin){assert.equal(request.method(),'GET');return route.abort();}
  const headers=await request.allHeaders(),signed=(headers.cookie||'').includes('nf_jwt='+jwt),json=(value,status=200)=>route.fulfill({status,contentType:mime['.json'],body:JSON.stringify(value)});
  if(url.pathname.startsWith('/.netlify/identity/'))return url.pathname.endsWith('/user')?json(signed?{id:actor.id,email:actor.email,confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{roles:['admin']},user_metadata:{full_name:actor.name}}:{msg:'Unauthorized'},signed?200:401):json({disable_signup:false,external:{email:true}});
  if(url.pathname.startsWith('/.netlify/functions/')){
   const name=url.pathname.split('/').at(-1).replace('ncn-','');
   if(handlers[name]){const response=await handlers[name](new Request(request.url(),{method:request.method(),headers,...(request.method()==='POST'?{body:request.postData()}:{})}));return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}
   return json(url.pathname.endsWith('ncn-billing')?{user:signed?actor:null}:{items:[],online:1,total:1});
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
  await fixture(true);await opened('/in-'+name+'/');await page.locator('#vip-gate[data-ncn-gate-state=ready]').waitFor({state:'attached'});await page.locator('#ncn-event-app').waitFor();const before=excelRequests;
  const importer=page.locator('details.ncn-stock-import');if(await importer.count()&&await importer.getAttribute('open')===null)await importer.locator('summary').first().click();
  await page.locator('#ev-stock-file').setInputFiles({name:'ton-kho.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook([['Mã sản phẩm','Tên sản phẩm','Số lượng'],['001234','Sản phẩm thử',3]])});await page.locator('#ev-status').filter({hasText:'Đã đọc file tồn kho'}).waitFor();assert.equal(excelRequests,before+1);
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#ev-stock-template').click()]),book=XLSX.read(await readFile(await file.path()),{type:'buffer'}),rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});assert.equal(rows[0][0],'Mã sản phẩm');assert.equal(excelRequests,before+1);
 });
 await check('original and optimized UI fonts retain Vietnamese, numbers and other-language text widths',async()=>{
  await fixture();await opened('/2024/02/kiem-quy.html');const index=JSON.parse(await readFile('public/assets/ncn-theme/font-subsets/manifest.json','utf8'));
  const differences=await page.evaluate(async index=>{const original='/assets/vendor/a699af1dea30b79931.ttf',full=new FontFace('NCNOriginal','url('+original+')'),ui=new FontFace('NCNSplit','url('+index.fonts[original].file+')',{unicodeRange:index.unicodeRange}),fallback=new FontFace('NCNSplit','url('+original+')',{unicodeRange:index.complementaryRange});for(const font of [full,ui,fallback])document.fonts.add(await font.load());const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');return ['Nguyễn Công Nghệ · Bảo Hiểm & Trả Chậm','Ă Â Đ Ê Ô Ơ Ư ă â đ ê ô ơ ư 1.234.567 ₫','Nguyễn'.normalize('NFD'),'Καλημέρα Привет NCN'].map(text=>{ctx.font='24px NCNOriginal';const a=ctx.measureText(text).width;ctx.font='24px NCNSplit';return Math.abs(a-ctx.measureText(text).width);});},index);assert.ok(differences.every(x=>x<.1),JSON.stringify(differences));
 });
 assert.deepEqual(errors,[]);
}catch(error){await page?.screenshot({path:out+'/failure.jpg',type:'jpeg',fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
