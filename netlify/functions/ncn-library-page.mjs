import {getStore} from '@netlify/blobs';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createLibraryPageHandler} from '../lib/ncn-library-page.mjs';

const seed=JSON.parse(readFileSync(join(process.cwd(),'netlify/lib/ncn-library/seed.json'),'utf8'));
const file=path=>readFile(join(process.cwd(),path),'utf8');
export default (req,context)=>createLibraryPageHandler({
  production:()=>context?.deploy?.context==='production',seed,
  store:()=>getStore({name:'ncn-site-library-v1',consistency:'strong'}),
  indexShell:()=>file('public/thu-vien/index.html'),articleShell:()=>file('netlify/lib/ncn-library/article-shell.html'),
  original:path=>file('public/'+path)
})(req);
