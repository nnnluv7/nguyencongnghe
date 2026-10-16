import { getIdentityConfig } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode/lib/core/qrcode.js';
import Core from '../lib/ncn-event-private/core.cjs';
import {createHandler,verifyIdentity} from '../lib/ncn-event-api.mjs';
import {PAYMENT_STORE,withPaidVip} from '../lib/ncn-membership.mjs';

const base=path.join(process.cwd(),'netlify/lib/ncn-event-private');
const dependencies={
  verify:async req=>withPaidVip(await verifyIdentity(req,getIdentityConfig()),()=>getStore({name:PAYMENT_STORE,consistency:'strong'})),
  store:()=>getStore({name:'ncn-event-vip-v1',consistency:'strong'}),
  asset:name=>readFileSync(path.join(base,name),'utf8'),
  print:(items,settings)=>Core.printable(items,settings,{
    frame:readFileSync(path.join(base,'stick.png')).toString('base64'),
    font:readFileSync(path.join(base,'mt2-mincap.woff2')).toString('base64'),
    qr:code=>QRCode.create(code,{errorCorrectionLevel:'M'}).modules
  })
};
export default async (request,context)=>createHandler({...dependencies,production:()=>context?.deploy?.context==='production'})(request);
