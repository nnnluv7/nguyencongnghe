import {createHash} from 'node:crypto';

export const PAYMENT_STORE='ncn-vip-payments-v1';
export const memberKey=userId=>'member-'+createHash('sha256').update(String(userId)).digest('hex');

export function emptyMember(user){
  return {schema:1,userId:user.id,email:user.email,name:user.name,expiresAt:null,blocked:false,grants:{},requests:{},updatedAt:null};
}

// Paid access lives in the server ledger, never in browser metadata or a permanent role.
// Existing VIP roles granted by the owner remain unchanged.
export async function withPaidVip(user,storeFactory,now=Date.now()){
  if(!user)return null;
  if(user.admin||user.vip)return {...user,vipSource:user.admin?'admin':'manual',vipExpiresAt:null};
  const store=typeof storeFactory==='function'?storeFactory():storeFactory;
  const member=await store.get(memberKey(user.id),{type:'json'});
  if(member&&member.userId!==user.id)throw new Error('Invalid membership record');
  const expires=Date.parse(member?.expiresAt||'');
  const active=!!(member&&!member.blocked&&Number.isFinite(expires)&&expires>now);
  return {...user,vip:active,vipSource:active?'payment':'none',vipExpiresAt:Number.isFinite(expires)?member.expiresAt:null,paidVipBlocked:!!member?.blocked};
}
