/* A display hint only. It never supplies authentication or VIP authorization. */
export const PROFILE_KEY='ncn:account:display:v1';
const MAX_AGE=30*60*1000;

export function sessionSubject(cookie,now=Date.now()){
  try{
    const token=decodeURIComponent(String(cookie).match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1]||'');
    const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return typeof claims.sub==='string'&&claims.exp*1000>now?claims.sub:null;
  }catch{return null;}
}
export function displayProfile(user){
  if(!user||typeof user.id!=='string'||typeof user.email!=='string')return null;
  return {id:user.id.slice(0,200),email:user.email.slice(0,254),name:String(user.name||user.email).slice(0,200)};
}
export function readDisplayProfile(storage,cookie,now=Date.now()){
  try{
    const saved=JSON.parse(storage?.getItem(PROFILE_KEY)||'null'),subject=sessionSubject(cookie,now);
    if(!subject||!saved||saved.profile?.id!==subject||!Number.isFinite(saved.checkedAt)||saved.checkedAt>now+5000||now-saved.checkedAt>MAX_AGE)return null;
    return displayProfile(saved.profile);
  }catch{return null;}
}
export function saveDisplayProfile(storage,user,now=Date.now()){
  try{
    const profile=displayProfile(user);
    if(profile)storage?.setItem(PROFILE_KEY,JSON.stringify({profile,checkedAt:now}));
    else storage?.removeItem(PROFILE_KEY);
  }catch{/* Blocked storage must not prevent signing in. */}
}
