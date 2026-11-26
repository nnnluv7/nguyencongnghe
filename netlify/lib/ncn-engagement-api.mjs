import {createHash} from 'node:crypto';

export const REACTIONS=['like','dislike','love','angry'];
const HOUR=3600000,MAX_COMMENTS=500;
const ids={story:/^story-[a-f0-9]{40}$/,article:/^(?:legacy-[a-f0-9]{16}|post-[a-f0-9-]{36}|rss-genk-[a-f0-9]{20})$/};
const commentID=/^comment-[a-f0-9]{40}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hash=value=>createHash('sha256').update(value).digest('hex');
export const engagementAuthorKey=id=>hash('ncn-community-author:'+id);
export const engagementKey=(kind,id)=>'thread-'+kind+'-'+id;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function target(kind,id){if(!Object.hasOwn(ids,kind)||!ids[kind].test(id||''))fail(400,'Nội dung không hợp lệ.');return {kind,id};}
async function read(store,key){
  const value=await store.getWithMetadata(key,{type:'json'});
  if(value&&(value.data?.schema!==1||!Array.isArray(value.data.comments)||typeof value.data.reactions!=='object'||!value.data.reactions))fail(503,'Bình luận đang kết nối lại. Vui lòng thử lại.');
  return value;
}
async function mutate(store,key,initial,change){
  for(let attempt=0;attempt<8;attempt++){
    const old=await read(store,key),data=old?.data||initial();
    const result=change(data);if(result?.unchanged)return result.value;
    const written=await store.setJSON(key,data,{...(old?{onlyIfMatch:old.etag}:{onlyIfNew:true}),metadata:{kind:data.kind,expiresAt:data.expiresAt||''}});
    if(written.modified)return result?.value;
  }
  fail(409,'Có tương tác khác vừa được lưu. Anh thử lại nhé.');
}
async function body(req){
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu không hợp lệ.');
  const limit=12000;if(Number(req.headers.get('content-length')||0)>limit)fail(413,'Bình luận quá dài.');
  const reader=req.body?.getReader();if(!reader)fail(400,'Chưa có nội dung.');
  let length=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail(413,'Bình luận quá dài.');}chunks.push(value);}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Dữ liệu không hợp lệ.');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dữ liệu không hợp lệ.');return data;
}
async function rateLimit(store,author,action,now){
  const key='rate-'+author;
  for(let attempt=0;attempt<8;attempt++){
    const old=await store.getWithMetadata(key,{type:'json'}),events=(old?.data?.events||[]).filter(x=>now-x.at<HOUR);
    if(action==='comment'&&events.filter(x=>x.action==='comment').length>=20||events.filter(x=>now-x.at<60000).length>=30)fail(429,'Bạn thao tác hơi nhanh. Vui lòng chờ một chút rồi thử lại.');
    events.push({action,at:now});
    if((await store.setJSON(key,{events},old?{onlyIfMatch:old.etag}:{onlyIfNew:true})).modified)return;
  }
  fail(409,'Có cập nhật khác vừa được lưu. Vui lòng thử lại.');
}
function snapshot(data,user,{before=''}={}){
  const actor=user?engagementAuthorKey(user.id):'',counts=Object.fromEntries(REACTIONS.map(x=>[x,0]));
  for(const item of Object.values(data.reactions))if(REACTIONS.includes(item.value))counts[item.value]++;
  const end=before?data.comments.findIndex(x=>x.id===before):data.comments.length;
  if(end<0)fail(409,'Danh sách bình luận vừa thay đổi. Vui lòng tải lại bình luận.');
  const visible=data.comments.slice(0,end).filter(x=>!x.deleted).reverse(),page=visible.slice(0,20);
  return {reactions:counts,mine:data.reactions[actor]?.value||null,commentCount:data.comments.filter(x=>!x.deleted).length,
    comments:page.map(({id,authorKey,name,text,createdAt})=>({id,name,text,createdAt,canDelete:!!user&&(user.admin===true||authorKey===actor)})),
    nextCursor:visible.length>page.length?page.at(-1).id:null};
}
export function createEngagementHandler(deps){return async req=>{
  try{
    if(!['GET','POST'].includes(req.method))fail(405,'Phương thức không hỗ trợ.');
    const url=new URL(req.url);
    if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail(403,'Yêu cầu phải gửi từ chính website.');
    if(!deps.production())fail(503,'Bình luận và tương tác chỉ hoạt động trên website chính thức.');
    const input=req.method==='POST'?await body(req):Object.fromEntries(url.searchParams),{kind,id}=target(input.kind,input.id);
    const now=deps.now?.()??Date.now(),resolved=await deps.resolveTarget(kind,id,now);
    if(!resolved)fail(kind==='story'?410:404,kind==='story'?'Story đã xoá hoặc hết hạn.':'Bài viết hiện không được công khai.');
    const expiresAt=resolved.expiresAt||null;if(expiresAt&&Date.parse(expiresAt)<=now)fail(410,'Story đã hết hạn.');
    const store=deps.store(),key=engagementKey(kind,id),initial=()=>({schema:1,kind,id,expiresAt,reactions:{},comments:[]});
    const user=await deps.verify(req);
    if(req.method==='GET'){
      if(input.before&&!commentID.test(input.before))fail(400,'Mốc bình luận không hợp lệ.');
      return reply(snapshot((await read(store,key))?.data||initial(),user,{before:input.before}));
    }
    if(!user?.id)fail(401,'Đăng nhập tài khoản đã xác nhận email để bình luận và tương tác.');
    const action=input.action;if(!['react','comment','delete-comment'].includes(action))fail(400,'Tương tác không hợp lệ.');
    const author=engagementAuthorKey(user.id);
    if(action==='react'&&input.value!==null&&!REACTIONS.includes(input.value))fail(400,'Chọn một cảm xúc hợp lệ.');
    if(action==='comment'){
      if(!uuid.test(input.requestId||'')||typeof input.text!=='string'||!input.text.trim()||input.text.trim().length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.text))fail(400,'Bình luận cần có từ 1 đến 1.000 ký tự.');
      input.commentId='comment-'+hash(user.id+':'+input.requestId).slice(0,40);
      const existing=await read(store,key);if(existing?.data.comments.some(x=>x.id===input.commentId))return reply(snapshot(existing.data,user));
    }
    if(action==='delete-comment'&&!commentID.test(input.commentId||''))fail(400,'Bình luận không hợp lệ.');
    await rateLimit(store,author,action,now);
    await mutate(store,key,initial,data=>{
      // Recheck expiry on every conditional-write retry as well as the request.
      if(data.expiresAt&&Date.parse(data.expiresAt)<=(deps.now?.()??Date.now()))fail(410,'Story đã hết hạn.');
      if(action==='react'){
        if(input.value===null)delete data.reactions[author];
        else {if(!data.reactions[author]&&Object.keys(data.reactions).length>=20000)fail(429,'Nội dung này đã đạt giới hạn tương tác.');data.reactions[author]={value:input.value};}
      }else if(action==='comment'){
        if(data.comments.some(x=>x.id===input.commentId))return {unchanged:true};
        if(data.comments.length>=MAX_COMMENTS)fail(429,'Nội dung này đã đạt giới hạn bình luận.');
        const name=String(user.name||'').replace(/[\u0000-\u001f\u007f]/g,'').trim();
        data.comments.push({id:input.commentId,authorKey:author,name:name&&!name.includes('@')?name.slice(0,100):'Thành viên',text:input.text.trim(),createdAt:new Date(now).toISOString()});
      }else{
        const index=data.comments.findIndex(x=>x.id===input.commentId);if(index<0||data.comments[index].deleted)return {unchanged:true};
        const item=data.comments[index];if(item.authorKey!==author&&user.admin!==true)fail(403,'Bạn chỉ có thể xoá bình luận của mình.');
        data.comments[index]={id:item.id,createdAt:item.createdAt,deleted:true};
      }
    });
    // Never acknowledge a mutation against a Story hidden while the write ran.
    if(kind==='story'&&!await deps.resolveTarget(kind,id,deps.now?.()??Date.now())){await store.delete(key);fail(410,'Story đã xoá hoặc hết hạn.');}
    return reply(snapshot((await read(store,key))?.data||initial(),user));
  }catch(error){return reply({error:error.status?error.message:'Chưa kết nối được bình luận. Vui lòng thử lại.'},error.status||503);}
};}

export async function cleanupEngagement(store,now=Date.now()){
  let removed=0;
  for await(const page of store.list({prefix:'thread-story-',paginate:true}))for(const blob of page.blobs){
    const value=await store.get(blob.key,{type:'json'});
    if(value?.expiresAt&&Date.parse(value.expiresAt)<=now){await store.delete(blob.key);removed++;}
  }
  return {removed};
}
