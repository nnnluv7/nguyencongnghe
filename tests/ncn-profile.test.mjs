import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createProfileHandler} from '../netlify/lib/ncn-profile-api.mjs';
import {scorePhoto} from '../netlify/lib/ncn-score-photos.mjs';
import {verifyIdentity} from '../netlify/lib/ncn-event-api.mjs';
import {withPaidVip,memberKey} from '../netlify/lib/ncn-membership.mjs';
import {safeAvatar,avatarInitials,profileUpdate,vipSummary} from '../public/assets/ncn-member-profile.js';
import {displayProfile} from '../public/assets/ncn-account-session.js';
import {memoryStore} from './fixtures/arcade-store.mjs';
import {createScoresHandler} from '../netlify/lib/ncn-scores-api.mjs';
import {GAMES} from '../public/assets/ncn-arcade/catalog.js';
import {randomBytes} from 'node:crypto';

const origin='https://nguyencongnghe.com',now=Date.parse('2026-10-26T12:00:00Z');
const user={id:'verified-member',email:'private@example.test',name:'Nguyễn Công Nghệ',vip:false,admin:false};
function fixture(){const f={user,production:true,store:memoryStore()};f.handler=createProfileHandler({production:()=>f.production,verify:async()=>f.user,store:()=>f.store,photo:scorePhoto});return f;}
const request=(route='upload',data,headers={})=>new Request(origin+'/.netlify/functions/ncn-profile?route='+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},...(data===undefined?{}:{body:typeof data==='string'?data:JSON.stringify(data)})});
const image=async()=>({image:'data:image/png;base64,'+(await sharp({create:{width:900,height:768,channels:3,background:'#79acd4'}}).withMetadata().png().toBuffer()).toString('base64')});

