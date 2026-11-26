import {reactionOptions,shareURL} from './model.js';

const API='/.netlify/functions/ncn-engagement';
const platforms=[['facebook','Facebook'],['tiktok','TikTok'],['threads','Threads'],['instagram','Instagram']];
const time=value=>{try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));}catch{return '';}};
export function mountEngagement({host,target,doc=document,win=window,fetcher=fetch,lazy=false}){
  if(host.dataset.communityMounted)return {destroy(){}};host.dataset.communityMounted='true';
  const $=selector=>host.querySelector(selector),listeners=[],controller=new AbortController();
  const node=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const listen=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
  let state={reactions:{},mine:null,comments:[],commentCount:0,nextCursor:null},busy=false,loading=false,disposed=false,epoch=0,revision=0,requestId='',started=!lazy,refreshQueued=false,observer;
  let identity=win.NCNAccount?.state.user?.id||null;
  host.innerHTML=`<h2>Bình luận &amp; tương tác</h2><div class="ncn-community-reactions" role="group" aria-label="Cảm xúc về nội dung"></div><div class="ncn-community-share"><span>Chia sẻ</span><div data-share-buttons></div></div><div data-share-help class="ncn-community-share-help" hidden><p data-share-explanation></p><input data-share-link aria-label="Liên kết chia sẻ" readonly><div><button type="button" data-copy-link>Sao chép liên kết</button><a data-open-app target="_blank" rel="noopener noreferrer">Mở ứng dụng</a><button type="button" data-close-share>Đóng</button></div></div><div class="ncn-community-comment-heading"><h3>Bình luận <span data-comment-count></span></h3><button type="button" data-refresh aria-label="Tải lại bình luận">Làm mới</button></div><p data-community-login><button type="button" data-login>Đăng nhập để bình luận và tương tác</button></p><form data-community-form hidden><label>Viết bình luận<textarea name="comment" maxlength="1000" rows="2" placeholder="Chia sẻ cảm nhận của bạn…" required></textarea></label><div class="ncn-community-compose-footer"><small>Tối đa 1.000 ký tự</small><button type="submit">Gửi bình luận</button></div></form><p data-community-status role="status" aria-live="polite"></p><div class="ncn-community-comments" data-comments></div><button type="button" data-more hidden>Xem bình luận trước</button>`;
  const form=$('form'),textarea=form.elements.comment,submit=form.querySelector('[type=submit]');
  for(const option of reactionOptions){
    const button=node('button');button.type='button';button.dataset.reaction=option.id;button.setAttribute('aria-pressed','false');
    const icon=node('span',option.icon,'ncn-community-emotion');icon.setAttribute('aria-hidden','true');const count=node('span','0');count.dataset.reactionCount=option.id;
    button.append(icon,node('span',option.label),count);$('.ncn-community-reactions').append(button);
  }
  for(const [id,label] of platforms){const button=node('button',label);button.type='button';button.dataset.share=id;button.setAttribute('aria-label','Chia sẻ lên '+label);$('[data-share-buttons]').append(button);}
  const say=(text,error=false)=>{if(disposed)return;const el=$('[data-community-status]');el.textContent=text;el.classList.toggle('ncn-community-error',error);};
  const signedIn=()=>!!win.NCNAccount?.state.user;
  function login(){win.NCNAccount?.open('login');}
  function controls(){
    const member=signedIn();form.hidden=!member;$('[data-community-login]').hidden=member;
    for(const button of host.querySelectorAll('[data-reaction], [data-refresh], [data-more], [data-delete-comment], [data-confirm-comment]'))button.disabled=busy||loading;
    textarea.disabled=busy;submit.disabled=busy||!textarea.value.trim();
    $('[data-refresh]').disabled=busy||loading;
  }
  function renderComments(){
    const container=$('[data-comments]'),scroll=container.scrollTop;container.replaceChildren();
    if(!state.comments.length){container.append(node('p','Chưa có bình luận. Hãy là người đầu tiên chia sẻ.','ncn-community-empty'));return;}
    for(const item of state.comments){
      const article=node('article',undefined,'ncn-community-comment');article.dataset.commentId=item.id;
      const avatar=node('span',String(item.name||'T').trim().slice(0,1).toUpperCase(),'ncn-community-avatar');avatar.setAttribute('aria-hidden','true');
      const body=node('div',undefined,'ncn-community-comment-body'),meta=node('div',undefined,'ncn-community-comment-meta'),stamp=node('time',time(item.createdAt));stamp.dateTime=item.createdAt;
      meta.append(node('strong',item.name||'Thành viên'),stamp);body.append(meta,node('p',item.text));
      if(item.canDelete){
        const remove=node('button','Xoá');remove.type='button';remove.dataset.deleteComment=item.id;remove.setAttribute('aria-label','Xoá bình luận của '+item.name);
        const confirm=node('div',undefined,'ncn-community-delete-confirm');confirm.hidden=true;confirm.dataset.confirmFor=item.id;
        const yes=node('button','Xác nhận xoá'),no=node('button','Giữ lại');yes.type=no.type='button';yes.dataset.confirmComment=item.id;no.dataset.keepComment=item.id;
        confirm.append(node('span','Xoá bình luận này?'),yes,no);body.append(remove,confirm);
      }
      article.append(avatar,body);container.append(article);
    }
    container.scrollTop=scroll;
  }
  function render(){
    for(const option of reactionOptions){const button=$('[data-reaction="'+option.id+'"]'),count=Number(state.reactions[option.id])||0;button.setAttribute('aria-pressed',String(state.mine===option.id));button.setAttribute('aria-label',option.label+': '+count);button.querySelector('[data-reaction-count]').textContent=String(count);}
    $('[data-comment-count]').textContent=String(state.commentCount||0);$('[data-more]').hidden=!state.nextCursor;renderComments();controls();
  }
  async function api(data,before){
    const query=new URLSearchParams({kind:target.kind,id:target.id});if(before)query.set('before',before);
    const request=new AbortController(),abort=()=>request.abort(),timer=win.setTimeout(abort,15000);controller.signal.addEventListener('abort',abort,{once:true});
    try{
      const response=await fetcher(API+'?'+query,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:target.kind,id:target.id,...data})}:{}),signal:request.signal});
      let result;try{result=await response.json();}catch{throw Error('Chưa kết nối được bình luận. Vui lòng thử lại.');}
      if(!response.ok)throw Object.assign(Error(result.error||'Chưa thực hiện được. Vui lòng thử lại.'),{status:response.status});return result;
    }finally{win.clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}
  }
  async function refresh(more=false){
    if(disposed||busy||loading)return;started=true;const current=++revision,generation=epoch;loading=true;controls();say('Đang tải bình luận…');
    try{const result=await api(null,more?state.nextCursor:null);if(disposed||current!==revision||generation!==epoch)return;
      if(more){const ids=new Set(state.comments.map(x=>x.id));result.comments=[...state.comments,...result.comments.filter(x=>!ids.has(x.id))];}state=result;render();say('');
    }catch(error){if(!disposed&&current===revision&&generation===epoch)say(error.message,true);}
    finally{if(current===revision&&generation===epoch){loading=false;controls();if(refreshQueued){refreshQueued=false;refresh();}}}
  }
  async function write(data,success){
    if(disposed||busy||loading)return false;if(!signedIn()){login();return false;}
    const generation=epoch,current=++revision;busy=true;controls();say('Đang lưu…');
    try{const result=await api(data);if(disposed||generation!==epoch||current!==revision)return false;state=result;render();say(success);return true;}
    catch(error){if(!disposed&&generation===epoch){say(error.message,true);if(error.status===401)login();}return false;}
    finally{if(generation===epoch&&current===revision){busy=false;controls();}}
  }
  function shareHelp(platform){
    const label=platform==='tiktok'?'TikTok':'Instagram';$('[data-share-help]').hidden=false;$('[data-share-link]').value=target.url;
    $('[data-share-explanation]').textContent='Sao chép liên kết rồi dán vào '+label+'. Bạn chọn nội dung và hoàn tất đăng trong ứng dụng.';
    const link=$('[data-open-app]');link.href=platform==='tiktok'?'https://www.tiktok.com/':'https://www.instagram.com/';link.textContent='Mở '+label;
  }
  async function share(platform){
    const direct=shareURL(platform,target.url,target.title);
    if(direct){win.open(direct,'_blank','noopener,noreferrer');return;}
    if(typeof win.navigator.share==='function'){
      say('Chọn '+(platform==='tiktok'?'TikTok':'Instagram')+' trong bảng chia sẻ nếu có.');
      try{await win.navigator.share({title:target.title,url:target.url});return;}
      catch(error){if(error.name==='AbortError'){shareHelp(platform);say('Đã đóng bảng chia sẻ. Bạn có thể sao chép liên kết bên trên.');return;}}
    }
    shareHelp(platform);
  }
  listen(host,'click',async event=>{
    if(event.target.closest('[data-login]')){login();return;}
    const reaction=event.target.closest('[data-reaction]');if(reaction){await write({action:'react',value:state.mine===reaction.dataset.reaction?null:reaction.dataset.reaction},'Đã lưu cảm xúc.');return;}
    const shareButton=event.target.closest('[data-share]');if(shareButton){await share(shareButton.dataset.share);return;}
    if(event.target.closest('[data-close-share]'))$('[data-share-help]').hidden=true;
    if(event.target.closest('[data-copy-link]')){
      try{await win.navigator.clipboard.writeText(target.url);say('Đã sao chép liên kết.');}
      catch{const input=$('[data-share-link]');input.focus();input.select();say('Chọn Sao chép để lấy liên kết.');}
    }
    if(event.target.closest('[data-refresh]'))refresh();
    if(event.target.closest('[data-more]'))refresh(true);
    const remove=event.target.closest('[data-delete-comment]');if(remove)$('[data-confirm-for="'+remove.dataset.deleteComment+'"]').hidden=false;
    const keep=event.target.closest('[data-keep-comment]');if(keep)$('[data-confirm-for="'+keep.dataset.keepComment+'"]').hidden=true;
    const confirm=event.target.closest('[data-confirm-comment]');if(confirm)await write({action:'delete-comment',commentId:confirm.dataset.confirmComment},'Đã xoá bình luận.');
  });
  listen(textarea,'input',()=>{requestId='';controls();});
  listen(form,'submit',async event=>{event.preventDefault();const text=textarea.value.trim();if(!text||busy||loading)return;requestId=requestId||win.crypto.randomUUID();
    if(await write({action:'comment',text,requestId},'Đã đăng bình luận.')){textarea.value='';requestId='';controls();}
  });
  function authChanged(){
    const next=win.NCNAccount?.state.user?.id||null;
    if(next!==identity){epoch++;revision++;identity=next;busy=false;loading=false;state.mine=null;state.comments=state.comments.map(x=>({...x,canDelete:false}));textarea.value='';requestId='';render();}
    controls();if(started){if(loading)refreshQueued=true;else refresh();}
  }
  listen(doc,'ncn-account-change',authChanged);listen(doc,'ncn-account-ready',authChanged);
  render();
  if(lazy&&win.IntersectionObserver){observer=new win.IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();refresh();}},{rootMargin:'200px'});observer.observe(host);}else refresh();
  return {refresh,destroy(){if(disposed)return;disposed=true;epoch++;revision++;controller.abort();observer?.disconnect();listeners.forEach(remove=>remove());host.replaceChildren();delete host.dataset.communityMounted;}};
}
