import test from 'node:test';
import assert from 'node:assert/strict';

test('sign-in writes the shared cookie before publishing its persisted session to other tabs',async()=>{
  const listeners=new Map(),values=new Map(),publications=[];
  const user={id:'fixture-vip',email:'vip@example.test',confirmed_at:'2026-10-24T00:00:00Z',created_at:'2026-10-24T00:00:00Z',app_metadata:{roles:['admin']},user_metadata:{full_name:'Fixture only'}};
  const jwt='fixture.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
  const cookies=new Map(),document={};
  Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([key,value])=>key+'='+value).join('; '),set:value=>{
    const pair=value.split(';')[0],at=pair.indexOf('='),key=pair.slice(0,at),content=pair.slice(at+1);content?cookies.set(key,content):cookies.delete(key);
  }});
  const storage={getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key),setItem(key,value){
    values.set(key,value);
    if(key==='gotrue.user')publications.push({id:JSON.parse(value).id,cookie:cookies.has('nf_jwt')});
  }};
  const originals={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
  globalThis.window={location:{origin:'https://identity-fixture.test'},addEventListener(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);}};
  globalThis.document=document;globalThis.localStorage=storage;
  globalThis.fetch=async url=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/token'))return Response.json({access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});
    if(path.endsWith('/user'))return Response.json(user);
    if(path.endsWith('/logout'))return Response.json({});
    throw Error('Unexpected fixture request '+path);
  };
  let identity;
  try{
    identity=await import('../public/assets/ncn-identity-client.js?publication-test');
    const signedIn=await identity.signIn(user.email,'fixture-password');assert.equal(signedIn.id,user.id);
    assert.ok(publications.length>0,'Other tabs must receive a persisted session');
    assert.deepEqual(publications.map(x=>x.cookie),publications.map(()=>true),'A peer must already have the session cookie when its storage event arrives');
    assert.equal((await identity.ensureSession()).id,user.id);
    await identity.signOut();assert.equal(cookies.has('nf_jwt'),false);assert.equal(storage.getItem('gotrue.user'),null);
  }finally{
    await identity?.signOut().catch(()=>{});
    for(const [key,value] of Object.entries(originals))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
