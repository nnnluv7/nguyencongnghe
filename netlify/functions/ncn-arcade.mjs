import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createArcadeHandler} from '../lib/ncn-arcade-api.mjs';
import {createSigningKeys,validPublicKeys} from '../../server/arcade/protocol.mjs';
import serverConfig from '../lib/ncn-arcade/config.json' with {type:'json'};
const store=()=>getStore({name:'ncn-arcade-v1',consistency:'strong'});
let remote=null,pending=null;
async function keys(){const s=store(),current=await s.get('signing-keys',{type:'json'});if(current)return current;const next=createSigningKeys(),written=await s.setJSON('signing-keys',next,{onlyIfNew:true});return written.modified?next:s.get('signing-keys',{type:'json'});}
async function serverKeys(){
 if(remote&&Date.now()<remote.until)return remote.keys;if(pending)return pending;
 pending=(async()=>{const u=new URL('/keys',process.env.NCN_ARCADE_SERVER_URL||serverConfig.serverURL),r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Server key unavailable');const raw=await r.text();if(raw.length>2000)throw Error('Invalid key');const keys=JSON.parse(raw);if(!validPublicKeys(keys))throw Error('Invalid key');remote={keys,until:Date.now()+3000};return keys;})();
 try{return await pending;}finally{pending=null;}
}
export default (req,context)=>createArcadeHandler({
 production:()=>context?.deploy?.context==='production',
 config:()=>({url:process.env.NCN_ARCADE_SERVER_URL||serverConfig.serverURL}),
 store,keys,serverKeys,
 verify:request=>verifyIdentity(request,getIdentityConfig())
})(req);
