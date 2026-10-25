import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';

const KEY='index',MAX_BYTES=2*1024*1024,DAY=86400000;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const validID=/^story-[a-f0-9]{40}$/;
const headers={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
export const storyAuthorKey=id=>hash('ncn-story-author:'+id);
const expiry=item=>Date.parse(item.expiresAt)||Date.parse(item.createdAt)+DAY;
const active=(item,now)=>item.state==='active'&&expiry(item)>now;
const publicItem=({id,authorKey,name,caption,createdAt,expiresAt,width,height})=>({id,authorKey,name,caption,createdAt,expiresAt,width,height});
async function read(store){
  const result=await store.getWithMetadata(KEY,{type:'json'});
  if(result&&(!Array.isArray(result.data?.items)||!Array.isArray(result.data?.uploads)))fail(503,'Story đang được cập nhật. Vui lòng thử lại.');
  return result;
}
async function mutate(store,change){
  for(let attempt=0;attempt<6;attempt++){
    const old=await read(store),index=old?.data||{items:[],uploads:[]};
    const result=await change(index);if(result?.unchanged)return result.value;
    const written=await store.setJSON(KEY,index,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(written.modified)return result?.value;
  }
  fail(409,'Có cập nhật khác vừa được lưu. Vui lòng thử lại.');
}
async function body(req){
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu ảnh không hợp lệ.');
  const limit=MAX_BYTES*4/3+4096;
  if(Number(req.headers.get('content-length')||0)>limit)fail(413,'Ảnh gửi lên cần nhỏ hơn 2 MB.');
  // Bound the streamed body as well as Content-Length.
  const reader=req.body?.getReader();if(!reader)fail(400,'Chưa có ảnh.');
  const chunks=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail(413,'Ảnh gửi lên cần nhỏ hơn 2 MB.');}chunks.push(value);}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Dữ liệu không hợp lệ.');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dữ liệu không hợp lệ.');return data;
}
export async function prepareStoryImage(encoded){
  if(typeof encoded!=='string'||!encoded.length||encoded.length>MAX_BYTES*4/3+4||encoded.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail(400,'Chọn ảnh JPEG, PNG hoặc WebP hợp lệ.');
  const input=Buffer.from(encoded,'base64');if(input.length>MAX_BYTES)fail(413,'Ảnh gửi lên cần nhỏ hơn 2 MB.');
  try{
    const image=sharp(input,{limitInputPixels:40000000,failOn:'warning'}),meta=await image.metadata();
    if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1||!meta.width||!meta.height)fail(400,'Chọn một ảnh tĩnh JPEG, PNG hoặc WebP.');
    // Re-encode the decoded pixels. Never serve the original upload or its EXIF.
    const {data:photo,info}=await image.rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).flatten({background:'#f5f7fb'}).jpeg({quality:82,mozjpeg:true}).toBuffer({resolveWithObject:true});
    const thumb=await sharp(photo).resize(300,420,{fit:'cover',position:'attention'}).jpeg({quality:72}).toBuffer();
    return {photo,thumb,width:info.width,height:info.height};
  }catch(error){if(error.status)throw error;fail(400,'Không đọc được ảnh. Hãy chọn ảnh JPEG, PNG hoặc WebP khác.');}
}
async function eraseStoryBytes(store,item){
  // The index already marks this entry as deleting. Interrupted cleanup can be
  // retried by its owner, an Admin, or the scheduled maintenance function.
  await store.setJSON('gone-'+item.id,{deleted:true},{onlyIfNew:true});
  await Promise.all([store.delete(item.imageKey),store.delete(item.thumbKey)]);
}
async function removeStory(store,item){
  await eraseStoryBytes(store,item);
  await mutate(store,index=>{index.items=index.items.filter(x=>x.id!==item.id);});
}
export async function cleanupStories(store,now=Date.now()){
  await mutate(store,index=>{
    const expired=index.items.filter(x=>x.state==='active'&&expiry(x)<=now);if(!expired.length)return {unchanged:true};
    expired.forEach(item=>item.state='deleting');
  });
  let index=await read(store),removed=0;
  const pending=(index?.data.items||[]).filter(x=>x.state==='deleting');
  for(let offset=0;offset<pending.length;offset+=10){
    const batch=pending.slice(offset,offset+10),results=await Promise.allSettled(batch.map(item=>eraseStoryBytes(store,item)));
    const done=new Set(batch.filter((_,i)=>results[i].status==='fulfilled').map(x=>x.id));
    if(done.size){await mutate(store,value=>{value.items=value.items.filter(x=>!done.has(x.id));});removed+=done.size;}
  }
  // Uploads are immutable and written before publication. Collect only old,
  // unreferenced bytes after cleaning up the expired Story pointers.
  index=await read(store);const live=new Set((index?.data.items||[]).flatMap(x=>[x.imageKey,x.thumbKey]));
  let checked=0;
  for await(const page of store.list({prefix:'image-',paginate:true}))for(const blob of page.blobs){
    if(++checked>1500)return {removed};if(live.has(blob.key))continue;
    const meta=await store.getMetadata(blob.key),created=Date.parse(meta?.metadata?.createdAt);
    if(Number.isFinite(created)&&now-created>DAY){await store.delete(blob.key);removed++;}
  }
  return {removed};
}
export function createStoriesHandler(deps){return async req=>{
  try{
    const url=new URL(req.url),route=url.searchParams.get('route')||'list';
    if(!['GET','POST'].includes(req.method))fail(405,'Phương thức không hỗ trợ.');
    if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail(403,'Yêu cầu phải gửi từ chính website.');
    if(!deps.production()){if(req.method==='GET'&&route==='list')return reply({items:[]});fail(503,'Story chỉ hoạt động trên website chính thức.');}
    const store=deps.store(),now=deps.now?.()??Date.now();
    if(req.method==='GET'&&['list','image'].includes(route)){
      const index=await read(store),items=(index?.data.items||[]).filter(x=>active(x,now));
      if(route==='list')return reply({items:items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicItem),serverNow:new Date(now).toISOString()});
      const id=url.searchParams.get('id');if(!validID.test(id||''))fail(404,'Ảnh không còn hiển thị.');
      const item=items.find(x=>x.id===id);if(!item)fail(404,'Ảnh không còn hiển thị.');
      const image=await store.get(url.searchParams.get('size')==='thumb'?item.thumbKey:item.imageKey,{type:'arrayBuffer'});
      if(!image)fail(404,'Ảnh không còn hiển thị.');
      return new Response(image,{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="ncn-story.jpg"','Cross-Origin-Resource-Policy':'same-origin'}});
    }
    if(req.method!=='POST'||!['create','delete'].includes(route))fail(404,'Không tìm thấy chức năng.');
    const user=await deps.verify(req);if(!user?.id)fail(401,'Đăng nhập tài khoản đã xác nhận email để đăng ảnh.');
    const data=await body(req),authorKey=storyAuthorKey(user.id);
    if(route==='delete'){
      if(!validID.test(data.id||''))fail(400,'Mã Story không hợp lệ.');
      const item=await mutate(store,index=>{
        const item=index.items.find(x=>x.id===data.id);if(!item)return {unchanged:true,value:null};
        if(item.owner!==user.id&&!user.admin)fail(403,'Bạn chỉ có thể xoá Story của mình.');
        item.state='deleting';return {value:{...item}};
      });
      if(item){try{await removeStory(store,item);}catch{fail(503,'Story đã ẩn. Bấm Xoá lần nữa để hoàn tất xoá ảnh.');}}
      return reply({deleted:true,id:data.id});
    }
    if(!uuid.test(data.requestId||'')||typeof data.caption!=='string'||data.caption.trim().length>180||/[\u0000-\u001f\u007f]/.test(data.caption))fail(400,'Chú thích tối đa 180 ký tự, trên một dòng.');
    const id='story-'+hash(user.id+':'+data.requestId).slice(0,40),caption=data.caption.trim();
    const existing=(await read(store))?.data.items.find(x=>x.id===id);
    if(existing){if(!active(existing,now))fail(409,'Story này đã xoá hoặc hết hạn. Chọn ảnh để tạo Story mới.');return reply({item:publicItem(existing)});}
    if(await store.get('gone-'+id,{type:'json'}))fail(409,'Story này đã được xoá. Chọn ảnh để tạo Story mới.');
    const checkQuota=index=>{
      if(index.items.filter(x=>active(x,now)).length>=200||index.items.length>=400)fail(409,'Dãy Story đã đủ ảnh. Vui lòng thử lại sau khi các ảnh cũ hết hạn.');
      const recent=index.uploads.filter(x=>now-x.at<DAY);
      if(recent.filter(x=>x.authorKey===authorKey).length>=5||recent.length>=2000)fail(429,'Mỗi tài khoản được đăng tối đa 5 ảnh trong 24 giờ. Hãy thử lại sau.');
    };
    checkQuota((await read(store))?.data||{items:[],uploads:[]});
    const image=await prepareStoryImage(data.image),revision=randomUUID(),prefix='image-'+id+'-'+revision;
    // Never expose an email address as the public display name.
    const name=String(user.name||'').replace(/[\u0000-\u001f\u007f]/g,'').trim();
    const item={id,owner:user.id,authorKey,name:name&&!name.includes('@')?name.slice(0,100):'Thành viên NCN',caption,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+DAY).toISOString(),width:image.width,height:image.height,state:'active',imageKey:prefix+'-full',thumbKey:prefix+'-thumb'};
    let published=false;
    try{
      const metadata={createdAt:item.createdAt};
      await store.set(item.imageKey,image.photo,{onlyIfNew:true,metadata});
      await store.set(item.thumbKey,image.thumb,{onlyIfNew:true,metadata});
      const result=await mutate(store,async index=>{
        const duplicate=index.items.find(x=>x.id===id);
        if(duplicate){if(!active(duplicate,now))fail(409,'Story đã xoá hoặc hết hạn.');return {unchanged:true,value:publicItem(duplicate)};}
        if(await store.get('gone-'+id,{type:'json'}))fail(409,'Story này đã được xoá.');
        checkQuota(index);index.items.push(item);index.uploads=index.uploads.filter(x=>now-x.at<DAY);index.uploads.push({authorKey,at:now});
        return {value:publicItem(item)};
      });
      published=(await read(store))?.data.items.some(x=>x.imageKey===item.imageKey)||false;
      return reply({item:result},201);
    }finally{
      // A lost index acknowledgement must never delete a successfully published
      // image. If index reads fail, leave bytes for delayed orphan collection.
      if(!published){let referenced;try{referenced=(await read(store))?.data.items.some(x=>x.imageKey===item.imageKey)||false;}catch{referenced=true;}
        if(!referenced)await Promise.allSettled([store.delete(item.imageKey),store.delete(item.thumbKey)]);
      }
    }
  }catch(error){return reply({error:error.status?error.message:'Chưa kết nối được Story. Vui lòng thử lại.'},error.status||503);}
};}
