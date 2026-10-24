import {MAX_ENTRIES,MAX_HISTORY,STORAGE_KEY,normalizeName,nameKey,parseNames,secureIndex,landingRotation,sectorPath,emptyState,restoreState} from './core.js?v=20261016-wheel-1';
const NS='http://www.w3.org/2000/svg';
export const GLASS_COLORS=[['#e1f6ff','#86c7ed'],['#eee5ff','#b5a1e7'],['#dbf9ed','#85cebb'],['#fff2d9','#e6c583'],['#e5edff','#9fb9e9'],['#ffe8f0','#e6b0c8'],['#d9f5f7','#84c8d1'],['#eef5da','#b6ce94']];
let wheelInstance=0;
export function createLuckyWheel({root=document.getElementById('ncn-wheel-app'),doc=document,win=window,storage,randomIndex,animate,now=()=>Date.now()}={}){
 if(!root)throw new Error('Không tìm thấy vòng quay.');
 const $=id=>root.querySelector('#lw-'+id),listeners=[];
 const listen=(node,type,handler)=>{node?.addEventListener(type,handler);listeners.push(()=>node?.removeEventListener(type,handler));};
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const svg=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const paintId='ncn-lw-glass-'+(++wheelInstance);
 let store=storage,storageOK=true;
 if(store===undefined)try{store=win.localStorage;}catch{storageOK=false;}
 let state;try{state=restoreState(store?.getItem(STORAGE_KEY));}catch{state=emptyState();storageOK=false;}
 let busy=false,destroyed=false,rotation=0,serial=0,resultOpen=false,confirmAction=null,animationCancel=null,confirmationFocus=null,spinToken=0;
 const uid=()=>win.crypto?.randomUUID?.()||'lw-'+now().toString(36)+'-'+(++serial).toString(36);
 const message=(text,error=false)=>{$('message').textContent=text;$('message').dataset.kind=error?'error':'info';$('message').hidden=!text;};
 const persist=()=>{try{store?.setItem(STORAGE_KEY,JSON.stringify(state));if(!store)storageOK=false;}catch{storageOK=false;}$('storage-note').textContent=storageOK?'Danh sách và kết quả được lưu trên trình duyệt này.':'Không lưu được trên trình duyệt này. Giữ tab đang mở để tránh mất danh sách.';};
 const getState=()=>JSON.parse(JSON.stringify({...state,busy}));
 const modalOpen=dialog=>{try{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}catch{dialog.setAttribute('open','');}};
 const modalClose=dialog=>{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');};
 function renderWheel(){
  const entries=state.entries,n=entries.length,paint=n||8,wheel=$('wheel');rotation=0;
  wheel.style.transition='none';wheel.style.transform='rotate(0deg)';wheel.replaceChildren();
  const defs=svg('defs');
  GLASS_COLORS.forEach(([light,color],i)=>{
   const gradient=svg('linearGradient',{id:paintId+'-'+i,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
   gradient.append(svg('stop',{offset:'0%','stop-color':light}),svg('stop',{offset:'62%','stop-color':color}),svg('stop',{offset:'100%','stop-color':light}));defs.append(gradient);
  });
  wheel.append(defs);
  $('wheel-desc').textContent=n?`Vòng quay có ${n} người tham gia. Mỗi tên có một cơ hội như nhau.`:'Thêm tên vào danh sách để bắt đầu quay.';
  for(let i=0;i<paint;i++){
   const group=svg('g');group.append(svg('path',{class:'lw-sector',d:sectorPath(i,paint),fill:`url(#${paintId}-${i%GLASS_COLORS.length})`,'fill-opacity':'.82',stroke:'#ffffffc2','stroke-width':paint>80?.5:1.8}));
   if(n&&(n<=48||i%Math.ceil(n/48)===0)){
    const angle=n===1?0:-90+(i+.5)*360/paint,rad=angle*Math.PI/180,x=n===1?300:300+183*Math.cos(rad),y=n===1?160:300+183*Math.sin(rad);
    const left=Math.cos(rad)<0,text=svg('text',{class:'lw-sector-label',x,y,'text-anchor':'middle','dominant-baseline':'middle',fill:'#16384e','font-weight':'750','font-family':'Arial, sans-serif','font-size':n>48?10:n>20?12:n>12?15:n>6?20:25,transform:`rotate(${angle+(left?180:0)} ${x} ${y})`});
    const title=svg('title');title.textContent=entries[i].name;text.append(title);
    const max=n>20?12:18,name=n>48?String(i+1):entries[i].name;text.append(doc.createTextNode(name.length>max?name.slice(0,max-1)+'…':name));group.append(text);
   }
   wheel.append(group);
  }
  $('empty-wheel').hidden=Boolean(n);$('wheel-note').textContent=n>48?'Các số trên vòng quay tương ứng số thứ tự trong danh sách.':n?`${n} người tham gia · Mỗi tên một cơ hội`:'Thêm tên bên cạnh để bắt đầu';
 }
 function renderLists(){
  $('count').textContent=String(state.entries.length);$('history-count').textContent=String(state.history.length);
  const list=doc.createDocumentFragment();
  state.entries.forEach((entry,i)=>{
   const row=make('li','lw-person'),number=make('span','lw-number',String(i+1).padStart(2,'0')),name=make('span','lw-person-name',entry.name),button=make('button','lw-delete','×');
   button.type='button';button.dataset.remove=entry.id;button.setAttribute('aria-label','Xóa '+entry.name);button.disabled=busy;row.append(number,name,button);list.append(row);
  });
  $('entries').replaceChildren(list);$('empty-list').hidden=state.entries.length>0;
  const history=doc.createDocumentFragment();
  state.history.forEach(entry=>{
   const row=make('li','lw-history-row'),mark=make('span','lw-trophy','✦'),body=make('div'),title=make('strong','',`Lần ${entry.draw}: ${entry.name}`),time=make('time'),button=make('button','lw-delete','×');
   time.dateTime=new Date(entry.at).toISOString();time.textContent=new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(entry.at));
   button.type='button';button.dataset.history=String(entry.draw);button.setAttribute('aria-label','Xóa kết quả lần '+entry.draw);button.disabled=busy;body.append(title,time);row.append(mark,body,button);history.append(row);
  });
  $('history').replaceChildren(history);$('empty-history').hidden=state.history.length>0;
  root.querySelectorAll('[data-lw-lock]').forEach(n=>n.disabled=busy);
  $('clear-list').disabled=busy||!state.entries.length;$('clear-history').disabled=busy||!state.history.length;
  $('spin').disabled=busy||!state.entries.length;$('spin').textContent=busy?'Đang quay…':'Quay ngay';
  root.setAttribute('aria-busy',String(busy));$('duration').value=String(state.duration);$('auto-remove').checked=state.removeWinner;
 }
 function addNames(text){
  if(busy||destroyed)return false;
  let names;try{names=parseNames(text);}catch(e){message(e.message,true);return false;}
  if(!names.length){message('Anh nhập ít nhất một tên nhé.',true);return false;}
  const existing=new Set(state.entries.map(e=>nameKey(e.name))),added=[],duplicates=[];
  for(const name of names){const key=nameKey(name);if(existing.has(key)){duplicates.push(name);continue;}existing.add(key);added.push(name);}
  if(state.entries.length+added.length>MAX_ENTRIES){message(`Danh sách tối đa ${MAX_ENTRIES} tên. Chưa thêm tên nào; anh chia nhỏ danh sách nhé.`,true);return false;}
  if(!added.length){message('Các tên này đã có trong danh sách.',true);return false;}
  for(const name of added)state.entries.push({id:uid(),name});
  persist();renderWheel();renderLists();message(`Đã thêm ${added.length} tên.${duplicates.length?' Bỏ qua '+duplicates.length+' tên trùng.':''}`);return true;
 }
 function removeEntry(id){
  if(busy||destroyed)return;
  state.entries=state.entries.filter(e=>e.id!==id);persist();renderWheel();renderLists();message('Đã xóa tên khỏi danh sách.');
 }
 function defaultAnimate({from,to,duration,onDone}){
  const wheel=$('wheel');let frame,done=false;
  wheel.style.transition='none';wheel.style.transform=`rotate(${from}deg)`;
  // Layout read establishes the start frame before a CSS transition.
  wheel.getBoundingClientRect();
  frame=win.requestAnimationFrame(()=>{wheel.style.transition=`transform ${duration}ms cubic-bezier(.12,.68,.08,1)`;wheel.style.transform=`rotate(${to}deg)`;});
  const finish=()=>{if(done)return;done=true;win.clearTimeout(timer);wheel.removeEventListener('transitionend',ended);wheel.style.transition='none';wheel.style.transform=`rotate(${to}deg)`;onDone();};
  const ended=e=>{if(e.target===wheel&&e.propertyName==='transform')finish();};
  const timer=win.setTimeout(finish,duration+120);wheel.addEventListener('transitionend',ended);
  return ()=>{done=true;win.cancelAnimationFrame(frame);win.clearTimeout(timer);wheel.removeEventListener('transitionend',ended);};
 }
 function spin(){
  if(busy||resultOpen||destroyed)return false;
  if(!state.entries.length){message('Thêm tên vào danh sách trước khi quay nhé.',true);return false;}
  let index;try{index=randomIndex?randomIndex(state.entries.length):secureIndex(state.entries.length,win.crypto);if(!Number.isInteger(index)||index<0||index>=state.entries.length)throw new Error('Không chọn được kết quả. Anh thử lại nhé.');}catch(e){message(e.message,true);return false;}
  const selected={...state.entries[index]},count=state.entries.length,remove=state.removeWinner,to=landingRotation(rotation,index,count),token=++spinToken;
  busy=true;message('Vòng quay đang chạy. Chúc anh may mắn!');renderLists();
  const duration=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches?120:state.duration*1000;
  const complete=()=>{
   if(destroyed||!busy||token!==spinToken)return;
   busy=false;rotation=to;const result={...selected,draw:state.nextDraw++,at:now()};
   state.history.unshift(result);state.history=state.history.slice(0,MAX_HISTORY);
   if(remove)state.entries=state.entries.filter(e=>e.id!==selected.id);
   persist();renderLists();$('winner').textContent=selected.name;$('result-round').textContent='Kết quả lần '+result.draw;
   $('result-note').textContent=remove?'Tên này đã được loại khỏi lượt quay tiếp theo.':'Tên này vẫn được giữ cho lượt quay tiếp theo.';
   message('Chúc mừng '+selected.name+'!');resultOpen=true;modalOpen($('result-dialog'));$('result-continue').focus();
  };
  try{animationCancel=(animate||defaultAnimate)({from:rotation,to,duration,onDone:complete});}
  catch{busy=false;renderLists();message('Không chạy được hiệu ứng quay. Anh thử lại nhé.',true);return false;}
  return true;
 }
 function closeResult(){if(!resultOpen)return;resultOpen=false;modalClose($('result-dialog'));renderWheel();$('spin').focus();}
 function askClear(kind,source){
  if(busy||destroyed)return;
  confirmationFocus=source;confirmAction=kind;$('confirm-title').textContent=kind==='list'?'Xóa danh sách tham gia?':'Xóa toàn bộ lịch sử?';
  $('confirm-copy').textContent=kind==='list'?'Anh có thể nhập danh sách mới sau khi xóa. Lịch sử kết quả vẫn được giữ.':'Các tên đang tham gia vẫn được giữ để anh tiếp tục quay.';modalOpen($('confirm-dialog'));$('confirm-cancel').focus();
 }
 function closeConfirm(){confirmAction=null;modalClose($('confirm-dialog'));confirmationFocus?.focus();}
 listen($('add-form'),'submit',e=>{e.preventDefault();if(addNames($('name').value)){$('name').value='';$('name').focus();}});
 listen($('bulk-add'),'click',()=>{if(addNames($('bulk').value)){$('bulk').value='';$('bulk-details').open=false;}});
 listen($('entries'),'click',e=>{const button=e.target.closest('[data-remove]');if(button)removeEntry(button.dataset.remove);});
 listen($('history'),'click',e=>{const button=e.target.closest('[data-history]');if(!button||busy)return;state.history=state.history.filter(r=>r.draw!==Number(button.dataset.history));persist();renderLists();message('Đã xóa kết quả khỏi lịch sử.');});
 listen($('duration'),'change',()=>{if(busy)return;const value=Number($('duration').value);if(!Number.isInteger(value)||value<1||value>20){$('duration').value=String(state.duration);message('Thời gian quay từ 1 đến 20 giây.',true);return;}state.duration=value;persist();});
 listen($('auto-remove'),'change',()=>{if(busy)return;state.removeWinner=$('auto-remove').checked;persist();});
 listen($('spin'),'click',spin);listen($('result-continue'),'click',closeResult);listen($('result-close'),'click',closeResult);
 listen($('result-dialog'),'cancel',e=>{e.preventDefault();closeResult();});listen($('result-dialog'),'close',()=>{if(resultOpen){resultOpen=false;renderWheel();$('spin').focus();}});
 listen($('clear-list'),'click',e=>askClear('list',e.currentTarget));listen($('clear-history'),'click',e=>askClear('history',e.currentTarget));
 listen($('confirm-cancel'),'click',closeConfirm);listen($('confirm-dialog'),'cancel',e=>{e.preventDefault();closeConfirm();});
 listen($('confirm-ok'),'click',()=>{if(busy)return;if(confirmAction==='list')state.entries=[];else if(confirmAction==='history'){state.history=[];state.nextDraw=1;}else return;persist();renderWheel();renderLists();closeConfirm();message('Đã xóa. Anh có thể bắt đầu lượt mới.');});
 listen($('fullscreen'),'click',async()=>{
  try{if(doc.fullscreenElement===root)await doc.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else throw new Error();}
  catch{message('Trình duyệt chưa mở được toàn màn hình. Anh vẫn có thể quay bình thường.',true);}
 });
 listen(doc,'fullscreenchange',()=>{$('fullscreen').textContent=doc.fullscreenElement===root?'Thoát toàn màn hình':'Toàn màn hình';});
 persist();renderWheel();renderLists();
 return {getState,addNames,spin,closeResult,destroy:()=>{destroyed=true;spinToken++;animationCancel?.();listeners.splice(0).forEach(fn=>fn());}};
}
if(typeof document!=='undefined'&&!window.NCN_WHEEL_TEST){const root=document.getElementById('ncn-wheel-app');if(root)createLuckyWheel({root});}
