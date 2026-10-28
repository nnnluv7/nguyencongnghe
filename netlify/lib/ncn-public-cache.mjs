// Cache only anonymous, public page shells at Netlify's CDN. Browsers always
// revalidate HTML. Account, VIP, scores, article bodies and errors stay no-store.
export function publicPageHeaders({seconds=60,stories=[],now=Date.now()}={}){
  for(const item of stories||[]){const expires=Date.parse(item.expiresAt);if(Number.isFinite(expires)&&expires>now)seconds=Math.min(seconds,Math.max(0,Math.floor((expires-now)/1000)-1));}
  return {'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','Netlify-CDN-Cache-Control':'public, durable, max-age='+Math.max(0,seconds)+', must-revalidate','X-Content-Type-Options':'nosniff'};
}
