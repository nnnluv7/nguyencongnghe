import {randomUUID} from 'node:crypto';

const KEY='announcements';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function fail(status,message){throw Object.assign(new Error(message),{status});}
async function readBody(request){
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu cần có định dạng JSON.');
  if(Number(request.headers.get('content-length'))>8000)fail(413,'Nội dung quá dài.');
  const text=await request.text();if(Buffer.byteLength(text)>8000)fail(413,'Nội dung quá dài.');
  let data;try{data=JSON.parse(text);}catch{fail(400,'Dữ liệu không hợp lệ.');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dữ liệu không hợp lệ.');
  return data;
}
export function createAnnouncementsHandler(deps){return async request=>{
  try{
    if(!deps.production())fail(503,'Thông báo chỉ được quản lý trên website chính thức.');
    const route=new URL(request.url).searchParams.get('route')||'list';
    if(!['GET','POST'].includes(request.method))fail(405,'Phương thức không hỗ trợ.');
    if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)fail(403,'Yêu cầu phải gửi từ chính website.');
    if(route==='list'&&request.method==='GET'){
      const saved=await deps.store().get(KEY,{type:'json'});
      return reply({items:(saved?.items||[]).map(({id,text})=>({id,text}))});
    }
    const user=await deps.verify(request);
    if(route==='me'&&request.method==='GET')return reply({admin:!!user?.admin});
    if(!user)fail(401,'Đăng nhập tài khoản Admin để quản lý thông báo.');
    if(!user.admin)fail(403,'Chỉ Admin được thêm và xóa thông báo.');
    const store=deps.store();
    if(route==='manage'&&request.method==='GET'){
      const saved=await store.get(KEY,{type:'json'});
      return reply({items:saved?.items||[],version:saved?.version||null});
    }
    if(!['add','delete'].includes(route)||request.method!=='POST')fail(404,'Không tìm thấy chức năng.');
    const data=await readBody(request),old=await store.getWithMetadata(KEY,{type:'json'});
    if(data.version!==(old?.data?.version||null))fail(409,'Thông báo vừa thay đổi. Tải lại danh sách rồi thử lại.');
    let items=old?.data?.items||[];
    if(route==='add'){
      const text=typeof data.text==='string'?data.text.replace(/\s+/gu,' ').trim():'';
      if(!text||text.length>500||/[\u0000-\u001f\u007f]/u.test(text))fail(400,'Nhập thông báo từ 1 đến 500 ký tự.');
      if(items.length>=10)fail(400,'Tối đa 10 thông báo. Xóa thông báo cũ trước khi thêm.');
      items=[...items,{id:randomUUID(),text,createdAt:new Date().toISOString()}];
    }else{
      if(typeof data.id!=='string'||!items.some(item=>item.id===data.id))fail(404,'Thông báo đã được xóa hoặc không tồn tại.');
      items=items.filter(item=>item.id!==data.id);
    }
    const saved={version:randomUUID(),items};
    const result=await store.setJSON(KEY,saved,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(!result.modified)fail(409,'Có cập nhật khác vừa được lưu. Tải lại danh sách rồi thử lại.');
    return reply(saved);
  }catch(error){return reply({error:error.status?error.message:'Chưa tải được thông báo. Vui lòng thử lại.'},error.status||503);}
};}