test('profile edits update display metadata only and preserve a photo on name-only saves',()=>{
 assert.deepEqual(profileUpdate('  Nguyễn\u202e Công\u0000   Nghệ  '),{data:{full_name:'Nguyễn Công Nghệ'}});
 assert.deepEqual(profileUpdate('Bạn','https://ncn.test/a.webp'),{data:{full_name:'Bạn',avatar_url:'https://ncn.test/a.webp'}});
 for(const name of ['', ' ', 'a'.repeat(101)])assert.throws(()=>profileUpdate(name));
 for(const avatar of ['javascript:alert(1)','data:image/svg+xml;base64,eA==','http://ncn.test/a','https://name:password@ncn.test/a'])assert.throws(()=>profileUpdate('Bạn',avatar));
 assert.equal(safeAvatar('https://ncn.test/a.webp'),'https://ncn.test/a.webp');assert.equal(avatarInitials(user),'NN');assert.equal(avatarInitials({name:'An'}),'AN');
});
test('avatar navigation hints retain display fields without carrying authorization',()=>{
 const hint=displayProfile({...user,avatar:'https://ncn.test/a.webp',admin:true,vip:true,createdAt:'2026-01-01',token:'private'});
 assert.deepEqual(hint,{id:user.id,email:user.email,name:user.name,avatar:'https://ncn.test/a.webp'});
 assert.equal(displayProfile({...user,avatar:'javascript:alert(1)'}).avatar,undefined);
});
test('VIP cards distinguish server-paid expiry, manual grants, administrators, blocks and ordinary members',()=>{
 assert.equal(vipSummary(null,now).state,'guest');assert.equal(vipSummary(user,now).state,'member');
 const paid={...user,vip:true,vipSource:'payment',vipExpiresAt:'2026-10-28T12:00:00Z'};
 assert.equal(vipSummary(paid,now).remaining,'2 ngày');assert.equal(vipSummary({...paid,vip:false},now+3*86400000).state,'expired');
 assert.equal(vipSummary({...paid,paidVipBlocked:true},now).state,'blocked');
 assert.equal(vipSummary({...user,vip:true,vipSource:'manual'},now).expires,'Không giới hạn');
 assert.equal(vipSummary({...user,admin:true},now).plan,'Quyền quản trị NCN');
});
test('fresh Identity display fields are optional and user metadata cannot grant VIP or admin',async()=>{
 const raw={id:user.id,email:user.email,confirmed_at:'2026-09-01',created_at:'2026-09-01T12:00:00Z',user_metadata:{full_name:user.name,avatar_url:'https://ncn.test/a.webp',roles:['admin','vip']},app_metadata:{roles:[]}},req=new Request(origin,{headers:{Cookie:'nf_jwt=fixture'}});
 assert.deepEqual(await verifyIdentity(req,{url:origin},async()=>Response.json(raw)),user);
 const enriched=await verifyIdentity(req,{url:origin},async()=>Response.json(raw),{includeAvatar:true,includeJoined:true});
 assert.equal(enriched.avatar,raw.user_metadata.avatar_url);assert.equal(enriched.createdAt,raw.created_at);assert.equal(enriched.vip,false);assert.equal(enriched.admin,false);
 assert.equal(await verifyIdentity(req,{url:origin},async()=>Response.json({...raw,confirmed_at:null}),{includeAvatar:true}),null);
});
test('adding display fields preserves the existing paid ledger and manual VIP rules',async()=>{
 const store=memoryStore(),member={...user,avatar:'https://ncn.test/a.webp',createdAt:'2026-09-01T12:00:00Z'},record={userId:user.id,expiresAt:'2026-11-26T12:00:00Z',blocked:false};await store.setJSON(memberKey(user.id),record);
 const result=await withPaidVip(member,store,now);assert.equal(result.vip,true);assert.equal(result.vipSource,'payment');assert.equal(result.avatar,member.avatar);assert.equal(result.createdAt,member.createdAt);assert.deepEqual(await store.get(memberKey(user.id)),record);
 assert.equal((await withPaidVip({...member,vip:true},store,now)).vipSource,'manual');
});
test('members upload a detailed immutable 768px WebP; public URLs contain no account identifiers',async()=>{
 const f=fixture(),response=await f.handler(request('upload',{...await image(),owner:'someone-else',roles:['admin']}));assert.equal(response.status,200);
 const {avatar}=await response.json();assert.match(avatar,/^https:\/\/nguyencongnghe\.com\/\.netlify\/functions\/ncn-profile\?route=avatar&id=[a-f0-9]{64}$/);
 assert.equal(avatar.includes(user.id),false);assert.equal(avatar.includes(user.email),false);assert.equal(f.store.entries.size,1);
 const photo=await f.handler(new Request(avatar)),bytes=Buffer.from(await photo.arrayBuffer()),meta=await sharp(bytes).metadata();assert.equal(photo.status,200);assert.equal(meta.format,'webp');assert.equal(meta.width,768);assert.equal(meta.height,768);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.match(photo.headers.get('cache-control'),/immutable/);
 await f.handler(request('upload',await image()));assert.equal(f.store.entries.size,1);assert.deepEqual(f.user,user);
});
test('member photos above the old body limit upload without enlarging small sources or changing old immutable photos',async()=>{
 const f=fixture(),bytes=await sharp(randomBytes(768*768*3),{raw:{width:768,height:768,channels:3}}).jpeg({quality:90}).toBuffer(),data={image:'data:image/jpeg;base64,'+bytes.toString('base64')};assert.ok(Buffer.byteLength(JSON.stringify(data))>240000);
 const large=await f.handler(request('upload',data));assert.equal(large.status,200);const largeUrl=(await large.json()).avatar;assert.equal((await sharp(Buffer.from(await (await f.handler(new Request(largeUrl))).arrayBuffer())).metadata()).width,768);
 const small=await sharp({create:{width:192,height:192,channels:3,background:'#79acd4'}}).png().toBuffer(),saved=await f.handler(request('upload',{image:'data:image/png;base64,'+small.toString('base64')}));assert.equal(saved.status,200);const smallUrl=(await saved.json()).avatar,old=Buffer.from(await (await f.handler(new Request(smallUrl))).arrayBuffer());assert.equal((await sharp(old).metadata()).width,192);
 await f.handler(request('upload',await image()));assert.deepEqual(Buffer.from(await (await f.handler(new Request(smallUrl))).arrayBuffer()),old);
});
test('guests, cross-origin requests and preview deployments cannot write member photos',async()=>{
 const f=fixture(),data=await image();f.user=null;assert.equal((await f.handler(request('upload',data))).status,401);
 f.user=user;assert.equal((await f.handler(request('upload',data,{Origin:'https://outside.test'}))).status,403);
 f.production=false;assert.equal((await f.handler(request('upload',data))).status,503);assert.equal(f.store.entries.size,0);
});
test('malformed, oversized and unsupported photos fail without storing data',async()=>{
 const f=fixture();for(const data of ['bad',{}, {image:'data:image/svg+xml;base64,PHN2Zz4='},{image:'data:image/jpeg;base64,YmFk'}])assert.equal((await f.handler(request('upload',data))).status,400);
 assert.equal((await f.handler(request('upload',{image:'a'.repeat(1200001)}))).status,413);
 assert.equal((await f.handler(request('upload',{}, {'Content-Length':'1200001'}))).status,413);
 assert.equal((await f.handler(request('upload',await image(),{'Content-Type':'text/plain'}))).status,415);
 const huge=await sharp({create:{width:1100,height:1100,channels:3,background:'#fff'}}).png().toBuffer();assert.equal((await f.handler(request('upload',{image:'data:image/png;base64,'+huge.toString('base64')}))).status,400);
 assert.equal(f.store.entries.size,0);assert.equal((await f.handler(request('avatar&id=bad'))).status,404);assert.equal((await f.handler(request('avatar&id='+'a'.repeat(64)))).status,404);
});
test('storage failures return a safe retry message without leaking server details',async()=>{
 const f=fixture();f.store.set=async()=>{throw Error('secret connection string');};const response=await f.handler(request('upload',await image()));assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes('secret'),false);
});
test('editing a member profile refreshes existing best-score entries across all six games',async()=>{
 const store=memoryStore();let current={...user,avatar:origin+'/first.webp'},clock=now;const handler=createScoresHandler({production:()=>true,verify:async()=>current,store:()=>store,now:()=>clock,photo:scorePhoto});
 const call=async(route,data)=>{const response=await handler(new Request(origin+'/.netlify/functions/ncn-scores?route='+route,{method:data?'POST':'GET',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}));assert.equal(response.status,200);return response.json();};
 for(const [game,spec] of Object.entries(GAMES)){const mode=Object.keys(spec.modes)[0],run=await call('start',{game,mode});clock+=20000;await call('score',{runId:run.runId,score:500,level:1});}
 current={...current,name:'Hồ sơ đã đổi',avatar:origin+'/changed.webp'};await call('profile');
 for(const [game,spec] of Object.entries(GAMES)){const board=await call('board&game='+game+'&mode='+Object.keys(spec.modes)[0]);assert.equal(board.total,1);assert.equal(board.items[0].name,current.name);assert.equal(board.items[0].avatar,current.avatar);assert.equal(board.items[0].score,500);assert.equal(board.items[0].rank,1);assert.equal(JSON.stringify(board).includes(user.email),false);}
});
