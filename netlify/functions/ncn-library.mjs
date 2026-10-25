import {getIdentityConfig} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyIdentity} from '../lib/ncn-event-api.mjs';
import {createLibraryHandler} from '../lib/ncn-library-api.mjs';
import {currentNews} from '../lib/ncn-public-state.mjs';

const root=join(process.cwd(),'netlify/lib/ncn-library');
const seed=JSON.parse(readFileSync(join(root,'seed.json'),'utf8'));
const originalBodies=JSON.parse(readFileSync(join(root,'original-markdown.json'),'utf8'));
export default (req,context)=>createLibraryHandler({
  production:()=>context?.deploy?.context==='production',seed,originalBodies,news:currentNews,
  verify:request=>verifyIdentity(request,getIdentityConfig()),
  store:()=>getStore({name:'ncn-site-library-v1',consistency:'strong'}),
  app:view=>readFile(join(root,view==='library'?'admin-library.html':'admin-hub.html'),'utf8')
})(req);
