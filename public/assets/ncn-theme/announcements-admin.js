import {ensureSession,onAuthChange} from '/assets/ncn-identity-client.js';
import {callAnnouncements} from './announcements.js?v=20261024-notice-1';

const $=id=>document.getElementById(id);
let version=null,busy=false;
function message(text,error=false){$('ncn-notice-status').textContent=text;$('ncn-notice-status').classList.toggle('ncn-notice-error',error);}
function lock(value){busy=value;$('ncn-notice-form').querySelectorAll('button,textarea').forEach(node=>node.disabled=value);$('ncn-notice-list').querySelectorAll('button').forEach(node=>node.disabled=value);$('ncn-notice-refresh').disabled=value;}
function render(saved){
  version=saved.version;
  const list=$('ncn-notice-list');list.replaceChildren();
  if(!saved.items.length){const empty=document.createElement('p');empty.textContent='Chưa có thông báo. Thanh thông báo đang ẩn trên toàn website.';list.append(empty);}
  for(const item of saved.items){
    const row=document.createElement('li'),text=document.createElement('p'),remove=document.createElement('button');
    text.textContent=item.text;remove.type='button';remove.className='ncn-notice-delete';remove.textContent='Xóa';remove.setAttribute('aria-label','Xóa thông báo: '+item.text);
    remove.addEventListener('click',async()=>{
      if(busy||!window.confirm('Xóa thông báo này khỏi toàn bộ website?\n\n'+item.text))return;
      await action(async()=>{render(await callAnnouncements('delete',{id:item.id,version}));message('Đã xóa thông báo.');});
    });row.append(text,remove);list.append(row);
  }
  window.dispatchEvent(new Event('ncn-announcements-changed'));
}
async function load(){await ensureSession();render(await callAnnouncements('manage'));}
async function action(work){
  lock(true);
  try{await work();}
  catch(error){message(error.message,true);if([401,403].includes(error.status)){$('ncn-notice-editor').hidden=true;$('ncn-notice-access').hidden=false;}}
  finally{lock(false);}
}
$('ncn-notice-form').addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;
  const text=$('ncn-notice-input').value.trim();if(!text)return;
  action(async()=>{render(await callAnnouncements('add',{text,version}));$('ncn-notice-input').value='';message('Đã thêm thông báo trên toàn website.');});
});
$('ncn-notice-refresh').addEventListener('click',()=>action(async()=>{await load();message('Đã tải danh sách mới nhất.');}));
async function boot(){
  try{await load();$('ncn-notice-access').hidden=true;$('ncn-notice-editor').hidden=false;message('Chỉ tài khoản Admin được thêm và xóa thông báo.');}
  catch(error){$('ncn-notice-editor').hidden=true;$('ncn-notice-access').hidden=false;message([401,403].includes(error.status)?'Đăng nhập bằng tài khoản Admin rồi quay lại trang này.':error.message,true);}
}
onAuthChange(()=>boot());boot();
