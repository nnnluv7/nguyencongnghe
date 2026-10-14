// All access decisions use a fresh, authenticated Identity /user response.
import { randomUUID } from 'node:crypto';

const headers = {'Cache-Control':'private, no-store, max-age=0','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
function cookie(req){
  const entries=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('nf_jwt='));
  if(entries.length!==1)return null;
  try {const token=decodeURIComponent(entries[0].slice(7));return token.length<16384&&/^[A-Za-z0-9_.-]+$/.test(token)?token:null;}catch{return null;}
}
export async function verifyIdentity(req,config,fetcher=fetch){
  const token=cookie(req);if(!token)return null;
  if(!config?.url)fail(503,'Chưa bật Netlify Identity. ADMIN cần bật Identity trong Netlify.');
  let res;
  try{res=await fetcher(config.url.replace(/\/$/,'')+'/user',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});}catch{fail(503,'Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.');}
  if(res.status===401||res.status===403)return null;
  if(!res.ok)fail(503,'Dịch vụ đăng nhập chưa sẵn sàng.');
  const raw=await res.json();
  if(!raw?.id||!raw?.email||!raw.confirmed_at)return null;
  if(raw.banned_until&&new Date(raw.banned_until)>new Date())return null;
  // user_metadata and any role sent by the browser are deliberately ignored.
  const roles=Array.isArray(raw.app_metadata?.roles)?raw.app_metadata.roles:[];
  return {id:String(raw.id),email:String(raw.email),name:String(raw.user_metadata?.full_name||raw.email),admin:roles.includes('admin'),vip:roles.includes('vip')};
}
async function body(req){
  if(Number(req.headers.get('content-length')||0)>3_000_000)fail(413,'Bảng giá quá lớn. Chia nhỏ chương trình.');
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))fail(415,'Dữ liệu cần có định dạng JSON.');
  const text=await req.text();if(Buffer.byteLength(text)>3_000_000)fail(413,'Dữ liệu quá lớn.');
  try{return JSON.parse(text);}catch{fail(400,'Dữ liệu không hợp lệ.');}
}
function id(value){if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,50}$/.test(value))fail(400,'Mã chương trình chỉ gồm chữ, số, dấu - hoặc _.');return value;}
function validatedProducts(items){
  if(!Array.isArray(items)||!items.length||items.length>10000)fail(400,'Bảng giá cần từ 1 đến 10.000 sản phẩm.');
  const seen=new Set();
  return items.map(p=>{
    if(!p||typeof p.code!=='string'||!p.code.trim()||p.code.length>60||typeof p.name!=='string'||!p.name.trim()||p.name.length>300||!Number.isFinite(p.originalPrice)||!Number.isFinite(p.eventPrice)||p.eventPrice<=0||p.originalPrice<p.eventPrice||p.originalPrice>1e12)fail(400,'Có mã, tên hoặc giá sản phẩm không hợp lệ.');
    const code=p.code.trim();if(seen.has(code))fail(400,'Bảng giá bị trùng mã '+code+'.');seen.add(code);
    return {code,name:p.name.trim(),originalPrice:p.originalPrice,eventPrice:p.eventPrice};
  });
}
export function createHandler(deps){return async function(req){
  try{
    if(!deps.production())fail(503,'Chức năng VIP chỉ hoạt động ở bản web chính thức.');
    const method=req.method,route=new URL(req.url).searchParams.get('route')||'me';
    if(!['GET','POST'].includes(method))fail(405,'Phương thức không hỗ trợ.');
    if(method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)fail(403,'Yêu cầu phải gửi từ chính trang web.');
    const user=await deps.verify(req);
    if(route==='me'&&method==='GET')return reply({user,allowed:!!(user&&(user.admin||user.vip))});
    if(!user)fail(401,'Đăng nhập tài khoản VIP để sử dụng.');
    if(!user.admin&&!user.vip)fail(403,'Tài khoản đang chờ ADMIN duyệt và cấp VIP.');
    const store=deps.store();
    if(route==='app'&&method==='GET')return reply({html:await deps.asset(user.admin?'admin.html':'vip.html'),user});
    if(route==='asset'&&method==='GET'){
      const name=new URL(req.url).searchParams.get('name');
      const names={core:['core.cjs','text/javascript'],ui:['ui.js','text/javascript'],bridge:['bridge.user.js','text/javascript']};
      if(!names[name])fail(404,'Không tìm thấy tài nguyên.');
      if(name==='bridge'&&!user.admin)fail(403,'Chỉ ADMIN được lấy kết nối cập nhật giá.');
      const [file,type]=names[name];return new Response(await deps.asset(file),{headers:{...headers,'Content-Type':type+'; charset=utf-8'}});
    }
    if(route==='catalogues'&&method==='GET'){
      const listing=await store.list({prefix:'campaign-'}),entries=await Promise.all(listing.blobs.map(async b=>store.get(b.key,{type:'json'})));
      return reply({catalogues:entries.filter(Boolean).map(p=>({id:p.id,name:p.name,updatedAt:p.updatedAt,count:p.items.length,version:p.version}))});
    }
    if(route==='catalogue'&&method==='GET'){
      const key=id(new URL(req.url).searchParams.get('id')),saved=await store.get('campaign-'+key,{type:'json'});
      if(!saved)fail(404,'ADMIN chưa lưu bảng giá cho chương trình này.');return reply(saved);
    }
    if(route==='publish'&&method==='POST'){
      if(!user.admin)fail(403,'Chỉ ADMIN được cập nhật bảng giá.');
      const d=await body(req),key='campaign-'+id(d.id),name=typeof d.name==='string'?d.name.trim():'';
      if(!name||name.length>200)fail(400,'Nhập tên chương trình, tối đa 200 ký tự.');
      const products=validatedProducts(d.items),old=await store.getWithMetadata(key,{type:'json'});
      if(old&&d.version!==old.data.version)fail(409,'Bảng giá đã được cập nhật. Tải bảng giá đã lưu trước khi ghi đè.');
      if(!old&&(await store.list({prefix:'campaign-'})).blobs.length>=20)fail(400,'Đã có 20 chương trình. Cập nhật một mã chương trình hiện có.');
      const saved={id:d.id,name,updatedAt:new Date().toISOString(),version:randomUUID(),items:products};
      const result=await store.setJSON(key,saved,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
      if(!result.modified)fail(409,'Có cập nhật khác vừa được lưu. Tải lại bảng giá rồi thử lại.');
      return reply({id:saved.id,name:saved.name,version:saved.version,updatedAt:saved.updatedAt,count:products.length});
    }
    if(route==='print'&&method==='POST'){
      const d=await body(req),settings=d.settings||{};
      if(!Array.isArray(d.items)||!d.items.length||d.items.length>10000)fail(400,'Danh sách in không hợp lệ.');
      let catalogue=null;
      if(settings.catalogueId)catalogue=await store.get('campaign-'+id(settings.catalogueId),{type:'json'});
      if(!user.admin&&!catalogue)fail(400,'Chọn bảng giá ADMIN đã lưu trước khi in.');
      const index=new Map((catalogue?.items||[]).map(p=>[p.code,p]));
      const items=d.items.map(p=>{
        if(!p||typeof p.code!=='string'||!Number.isInteger(p.qty)||p.qty<1)fail(400,'Mã hoặc số lượng in không hợp lệ.');
        // VIP prices always come from the server catalogue, including reopened history.
        const source=user.admin?p:index.get(p.code);if(!source)fail(400,'Mã '+p.code+' chưa có trong bảng giá đang chọn.');
        return {...source,qty:p.qty};
      });
      if(items.reduce((sum,p)=>sum+p.qty,0)>1500)fail(400,'Một lần tạo tối đa 1.500 nhãn. Chia danh sách hoặc giới hạn số lượng mỗi mã.');
      let printed;try{printed=deps.print(items,settings);}catch(e){fail(400,e.message);}
      if(Buffer.byteLength(printed.html)>5_000_000)fail(400,'Bản in quá lớn. Chia thành nhiều lần in nhỏ hơn.');
      return reply(printed);
    }
    fail(404,'Không tìm thấy chức năng.');
  }catch(e){return reply({error:e.status?e.message:'Chưa thực hiện được thao tác. Tải lại trang hoặc kiểm tra Functions trong Netlify.'},e.status||503);}
};}
