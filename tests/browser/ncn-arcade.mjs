import {chromium} from 'playwright';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createScoresHandler} from '../../netlify/lib/ncn-scores-api.mjs';
import {scorePhoto} from '../../netlify/lib/ncn-score-photos.mjs';
import {memoryStore} from '../fixtures/arcade-store.mjs';
import {findMatch} from '../../public/pikachu/core.js';

// A wholly synthetic HTTPS site. Actual server handler + cookies + browser
// game input, with no production Identity, score, upload, or email writes.
const origin='https://ncn-arcade.test',root=resolve('public'),out=resolve('artifacts/arcade'),results=[],errors=[],calls=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const at=Date.parse('2026-10-26T12:00:00Z'),member={id:'fixture-member',email:'private@example.test',name:'Thành viên đã đăng nhập',avatar:'https://ncn-arcade.test/member-photo.webp',admin:false,vip:false};
const jwt=Buffer.from('{"alg":"fixture"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:member.id,email:member.email,exp:Math.floor(at/1000)+36000})).toString('base64url')+'.fixture';
const photo=await sharp({create:{width:140,height:180,channels:3,background:'#75aa94'}}).png().toBuffer();
const browser=await chromium.launch();let page,active;
await mkdir(out,{recursive:true});
async function fixture({signed=false,storageBlocked=false}={}){
 const store=memoryStore(),f={store,now:at,failScore:false,delayStart:null};
 const handler=createScoresHandler({production:()=>true,store:()=>store,now:()=>f.now,photo:scorePhoto,verify:async req=>(req.headers.get('cookie')||'').includes('nf_jwt='+jwt)?member:null});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});f.context=context;
 if(signed)await context.addCookies([{name:'nf_jwt',value:jwt,url:origin}]);
 await context.addInitScript(({storageBlocked})=>{Math.random=()=>.31415926;if(storageBlocked){const read=Storage.prototype.getItem,write=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key.startsWith('ncn:arcade:'))throw new DOMException('Blocked','SecurityError');return read.call(this,key);};Storage.prototype.setItem=function(key,value){if(key.startsWith('ncn:arcade:'))throw new DOMException('Blocked','QuotaExceededError');return write.call(this,key,value);};}},{storageBlocked});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),headers=await request.allHeaders(),isMember=(headers.cookie||'').includes('nf_jwt='+jwt);
  if(url.origin!==origin)return route.abort();
  const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname==='/.netlify/functions/ncn-scores'){
   const action=url.searchParams.get('route');calls.push({action,body:request.postData(),store});
   if(action==='score'&&f.failScore)return json({error:'Fixture offline'},503);
   if(action==='start'&&f.delayStart)await f.delayStart;
   const req=new Request(request.url(),{method:request.method(),headers,...(request.method()==='POST'?{body:request.postData()}:{})}),response=await handler(req);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  }
  if(url.pathname.startsWith('/.netlify/identity/')){
   if(url.pathname.endsWith('/user'))return json(isMember?{id:member.id,email:member.email,confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{roles:[]},user_metadata:{full_name:member.name,picture:member.avatar}}:{msg:'Unauthorized'},isMember?200:401);
   return json({disable_signup:false,external:{email:true}});
  }
  if(url.pathname.startsWith('/.netlify/functions/'))return json(url.pathname.endsWith('ncn-billing')?{user:isMember?member:null}:url.pathname.endsWith('ncn-announcements')?{items:[{text:'NCN Arcade · Một hồ sơ, năm trò chơi'}]}:{items:[],online:1,total:1});
  if(url.pathname==='/member-photo.webp')return route.fulfill({contentType:'image/png',body:photo});
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))throw Error();if((await stat(path)).isDirectory())path+='/index.html';return route.fulfill({contentType:mime[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{return route.fulfill({status:404,body:'Not found'});}
 });
 f.page=await context.newPage();f.page.on('pageerror',e=>errors.push(e.message));await f.page.clock.install({time:new Date(at)});return f;
}
const tick=async ms=>{active.now+=ms;await page.clock.runFor(ms);};
const open=async path=>{await page.goto(origin+path);await page.waitForFunction(()=>window.NCNAccount?.state.ready);await page.locator('#ncn-scoreboard .ncn-score-status').filter({hasText:/người chơi|Chưa/}).waitFor();};
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){
 results.push({name,ok:false,error:error.message});
 const diagnostic=await page.evaluate(()=>({expanded:document.querySelector('.ncn-arcade-expanded')?.open,rows:document.querySelectorAll('.ncn-arcade-expanded .ncn-score-row').length,status:[...document.querySelectorAll('.ncn-score-status')].map(x=>x.textContent),more:document.querySelector('.ncn-score-more')?.outerHTML})).catch(()=>null);
 console.log('DIAGNOSTIC',JSON.stringify(diagnostic));await page?.screenshot({path:out+'/failure-'+results.length+'.jpg',fullPage:true}).catch(()=>{});throw error;}};
