import {createHash, randomUUID} from 'node:crypto';
import {withMemberVip, withPaidVip} from './ncn-membership.mjs';

export const TRIAL_LIMIT=3;
const COOKIE='ncn_vip_trial';
const hash=value=>createHash('sha256').update(value).digest('hex');
const key=(kind,id)=>'trial-'+kind+'-'+hash(id);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const events=record=>record?.uses||{};
const count=record=>Object.keys(events(record)).length;
async function change(store,k,fn){
  for(let n=0;n<16;n++){
    const old=await store.getWithMetadata(k,{type:'json'}),draft=structuredClone(old?.data||{schema:1,uses:{}});
    const result=fn(draft);
    if(result?.skip)return result.value;
    const saved=await store.setJSON(k,draft,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(saved.modified)return result?.value;
  }
  fail(503,'Có nhiều thao tác cùng lúc. Vui lòng thử lại.');
}

// The browser ID is opaque and HttpOnly. Usage is kept on the server, shared by
// both tools, and imported into the confirmed account after sign-in.
export async function resolveVipAccess(req,identity,storeFactory,now=Date.now()){
  let user=withMemberVip(identity);
  if(user?.admin||user?.vip)return {user,trial:null,cookie:null,unlimited:true};
  const store=typeof storeFactory==='function'?storeFactory():storeFactory;
  user=await withPaidVip(user,store,now);
  if(user?.vip)return {user,trial:null,cookie:null,unlimited:true};
  const matches=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
  const saved=matches.length===1?matches[0].slice(COOKIE.length+1):'';
  const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved);
  const browserId=valid?saved:randomUUID(),browserKey=key('browser',browserId);
  const cookie=valid?null:COOKIE+'='+browserId+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000';
  const browser=await store.get(browserKey,{type:'json'}),accountKey=user?key('user',user.id):null;
  let account=null;
  if(accountKey){
    account=await change(store,accountKey,draft=>{
      const merged={...events(draft),...events(browser)};
      if(JSON.stringify(merged)===JSON.stringify(events(draft)))return {skip:true,value:draft};
      draft.uses=merged;return {value:draft};
    });
  }
  const used=Math.min(TRIAL_LIMIT,Math.max(count(browser),count(account))),blocked=!!user?.paidVipBlocked;
  const trial={limit:TRIAL_LIMIT,used,remaining:blocked?0:TRIAL_LIMIT-used};
  const viewer=user?{...user,trial}:{id:'guest-'+browserId,name:'Khách dùng thử',email:null,admin:false,vip:false,vipSource:'none',guest:true,trial};
  return {user:viewer,trial,cookie,unlimited:false,store,keys:[browserKey,...(accountKey?[accountKey]:[])]};
}

// Generate/validate the print first. CAS reservations then enforce the limit
// across tabs, browsers and the two functions. Retrying the same request is free.
export async function consumeVipTrial(access,requestId,fingerprint,now=Date.now()){
  if(access.unlimited)return null;
  if(access.user.paidVipBlocked)fail(403,'Quyền thành viên đang tạm khóa. Vui lòng liên hệ Admin.');
  if(typeof requestId!=='string'||!/^[-a-zA-Z0-9_]{16,80}$/.test(requestId))fail(400,'Mã lượt dùng chưa hợp lệ. Tải lại công cụ và thử lại.');
  const digest=hash(fingerprint),added=[];
  try{
    for(const k of access.keys){
      const created=await change(access.store,k,draft=>{
        const old=events(draft)[requestId];
        if(old){if(old.fingerprint!==digest)fail(409,'Mã lượt dùng đã được sử dụng cho bản in khác.');return {skip:true,value:false};}
        if(count(draft)>=TRIAL_LIMIT)fail(403,'Bạn đã dùng hết 3 lượt Event VIP và Giờ vàng VIP. Donate để sử dụng không giới hạn.');
        draft.uses[requestId]={fingerprint:digest,at:new Date(now).toISOString()};return {value:true};
      });
      if(created)added.push(k);
    }
  }catch(error){
    for(const k of added)await change(access.store,k,draft=>{delete draft.uses[requestId];return {};});
    throw error;
  }
  const records=await Promise.all(access.keys.map(k=>access.store.get(k,{type:'json'})));
  const used=Math.min(TRIAL_LIMIT,Math.max(...records.map(count)));
  return {limit:TRIAL_LIMIT,used,remaining:TRIAL_LIMIT-used};
}
