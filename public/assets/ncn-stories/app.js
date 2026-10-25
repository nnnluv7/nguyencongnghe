const API='/.netlify/functions/ncn-stories';
const validID=/^story-[a-f0-9]{40}$/;
const imageURL=(id,thumb=false)=>API+'?route=image&id='+encodeURIComponent(id)+(thumb?'&size=thumb':'');
const stamp=value=>new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));
const authorKey=async id=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ncn-story-author:'+id)))].map(x=>x.toString(16).padStart(2,'0')).join('');

async function resizedImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024)throw Error('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 10 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('Ảnh quá lớn. Chọn ảnh nhỏ hơn 40 megapixel.');
    const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='#f5f7fb';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
    if(!blob||blob.size>2*1024*1024)throw Error('Ảnh sau tối ưu vẫn quá lớn. Chọn một ảnh nhỏ hơn.');
    return blob;
  }finally{URL.revokeObjectURL(url);}
}
const base64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Không đọc được ảnh.'));reader.readAsDataURL(blob);});

export function mountStories({host,doc=document,win=window,fetcher=fetch}){
  if(host.dataset.mounted)return {destroy(){}};host.dataset.mounted='true';
  const $=selector=>host.querySelector(selector),listeners=[];
  const listen=(el,type,fn)=>{el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));};
  const node=(tag,text,cls)=>{const el=doc.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
  let items=[],user=null,mine='',busy=false,disposed=false,epoch=0,selected=null,blob=null,previewURL='',requestId='',returnFocus=null,photoEpoch=0,expiryTimer=null,serverOffset=0;
  const status=(text,error=false)=>{if(disposed)return;const el=$('[data-story-status]');el.textContent=text;el.classList.toggle('ncn-story-error',error);};
  const dialog=node('dialog',null,'ncn-story-dialog ncn-ui');dialog.id='ncn-story-compose';dialog.setAttribute('aria-labelledby','ncn-story-compose-title');
  dialog.innerHTML=`<header><div><small>GÓC THÀNH VIÊN NCN</small><h2 id="ncn-story-compose-title">Chia sẻ một khoảnh khắc</h2></div><button type="button" data-close aria-label="Đóng đăng Story">×</button></header><p>Ảnh và tên hiển thị của bạn sẽ công khai trên Thư viện. Story tự xoá sau 24 giờ; bạn hoặc Admin có thể xoá sớm hơn.</p><form><label class="ncn-story-file">Chọn ảnh<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPEG, PNG hoặc WebP · tối đa 10 MB · 5 ảnh / 24 giờ</small></label><img class="ncn-story-preview" alt="Ảnh sắp đăng" hidden><label>Chú thích <span>(không bắt buộc)</span><input name="caption" maxlength="180" placeholder="Kể một chút về bức ảnh…" autocomplete="off"></label><p data-message role="status" aria-live="polite"></p><div class="ncn-story-dialog-actions"><button type="button" data-close>Để sau</button><button type="submit" class="ncn-story-primary" disabled>Đăng Story</button></div></form>`;
  const viewer=node('dialog',null,'ncn-story-dialog ncn-story-viewer ncn-ui');viewer.id='ncn-story-viewer';viewer.setAttribute('aria-label','Xem Story');
  viewer.innerHTML=`<header><div><strong data-author></strong><time data-time></time></div><button type="button" data-close aria-label="Đóng Story">×</button></header><div class="ncn-story-frame"><img alt=""><button type="button" data-step="-1" aria-label="Story trước">‹</button><button type="button" data-step="1" aria-label="Story tiếp theo">›</button></div><p data-caption></p><div class="ncn-story-viewer-footer"><span data-position></span><button type="button" data-delete hidden>Xoá Story</button></div><p data-message role="status" aria-live="polite"></p><div class="ncn-story-confirm" hidden><p>Xoá vĩnh viễn ảnh này khỏi Story?</p><div class="ncn-story-dialog-actions"><button type="button" data-keep>Giữ lại</button><button type="button" data-confirm-delete class="ncn-story-danger">Xoá ảnh</button></div></div>`;
  doc.body.append(dialog,viewer);
  const form=dialog.querySelector('form'),photo=form.elements.photo,caption=form.elements.caption,submit=form.querySelector('[type=submit]');
  const message=(el,text,error=false)=>{const target=el.querySelector('[data-message]');target.textContent=text;target.classList.toggle('ncn-story-error',error);};
  function controls(){
    $('[data-story-add]').disabled=!win.NCNAccount?.state.ready;
    form.querySelectorAll('input,button').forEach(el=>el.disabled=busy);submit.disabled=busy||!blob||!user;
    viewer.querySelectorAll('button').forEach(el=>el.disabled=busy);
    const current=items.find(x=>x.id===selected);viewer.querySelector('[data-delete]').hidden=!current||!(user?.admin||current.authorKey===mine);
  }
  function clearPhoto(preserveInput=false){photoEpoch++;blob=null;if(!preserveInput)photo.value='';photo.required=true;if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';const img=dialog.querySelector('img');img.removeAttribute('src');img.hidden=true;}
  async function api(route,data){
    const response=await fetcher(API+'?route='+route,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(data?45000:12000)});
    let result;try{result=await response.json();}catch{throw Error('Chưa kết nối được Story. Vui lòng thử lại.');}
    if(!response.ok)throw Object.assign(Error(result.error||'Chưa thực hiện được. Vui lòng thử lại.'),{status:response.status});return result;
  }
  function render(){
    const now=Date.now()+serverOffset;items=items.filter(x=>Date.parse(x.expiresAt)>now);win.clearTimeout(expiryTimer);
    if(viewer.open&&!items.some(x=>x.id===selected)){viewer.close();status('Story đã hết hạn sau 24 giờ.');}
    if(items.length)expiryTimer=win.setTimeout(()=>{if(!disposed)render();},Math.max(50,Math.min(...items.map(x=>Date.parse(x.expiresAt)))-now+50));
    const container=$('[data-story-items]');container.replaceChildren();
    for(const item of items){
      const button=node('button',null,'ncn-story-tile');button.type='button';button.dataset.storyId=item.id;button.setAttribute('aria-label','Xem Story của '+item.name+(item.caption?': '+item.caption:''));
      const img=node('img');img.src=imageURL(item.id,true);img.alt='';img.loading='lazy';img.width=140;img.height=196;
      const copy=node('span',null,'ncn-story-tile-copy'),avatar=node('span',String(item.name||'N').trim().slice(0,1).toUpperCase(),'ncn-story-avatar');
      copy.append(avatar,node('strong',item.name),node('small',item.caption||stamp(item.createdAt)));button.append(img,copy);container.append(button);
    }
    if(!items.length){const empty=node('div',null,'ncn-story-empty');empty.append(node('span','Bắt đầu câu chuyện đầu tiên','ncn-story-empty-title'),node('p','Đăng nhập và chia sẻ bức ảnh của bạn tại đây.'));container.append(empty);}
    status(items.length?items.length+' khoảnh khắc từ cộng đồng':'Ảnh của thành viên sẽ xuất hiện tại đây.');controls();
    $('[data-story-scroll="-1"]').disabled=!items.length;$('[data-story-scroll="1"]').disabled=!items.length;
  }
  async function refresh(){
    try{const result=await api('list');if(disposed)return;if(Number.isFinite(Date.parse(result.serverNow)))serverOffset=Date.parse(result.serverNow)-Date.now();items=(Array.isArray(result.items)?result.items:[]).filter(x=>validID.test(x.id)&&x.name&&Number.isFinite(Date.parse(x.createdAt))&&Number.isFinite(Date.parse(x.expiresAt)));render();}
    catch(error){status(error.message,true);}
  }
  function showStory(id){
    const index=items.findIndex(x=>x.id===id);if(index<0)return;
    selected=id;const item=items[index];viewer.querySelector('[data-author]').textContent=item.name;
    const time=viewer.querySelector('time');time.textContent=stamp(item.createdAt);time.dateTime=item.createdAt;
    const img=viewer.querySelector('img');img.src=imageURL(id);img.alt=item.caption||'Ảnh của '+item.name;
    viewer.querySelector('[data-caption]').textContent=item.caption;viewer.querySelector('[data-position]').textContent=(index+1)+' / '+items.length;
    viewer.querySelector('[data-step="-1"]').hidden=index===0;viewer.querySelector('[data-step="1"]').hidden=index===items.length-1;
    viewer.querySelector('.ncn-story-confirm').hidden=true;message(viewer,'');controls();
    if(!viewer.open){returnFocus=doc.activeElement;viewer.showModal();viewer.querySelector('[data-close]').focus({preventScroll:true});}
  }
  function step(amount){const index=items.findIndex(x=>x.id===selected);if(!busy&&items[index+amount])showStory(items[index+amount].id);}
  async function authChanged(){
    const generation=++epoch,next=win.NCNAccount?.state.user||null,changed=user?.id!==next?.id;user=next;mine='';
    if(changed){dialog.close();viewer.close();clearPhoto();caption.value='';}
    if(user)try{const key=await authorKey(user.id);if(generation===epoch)mine=key;}catch{}
    if(!disposed)controls();
  }
  listen(host,'click',async event=>{
    if(event.target.closest('[data-story-add]')){
      const account=win.NCNAccount;if(!account?.state.ready)return;
      if(!account.state.user){account.open('login');return;}
      returnFocus=doc.activeElement;clearPhoto();caption.value='';requestId=win.crypto.randomUUID();message(dialog,'');dialog.showModal();controls();photo.focus({preventScroll:true});
    }
    const tile=event.target.closest('[data-story-id]');if(tile)showStory(tile.dataset.storyId);
    const scroll=event.target.closest('[data-story-scroll]');if(scroll)$('[data-story-rail]').scrollBy({left:Number(scroll.dataset.storyScroll)*450,behavior:win.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  for(const el of [dialog,viewer]){
    listen(el,'click',event=>{if(!busy&&(event.target===el||event.target.closest('[data-close]')))el.close();});
    listen(el,'cancel',event=>{if(busy)event.preventDefault();});
    listen(el,'close',()=>{if(el===dialog){clearPhoto();caption.value='';}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  }
  listen(photo,'change',async()=>{
    const file=photo.files[0];clearPhoto(true);const generation=photoEpoch;message(dialog,'');controls();if(!file)return;
    message(dialog,'Đang chuẩn bị ảnh…');
    try{const resized=await resizedImage(file);if(generation!==photoEpoch||!dialog.open||disposed)return;blob=resized;requestId=win.crypto.randomUUID();photo.required=false;previewURL=URL.createObjectURL(blob);const img=dialog.querySelector('img');img.src=previewURL;img.hidden=false;message(dialog,'Ảnh đã sẵn sàng.');}
    catch(error){if(generation===photoEpoch)message(dialog,error.message,true);}
    controls();
  });
  listen(form,'submit',async event=>{
    event.preventDefault();if(busy||!blob||!user)return;const generation=epoch,picture=blob;busy=true;controls();message(dialog,'Đang đăng ảnh…');
    try{const data={requestId,caption:caption.value.trim(),image:await base64(picture)};if(disposed||generation!==epoch)return;
      const result=await api('create',data);if(disposed||generation!==epoch)return;
      items=[result.item,...items.filter(x=>x.id!==result.item.id)];render();dialog.close();status('Đã đăng Story. Ảnh của bạn đã xuất hiện trong dãy Story.');
    }catch(error){if(generation===epoch)message(dialog,error.message,true);}
    finally{busy=false;if(!disposed)controls();}
  });
  listen(viewer,'click',event=>{
    const move=event.target.closest('[data-step]');if(move)step(Number(move.dataset.step));
    if(event.target.closest('[data-delete]'))viewer.querySelector('.ncn-story-confirm').hidden=false;
    if(event.target.closest('[data-keep]'))viewer.querySelector('.ncn-story-confirm').hidden=true;
  });
  listen(viewer.querySelector('[data-confirm-delete]'),'click',async()=>{
    if(busy||!selected)return;const id=selected,generation=epoch;busy=true;controls();message(viewer,'Đang xoá ảnh…');
    try{await api('delete',{id});if(disposed||generation!==epoch)return;items=items.filter(x=>x.id!==id);viewer.close();render();status('Đã xoá vĩnh viễn Story và ảnh đã tải lên.');}
    catch(error){if(generation===epoch)message(viewer,error.message,true);}
    finally{busy=false;if(!disposed)controls();}
  });
  listen(doc,'keydown',event=>{if(viewer.open&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}});
  let touchX=null;const frame=viewer.querySelector('.ncn-story-frame');
  listen(frame,'touchstart',event=>{touchX=event.touches.length===1?event.touches[0].clientX:null;});
  listen(frame,'touchend',event=>{if(touchX===null)return;const delta=event.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(delta)>60)step(delta>0?-1:1);});
  listen(doc,'ncn-account-change',authChanged);listen(doc,'ncn-account-ready',authChanged);
  listen(doc,'visibilitychange',()=>{if(!doc.hidden){render();refresh();}});
  controls();authChanged();refresh();
  return {refresh,destroy(){disposed=true;epoch++;photoEpoch++;win.clearTimeout(expiryTimer);clearPhoto();listeners.forEach(remove=>remove());dialog.remove();viewer.remove();delete host.dataset.mounted;}};
}