const wait=async selector=>page.locator(selector).waitFor();
async function pair(){const board=await page.locator('#pk-board').evaluate(el=>({cols:Number(el.style.getPropertyValue('--frame-cols'))-2,rows:Number(el.style.getPropertyValue('--frame-rows'))-2,cells:[...el.querySelectorAll('.pk-tile')].map(x=>Number(x.dataset.type))})),match=findMatch(board);assert.ok(match);await page.locator('[data-index="'+match.first+'"]').click();await page.locator('[data-index="'+match.second+'"]').click();await tick(350);}
async function seededRows(f,game='snake',mode='arena',count=137){for(let i=0;i<count;i++){const id=createHash('sha256').update('fixture-'+game+i).digest('hex'),score=999999999-i,key='rank/'+game+'/'+mode+'/'+String(999999999-score).padStart(9,'0')+'/'+at+'/'+id;await f.store.setJSON(key,{id,name:'Bạn '+(i+1),avatar:'preset:🐼',score,at,member:i%3===0,level:1});}}
try{
 active=await fixture();page=active.page;
 await check('NCN Arcade hub links the five real games and fits 320px through desktop',async()=>{
  await open('/arcade/');assert.equal(await page.locator('.ncn-arcade-card').count(),5);assert.equal(await page.locator('.ncn-arcade-links a').count(),5);
  for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.locator('.ncn-arcade-card').count(),5);const size=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.w+1,JSON.stringify(size));}
  await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:out+'/hub-desktop.jpg',fullPage:true});
 });
 await check('first-time guests add a name and uploaded photo once before actual gameplay',async()=>{
  await open('/pikachu/');await page.locator('#pk-start').click();await wait('.ncn-arcade-profile[open]');await page.locator('#ncn-player-name').fill('<img src=x> Bé Cá');
  await page.locator('.ncn-avatar-upload').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:photo});await page.locator('.ncn-arcade-profile [role=status]').filter({hasText:'Đã chọn ảnh'}).waitFor();await page.locator('.ncn-arcade-profile [type=submit]').click();await wait('#pk-app[data-state=playing]');
  const cookies=await active.context.cookies();assert.equal(cookies.filter(x=>x.name==='__Host-ncn_arcade').length,1);assert.equal(cookies.find(x=>x.name==='__Host-ncn_arcade').httpOnly,true);assert.equal(await page.evaluate(()=>document.cookie.includes('__Host-ncn_arcade')),false);
  await pair();await pair();await pair();await page.locator('#pk-pause').click();await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));await page.locator('#ncn-scoreboard .ncn-score-row.is-you').waitFor();assert.match(await page.locator('#ncn-scoreboard .ncn-score-row.is-you').innerText(),/<img src=x> Bé Cá/);assert.equal(await page.locator('.ncn-score-name img').count(),0);assert.equal(await page.locator('#ncn-scoreboard .ncn-score-row.is-you img').count(),1,JSON.stringify({row:await page.locator('#ncn-scoreboard .ncn-score-row.is-you').innerHTML(),profiles:[...active.store.entries].filter(([k])=>k.startsWith('profile/')).map(([k,v])=>v.data),photos:[...active.store.entries].filter(([k])=>k.startsWith('avatar/')).map(([k,v])=>({key:k,length:v.data.length})),upload:calls.filter(x=>x.store===active.store&&x.action==='profile'&&x.body).map(x=>({avatar:JSON.parse(x.body).avatar.slice(0,50)}))}));await page.screenshot({path:out+'/guest-score.jpg',fullPage:true});
 });
 await check('the remembered profile starts all four other games and real earned results share that identity',async()=>{
  await open('/ran-luot/');await page.locator('#rl-start').click();await wait('#rl-stage[data-state=playing]');await tick(3200);await page.keyboard.press('p');await wait('#rl-stage[data-state=paused]');assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0);await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));
  await open('/ca-lon-nuot-ca-be/');await page.locator('#ff-start').click();await wait('#ff-stage[data-state=playing]');await page.keyboard.down('ArrowRight');await tick(3200);await page.keyboard.up('ArrowRight');await page.keyboard.press('p');await page.locator('#ff-end').click();await wait('#ff-stage[data-state=over]');await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));
  await open('/xep-hinh/');await page.locator('#xh-start').click();await wait('#xh-app[data-state=playing]');for(let i=0;i<5;i++){await page.keyboard.press('Space');await tick(30);}await page.keyboard.press('p');await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));
  await open('/flappy-bird/');await page.locator('#startButton').click();await page.waitForFunction(()=>document.querySelector('#welcomeScreen').hidden);await tick(1800);await tick(700);await page.waitForFunction(()=>!document.querySelector('#overScreen').hidden);await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));
  const keys=[...active.store.entries.keys()].filter(x=>x.startsWith('best/'));assert.equal(keys.length,5);assert.equal(new Set(keys.map(x=>x.split('/')[1])).size,1);assert.equal(calls.some(x=>/ticket|room/.test(x.action)),false);
 });
 await check('public top ten expands through every player, modes stay separate, and closing does not resume a paused game',async()=>{
  await seededRows(active);await open('/ran-luot/');await page.locator('[data-rank-refresh]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncn-scoreboard .ncn-score-row').length===10);
  assert.equal(await page.locator('#ncn-scoreboard .ncn-score-row').count(),10);await page.locator('[data-rank-expand]').click();await wait('.ncn-arcade-expanded[open]');
  for(let i=0;i<6;i++){const before=await page.locator('.ncn-arcade-expanded .ncn-score-row').count();if(before>=138)break;await page.locator('.ncn-score-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);await tick(100);await page.waitForFunction(n=>document.querySelectorAll('.ncn-arcade-expanded .ncn-score-row').length>n,before,{polling:20});}
  await page.waitForFunction(()=>document.querySelectorAll('.ncn-arcade-expanded .ncn-score-row').length===138);assert.equal(await page.locator('.ncn-score-more').isVisible(),false);for(const width of [390,320]){await page.setViewportSize({width,height:844});const box=await page.locator('.ncn-arcade-expanded').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);const scroll=await page.locator('.ncn-score-scroll').evaluate(el=>({width:el.clientWidth,actual:el.scrollWidth}));assert.ok(scroll.actual<=scroll.width+1,JSON.stringify(scroll));}await page.screenshot({path:out+'/rank-phone.jpg'});await page.setViewportSize({width:1440,height:1050});await page.locator('[data-close-rank]').click();assert.equal(await page.locator('#ncn-scoreboard .ncn-score-row').count(),10);
  await page.locator('.ncn-score-tabs [data-game=flight]').click();await page.getByLabel('Chế độ xếp hạng').selectOption('hard');await page.waitForFunction(()=>document.querySelectorAll('#ncn-scoreboard .ncn-score-row').length===0);assert.match(await page.locator('.ncn-score-empty').first().innerText(),/Chưa có/);
 });
 await check('an interrupted score submission stays queued and retries successfully without a duplicate leaderboard entry',async()=>{
  await open('/pikachu/');await page.locator('#pk-start').click();await wait('#pk-app[data-state=playing]');active.failScore=true;await pair();await page.locator('#pk-pause').click();await page.locator('.ncn-score-save button').waitFor();assert.match(await page.locator('.ncn-score-save').innerText(),/chờ kết nối/);active.failScore=false;await page.locator('.ncn-score-save button').click();await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));assert.equal([...active.store.entries.keys()].filter(x=>x.startsWith('best/')&&x.includes('/pikachu/')).length,1);
 });
 await check('changing a guest name/photo updates that profile in the other games too',async()=>{
  await page.locator('.ncn-score-player button').click();await page.locator('#ncn-player-name').fill('Bạn Đã Đổi Tên');await page.getByRole('button',{name:'Chọn 🦊',exact:true}).click();await page.locator('.ncn-arcade-profile [type=submit]').click();await page.locator('.ncn-arcade-profile[open]').waitFor({state:'hidden'});await open('/ca-lon-nuot-ca-be/');assert.match(await page.locator('.ncn-score-player').innerText(),/Bạn Đã Đổi Tên/);await page.locator('#ncn-scoreboard .ncn-score-row.is-you').waitFor();assert.match(await page.locator('#ncn-scoreboard .ncn-score-row.is-you').innerText(),/Bạn Đã Đổi Tên/);
 });
 await check('native/fullscreen fallback games keep the shared profile and leaderboard dialogs inside the game',async()=>{
  await open('/xep-hinh/');await page.locator('#xh-fullscreen').click();await page.locator('#xh-app').waitFor();if(await page.locator('#xh-continue').isVisible())await page.locator('#xh-continue').click();else await page.locator('#xh-start').click();await wait('#xh-app[data-state=playing]');for(let i=0;i<15&&await page.locator('#xh-app').getAttribute('data-state')==='playing';i++)await page.keyboard.press('Space');await page.locator('.xh-result .ncn-game-rank-button').click();await wait('.ncn-arcade-expanded[open]');assert.equal(await page.locator('#xh-app>.ncn-arcade-expanded').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('#xh-app').getAttribute('data-state'),'lost');
 });
 await active.context.close();active=await fixture({signed:true});page=active.page;
 await check('an existing NCN member uses the account name/photo and skips profile entry in every game',async()=>{
  for(const [route,button,state]of [['ran-luot','rl-start','#rl-stage[data-state=playing]'],['flappy-bird','startButton','#hud:not([hidden])'],['pikachu','pk-start','#pk-app[data-state=playing]'],['ca-lon-nuot-ca-be','ff-start','#ff-stage[data-state=playing]'],['xep-hinh','xh-start','#xh-app[data-state=playing]']]){
   await open('/'+route+'/');await page.locator('#'+button).click();await wait(state);assert.equal(await page.locator('.ncn-arcade-profile[open]').count(),0);assert.match(await page.locator('.ncn-score-player').innerText(),new RegExp(member.name));assert.equal(await page.locator('.ncn-score-player img').getAttribute('src'),member.avatar);await tick(600);
  }
 });
 await active.context.close();active=await fixture({storageBlocked:true});page=active.page;
 await check('blocked local storage still allows the HttpOnly guest profile and an in-memory result submission',async()=>{
  await open('/ca-lon-nuot-ca-be/');await page.locator('#ff-start').click();await page.locator('#ncn-player-name').fill('Bạn Không Lưu Máy');await page.locator('.ncn-arcade-profile [type=submit]').click();await wait('#ff-stage[data-state=playing]');await page.keyboard.down('ArrowRight');await tick(3000);await page.keyboard.up('ArrowRight');await page.keyboard.press('p');await page.locator('#ff-end').click();await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));assert.equal([...active.store.entries.keys()].filter(x=>x.startsWith('best/')).length,1);
 });
 await check('a slow run-creation request does not swallow the first control input or an early score',async()=>{
  let release;active.delayStart=new Promise(resolve=>release=resolve);await open('/ca-lon-nuot-ca-be/');await page.locator('#ff-start').click();await wait('#ff-stage[data-state=playing]');await page.keyboard.down('ArrowRight');await tick(2500);await page.keyboard.up('ArrowRight');assert.ok(Number((await page.locator('#ff-score').innerText()).replace(/\D/g,''))>0);await page.keyboard.press('p');release();active.delayStart=null;await page.locator('#ff-end').click();await page.waitForFunction(()=>document.querySelector('.ncn-score-save').textContent.includes('✓'));
 });
 assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors; all writes stayed inside the synthetic fixture');
}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
