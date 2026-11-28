import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

const origin='https://returns.example.test',root=resolve('dist'),out=resolve('artifacts/returns-editor');
await mkdir(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==origin)return route.abort();
 if(url.pathname.startsWith('/.netlify/'))return route.fulfill({json:{items:[],user:null,allowed:false,signedIn:false,total:0,online:0}});
 const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
 try{return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(resolve(root,'.'+path))});}
 catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
const path='/ban-hang/?mau=sales-doi-tra-bao-hanh';
try{
 await page.goto(origin+path);let preview=page.frameLocator('#nt-preview');await preview.locator('.returns-slip').first().waitFor();
 assert.equal(await page.locator('#nt-returns-text-editor').count(),0);
 const original=await preview.locator('.returns-slip').first().innerHTML();
 await page.goto(origin+path+'&sua=1');await page.locator('#nt-returns-text-editor').waitFor();
 preview=page.frameLocator('#nt-preview');const first=preview.locator('[data-ncn-return-block="0"]').first();await first.waitFor();
 assert.ok(await preview.locator('[contenteditable=true]').count()>20);
 await first.fill('CHÍNH SÁCH ĐỔI TRẢ VÀ BẢO HÀNH');
 await page.waitForFunction(()=>[...document.getElementById('nt-preview').contentDocument.querySelectorAll('h1')].every(node=>node.textContent==='CHÍNH SÁCH ĐỔI TRẢ VÀ BẢO HÀNH'));
 await page.getByText('Đã lưu nháp trên trình duyệt này.',{exact:false}).waitFor();
 // Emphasis remains editable without replacing the surrounding paragraph.
 const bold=preview.locator('[data-ncn-return-block] strong').first();await bold.click();await page.keyboard.type(' thử');
 const changedBold=await bold.textContent();assert.ok(changedBold.includes('thử'));
 await page.screenshot({path:out+'/editing-desktop.png',fullPage:true});
 const fieldsTab=page.getByRole('button',{name:'Nhập nội dung',exact:true});if(await fieldsTab.isVisible())await fieldsTab.click();
 await page.locator('.ncn-print-settings > summary').click();
 for(const [paper,count] of [['A4',2],['A5',1]]){
  await page.locator('#nt-paper').selectOption(paper);
  await page.waitForFunction(count=>document.getElementById('nt-preview').contentDocument.querySelectorAll('.returns-slip').length===count,count);
  await preview.locator('[contenteditable=true]').first().waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#nt-download').click()]);
  const html=await readFile(await download.path(),'utf8');
  assert.equal((html.match(/CHÍNH SÁCH ĐỔI TRẢ VÀ BẢO HÀNH<\/h1>/g)||[]).length,count);
  assert.equal(html.split('<strong>'+changedBold+'</strong>').length-1,count);
  assert.doesNotMatch(html,/contenteditable|data-ncn-return-block/);
  const printed=await context.newPage();await printed.setContent(html);await printed.evaluate(()=>document.fonts.ready);
  const pdf=await printed.pdf({preferCSSPageSize:true,printBackground:true});
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
  await printed.close();
 }
 await page.reload();await page.locator('#nt-returns-text-editor').waitFor();
 assert.equal(await page.frameLocator('#nt-preview').locator('h1').first().textContent(),'CHÍNH SÁCH ĐỔI TRẢ VÀ BẢO HÀNH');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.screenshot({path:out+'/editing-mobile.png',fullPage:true});
 await page.goto(origin+path);await page.frameLocator('#nt-preview').locator('.returns-slip').first().waitFor();
 assert.equal(await page.locator('#nt-returns-text-editor').count(),0);
 assert.equal(await page.frameLocator('#nt-preview').locator('.returns-slip').first().innerHTML(),original);
 assert.deepEqual(errors,[]);
 console.log('PASS opt-in editing, emphasis, synchronized copies, draft recovery, passive A4/A5 one-page output, mobile and unchanged public template');
}catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
