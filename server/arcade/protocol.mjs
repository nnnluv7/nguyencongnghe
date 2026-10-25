import {createHash,generateKeyPairSync,sign,verify,createPublicKey} from 'node:crypto';
export const AUDIENCE='ncn-snake-online-v1';
export const roomCode=value=>typeof value==='string'&&(value==='public'||/^[\w-]{22}$/.test(value));
export const playerKey=id=>createHash('sha256').update('ncn-arcade-v1:'+id).digest('hex');
export const displayName=(name,id)=>{const n=String(name||'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,24);return n&&!n.includes('@')?n:'Rắn '+playerKey(id).slice(0,5);};
export function createSigningKeys(){const k=generateKeyPairSync('ed25519'),publicKey=k.publicKey.export({format:'pem',type:'spki'}),privateKey=k.privateKey.export({format:'pem',type:'pkcs8'});return {kid:createHash('sha256').update(publicKey).digest('hex').slice(0,16),publicKey,privateKey};}
export function validPublicKeys(keys){try{return /^[\da-f]{16}$/.test(keys?.kid||'')&&typeof keys.publicKey==='string'&&keys.publicKey.length<1000&&createPublicKey(keys.publicKey).asymmetricKeyType==='ed25519';}catch{return false;}}
const signature=(text,key)=>sign(null,Buffer.from(text),key).toString('base64url');
const valid=(text,sig,key)=>{try{return typeof sig==='string'&&sig.length<100&&verify(null,Buffer.from(text),key,Buffer.from(sig,'base64url'));}catch{return false;}};
export function signTicket(claims,keys,now=Date.now()){
 const head=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:keys.kid})).toString('base64url'),body=Buffer.from(JSON.stringify({...claims,aud:AUDIENCE,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+120})).toString('base64url'),text=head+'.'+body;
 return text+'.'+signature(text,keys.privateKey);
}
export function verifyTicket(token,keys,now=Date.now()){
 if(typeof token!=='string'||token.length>4096||!validPublicKeys(keys))throw Error('Invalid ticket');
 const [head,body,sig,...extra]=token.split('.');if(extra.length||!sig||!valid(head+'.'+body,sig,keys.publicKey))throw Error('Invalid ticket');
 let h,c;try{h=JSON.parse(Buffer.from(head,'base64url'));c=JSON.parse(Buffer.from(body,'base64url'));}catch{throw Error('Invalid ticket');}
 if(h.alg!=='EdDSA'||h.typ!=='JWT'||h.kid!==keys.kid||c.aud!==AUDIENCE||!Number.isInteger(c.exp)||c.exp<=now/1000||c.exp>now/1000+125||!Number.isInteger(c.iat)||c.iat>now/1000+5||!roomCode(c.room)||!/^\w{64}$/.test(c.sub||'')||!/^[\da-f-]{36}$/.test(c.jti||'')||typeof c.name!=='string'||c.name.length>24)throw Error('Invalid ticket');
 return c;
}
export function signRecord(body,keys,now=Date.now()){const timestamp=String(Math.floor(now/1000));return {timestamp,kid:keys.kid,signature:signature('record\n'+timestamp+'\n'+body,keys.privateKey)};}
export function verifyRecord(body,keys,timestamp,sig,kid,now=Date.now()){
 return validPublicKeys(keys)&&keys.kid===kid&&/^\d{10}$/.test(timestamp||'')&&Math.abs(now/1000-Number(timestamp))<=60&&valid('record\n'+timestamp+'\n'+body,sig,keys.publicKey);
}
