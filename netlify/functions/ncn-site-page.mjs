import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createSitePageHandler} from '../lib/ncn-site-page.mjs';
import {currentPublicState} from '../lib/ncn-public-state.mjs';
import {injectCatalog} from '../lib/ncn-library-page.mjs';
import {optimizePublicResponse} from '../lib/ncn-public-assets.mjs';

const pages=JSON.parse(readFileSync(join(process.cwd(),'netlify/lib/ncn-shell/pages.json'),'utf8'));
// The literal suffix keeps Netlify's dependency trace inside the HTML allowlist.
// A bare dynamic path makes it inspect unrelated browser JavaScript under public.
const html=page=>readFile(join(process.cwd(),'public',`${page.slice(0,-5)}.html`),'utf8');
export default async req=>optimizePublicResponse(await createSitePageHandler({pages,html,state:()=>currentPublicState(),inject:injectCatalog})(req));
