// Use only the current account response verified by the server, never a cached profile.
export function canUseVip(user){
  return Boolean(user?.id&&(user.admin===true||(user.vip===true&&user.vipSource==='manual')));
}

export function isVipToolURL(value){
  try{return /^\/in-(?:event|gvgs)(?:\/|$)/.test(new URL(value,'https://nguyencongnghe.com').pathname);}
  catch{return false;}
}
