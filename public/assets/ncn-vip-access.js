// Use only the current account response verified by the server, never a cached profile.
export function canUseVip(user,now=Date.now()){
  return Boolean(user?.id&&(user.admin===true||(user.vip===true&&user.vipSource==='manual')||(!user.paidVipBlocked&&user.vip===true&&user.vipSource==='payment'&&Date.parse(user.vipExpiresAt)>now)||(!user.paidVipBlocked&&user.trial?.remaining>0)));
}

export function isVipToolURL(value){
  try{return /^\/in-(?:event|gvgs)(?:\/|$)/.test(new URL(value,'https://nguyencongnghe.com').pathname);}
  catch{return false;}
}
