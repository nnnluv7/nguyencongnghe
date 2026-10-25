import {randomUUID} from 'node:crypto';
import {safeURL,slugify} from '../../public/assets/ncn-library/content.js';

const KEY='index',MAX_CUSTOM=200;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function libraryError(status,message){throw Object.assign(new Error(message),{status});}
export const emptyLibrary=()=>({items:[]});
export async function readLibrary(store){
  const saved=await store.getWithMetadata(KEY,{type:'json'});
  if(saved&&(!Array.isArray(saved.data?.items)||saved.data.items.length>500))libraryError(503,'Danh sách Thư viện chưa sẵn sàng.');
  return saved;
}
export function mergedLibrary(seed,index){
  const changes=new Map((index?.items||[]).map(item=>[item.id,item]));
  const rows=seed.map(item=>({...item,status:'published',mode:'original',version:null,...changes.get(item.id)}));
  const known=new Set(seed.map(item=>item.id));
  return [...rows,...(index?.items||[]).filter(item=>!known.has(item.id))];
}
export function publicCatalog(seed,index){
  return mergedLibrary(seed,index).filter(item=>item.status==='published').map(item=>({
    title:item.title,link:item.href,thumbnail:item.image?{src:item.image,type:'image'}:null,labels:item.labels,
    datetime:item.datetime,summary:item.summary,isPage:!!item.isPage,isArticle:item.kind!=='legacy'||!!item.managedPage&&!item.isPage,author:'NCN',date:''
  }));
}
function summary(item){
  const {bodyKey,sourcePath,createdBy,...result}=item;return result;
}
function text(value,max,label,required=false){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))libraryError(400,label+' không hợp lệ.');
  const result=value.trim();if(required&&!result)libraryError(400,'Nhập '+label.toLowerCase()+'.');return result;
}
function url(value,label,required=false){const result=text(value??'',2048,label,required);if(result&&!safeURL(result))libraryError(400,label+' cần là liên kết HTTPS hoặc đường dẫn trong website.');return result?safeURL(result):'';}
function key(value){if(typeof value!=='string'||!(/^(?:legacy-[a-f0-9]{16}|post-[a-f0-9-]{36})$/).test(value))libraryError(400,'Mã bài viết không hợp lệ.');return value;}
async function body(req){
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))libraryError(415,'Dữ liệu cần có định dạng JSON.');
  if(Number(req.headers.get('content-length')||0)>180000)libraryError(413,'Bài viết quá dài.');
  const raw=await req.text();if(Buffer.byteLength(raw)>180000)libraryError(413,'Bài viết quá dài.');
  let value;try{value=JSON.parse(raw);}catch{libraryError(400,'Dữ liệu không hợp lệ.');}
  if(!value||typeof value!=='object'||Array.isArray(value))libraryError(400,'Dữ liệu không hợp lệ.');return value;
}
function destination(href){try{const u=new URL(href,'https://nguyencongnghe.com');return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}}
function assertVersion(current,version){if((current?.version??null)!==(version??null))libraryError(409,'Bài viết vừa thay đổi. Mở lại bài để kiểm tra trước khi lưu.');}
async function purgeArticle(store,old,index,current,seedItem,data,now){
  if(!['trash','purging'].includes(current.status))libraryError(409,'Đưa bài vào Thùng rác trước khi xoá vĩnh viễn.');
  if(data.confirmTitle!==current.title)libraryError(400,'Xác nhận đúng bài viết trước khi xoá vĩnh viễn.');
  let pending=current;
  if(current.status==='trash'){
    pending={...current,status:'purging',pageRemoved:current.kind==='article'||!!seedItem?.managedPage,updatedAt:now,version:randomUUID()};
    const written=await store.setJSON(KEY,{items:[...index.items.filter(x=>x.id!==current.id),pending]},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(!written.modified)libraryError(409,'Bài vừa thay đổi. Tải lại danh sách trước khi xoá.');
  }
  // The irreversible state is committed before deleting any body. Restore/save
  // cannot race a partial cleanup and publish a pointer to a deleted body.
  try{
    await store.setJSON('gone-'+current.id,{deleted:true},{onlyIfNew:true});
    const prefix='body-'+current.id+'-',keys=[];
    for await(const page of store.list({prefix,paginate:true})){
      for(const blob of page.blobs){if(typeof blob.key!=='string'||!blob.key.startsWith(prefix))throw Error('Invalid body key');keys.push(blob.key);}
    }
    for(let offset=0;offset<keys.length;offset+=10)await Promise.all(keys.slice(offset,offset+10).map(k=>store.delete(k)));
  }catch{libraryError(503,'Bài đã được gỡ nhưng việc xoá dữ liệu chưa hoàn tất. Bấm Xoá vĩnh viễn lần nữa để tiếp tục.');}
  for(let attempt=0;attempt<4;attempt++){
    const latest=await readLibrary(store),record=latest?.data.items.find(x=>x.id===current.id);
    if(!record||record.status==='purged')return {deleted:true,id:current.id};
    if(record.status!=='purging'||record.version!==pending.version)libraryError(409,'Trạng thái bài vừa thay đổi. Tải lại danh sách để kiểm tra.');
    // Legacy IDs need a minimal tombstone or the original seed would reappear.
    // No title, content, author, body pointer or restore information is retained.
    const tombstone=seedItem?{id:current.id,kind:'legacy',status:'purged',pageRemoved:!!seedItem.managedPage,updatedAt:now,version:randomUUID()}:null;
    const items=latest.data.items.filter(x=>x.id!==current.id);if(tombstone)items.push(tombstone);
    const result=await store.setJSON(KEY,{items},{onlyIfMatch:latest.etag});
    if(result.modified)return {deleted:true,id:current.id};
  }
  libraryError(409,'Danh sách đang được cập nhật. Bấm Xoá vĩnh viễn lần nữa để hoàn tất.');
}
function validate(input,current,seedItem,now){
  const kind=current?.kind||input.kind;if(!['legacy','article','link'].includes(kind)||(!seedItem&&kind==='legacy'))libraryError(400,'Chọn loại bài viết hợp lệ.');
  if(current&&input.kind!==current.kind)libraryError(400,'Loại bài đã tạo không thể thay đổi.');
  if(!['published','hidden','draft'].includes(input.status)||kind==='legacy'&&input.status==='draft')libraryError(400,'Trạng thái bài viết không hợp lệ.');
  const title=text(input.title,200,'Tiêu đề',true),excerpt=text(input.summary??'',500,'Mô tả'),image=url(input.image,'Ảnh đại diện');
  if(!Array.isArray(input.labels)||input.labels.length>5)libraryError(400,'Chọn tối đa 5 chuyên mục.');
  const labels=[...new Set(input.labels.map(v=>text(v,60,'Chuyên mục',true)))];
  let mode=kind==='legacy'?'original':kind==='article'?'markdown':'link';
  if(kind==='legacy'&&input.mode==='markdown'){
    if(!seedItem?.managedPage)libraryError(400,'Trang công cụ chỉ quản lý lối tắt trong Thư viện.');mode='markdown';
  }
  const content=mode==='markdown'?text(input.body??'',50000,'Nội dung',input.status!=='draft'):'';
  const slug=current?.slug||(kind==='article'?slugify(title)+'-'+input.id.slice(5,13):null);
  const href=kind==='legacy'?seedItem.href:kind==='article'?'/bai-viet/'+slug+'/':url(input.href,'Đường dẫn bài viết',true);
  const firstPublishedAt=current?.firstPublishedAt||(current&&current.status!=='draft'?current.datetime:null)||(input.status==='published'?now:null);
  return {id:input.id,kind,title,summary:excerpt,image,labels,status:input.status,mode,href,slug,
    managedPage:kind==='article'||!!seedItem?.managedPage,isPage:current?.isPage??false,
    datetime:firstPublishedAt||current?.datetime||now,firstPublishedAt,updatedAt:now,version:randomUUID(),pageRemoved:false,content};
}
export function createLibraryHandler(deps){return async req=>{
  try{
    const route=new URL(req.url).searchParams.get('route')||'list',method=req.method;
    if(!['GET','POST'].includes(method))libraryError(405,'Phương thức không hỗ trợ.');
    if(method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)libraryError(403,'Yêu cầu phải gửi từ chính website.');
    if(route==='list'&&method==='GET'){
      const old=deps.production()?await readLibrary(deps.store()):null;
      return reply({items:publicCatalog(deps.seed,old?.data)});
    }
    if(!deps.production())libraryError(503,'Quản trị chỉ hoạt động trên website chính thức.');
    const user=await deps.verify(req);
    if(!user)libraryError(401,'Đăng nhập tài khoản ADMIN để tiếp tục.');
    if(!user.admin)libraryError(403,'Chỉ ADMIN được sử dụng khu vực quản trị.');
    if(route==='app'&&method==='GET'){
      const view=new URL(req.url).searchParams.get('view')==='library'?'library':'hub';
      return reply({html:await deps.app(view)});
    }
    const store=deps.store(),old=await readLibrary(store),index=old?.data||emptyLibrary(),items=mergedLibrary(deps.seed,index);
    if(route==='manage'&&method==='GET')return reply({items:items.filter(x=>x.status!=='purged').map(summary)});
    if(route==='detail'&&method==='GET'){
      const id=key(new URL(req.url).searchParams.get('id')),item=items.find(x=>x.id===id);if(!item||item.status==='purged')libraryError(404,'Không tìm thấy bài viết.');
      const deleting=item.status==='purging',markdown=!deleting&&item.bodyKey?await store.get(item.bodyKey,{type:'json'}):null;
      return reply({item:summary(item),body:markdown?.body||'',originalBody:deleting?'':deps.originalBodies?.[id]||''});
    }
    if(method!=='POST'||!['save','visibility','trash','restore','purge'].includes(route))libraryError(404,'Không tìm thấy chức năng.');
    const data=await body(req),id=key(data.id),current=items.find(x=>x.id===id),seedItem=deps.seed.find(x=>x.id===id);
    if(route==='purge'&&(current?.status==='purged'||!current&&await store.get('gone-'+id,{type:'json'})))return reply({deleted:true,id});
    assertVersion(current,data.version);
    if(route!=='save'&&!current)libraryError(404,'Không tìm thấy bài viết.');
    const now=(deps.now?.()||new Date()).toISOString();let next;
    if(route==='purge')return reply(await purgeArticle(store,old,index,current,seedItem,data,now));
    if(route==='save'){
      if(['purging','purged'].includes(current?.status)||!current&&await store.get('gone-'+id,{type:'json'}))libraryError(409,'Bài đã xoá vĩnh viễn. Tạo bài mới nếu cần.');
      if(current?.status==='trash')libraryError(409,'Khôi phục bài khỏi Thùng rác trước khi sửa.');
      if(!current&&(!id.startsWith('post-')||index.items.filter(x=>x.kind!=='legacy').length>=MAX_CUSTOM))libraryError(400,'Không thể thêm bài. Kiểm tra mã bài hoặc giới hạn 200 bài mới.');
      next=validate(data,current,seedItem,now);
      if(items.some(x=>x.id!==id&&destination(x.href)===destination(next.href)))libraryError(409,'Đường dẫn này đã có trong Thư viện. Tìm và sửa bài hiện có hoặc khôi phục từ Thùng rác.');
      const content=next.content;delete next.content;
      if(next.mode==='markdown'){
        next.bodyKey='body-'+id+'-'+next.version;
        // Immutable content is written first. The conditional index write is
        // the only publish point; a conflict can never replace a newer body.
        const contentWrite=await store.setJSON(next.bodyKey,{body:content},{onlyIfNew:true});
        if(!contentWrite.modified)libraryError(409,'Nội dung vừa thay đổi. Anh thử lưu lại nhé.');
      }
      next.createdBy=current?.createdBy||user.id;
    }else if(route==='visibility'){
      if(!['published','hidden'].includes(current.status))libraryError(409,'Khôi phục hoặc mở bản nháp để đăng bài trước.');
      next={...current,status:current.status==='published'?'hidden':'published',updatedAt:now,version:randomUUID()};
    }else if(route==='trash'){
      if(['purging','purged'].includes(current.status))libraryError(409,'Bài đang hoặc đã được xoá vĩnh viễn.');
      if(current.status==='trash')libraryError(409,'Bài đã ở trong Thùng rác.');
      if(data.removePage!==undefined&&typeof data.removePage!=='boolean')libraryError(400,'Chọn thao tác gỡ trang hợp lệ.');
      if(data.removePage&&!(current.kind==='article'||seedItem?.managedPage))libraryError(400,'Chỉ có thể gỡ lối tắt của trang công cụ hoặc bài ở website khác.');
      next={...current,status:'trash',previousStatus:current.status,pageRemoved:current.kind==='article'||!!data.removePage,updatedAt:now,version:randomUUID()};
    }else{
      if(current.status!=='trash')libraryError(409,'Bài không nằm trong Thùng rác.');
      next={...current,status:current.previousStatus||'published',pageRemoved:false,updatedAt:now,version:randomUUID()};delete next.previousStatus;
    }
    // The original HTML and original article body always remain recoverable.
    const saved={items:[...index.items.filter(x=>x.id!==id),next]};
    const written=await store.setJSON(KEY,saved,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(!written.modified)libraryError(409,'Có cập nhật khác vừa được lưu. Tải lại danh sách rồi thử lại.');
    return reply({item:summary(next)});
  }catch(error){return reply({error:error.status?error.message:'Chưa thực hiện được. Vui lòng thử lại.'},error.status||503);}
};}
