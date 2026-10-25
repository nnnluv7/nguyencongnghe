export async function readPublicStories(store,now=Date.now()){
  const value=await store.get('index',{type:'json'});
  return (Array.isArray(value?.items)?value.items:[]).filter(x=>x.state==='active'&&(Date.parse(x.expiresAt)||Date.parse(x.createdAt)+86400000)>now).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({id,authorKey,name,caption,createdAt,expiresAt,width,height})=>({id,authorKey,name,caption,createdAt,expiresAt,width,height}));
}
