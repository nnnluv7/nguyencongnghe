export function memoryStories(){
  const entries=new Map();let serial=0;
  return {entries,beforeWrite:null,failDelete:false,
    async get(key,{type}={}){const data=entries.get(key)?.data;if(data==null)return null;return type==='arrayBuffer'?new Uint8Array(data).buffer:structuredClone(data);},
    async getWithMetadata(key){return structuredClone(entries.get(key)??null);},
    async getMetadata(key){const item=entries.get(key);return item?{metadata:item.metadata||{},etag:item.etag}:null;},
    async *list({prefix}){const keys=[...entries.keys()].filter(k=>k.startsWith(prefix));for(let i=0;i<keys.length;i+=20)yield {blobs:keys.slice(i,i+20).map(key=>({key}))};},
    async delete(key){if(this.failDelete){this.failDelete=false;throw Error('Interrupted deletion');}entries.delete(key);},
    async set(key,data,options={}){
      if(this.beforeWrite){const hook=this.beforeWrite;this.beforeWrite=null;await hook(key);}
      const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
      entries.set(key,{data:structuredClone(data),etag:'"'+(++serial)+'"',metadata:options.metadata});return {modified:true};
    },
    async setJSON(key,data,options){return this.set(key,data,options);}
  };
}
