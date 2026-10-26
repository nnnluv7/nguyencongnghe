import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {createScoresHandler,cleanName} from '../netlify/lib/ncn-scores-api.mjs';
import {scorePhoto} from '../netlify/lib/ncn-score-photos.mjs';
import {memoryStore} from './fixtures/arcade-store.mjs';
import {GAMES,gameBoard,vietnamDate} from '../public/assets/ncn-arcade/catalog.js';

const origin='https://nguyencongnghe.com',at=Date.parse('2026-10-26T12:00:00Z'),member={id:'account-verified',name:'Anh Công Nghệ',email:'secret@example.test',avatar:'https://images.example.test/avatar.jpg'};
function fixture(){const store=memoryStore(),f={store,now:at,user:null,production:true};f.handler=createScoresHandler({store:()=>store,now:()=>f.now,verify:async()=>f.user,production:()=>f.production,photo:scorePhoto});return f;}
async function call(f,route,data,cookie='',extra={}){const response=await f.handler(new Request(origin+'/.netlify/functions/ncn-scores?route='+route,{method:data?'POST':'GET',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),Cookie:cookie,...extra},...(data?{body:JSON.stringify(data)}:{})}));const value=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();return {response,status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function guest(f,name='Cá Nhỏ'){const r=await call(f,'profile',{name,avatar:'preset:🐱'});assert.equal(r.status,200);return r;}
async function scored(f,{game='snake',mode='arena',score=500,level=0,cookie='' }={}){const start=await call(f,'start',{game,mode},cookie);assert.equal(start.status,200,JSON.stringify(start.value));f.now+=20000;const result=await call(f,'score',{runId:start.value.runId,score,level},cookie);assert.equal(result.status,200,JSON.stringify(result.value));return {start,result};}

test('five games share one catalogue; modes and Vietnamese daily dates remain separate',()=>{
 assert.equal(Object.keys(GAMES).length,5);assert.equal(vietnamDate(new Date('2026-10-26T18:00:00Z')),'2026-10-27');assert.equal(gameBoard('snake','daily','2026-02-30'),null);assert.equal(gameBoard('snake','classic'),null);assert.equal(gameBoard('snake','constructor'),null);assert.equal(gameBoard('__proto__','arena'),null);assert.equal(gameBoard('flight','easy'),'easy');
});
test('the hub and five games are discoverable once in both static and hydrated Library catalogues',()=>{
 const staticRows=JSON.parse(readFileSync('public/assets/catalog.js','utf8').replace(/^window.CG_CATALOG\s*=\s*/,'').trim().replace(/;$/,'')),seed=JSON.parse(readFileSync('netlify/lib/ncn-library/seed.json','utf8'));
 for(const href of ['/arcade/',...Object.values(GAMES).map(x=>x.path)]){assert.equal(staticRows.filter(x=>x.link===href).length,1,href);assert.equal(seed.filter(x=>x.href===href).length,1,href);}
});
test('guests can read an empty public board without creating a profile or cookie',async()=>{const f=fixture(),r=await call(f,'board&game=snake&mode=arena');assert.equal(r.status,200);assert.deepEqual(r.value.items,[]);assert.equal(f.store.entries.size,0);assert.equal(r.response.headers.has('set-cookie'),false);assert.equal((await call(f,'start',{game:'snake',mode:'arena'})).status,401);});
test('a remembered HttpOnly guest profile supplies all five games without a website account',async()=>{
 const f=fixture(),g=await guest(f);for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=31536000'])assert.ok(g.response.headers.get('set-cookie').includes(flag));
 assert.equal((await call(f,'profile',undefined,g.cookie)).value.profile.name,'Cá Nhỏ');
 for(const [game,spec]of Object.entries(GAMES))await scored(f,{game,mode:Object.keys(spec.modes)[0],cookie:g.cookie});
 assert.equal([...f.store.entries.keys()].filter(x=>x.startsWith('profile/')).length,1);
});
test('a verified NCN account uses its existing name and photo without profile setup',async()=>{const f=fixture();f.user=member;const r=await call(f,'profile');assert.equal(r.value.needsProfile,false);assert.equal(r.value.profile.name,member.name);assert.equal(r.value.profile.avatar,member.avatar);assert.equal(r.value.profile.member,true);assert.equal(JSON.stringify(r.value).includes(member.email),false);await scored(f);});
test('member identity and display name cannot be replaced by browser claims; emails stay private',async()=>{const f=fixture();f.user={...member,name:member.email};const r=await call(f,'profile',{name:'Forged Admin',id:'someone-else',avatar:'javascript:alert(1)'});assert.equal(r.value.profile.name,'Thành viên NCN');assert.equal(r.value.profile.member,true);await scored(f);const b=await call(f,'board&game=snake&mode=arena');assert.equal(JSON.stringify(b.value).includes(member.email),false);assert.equal(JSON.stringify(b.value).includes(member.id),false);assert.equal(b.value.items[0].you,true);});
test('guest name validation handles controls and forbids email fallbacks',async()=>{assert.equal(cleanName('  Bé\u202e Cá\u0000  '),'Bé Cá');assert.equal(Array.from(cleanName('ố'.repeat(40))).length,30);const f=fixture();for(const name of ['','   ','name@example.test'])assert.equal((await call(f,'profile',{name,avatar:'preset:🐱'})).status,400);});
test('avatar uploads are decoded and re-encoded as 96px WebP; SVG, bad images and oversized bodies are rejected',async()=>{
 const f=fixture(),bytes=await sharp({create:{width:128,height:160,channels:3,background:'#88aa99'}}).png().toBuffer(),g=await call(f,'profile',{name:'Bạn Có Ảnh',avatar:'data:image/png;base64,'+bytes.toString('base64')});assert.equal(g.status,200);const photo=await call(f,g.value.profile.avatar.split('?route=')[1]);assert.equal(photo.status,200);const meta=await sharp(Buffer.from(photo.value)).metadata();assert.equal(meta.width,96);assert.equal(meta.height,96);assert.equal(meta.format,'webp');assert.match(photo.response.headers.get('cache-control'),/immutable/);
 for(const avatar of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,YmFk','https://arbitrary.example.test/a.png'])assert.equal((await call(f,'profile',{name:'Bé',avatar})).status,400);
 assert.equal((await call(f,'profile',{name:'a'.repeat(240001),avatar:'preset:🐱'})).status,413);
});
test('mutation routes reject cross-origin requests and previews never publish a score',async()=>{const f=fixture();assert.equal((await call(f,'profile',{name:'Bé',avatar:'preset:🐱'},'',{Origin:'https://outside.test'})).status,403);assert.equal(f.store.entries.size,0);f.production=false;assert.equal((await call(f,'profile',{name:'Bé',avatar:'preset:🐱'})).status,503);assert.equal(f.store.entries.size,0);});
test('a server-issued run binds score to its owner and original game/mode',async()=>{
 const f=fixture(),a=await guest(f),start=await call(f,'start',{game:'snake',mode:'arena',sub:'forged'},a.cookie),b=await guest(f,'Người khác');f.now+=20000;
 assert.equal((await call(f,'score',{runId:start.value.runId,score:500,level:0},b.cookie)).status,403);assert.equal((await call(f,'score',{runId:start.value.runId,score:500,level:0,game:'ocean'},a.cookie)).status,200);assert.equal((await call(f,'board&game=ocean&mode=classic')).value.total,0);assert.equal((await call(f,'board&game=snake&mode=arena')).value.total,1);
});
test('best score is idempotent, cannot go backwards, and concurrent improvements retain the maximum',async()=>{
 const f=fixture(),g=await guest(f),r=await scored(f,{cookie:g.cookie});
 for(const score of [500,100,500])assert.equal((await call(f,'score',{runId:r.start.value.runId,score,level:0},g.cookie)).value.improved,false);
 await Promise.all([600,800,700,1000].map(score=>call(f,'score',{runId:r.start.value.runId,score,level:0},g.cookie)));
 const board=(await call(f,'board&game=snake&mode=arena',undefined,g.cookie)).value;assert.equal(board.total,1);assert.equal(board.items[0].score,1000);assert.deepEqual(board.you,{rank:1,score:1000});
});
test('normal, relaxed and daily scores never mix, and daily boards use separate dates',async()=>{const f=fixture(),g=await guest(f);for(const mode of ['classic','relax','daily'])await scored(f,{game:'pikachu',mode,score:500,cookie:g.cookie});for(const mode of ['classic','relax','daily'])assert.equal((await call(f,'board&game=pikachu&mode='+mode)).value.total,1);assert.equal((await call(f,'board&game=pikachu&mode=daily&date=2026-10-27')).value.total,0);});
test('impossible values, instantaneous huge scores and expired runs do not enter a board',async()=>{const f=fixture(),g=await guest(f),r=await call(f,'start',{game:'flight',mode:'normal'},g.cookie);for(const score of [-1,Infinity,1.5,1000000000])assert.equal((await call(f,'score',{runId:r.value.runId,score,level:0},g.cookie)).status,400);assert.equal((await call(f,'score',{runId:r.value.runId,score:50000,level:0},g.cookie)).status,400);f.now+=31*86400000;assert.equal((await call(f,'score',{runId:r.value.runId,score:50,level:0},g.cookie)).status,410);});
test('pagination starts with ten and continues past 1000 players without an overall cutoff',async()=>{
 const f=fixture();for(let i=0;i<1207;i++){const id=createHash('sha256').update('player-'+i).digest('hex'),score=5000-i,key='rank/snake/arena/'+String(999999999-score).padStart(9,'0')+'/'+at+'/'+id;await f.store.setJSON(key,{id,name:'Bạn '+i,avatar:'preset:🐱',member:false,score,level:0,at});}
 let r=await call(f,'board&game=snake&mode=arena'),rows=[...r.value.items];assert.equal(rows.length,10);assert.equal(r.value.total,1207);
 while(r.value.nextCursor){r=await call(f,'board&game=snake&mode=arena&limit=50&cursor='+r.value.nextCursor);rows.push(...r.value.items);}
 assert.equal(rows.length,1207);assert.equal(new Set(rows.map(x=>x.id)).size,1207);assert.deepEqual(rows.map(x=>x.rank),Array.from({length:1207},(_,i)=>i+1));assert.ok(rows.every((x,i)=>!i||rows[i-1].score>=x.score));assert.equal((await call(f,'board&game=ocean&mode=classic&cursor='+Buffer.from('rank/snake/arena/x').toString('base64url'))).status,400);
});
test('signing in during a guest run can save that run to the verified account, but signing out cannot steal an account run',async()=>{const f=fixture(),g=await guest(f),start=await call(f,'start',{game:'ocean',mode:'classic'},g.cookie);f.now+=20000;f.user=member;assert.equal((await call(f,'score',{runId:start.value.runId,score:600,level:1},g.cookie)).status,200);const row=(await call(f,'board&game=ocean&mode=classic')).value.items[0];assert.equal(row.name,member.name);assert.equal(row.member,true);f.now+=1000;const accountRun=await call(f,'start',{game:'ocean',mode:'classic'},g.cookie);f.user=null;assert.equal((await call(f,'score',{runId:accountRun.value.runId,score:500,level:1},g.cookie)).status,403);});
