export function safeAvatar(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function avatarInitials(user){
 const words=String(user?.name||user?.email?.split('@')[0]||'NCN').trim().split(/\s+/).filter(Boolean);
 return (words.length>1?words[0][0]+words.at(-1)[0]:words[0]?.slice(0,2)||'NC').toLocaleUpperCase('vi-VN');
}
export function profileUpdate(name,avatar){
 const clean=String(name||'').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();
 if(!clean||Array.from(clean).length>100)throw new Error('Nhập tên hiển thị từ 1 đến 100 ký tự.');
 if(avatar!==undefined&&!safeAvatar(avatar))throw new Error('Ảnh đại diện chưa hợp lệ. Chọn lại ảnh nhé.');
 return {data:{full_name:clean,...(avatar!==undefined?{avatar_url:safeAvatar(avatar)}:{})}};
}
export function vipSummary(user,now=Date.now()){
 if(!user)return {state:'guest',title:'Chưa đăng nhập',plan:'Chưa có',expires:'—',remaining:'—',note:'Đăng nhập tài khoản NCN để xem thông tin VIP.'};
 if(user.admin)return {state:'active',title:'Tài khoản quản trị',plan:'Quyền quản trị NCN',expires:'Không giới hạn',remaining:'Toàn quyền',note:'Bạn có quyền sử dụng các công cụ VIP và quản trị website.'};
 if(user.vipSource==='manual')return {state:'active',title:'VIP đang hoạt động',plan:'VIP do Admin cấp',expires:'Không giới hạn',remaining:'Không giới hạn',note:'VIP của bạn được Admin cấp, không cần mua thêm gói.'};
 const expiry=Date.parse(user.vipExpiresAt||''),valid=Number.isFinite(expiry),date=valid?new Date(expiry).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có gói';
 if(user.paidVipBlocked)return {state:'blocked',title:'VIP đang tạm khóa',plan:'VIP trả phí',expires:date,remaining:'Tạm khóa',note:'Liên hệ Admin để được kiểm tra và hỗ trợ gói VIP.'};
 if(user.vip&&valid&&expiry>now)return {state:'active',title:'VIP đang hoạt động',plan:'VIP trả phí',expires:date,remaining:Math.max(1,Math.ceil((expiry-now)/86400000))+' ngày',note:'Dùng chung các công cụ Event và Giờ Vàng VIP trong thời hạn gói.'};
 if(user.vip&&!valid)return {state:'active',title:'VIP đang hoạt động',plan:'VIP NCN',expires:'Được cấp quyền',remaining:'Đang hoạt động',note:'Tài khoản của bạn có quyền sử dụng các công cụ VIP.'};
 return {state:valid?'expired':'member',title:valid?'Gói VIP đã hết hạn':'Thành viên NCN',plan:valid?'VIP trả phí':'Chưa đăng ký VIP',expires:date,remaining:valid?'0 ngày':'Chưa kích hoạt',note:valid?'Gia hạn VIP để tiếp tục sử dụng các công cụ dành cho thành viên VIP.':'Bạn có thể đăng ký VIP bằng chính tài khoản NCN này.'};
}
export function paintAvatar(target,user,{preview=''}={}){
 const doc=target.ownerDocument,url=preview||safeAvatar(user?.avatar);
 target.replaceChildren();
 if(url){const img=doc.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{target.textContent=avatarInitials(user);},{once:true});target.append(img);}
 else target.textContent=avatarInitials(user);
}
export async function avatarPreview(file,win=globalThis){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Chọn ảnh JPG, PNG hoặc WebP nhé.');
 if(file.size>12*1024*1024)throw new Error('Chọn ảnh dưới 12 MB nhé.');
 let source,objectURL;
 try{
  if(win.createImageBitmap)source=await win.createImageBitmap(file);
  else{source=new win.Image();objectURL=win.URL.createObjectURL(file);source.src=objectURL;await source.decode();}
  const side=Math.min(source.width,source.height);if(!side)throw Error('Empty image');
  const canvas=win.document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#dce9ee';ctx.fillRect(0,0,256,256);ctx.drawImage(source,(source.width-side)/2,(source.height-side)/2,side,side,0,0,256,256);return canvas.toDataURL('image/jpeg',.87);
 }catch(error){if(error.message==='Chọn ảnh dưới 12 MB nhé.')throw error;throw new Error('Ảnh chưa đọc được. Chọn ảnh khác nhé.');}
 finally{source?.close?.();if(objectURL)win.URL.revokeObjectURL(objectURL);}
}

