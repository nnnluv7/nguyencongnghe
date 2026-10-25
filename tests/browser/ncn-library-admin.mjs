import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createLibraryHandler} from '../../netlify/lib/ncn-library-api.mjs';
import {createLibraryPageHandler} from '../../netlify/lib/ncn-library-page.mjs';

// Synthetic HTTPS origin. Real handlers and the real UI use an isolated memory
// store; no production Identity, content, payment or external write is possible.
const origin='https://ncn-admin.test',root=resolve('public'),out=resolve('artifacts/library-admin');
await mkdir(out,{recursive:true});
const read=path=>readFile(path,'utf8');
const seed=JSON.parse(await read('netlify/lib/ncn-library/seed.json'));
const originalBodies=JSON.parse(await read('netlify/lib/ncn-library/original-markdown.json'));
const entries=new Map();let serial=0,failDelete=false,losePurgeReply=false;
const store={async get(key){return structuredClone(entries.get(key)?.data??null);},async getWithMetadata(key){return structuredClone(entries.get(key)??null);},async *list({prefix}){yield {blobs:[...entries.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};},async delete(key){if(failDelete){failDelete=false;throw Error('Fixture cleanup interruption');}entries.delete(key);},async setJSON(key,data,options={}){
  const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
  entries.set(key,{data:structuredClone(data),etag:'"'+(++serial)+'"'});return {modified:true};
}};
const users=new Map([
  ['admin@example.test',{id:'admin',email:'admin@example.test',name:'Admin thử nghiệm',admin:true,vip:true}],
  ['vip@example.test',{id:'vip',email:'vip@example.test',name:'Thành viên VIP',admin:false,vip:true}]
]),tokens=new Map();
const raw=user=>({id:user.id,email:user.email,confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{roles:user.admin?['admin']:['vip']},user_metadata:{full_name:user.name,roles:['admin']}});
const tokenUser=req=>tokens.get(decodeURIComponent((req.headers.get('cookie')||'').match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1]||''))||null;
const deps={seed,originalBodies,production:()=>true,store:()=>store,verify:async req=>tokenUser(req),app:view=>read('netlify/lib/ncn-library/admin-'+(view==='library'?'library':'hub')+'.html')};
const handler=createLibraryHandler(deps),pageHandler=createLibraryPageHandler({...deps,homeShell:()=>read('public/index.html'),indexShell:()=>read('public/thu-vien/index.html'),articleShell:()=>read('netlify/lib/ncn-library/article-shell.html'),original:path=>read('public/'+path)});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const browser=await chromium.launch(),results=[];let page;
async function context(){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){assert.notEqual(request.method(),'POST','No external writes');return route.abort();}
    const headers=await request.allHeaders();
    const req=new Request(request.url(),{method:request.method(),headers,...(['GET','HEAD'].includes(request.method())?{}:{body:request.postData()||''})});
    const user=tokenUser(req),identityUser=tokens.get((headers.authorization||'').replace(/^Bearer /,''))||user;
    const reply=(data,status=200,type='application/json')=>route.fulfill({status,contentType:type,body:typeof data==='string'?data:JSON.stringify(data)});
    const respond=async response=>route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    if(url.pathname.startsWith('/.netlify/identity/')){
      const action=url.pathname.split('/').at(-1);
      if(action==='settings')return reply({autoconfirm:true,disable_signup:false,external:{email:true}});
      if(action==='token'){
        const data=Object.fromEntries(new URLSearchParams(request.postData()||'')),u=users.get(data.username)||[...users.values()].find(x=>'refresh-'+x.id===data.refresh_token);
        if(!u||data.grant_type==='password'&&data.password!=='Example123!')return reply({error_description:'Fixture credentials only'},400);
        const token=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';tokens.set(token,u);
        return reply({access_token:token,refresh_token:'refresh-'+u.id,expires_in:3600,token_type:'bearer',user:raw(u)});
      }
      if(action==='user')return reply(identityUser?raw(identityUser):{error:'Unauthorized'},identityUser?200:401);
      if(action==='logout')return reply({});
      throw Error('Unmocked Identity action '+action);
    }
    if(url.pathname==='/.netlify/functions/ncn-library'){const response=await handler(req);if(losePurgeReply&&url.searchParams.get('route')==='purge'&&response.ok){losePurgeReply=false;return route.abort('failed');}return respond(response);}
    if(url.pathname==='/.netlify/functions/ncn-billing')return reply({user});
    if(url.pathname==='/.netlify/functions/ncn-announcements')return reply({items:[],admin:!!user?.admin});
    if(url.pathname==='/.netlify/functions/ncn-visitors')return reply({total:1,online:1});
    if(url.pathname.startsWith('/.netlify/functions/'))throw Error('Unexpected function '+url.pathname);
    let query=null;
    if(['/','/index.html'].includes(url.pathname))query='view=home';
    if(['/thu-vien/','/thu-vien/index.html'].includes(url.pathname))query='view=index';
    const article=url.pathname.match(/^\/bai-viet\/([^/]+)\/?$/);if(article)query='slug='+encodeURIComponent(article[1]);
    const original=seed.find(x=>x.managedPage&&[x.href,x.href.replace(/\.html$/,''),x.href.replace(/\.html$/,'/')].includes(url.pathname));if(original)query='legacy='+original.id;
    if(query)return respond(await pageHandler(new Request(origin+'/.netlify/functions/ncn-library-page?'+query,{headers})));
    assert.equal(request.method(),'GET','Only fixture APIs can write');
    try{
      let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('Outside public');
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      return route.fulfill({status:200,contentType:types[extname(file)]||'application/octet-stream',body:await readFile(file)});
    }catch{return reply('Not found',404,'text/plain');}
  });
  return ctx;
}
async function open(ctx,path){const p=await ctx.newPage();await p.goto(origin+path,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.NCNAccount?.state.ready);return p;}
async function login(p,email){
  await p.evaluate(()=>window.NCNAccount.open('login'));
  const form=p.locator('[data-account-form=login]');await form.locator('[name=email]').fill(email);await form.locator('[name=password]').fill('Example123!');await form.locator('[type=submit]').click();
  try{await p.waitForFunction(()=>!!window.NCNAccount.state.user&&!document.getElementById('ncn-account-dialog').open);}
  catch(error){await p.screenshot({path:out+'/login-failure.jpg',type:'jpeg',quality:80});console.log(await p.evaluate(()=>({message:document.getElementById('ncn-account-message')?.textContent,ready:NCNAccount.state.ready,user:NCNAccount.state.user,error:NCNAccount.state.error?.message})));throw error;}
}
async function check(name,action){try{await action();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}}
async function saved(p,pattern=/Đã lưu/){await p.waitForFunction(()=>!document.getElementById('nl-refresh').disabled);await p.locator('#nl-status').filter({hasText:pattern}).waitFor();}
async function choose(p,item){await p.locator('#nl-search').fill(item.title);await p.locator('[data-article-id="'+item.id+'"]').click();await p.waitForFunction(id=>new URL(location.href).searchParams.get('id')===id,item.id);await p.waitForFunction(()=>!document.getElementById('nl-save').disabled);}
async function fits(p){const size=await p.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.content<=size.viewport+1,JSON.stringify(size));}
let guest,vip,admin,reader,editor,newArticle,homeReader;
try{
  guest=await context();page=await open(guest,'/');
  await check('the homepage welcome panel is replaced by exactly the four newest public articles',async()=>{
    await page.locator('#ncn-articles a').first().waitFor();assert.equal(await page.locator('#ncn-welcome-panel').count(),0);assert.equal(await page.locator('details #ncn-articles').count(),0);
    assert.equal(await page.locator('#ncn-home').evaluate(node=>node.firstElementChild.id),'ncn-home-latest');assert.equal(await page.locator('#ncn-articles a').count(),4);
    assert.deepEqual(await page.locator('#ncn-articles a').evaluateAll(nodes=>nodes.map(x=>x.getAttribute('href'))),[
      '/2024/06/copilot-plus-cua-windows-11-bi-be-khoa-chay-muot-ma-tren-cac-may-doi-cu.html',
      '/2024/06/microsoft-tien-gan-den-giai-doan-loai-bo-nhung-thanh-phan-quen-thuoc-tren-windows.html',
      '/2024/06/leica-lux-ra-mat-tren-iphone-gia-1-trieu-8-cho-nguoi-dung-tan-huong-may-anh-cua-nha-giau.html',
      '/2024/04/giai-tri-nhung-tinh-huong-do-khoc-do-cuoi-khong-noi-thanh-loi.html'
    ]);
    assert.equal(await page.evaluate(()=>window.NCN_LIBRARY_SNAPSHOT),true);await fits(page);await page.screenshot({path:out+'/home-latest-desktop.jpg',type:'jpeg',quality:80});
  });
  await check('guests do not see the Admin menu or private management screens',async()=>{
    assert.equal(await page.locator('#ncn-admin-navigation').count(),0);
    const denied=await open(guest,'/admin/thu-vien/');await denied.getByText('Đăng nhập tài khoản có quyền ADMIN để mở khu vực quản trị.').waitFor();
    assert.equal(await denied.locator('#nl-form,.na-module').count(),0);
    const result=await denied.evaluate(async()=>{const r=await fetch('/.netlify/functions/ncn-library?route=manage');return {status:r.status,text:await r.text()};});assert.equal(result.status,401);assert.equal(result.text.includes('bodyKey'),false);await denied.close();
  });
  vip=await context();page=await open(vip,'/');await login(page,'vip@example.test');
  await check('VIP and forged browser roles cannot see Admin or write articles',async()=>{
    assert.equal(await page.locator('#ncn-admin-navigation').count(),0);
    await page.evaluate(()=>localStorage.setItem('qz_user',JSON.stringify({roles:['admin'],admin:true})));
    const denied=await open(vip,'/admin/');await denied.getByText('Chỉ ADMIN được sử dụng khu vực quản trị.').waitFor();assert.equal(await denied.locator('.na-module').count(),0);
    const status=await denied.evaluate(async()=>{const r=await fetch('/.netlify/functions/ncn-library?route=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin:true})});return r.status;});assert.equal(status,403);await denied.close();
  });
  admin=await context();page=await open(admin,'/');await login(page,'admin@example.test');
  await check('verified ADMIN receives a separate navigation entry and extensible hub',async()=>{
    await page.locator('#ncn-admin-navigation').waitFor({state:'attached'});
    page=await open(admin,'/admin/');await page.locator('.na-module').first().waitFor();assert.equal(await page.locator('.na-module').count(),5);
    assert.equal(await page.locator('.na-module[href="/admin/thu-vien/"]').count(),1);await fits(page);await page.screenshot({path:out+'/admin-hub-desktop.jpg',type:'jpeg',quality:80});
  });
  editor=await open(admin,'/admin/thu-vien/');page=editor;
  await check('Admin editor lists all existing articles with the approved glass layout',async()=>{
    await editor.locator('[data-article-id]').first().waitFor();assert.equal(await editor.locator('[data-article-id]').count(),77);await fits(editor);
    await editor.screenshot({path:out+'/library-admin-desktop.jpg',type:'jpeg',quality:80});
  });
  homeReader=await open(admin,'/');
  await check('Admin can save a private draft with Vietnamese text and safe preview formatting',async()=>{
    await editor.locator('#nl-title').fill('Hướng dẫn thử nghiệm Admin');await editor.locator('#nl-summary').fill('Mô tả bài viết thử nghiệm');await editor.locator('#nl-labels').fill('Hướng dẫn, Kiểm tra');
    await editor.locator('#nl-body').fill('## Nội dung mới\nBài viết **tiếng Việt** đầy đủ dấu.\n\n<script>window.ATTACKED=true</script>\n\n[Không thực thi](javascript:alert)');
    await editor.locator('#nl-preview-toggle').click();assert.equal(await editor.locator('#nl-preview script').count(),0);assert.match(await editor.locator('#nl-preview strong').innerText(),/tiếng Việt/);
    await editor.locator('#nl-save').click();await saved(editor,/Đã lưu bản nháp/);newArticle=await editor.locator('#nl-href').inputValue();assert.ok(newArticle.startsWith('/bai-viet/'));
    reader=await guest.newPage();const response=await reader.goto(origin+newArticle);assert.equal(response.status(),404);assert.equal((await reader.content()).includes('window.ATTACKED=true'),false);
    assert.equal(await homeReader.locator('#ncn-articles a[href="'+newArticle+'"]').count(),0);
  });
  await check('publishing updates the public library and serves a full Liquid Glass article',async()=>{
    await editor.locator('#nl-state').selectOption('published');await editor.locator('#nl-save').click();await saved(editor,/Đã lưu và cập nhật/);
    const response=await reader.goto(origin+newArticle);assert.equal(response.status(),200);await reader.locator('#postBody h2').waitFor();
    assert.match(await reader.locator('#postBody').innerText(),/đầy đủ dấu/);assert.equal(await reader.evaluate(()=>window.ATTACKED),undefined);assert.equal(await reader.locator('#postBody script,a[href^="javascript:"]').count(),0);
    assert.equal(await reader.locator('link[rel=canonical]').getAttribute('href'),'https://nguyencongnghe.com'+newArticle);await fits(reader);
    await reader.goto(origin+'/thu-vien/?q=Hướng+dẫn+thử+nghiệm+Admin');await reader.locator('#ncn-library-results a').waitFor();assert.equal(await reader.locator('#ncn-library-results a').count(),1);
    await homeReader.locator('#ncn-articles a[href="'+newArticle+'"]').waitFor();assert.equal(await homeReader.locator('#ncn-articles a').count(),4);assert.equal(await homeReader.locator('#ncn-articles a').first().getAttribute('href'),newArticle);
  });
  await check('hiding removes the library entry while retaining its direct public page',async()=>{
    await editor.locator('#nl-visibility').click();await saved(editor,/Đã ẩn khỏi Thư viện/);
    await reader.reload();await reader.locator('#ncn-library-results .ncn-empty').waitFor();assert.equal((await reader.goto(origin+newArticle)).status(),200);
    await homeReader.locator('#ncn-articles a[href="'+newArticle+'"]').waitFor({state:'detached'});assert.equal(await homeReader.locator('#ncn-articles a').count(),4);
    await editor.locator('#nl-visibility').click();await saved(editor,/Đã hiện bài/);
    await homeReader.locator('#ncn-articles a[href="'+newArticle+'"]').waitFor();
  });
  await check('trash removes an owned article page and restore recovers all of its content',async()=>{
    await editor.locator('#nl-trash').click();await editor.locator('#nl-trash-dialog[open]').waitFor();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    assert.equal((await reader.goto(origin+newArticle)).status(),410);await editor.locator('#nl-restore').click();await saved(editor,/Đã khôi phục/);assert.equal((await reader.goto(origin+newArticle)).status(),200);
    assert.match(await reader.locator('#postBody').innerText(),/đầy đủ dấu/);
  });
  await check('permanent deletion offers cancellation, removes all hosted revisions and cannot restore the article',async()=>{
    assert.equal(await editor.locator('#nl-purge').isVisible(),false);
    await editor.locator('#nl-trash').click();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    await editor.locator('#nl-filter').selectOption('trash');const id=new URL(editor.url()).searchParams.get('id');
    assert.ok([...entries.keys()].filter(k=>k.startsWith('body-'+id+'-')).length>=2);
    await editor.locator('#nl-purge').click();await editor.locator('#nl-purge-dialog[open]').waitFor();assert.match(await editor.locator('#nl-purge-dialog').innerText(),/GitHub vẫn được giữ/);
    await editor.locator('#nl-purge-cancel').click();assert.equal(await editor.locator('#nl-restore').isVisible(),true);assert.equal((await reader.goto(origin+newArticle)).status(),410);
    await editor.locator('#nl-purge').click();await editor.locator('#nl-purge-confirm').click();await saved(editor,/Đã xoá vĩnh viễn/);
    assert.equal(new URL(editor.url()).searchParams.has('id'),false);assert.equal(await editor.locator('[data-article-id="'+id+'"]').count(),0);
    assert.equal([...entries.keys()].filter(k=>k.startsWith('body-'+id+'-')).length,0);assert.equal((await reader.goto(origin+newArticle)).status(),404);
    assert.equal(await editor.locator('#nl-restore').isVisible(),false);assert.equal(await editor.locator('#nl-purge').isVisible(),false);
  });
  const original=seed.find(x=>x.managedPage&&x.href.includes('wps-office'));
  await check('removing a legacy library entry leaves its original article available',async()=>{
    await editor.locator('#nl-filter').selectOption('all');await choose(editor,original);await editor.locator('#nl-trash').click();assert.equal(await editor.locator('#nl-remove-page').isChecked(),false);await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    assert.equal((await reader.goto(origin+original.href)).status(),200);await editor.locator('#nl-restore').click();await saved(editor,/Đã khôi phục/);
  });
  await check('disabling the original legacy page also covers extensionless aliases and is reversible',async()=>{
    await editor.locator('#nl-trash').click();await editor.locator('#nl-remove-page').check();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    for(const path of [original.href,original.href.replace(/\.html$/,''),original.href.replace(/\.html$/,'/')])assert.equal((await reader.goto(origin+path)).status(),410,path);
    await editor.locator('#nl-restore').click();await saved(editor,/Đã khôi phục/);assert.equal((await reader.goto(origin+original.href)).status(),200);
  });
  await check('permanent deletion of the pictured legacy page explains GitHub and removes it from trash and every route alias',async()=>{
    const sm=seed.find(x=>x.id==='legacy-b1a4f4e54bd52f43');await choose(editor,sm);
    await editor.locator('#nl-trash').click();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    assert.equal((await reader.goto(origin+sm.href)).status(),200);await editor.locator('#nl-filter').selectOption('trash');
    await editor.locator('#nl-purge').click();assert.match(await editor.locator('#nl-purge-name').innerText(),/SM V7/);await fits(editor);
    await editor.screenshot({path:out+'/permanent-delete-desktop.jpg',type:'jpeg',quality:85});await editor.locator('#nl-purge-cancel').click();
    await editor.setViewportSize({width:390,height:844});await editor.evaluate(()=>window.NCN_APPEARANCE.set('dark',true));await editor.locator('#nl-purge').click();await fits(editor);
    const box=await editor.locator('#nl-purge-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.height<=818,JSON.stringify(box));
    await editor.screenshot({path:out+'/permanent-delete-phone-dark.jpg',type:'jpeg',quality:85});await editor.locator('#nl-purge-confirm').click();await saved(editor,/Đã xoá vĩnh viễn/);
    for(const path of [sm.href,sm.href.replace(/\.html$/,''),sm.href.replace(/\.html$/,'/')])assert.equal((await reader.goto(origin+path)).status(),410,path);
    assert.equal(await editor.locator('[data-article-id="'+sm.id+'"]').count(),0);assert.ok((await read('public/'+sm.sourcePath)).includes('ncn-library-detail'));
    await editor.setViewportSize({width:1280,height:900});await editor.evaluate(()=>window.NCN_APPEARANCE.set('light',true));await editor.locator('#nl-filter').selectOption('all');
  });
  await check('an interrupted permanent deletion stays removed and offers a safe retry',async()=>{
    await editor.locator('#nl-new').click();await editor.locator('#nl-search').fill('');await editor.locator('#nl-title').fill('Bài xoá lại thử nghiệm');await editor.locator('#nl-body').fill('Chỉ có trong bộ nhớ thử nghiệm.');await editor.locator('#nl-state').selectOption('published');
    await editor.locator('#nl-save').click();await saved(editor,/Đã lưu và cập nhật/);const href=await editor.locator('#nl-href').inputValue();
    await editor.locator('#nl-trash').click();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    failDelete=true;await editor.locator('#nl-purge').click();await editor.locator('#nl-purge-confirm').click();await saved(editor,/xoá dữ liệu chưa hoàn tất/);
    assert.equal(await editor.locator('#nl-restore').isVisible(),false);assert.match(await editor.locator('#nl-purge').innerText(),/Thử xoá vĩnh viễn/);assert.equal((await reader.goto(origin+href)).status(),410);
    await editor.locator('#nl-purge').click();await editor.locator('#nl-purge-confirm').click();await saved(editor,/Đã xoá vĩnh viễn/);assert.equal((await reader.goto(origin+href)).status(),404);
  });
  await check('a lost success response still clears the deleted selection instead of offering restore',async()=>{
    await editor.locator('#nl-new').click();await editor.locator('#nl-title').fill('Bài mất phản hồi thử nghiệm');await editor.locator('#nl-body').fill('Dữ liệu giả để kiểm tra mất kết nối.');await editor.locator('#nl-state').selectOption('published');await editor.locator('#nl-save').click();await saved(editor,/Đã lưu và cập nhật/);
    const href=await editor.locator('#nl-href').inputValue();await editor.locator('#nl-trash').click();await editor.locator('#nl-trash-confirm').click();await saved(editor,/Đã đưa bài/);
    losePurgeReply=true;await editor.locator('#nl-purge').click();await editor.locator('#nl-purge-confirm').click();await saved(editor,/Đã xoá vĩnh viễn/);
    assert.equal(await editor.locator('#nl-restore').isVisible(),false);assert.equal(new URL(editor.url()).searchParams.has('id'),false);assert.equal((await reader.goto(origin+href)).status(),404);assert.equal(await editor.locator('#nl-status').evaluate(n=>n.classList.contains('na-error')),false);
  });
  const tool=seed.find(x=>x.href==='/2024/01/in-fifo.html');
  await check('print tools expose listing controls without an option to overwrite or remove the tool',async()=>{
    await choose(editor,tool);assert.equal(await editor.locator('#nl-tool-note').isVisible(),true);assert.equal(await editor.locator('#nl-mode-field').isVisible(),false);await editor.locator('#nl-trash').click();assert.equal(await editor.locator('#nl-remove-page-option').isVisible(),false);await editor.locator('#nl-trash-cancel').click();
  });
  await check('link posts can be added and found in the public library',async()=>{
    await editor.locator('#nl-new').click();await editor.locator('#nl-kind').selectOption('link');await editor.locator('#nl-title').fill('Liên kết hướng dẫn thử nghiệm');await editor.locator('#nl-href').fill('https://example.com/guide');await editor.locator('#nl-state').selectOption('published');await editor.locator('#nl-save').click();await saved(editor,/Đã lưu và cập nhật/);
    await reader.goto(origin+'/thu-vien/?q=Liên+kết+hướng+dẫn+thử+nghiệm');await reader.locator('#ncn-library-results a').waitFor();assert.equal(await reader.locator('#ncn-library-results a').getAttribute('href'),'https://example.com/guide');
  });
  await check('phone and dark-mode management remain readable without horizontal overflow',async()=>{
    await editor.setViewportSize({width:390,height:844});await editor.evaluate(()=>window.NCN_APPEARANCE.set('dark',true));await fits(editor);await editor.screenshot({path:out+'/library-admin-phone-dark.jpg',type:'jpeg',quality:80});
    const hub=await open(admin,'/admin/');await hub.setViewportSize({width:390,height:844});await hub.locator('.na-module').first().waitFor();await fits(hub);await hub.screenshot({path:out+'/admin-hub-phone.jpg',type:'jpeg',quality:80});await hub.close();
  });
  await check('the four homepage article cards remain visible and compact on a dark phone screen',async()=>{
    const home=await open(guest,'/');await home.setViewportSize({width:390,height:844});await home.evaluate(()=>window.NCN_APPEARANCE.set('dark',true));await home.locator('#ncn-articles a').first().waitFor();await fits(home);
    assert.equal(await home.locator('#ncn-articles a').count(),4);assert.equal(await home.locator('details #ncn-articles').count(),0);
    const cards=await home.locator('#ncn-articles').boundingBox();assert.ok(cards.height<650,JSON.stringify(cards));await home.screenshot({path:out+'/home-latest-phone-dark.jpg',type:'jpeg',quality:80});await home.close();
  });
  await check('logout immediately removes private forms and the verified Admin navigation',async()=>{
    await editor.evaluate(()=>window.NCNAccount.signOut());await editor.locator('#ncn-admin-access').waitFor();assert.equal(await editor.locator('#nl-form').count(),0);assert.equal(await editor.locator('#ncn-admin-navigation').count(),0);
    const response=await editor.evaluate(async()=>{const r=await fetch('/.netlify/functions/ncn-library?route=manage');return r.status;});assert.equal(response,401);
  });
}finally{
  await writeFile(out+'/results.json',JSON.stringify({scope:'Synthetic users and memory store; all external writes blocked',results},null,2));await browser.close();
}
console.log('Admin library scenarios: '+results.length+' passed.');
