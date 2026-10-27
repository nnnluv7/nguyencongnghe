import {createHash} from 'node:crypto';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function createProfileHandler(deps){return async req=>{
 try{
  const url=new URL(req.url),route=url.searchParams.get('route')||'upload';
  if(!deps.production())fail(503,'Ảnh tài khoản chỉ được cập nhật trên website chính thức.');
  if(route==='avatar'&&req.method==='GET'){
   const id=url.searchParams.get('id');if(!/^[a-f0-9]{64}$/.test(id||''))fail(404,'Không tìm thấy ảnh đại diện.');const bytes=await deps.store().get('avatar/'+id,{type:'arrayBuffer'});if(!bytes)fail(404,'Không tìm thấy ảnh đại diện.');
   return new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
  }
  if(route!=='upload')fail(404,'Không tìm thấy chức năng.');if(req.method!=='POST')fail(405,'Phương thức không hỗ trợ.');
  if(req.headers.get('origin')!==url.origin)fail(403,'Yêu cầu phải gửi từ chính website.');
  const user=await deps.verify(req);if(!user)fail(401,'Đăng nhập tài khoản NCN đã xác nhận email để thêm ảnh đại diện.');
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu cần ở dạng JSON.');
  if(Number(req.headers.get('content-length')||0)>1200000)fail(413,'Ảnh quá lớn. Chọn ảnh khác nhé.');const raw=await req.text();if(Buffer.byteLength(raw)>1200000)fail(413,'Ảnh quá lớn. Chọn ảnh khác nhé.');
  let data;try{data=JSON.parse(raw);}catch{fail(400,'Dữ liệu không hợp lệ.');}
  const match=typeof data?.image==='string'&&data.image.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)fail(400,'Chọn ảnh JPG, PNG hoặc WebP.');
  let bytes;try{bytes=await deps.photo(Buffer.from(match[1],'base64'));}catch{fail(400,'Ảnh chưa đọc được. Chọn ảnh khác nhé.');}
  const id=createHash('sha256').update(bytes).digest('hex');await deps.store().set('avatar/'+id,bytes,{onlyIfNew:true});
  return reply({avatar:new URL('/.netlify/functions/ncn-profile?route=avatar&id='+id,url.origin).href});
 }catch(error){return reply({error:error.status?error.message:'Chưa tải được ảnh đại diện. Vui lòng thử lại.'},error.status||503);}
};}