export function mountMemberPanel({doc,dialog,getUser,onSave,onRefresh,onMode,onMessage,clock=Date.now}){
 const panel=doc.createElement('section');panel.className='ncn-member-panel';panel.hidden=true;
 panel.innerHTML='<div class="ncn-member-tabs" role="group" aria-label="Quản lý tài khoản"><button type="button" data-member-tab="profile" aria-pressed="true">Thông tin cá nhân</button><button type="button" data-member-tab="vip" aria-pressed="false">Thông tin VIP</button></div><div class="ncn-member-gate" hidden><p>Đăng nhập để quản lý tài khoản NCN của bạn.</p><button type="button" data-ncn-account-open="login">Đăng nhập NCN</button></div><div data-member-content><div class="ncn-member-hero"><span class="ncn-member-avatar" aria-label="Ảnh đại diện"></span><div><strong data-member-name></strong><span data-member-email></span><small>Một tài khoản dùng chung toàn website</small></div></div><form class="ncn-member-form" data-member-form><fieldset><label class="ncn-member-photo-label" for="ncn-member-photo"><span>Thay ảnh đại diện</span><strong>Chọn ảnh ↗</strong><input id="ncn-member-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Chọn ảnh đại diện"></label><small class="ncn-member-photo-note">Tên và ảnh được dùng trên website và bảng điểm công khai của 5 game.</small><div class="ncn-member-fields"><label>Tên hiển thị<input id="ncn-member-name" name="name" autocomplete="name" maxlength="100" required></label><label>Email tài khoản<input id="ncn-member-email" type="email" readonly autocomplete="email" aria-readonly="true"></label></div><div class="ncn-member-facts"><span>Ngày tham gia<strong id="ncn-member-since">—</strong></span><span>Tài khoản<strong>Email đã xác nhận</strong></span></div><button type="submit" class="ncn-account-primary">Lưu thay đổi</button></fieldset></form><section class="ncn-member-vip" data-member-vip hidden aria-labelledby="ncn-member-vip-title"><div class="ncn-member-vip-heading"><span aria-hidden="true">✦</span><div><small>THẺ THÀNH VIÊN NCN</small><h3 id="ncn-member-vip-title"></h3></div></div><p data-member-vip-note></p><dl class="ncn-member-vip-facts"><div><dt>Quyền sử dụng</dt><dd id="ncn-member-vip-plan"></dd></div><div><dt>Hạn VIP</dt><dd id="ncn-member-vip-expiry"></dd></div><div><dt>Thời gian còn lại</dt><dd id="ncn-member-vip-remaining"></dd></div></dl><div class="ncn-member-vip-actions"><a href="/premium/" class="ncn-member-vip-link">Đăng ký / gia hạn VIP ↗</a><button type="button" data-member-refresh>Làm mới thông tin</button></div><p class="ncn-member-vip-footnote">Trạng thái VIP được cập nhật từ tài khoản NCN và lịch sử thanh toán của bạn.</p></section></div>';
 dialog.insertBefore(panel,dialog.querySelector('footer'));
 const $=s=>panel.querySelector(s),name=$('#ncn-member-name'),file=$('#ncn-member-photo'),hero=$('.ncn-member-avatar');
 let owner=null,dirty=false,photo='',tab='profile',lastOptions={};
 function render(user,options=lastOptions){
  lastOptions=options;tab=options.tab||tab;panel.hidden=!['profile','vip'].includes(tab);if(panel.hidden)return;
  for(const b of panel.querySelectorAll('[data-member-tab]'))b.setAttribute('aria-pressed',String(b.dataset.memberTab===tab));
  $('[data-member-content]').hidden=!user;$('.ncn-member-gate').hidden=!!user;
  if(!user){reset();return;}
  if(owner!==user.id){owner=user.id;dirty=false;photo='';}
  if(!dirty)name.value=user.name||'';
  $('#ncn-member-email').value=user.email||'';$('[data-member-name]').textContent=user.name||'Thành viên NCN';$('[data-member-email]').textContent=user.email||'';paintAvatar(hero,user,{preview:photo});
  const joined=Date.parse(user.createdAt||'');$('#ncn-member-since').textContent=Number.isFinite(joined)?new Date(joined).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa cập nhật';
  $('[data-member-form]').hidden=tab!=='profile';$('[data-member-vip]').hidden=tab!=='vip';$('fieldset').disabled=!!options.busy;$('[data-member-refresh]').disabled=!!options.busy;
  const vip=vipSummary(user,clock()+Number(options.serverOffset||0));$('[data-member-vip]').dataset.state=vip.state;$('#ncn-member-vip-title').textContent=vip.title;$('[data-member-vip-note]').textContent=vip.note;$('#ncn-member-vip-plan').textContent=vip.plan;$('#ncn-member-vip-expiry').textContent=vip.expires;$('#ncn-member-vip-remaining').textContent=vip.remaining;
  const unlimited=user.admin||user.vipSource==='manual';$('.ncn-member-vip-link').textContent=unlimited?'Xem quyền lợi VIP ↗':user.vip?'Gia hạn VIP ↗':'Đăng ký VIP ↗';
 }
 name.addEventListener('input',()=>{dirty=true;});
 file.addEventListener('change',async()=>{const selected=file.files?.[0],id=owner;if(!selected)return;try{const next=await avatarPreview(selected,doc.defaultView);if(owner!==id||getUser()?.id!==id)return;photo=next;dirty=true;paintAvatar(hero,getUser(),{preview:photo});onMessage('Đã chọn ảnh. Bấm “Lưu thay đổi” để cập nhật.');}catch(error){onMessage(error.message,true);}finally{file.value='';}});
 $('[data-member-form]').addEventListener('submit',async event=>{event.preventDefault();const id=owner;const user=await onSave({owner:id,name:name.value,photo});if(user?.id===id&&getUser()?.id===id){dirty=false;photo='';render(user);onMessage('Đã cập nhật thông tin và ảnh đại diện của bạn.');}});
 for(const b of panel.querySelectorAll('[data-member-tab]'))b.addEventListener('click',()=>onMode(b.dataset.memberTab));
 $('[data-member-refresh]').addEventListener('click',onRefresh);
 function reset(){owner=null;dirty=false;photo='';file.value='';name.value='';$('#ncn-member-email').value='';hero.replaceChildren();for(const el of panel.querySelectorAll('[data-member-name],[data-member-email],[data-member-vip-note],#ncn-member-since,.ncn-member-vip-facts dd,#ncn-member-vip-title'))el.textContent='';}
 return {render,focus(){(tab==='profile'?name:$('[data-member-refresh]')).focus({preventScroll:true});},reset};
}
