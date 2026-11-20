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

test('expired sessions restore after a browser restart, survive offline renewal and stay logged out after a late response',async()=>{
  const originalNow=Date.now;
  const keys=['window','document','localStorage','fetch','setTimeout','clearTimeout'];
  const originals=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const values=new Map(),cookies=new Map(),cookieWrites=[],timers=new Map(),listeners=new Map();
  let now=Date.parse('2026-11-20T08:00:00Z'),sequence=0,timerId=0,refreshes=0,mode='online',release;
  const user={id:'persistent-member',email:'persistent@example.test',confirmed_at:'2026-11-20',app_metadata:{roles:[]},user_metadata:{full_name:'Session fixture'}};
  const token=()=>({
    access_token:'fixture.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(now/1000)+3600,sequence:++sequence})).toString('base64url')+'.fixture',
    refresh_token:'refresh-'+sequence,expires_in:3600,token_type:'bearer',user
  });
  const document={};
  Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([key,value])=>key+'='+value).join('; '),set:value=>{
    cookieWrites.push(value);
    const pair=value.split(';')[0],at=pair.indexOf('='),key=pair.slice(0,at),content=pair.slice(at+1);
    content?cookies.set(key,content):cookies.delete(key);
  }});
  globalThis.window={location:{origin:'https://persistent.test'},addEventListener(type,fn){
    const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);
  }};
  globalThis.document=document;
  globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  globalThis.setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;};
  globalThis.clearTimeout=id=>timers.delete(id);
  Date.now=()=>now;
  globalThis.fetch=async(url,options={})=>{
    const action=new URL(url).pathname.split('/').at(-1);
    if(action==='token'){
      const data=new URLSearchParams(options.body);
      if(data.get('grant_type')==='refresh_token'){
        refreshes++;
        if(mode==='offline')throw new TypeError('Fixture network failure');
        if(mode==='revoked')return Response.json({error:'invalid_grant'}, {status:400});
        if(mode==='delayed')await new Promise(resolve=>release=resolve);
      }
      return Response.json(token());
    }
    if(action==='user')return Response.json(user);
    if(action==='logout')return Response.json({});
    throw Error('Unexpected session fixture '+url);
  };
  let identity;
  try{
    identity=await import('../public/assets/ncn-identity-client.js?persistent-browser-first');
    await identity.signIn(user.email,'fixture-password');
    assert.ok(cookieWrites.filter(value=>/^nf_(jwt|refresh)=.+/.test(value)).every(value=>value.includes('max-age=31536000')));
    const stored=values.get('gotrue.user');
    cookies.clear();timers.clear();listeners.clear();
    now+=2*3600000;
    identity=await import('../public/assets/ncn-identity-client.js?persistent-browser-reopen');
    const [first,second]=await Promise.all([identity.ensureSession(),identity.ensureSession()]);
    assert.equal(first.id,user.id);assert.equal(second.id,user.id);
    assert.equal(refreshes,1);
    assert.ok(cookies.has('nf_jwt'));assert.notEqual(values.get('gotrue.user'),stored);

    now+=2*3600000;mode='offline';
    const saved=values.get('gotrue.user');
    await assert.rejects(identity.ensureSession(),/network failure/);
    assert.equal(values.get('gotrue.user'),saved);
    mode='online';
    assert.equal((await identity.ensureSession()).id,user.id);
    assert.equal(refreshes,3);

    now+=2*3600000;mode='delayed';
    const pending=identity.ensureSession();
    while(!release)await Promise.resolve();
    await identity.signOut();
    assert.equal(values.has('gotrue.user'),false);assert.equal(cookies.has('nf_jwt'),false);
    release();
    await assert.rejects(pending,/thay đổi/);
    assert.equal(values.has('gotrue.user'),false);assert.equal(cookies.has('nf_jwt'),false);
    assert.equal(await identity.ensureSession(),null);

    mode='online';await identity.signIn(user.email,'fixture-password');
    now+=2*3600000;mode='revoked';
    await assert.rejects(identity.ensureSession());
    assert.equal(values.has('gotrue.user'),false);
    assert.equal(cookies.has('nf_jwt'),false);
  }finally{
    await identity?.signOut().catch(()=>{});
    Date.now=originalNow;
    for(const [key,value] of Object.entries(originals))value===undefined?delete globalThis[key]:globalThis[key]=value;
  }
});
