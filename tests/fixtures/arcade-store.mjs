export function memoryStore(){
 const entries=new Map();let version=0;
 return {entries,
  async get(key){return structuredClone(entries.get(key)?.data??null);},
  async getWithMetadata(key){return structuredClone(entries.get(key)||null);},
  async setJSON(key,data,options={}){return this.set(key,data,options);},
  async set(key,data,options={}){const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};entries.set(key,{data:structuredClone(data),etag:String(++version)});return {modified:true};},
  async delete(key){entries.delete(key);},
  async list({prefix=''}){return {blobs:[...entries.keys()].filter(key=>key.startsWith(prefix)).reverse().map(key=>({key,etag:entries.get(key).etag}))};}
 };
}
// Existing engine/layout suites start with an established synthetic guest.
// The dedicated Arcade browser suite tests first-time profile creation and the
// real score handler separately; this fixture creates no production data.
export function arcadeEngineFixture(url){
 const route=url.searchParams.get('route');
 if(route==='profile')return {profile:{id:'a'.repeat(64),name:'Người chơi thử',avatar:'preset:🐱',member:false}};
 if(route==='start')return {runId:'00000000-0000-4000-8000-000000000001',owner:'a'.repeat(64)};
 if(route==='score')return {saved:true,improved:true,best:100};
 return {items:[],total:0,nextCursor:null,you:null};
}
