import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createSitePageHandler} from '../lib/ncn-site-page.mjs';
import {currentPublicState} from '../lib/ncn-public-state.mjs';
import {injectCatalog} from '../lib/ncn-library-page.mjs';

const pages=JSON.parse(readFileSync(join(process.cwd(),'netlify/lib/ncn-shell/pages.json'),'utf8'));
export default req=>createSitePageHandler({pages,html:page=>readFile(join(process.cwd(),'public',page),'utf8'),state:()=>currentPublicState(),inject:injectCatalog})(req);
