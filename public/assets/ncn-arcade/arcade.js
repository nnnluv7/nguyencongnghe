import {GAMES,AVATARS,GAME_ICONS,ARCADE_COUNT,vietnamDate} from './catalog.js?v=20261027-bubble-1';

const ENDPOINT='/.netlify/functions/ncn-scores',PROFILE_KEY='ncn:arcade:profile:v1',QUEUE_KEY='ncn:arcade:pending:v1';
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const write=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage denial must not block a game. */}};
const number=n=>Math.floor(n||0).toLocaleString('vi-VN');
async function api(route,data){
 const res=await fetch(ENDPOINT+'?route='+route,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(12000)});
 const value=await res.json();if(!res.ok)throw Object.assign(new Error(value.error||'Chưa kết nối được bảng điểm.'),{status:res.status});return value;
}
function avatarNode(value){
 const span=document.createElement('span');span.className='ncn-score-avatar';
 if(typeof value==='string'&&(value.startsWith('/.netlify/functions/ncn-scores?route=avatar&id=')||/^https:\/\//.test(value))){const img=new Image();img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=value;img.addEventListener('error',()=>{span.replaceChildren(document.createTextNode('☺'));},{once:true});span.append(img);}else {const index=AVATARS.findIndex(x=>value==='preset:'+x),names=['cat','dog','panda','fox','frog','tiger','penguin','rabbit'];span.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><use href="/assets/ncn-arcade/avatars.svg#'+names[Math.max(0,index)]+'"></use></svg>';}return span;
}
function profileView(profile){write(PROFILE_KEY,profile);return profile;}
export function mountScores({game='snake',host=document.body,anchor,pause=()=>{}}={}){
 if(!GAMES[game])throw Error('Unknown arcade game');
 const navigation=document.querySelector('.ncn-arcade-links'),currentLink=navigation?.querySelector('[aria-current=page]');
 if(currentLink)requestAnimationFrame(()=>{const current=currentLink.getBoundingClientRect(),band=navigation.getBoundingClientRect();navigation.scrollLeft+=current.left-band.left-(band.width-current.width)/2;});
 const section=document.createElement('section');section.id='ncn-scoreboard';section.className='ncn-scoreboard';section.setAttribute('aria-labelledby','ncn-score-title');
 section.innerHTML=`<header class="ncn-score-head"><div><span class="ncn-score-eyebrow">NCN ARCADE · CÙNG CHƠI, CÙNG LÊN HẠNG</span><h2 id="ncn-score-title">Bảng điểm cộng đồng.</h2><p>Một hồ sơ cho cả ${ARCADE_COUNT} game. Mỗi chế độ có bảng điểm riêng, giữ thành tích tốt nhất của mỗi người.</p></div><button type="button" data-rank-refresh>Làm mới ↻</button></header><div class="ncn-score-tabs" role="group" aria-label="Chọn game xếp hạng"></div><div class="ncn-score-tools"><label>Chế độ <select aria-label="Chế độ xếp hạng"></select></label><a class="ncn-score-play"></a></div><div class="ncn-score-player"></div><p class="ncn-score-save" role="status" aria-live="polite"></p><div class="ncn-score-table-head" aria-hidden="true"><span>HẠNG</span><span>NGƯỜI CHƠI</span><span>ĐIỂM</span></div><ol class="ncn-score-list" aria-label="Top 10 người chơi"></ol><p class="ncn-score-status" role="status"></p><div class="ncn-score-footer"><small>Tên và ảnh hiển thị công khai.<br>Điểm của từng game được tính riêng.</small><button type="button" data-rank-expand>Xem tất cả ↗</button></div>`;
 (anchor||document.querySelector('main'))?.insertAdjacentElement(anchor?'beforebegin':'beforeend',section);
 const expanded=document.createElement('dialog');expanded.className='ncn-arcade-dialog ncn-arcade-expanded';expanded.setAttribute('aria-labelledby','ncn-expanded-title');
 expanded.innerHTML='<header><div><span class="ncn-score-eyebrow">NCN ARCADE · BẢNG XẾP HẠNG</span><h2 id="ncn-expanded-title">Tất cả người chơi.</h2></div><button type="button" data-close-rank aria-label="Đóng bảng điểm">×</button></header><p class="ncn-score-status" role="status"></p><div class="ncn-score-scroll"><ol class="ncn-score-list" aria-label="Danh sách xếp hạng đầy đủ"></ol><div class="ncn-score-sentinel"></div><button type="button" class="ncn-score-more">Xem thêm 50 người chơi ↓</button></div>';
 const dialog=document.createElement('dialog');dialog.className='ncn-arcade-dialog ncn-arcade-profile';dialog.setAttribute('aria-labelledby','ncn-profile-title');
 dialog.innerHTML=`<header><div><span class="ncn-score-eyebrow">MỘT HỒ SƠ · ${ARCADE_COUNT} TRÒ CHƠI</span><h2 id="ncn-profile-title">Xin chào, người chơi!</h2></div><button type="button" data-profile-close aria-label="Đóng hồ sơ người chơi">×</button></header><p>Chọn tên và ảnh đại diện một lần để lưu điểm cho cả NCN Arcade.</p><form><label for="ncn-player-name">Tên trên bảng điểm</label><input id="ncn-player-name" name="name" type="text" maxlength="30" autocomplete="nickname" placeholder="Ví dụ: Cá Nhỏ Vui Vẻ" required><label>Ảnh đại diện</label><div class="ncn-avatar-picker" role="group" aria-label="Chọn ảnh đại diện"></div><div class="ncn-profile-preview"></div><input class="ncn-avatar-upload" aria-label="Tải ảnh đại diện của bạn" type="file" accept="image/jpeg,image/png,image/webp"><p class="ncn-profile-note">Tên và ảnh của bạn sẽ hiện công khai trên bảng điểm. Khách được nhớ trên trình duyệt này; tài khoản NCN dùng được trên các thiết bị.</p><p class="ncn-score-status" role="status"></p><div class="ncn-profile-actions"><button type="submit">Lưu hồ sơ &amp; chơi</button><button type="button" data-profile-login>Đăng nhập NCN</button></div></form>`;
 const portrait=document.createElement('dialog');portrait.id='ncn-avatar-viewer';portrait.className='ncn-arcade-dialog ncn-avatar-viewer';portrait.setAttribute('aria-labelledby','ncn-avatar-title');
 portrait.innerHTML='<header><div><span class="ncn-score-eyebrow">ẢNH ĐẠI DIỆN</span><h2 id="ncn-avatar-title"></h2></div><button type="button" data-avatar-close aria-label="Đóng ảnh đại diện" autofocus>×</button></header><div class="ncn-avatar-image"></div><p class="ncn-avatar-caption"></p><p class="ncn-avatar-quality" role="status" hidden></p><button type="button" data-avatar-upgrade hidden>Cập nhật ảnh rõ hơn</button>';
 host.append(expanded,dialog,portrait);
 const q=(s,root=section)=>root.querySelector(s),list=q('.ncn-score-list'),fullList=q('.ncn-score-list',expanded),more=q('.ncn-score-more',expanded),status=q('.ncn-score-status'),saveNote=q('.ncn-score-save'),form=q('form',dialog),profileStatus=q('.ncn-score-status',dialog);
 let profile=null,boardGame=game,boardMode=Object.keys(GAMES[game].modes)[0],boardDate=vietnamDate(),items=[],cursor=null,total=0,own=null,loadEpoch=0,loading=false,run=null,starting=false,profileResolve=null,choice='preset:'+AVATARS[0],profileEpoch=0,profilePending=null,saveChain=Promise.resolve(),lastCheckpoint=0,lastScore=-1,localRunKey='ncn:arcade:run:'+game,memoryQueue=[];
 const tabs=q('.ncn-score-tabs'),select=q('select'),playLink=q('.ncn-score-play');
 let portraitTrigger=null,portraitOwner=null;
 function openPortrait(entry,trigger){
  pause();portraitTrigger=trigger;portraitOwner=entry.id;portrait.returnValue='';
  const name=entry.name||'Người chơi NCN',image=avatarNode(entry.avatar),photo=image.querySelector('img');
  const frame=q('.ncn-avatar-image',portrait),quality=q('.ncn-avatar-quality',portrait),upgrade=q('[data-avatar-upgrade]',portrait);
  frame.style.removeProperty('--ncn-avatar-max');quality.hidden=true;upgrade.hidden=true;
  q('#ncn-avatar-title',portrait).textContent=name;
  q('.ncn-avatar-caption',portrait).textContent=entry.member?'Thành viên NCN':'Người chơi NCN Arcade';
  frame.replaceChildren(image);
  if(photo){
   photo.alt='Ảnh đại diện của '+name;photo.loading='eager';
   const loaded=()=>{
    if(frame.firstElementChild!==image)return;
    const size=Math.min(photo.naturalWidth,photo.naturalHeight);
    if(size>0&&size<384){
     frame.style.setProperty('--ncn-avatar-max',size*2+'px');
     quality.textContent=entry.member?'Ảnh này đang ở chất lượng thấp. Người chơi có thể chọn lại ảnh gốc trong “Quản lý tài khoản” để xem rõ hơn.':'Ảnh này đang ở chất lượng thấp. Người chơi có thể chọn lại ảnh gốc trong “Sửa hồ sơ” để xem rõ hơn.';quality.hidden=false;upgrade.hidden=profile?.id!==entry.id;
    }
   };
   photo.addEventListener('load',loaded,{once:true});if(photo.complete&&photo.naturalWidth)loaded();
   photo.addEventListener('error',()=>{if(frame.firstElementChild===image)q('.ncn-avatar-caption',portrait).textContent='Ảnh chưa tải được. Thử mở lại sau nhé.';},{once:true});
  }
  if(!portrait.open)portrait.showModal();portrait.scrollTop=0;
 }
 q('[data-avatar-close]',portrait).addEventListener('click',()=>portrait.close());
 q('[data-avatar-upgrade]',portrait).addEventListener('click',()=>portrait.close('upgrade'));
 portrait.addEventListener('click',event=>{if(event.target!==portrait)return;const box=portrait.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)portrait.close();});
 portrait.addEventListener('close',()=>{
  q('.ncn-avatar-image',portrait).replaceChildren();
  if(portrait.returnValue==='upgrade'&&profile?.id===portraitOwner){
   portraitTrigger=null;portraitOwner=null;if(expanded.open)expanded.close();if(profile.member)window.NCNAccount?.open('profile');else{showProfile();profileStatus.textContent='Chọn lại ảnh gốc rõ nét rồi bấm Lưu hồ sơ. Điểm và tên người chơi được giữ nguyên.';}return;
  }
  const target=portraitTrigger?.isConnected&&!portraitTrigger.closest('dialog:not([open])')?portraitTrigger:expanded.open?q('[data-close-rank]',expanded):q('[data-rank-expand]');
  target?.focus({preventScroll:true});portraitTrigger=null;portraitOwner=null;
 });
 function player(){
  const box=q('.ncn-score-player');box.replaceChildren(avatarNode(profile?.avatar));const copy=document.createElement('span'),name=document.createElement('strong'),note=document.createElement('small');name.textContent=profile?.name||'Bạn sẽ lên bảng với tên nào?';note.textContent=profile?(profile.member?`Tài khoản NCN · Dùng chung ${ARCADE_COUNT} game`:`Hồ sơ khách · Dùng chung ${ARCADE_COUNT} game`):'Thêm tên và ảnh khi bắt đầu chơi';copy.append(name,note);const b=document.createElement('button');b.type='button';b.textContent=profile?.member?'Tài khoản NCN':profile?'Sửa hồ sơ':'Thêm hồ sơ';b.addEventListener('click',()=>{pause();if(profile?.member)window.NCNAccount?.open('profile');else showProfile();});box.append(copy,b);
 }
 function saveMessage(message,retry=false){saveNote.replaceChildren(document.createTextNode(message));if(retry){const b=document.createElement('button');b.type='button';b.textContent='Thử lưu lại';b.addEventListener('click',flush);saveNote.append(b);}}
 function row(entry){
  const li=document.createElement('li');li.className='ncn-score-row'+(entry.you?' is-you':'');li.value=entry.rank;
  li.dataset.player=entry.id;
  const rank=document.createElement('span');rank.className='ncn-score-rank';rank.textContent=number(entry.rank);rank.setAttribute('aria-label','Hạng '+entry.rank);
  const name=document.createElement('span');name.className='ncn-score-name';const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=entry.name+(entry.you?' · Bạn':'');small.textContent=(entry.member?'Thành viên NCN':'Người chơi')+(entry.level?' · Màn '+entry.level:'');name.append(strong,small);
  const avatar=document.createElement('button');avatar.type='button';avatar.className='ncn-score-avatar-button';avatar.setAttribute('aria-label','Xem ảnh đại diện của '+entry.name);avatar.setAttribute('aria-haspopup','dialog');avatar.setAttribute('aria-controls',portrait.id);avatar.title='Xem ảnh đại diện';avatar.append(avatarNode(entry.avatar));
  // Native keyboard activation must not also reach a game's Space/Enter controls.
  avatar.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();});avatar.addEventListener('click',()=>openPortrait(entry,avatar));
  const points=document.createElement('b');points.className='ncn-score-points'+(entry.score>=10000000?' is-long':'');points.textContent=number(entry.score);points.setAttribute('aria-label',number(entry.score)+' điểm');li.append(rank,avatar,name,points);return li;
 }
 function paint(){
  const scroll=q('.ncn-score-scroll',expanded),position=scroll.scrollTop;
  list.replaceChildren(...items.slice(0,10).map(row));
  const previous=[...fullList.children];
  if(previous.length&&previous.length<=items.length&&previous.every((node,i)=>node.dataset.player===items[i]?.id)){
   for(const entry of items.slice(previous.length))fullList.append(row(entry));
  }else fullList.replaceChildren(...items.map(row));
  scroll.scrollTop=position;
  if(!items.length&&!loading){const empty=document.createElement('li');empty.className='ncn-score-empty';empty.textContent='Chưa có thành tích. Chơi một ván và ghi tên đầu tiên nhé!';list.append(empty);fullList.append(empty.cloneNode(true));}
  status.textContent=loading&&!items.length?'Đang tải bảng điểm…':number(total)+' người chơi'+(own?' · Bạn: hạng '+number(own.rank)+' · '+number(own.score)+' điểm':'');
  q('.ncn-score-status',expanded).textContent=GAMES[boardGame].name+' · '+GAMES[boardGame].modes[boardMode]+' · '+number(items.length)+' / '+number(total)+' người chơi';
  q('[data-rank-expand]').textContent='Xem tất cả'+(total?' · '+number(total):'')+' ↗';more.hidden=!cursor;more.disabled=loading;more.textContent='Xem thêm 50 người chơi ↓';
 }
 async function load(reset=true){
  if(loading&&!reset)return;const epoch=reset?++loadEpoch:loadEpoch;if(reset){items=[];cursor=null;total=0;own=null;}loading=true;paint();
  const params=new URLSearchParams({game:boardGame,mode:boardMode,date:boardDate,limit:reset?'10':'50'});if(!reset&&cursor)params.set('cursor',cursor);
  try{const value=await api('board&'+params);if(epoch!==loadEpoch)return;const seen=new Set(items.map(x=>x.id));items.push(...(value.items||[]).filter(x=>!seen.has(x.id)));cursor=value.nextCursor||null;total=value.total||0;own=value.you||null;loading=false;paint();requestAnimationFrame(maybeMore);}
  catch(error){if(epoch!==loadEpoch)return;loading=false;paint();status.textContent=error.message;q('.ncn-score-status',expanded).textContent=error.message;more.hidden=false;more.textContent='Thử tải lại';}
 }
 function filters(){
  for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.game===boardGame));select.replaceChildren(...Object.entries(GAMES[boardGame].modes).map(([key,label])=>{const o=document.createElement('option');o.value=key;o.textContent=label;return o;}));select.value=boardMode;playLink.href=GAMES[boardGame].path;playLink.textContent=boardGame===game?'Đang ở '+GAMES[game].name:'Chơi '+GAMES[boardGame].name+' ↗';
 }
 for(const [id,spec]of Object.entries(GAMES)){const b=document.createElement('button');b.type='button';b.dataset.game=id;b.innerHTML='<svg class="ncn-arcade-icon" viewBox="0 0 24 24" aria-hidden="true">'+GAME_ICONS[id]+'</svg>'+spec.name;b.addEventListener('click',()=>{if(boardGame===id)return;boardGame=id;boardMode=Object.keys(spec.modes)[0];filters();load();});tabs.append(b);}
 select.addEventListener('change',()=>{boardMode=select.value;load();});q('[data-rank-refresh]').addEventListener('click',()=>load());
 function openRanks(){pause();if(!expanded.open)expanded.showModal();if(cursor)load(false);}
 q('[data-rank-expand]').addEventListener('click',openRanks);q('[data-close-rank]',expanded).addEventListener('click',()=>expanded.close());
 document.querySelector('.ncn-arcade-nav a[href="#ncn-scoreboard"]')?.addEventListener('click',event=>{event.preventDefault();openRanks();});
 const result=document.querySelector('.rl-result-actions,.ff-result-panel,.result-actions,.pk-overlay-result,.xh-result,.bb-result');
 if(result){const button=document.createElement('button');button.type='button';button.className='ncn-game-rank-button';button.textContent='Bảng điểm NCN Arcade ↗';button.addEventListener('click',openRanks);result.append(button);}
 more.addEventListener('click',()=>load(!cursor));expanded.addEventListener('click',e=>{if(e.target===expanded)expanded.close();});
 function maybeMore(){if(!expanded.open||!cursor||loading)return;const scroll=q('.ncn-score-scroll',expanded);if(scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<200)load(false);}
 q('.ncn-score-scroll',expanded).addEventListener('scroll',maybeMore,{passive:true});
 const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting))maybeMore();},{root:q('.ncn-score-scroll',expanded),rootMargin:'150px'});observer.observe(q('.ncn-score-sentinel',expanded));
 function preview(){q('.ncn-profile-preview',dialog).replaceChildren(avatarNode(choice));if(choice.startsWith('data:')){const img=new Image();img.alt='Ảnh đã chọn';img.src=choice;q('.ncn-profile-preview',dialog).firstElementChild.replaceChildren(img);}for(const b of q('.ncn-avatar-picker',dialog).children)b.setAttribute('aria-pressed',String(b.dataset.avatar===choice));}
 for(const value of AVATARS){const b=document.createElement('button');b.type='button';b.append(avatarNode('preset:'+value));b.dataset.avatar='preset:'+value;b.setAttribute('aria-label','Chọn '+value);b.addEventListener('click',()=>{choice=b.dataset.avatar;preview();});q('.ncn-avatar-picker',dialog).append(b);}
 function showProfile(){
  pause();form.elements.name.value=profile?.name||'';choice=profile?.avatar||'preset:'+AVATARS[0];profileStatus.textContent='';preview();if(!dialog.open)dialog.showModal();form.elements.name.focus({preventScroll:true});
 }
 function resolveProfile(value){const fn=profileResolve;profileResolve=null;fn?.(value);}
 q('[data-profile-close]',dialog).addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>resolveProfile(null));
 q('[data-profile-login]',dialog).addEventListener('click',()=>{dialog.close();window.NCNAccount?.open('login');});
 q('input[type=file]',dialog).addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;if(file.size>12*1024*1024){profileStatus.textContent='Chọn ảnh dưới 12 MB nhé.';return;}
  let bitmap;try{bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas'),side=Math.min(bitmap.width,bitmap.height),size=Math.min(768,side);canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.fillStyle='#dceada';ctx.fillRect(0,0,size,size);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);choice=canvas.toDataURL('image/jpeg',.92);preview();profileStatus.textContent=size<384?'Đã chọn ảnh. Ảnh gốc hơi nhỏ; chọn ảnh lớn hơn nếu muốn xem rõ khi phóng to.':'Đã chọn ảnh rõ nét. Lưu hồ sơ để dùng ảnh này.';}catch{profileStatus.textContent='Ảnh chưa đọc được. Chọn JPG, PNG hoặc WebP nhé.';}finally{bitmap?.close();event.target.value='';}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();const submit=q('[type=submit]',dialog);submit.disabled=true;profileStatus.textContent='Đang lưu hồ sơ…';const epoch=profileEpoch;
  try{const value=await api('profile',{name:form.elements.name.value,avatar:choice});if(epoch!==profileEpoch)return;profile=profileView(value.profile);player();resolveProfile(profile);dialog.close();flush();load();}catch(error){profileStatus.textContent=error.message;}finally{submit.disabled=false;}
 });
 async function syncProfile(){
  const epoch=++profileEpoch;
  try{const value=await api('profile');if(epoch!==profileEpoch)return;const before=profile;profile=profileView(value.profile||null);if(run&&before&&!before.member&&profile?.member&&run.owner===before.id){run.owner=profile.id;write(localRunKey,run);}player();if(profile&&dialog.open){resolveProfile(profile);dialog.close();}flush();}
  catch{if(epoch!==profileEpoch)return;profile=null;player();}
 }
 const ready=(async()=>{await window.NCNAccount?.ready;await syncProfile();filters();player();load();})();
 for(const type of ['ncn-account-ready','ncn-account-change'])document.addEventListener(type,()=>{profilePending=syncProfile();profilePending.then(()=>load());});
 async function begin({mode=Object.keys(GAMES[game].modes)[0],date=vietnamDate(),restore=false}={}){
  if(starting)return false;starting=true;
  try{
   await ready;await profilePending;
   if(!profile&&window.NCNAccount?.state.user){run=null;saveMessage('Đang chơi trên máy. Hồ sơ NCN sẽ dùng lại khi bảng điểm kết nối được.');return true;}
   if(!profile){showProfile();const ok=await new Promise(resolve=>{profileResolve=resolve;});if(!ok)return false;}
   if(boardGame!==game||boardMode!==mode||boardDate!==date){boardGame=game;boardMode=mode;boardDate=date;filters();load();}
   const previous=read(localRunKey);if(restore){if(previous?.owner===profile.id&&previous.mode===mode&&(mode!=='daily'||previous.date===date)){run=previous;lastScore=-1;}else{run=null;saveMessage('Đã tiếp tục ván cũ trên máy. Bắt đầu ván mới để ghi tên lên bảng Arcade.');}return true;}
   const current={owner:profile.id,mode,date,runId:null};run=current;write(localRunKey,null);lastScore=-1;lastCheckpoint=0;saveMessage('Ván này được lưu cho '+profile.name+'.');
   // The profile is established before play. Issuing the run must not delay
   // the first steering/tap input; an early result waits for this promise.
   current.pending=api('start',{game,mode,date}).then(value=>{current.runId=value.runId;if(run===current)write(localRunKey,{runId:current.runId,owner:current.owner,mode,date});}).catch(error=>{if(run===current)saveMessage('Đang chơi trên máy. '+error.message);});
   return true;
  }finally{starting=false;}
 }
 function pending(){const stored=read(QUEUE_KEY),rows=Array.isArray(stored)?stored:[],merged=new Map();for(const x of [...rows,...memoryQueue])if(x&&typeof x.runId==='string'&&typeof x.owner==='string'&&Number.isSafeInteger(x.score)&&(!merged.has(x.runId)||merged.get(x.runId).score<x.score))merged.set(x.runId,x);return [...merged.values()].slice(-100);}
 function savePending(rows){memoryQueue=rows;write(QUEUE_KEY,rows);}
 async function flush(){
  saveChain=saveChain.catch(()=>{}).then(async()=>{
   if(!profile)return;const owner=profile.id;
   for(const entry of pending().filter(x=>x.owner===owner)){
    if(profile?.id!==owner)break;
    try{const value=await api('score',{runId:entry.runId,score:entry.score,level:entry.level});savePending(pending().filter(x=>x.runId!==entry.runId||x.score>entry.score));if(entry.game===game)saveMessage(value.improved?'✓ Đã lưu '+number(entry.score)+' điểm lên bảng công khai.':'✓ Đã lưu kết quả. Kỷ lục: '+number(value.best)+' điểm.');}
    catch(error){if(profile?.id!==owner)break;if([400,403,410].includes(error.status)){savePending(pending().filter(x=>x.runId!==entry.runId||x.score>entry.score));saveMessage(error.message);continue;}saveMessage('Chưa gửi được điểm. Kết quả đang chờ kết nối lại.',true);break;}
   }
  });await saveChain;
 }
 function checkpoint(score,level=0,{force=false}={}){
  score=Math.floor(score);if(!run||!profile||run.owner!==profile.id||score<=0||score<=lastScore)return;
  if(!force&&Date.now()-lastCheckpoint<15000)return;lastCheckpoint=Date.now();lastScore=score;
  const current=run;
  const enqueue=()=>{if(!current.runId||current.owner!==profile?.id)return;const entry={runId:current.runId,owner:current.owner,game,score,level:Math.floor(level)},rows=pending();const old=rows.find(x=>x.runId===entry.runId);if(old&&old.score>=score)return;savePending([...rows.filter(x=>x.runId!==entry.runId),entry].slice(-100));flush().then(()=>{if(boardGame===game)load();});};
  if(current.runId)enqueue();else current.pending?.then(enqueue);
 }
 addEventListener('online',()=>{syncProfile().then(flush);});
 filters();player();return {ready,begin,checkpoint,finish:(score,level=0)=>checkpoint(score,level,{force:true}),profile:()=>profile,refresh:()=>load(),section};
}
