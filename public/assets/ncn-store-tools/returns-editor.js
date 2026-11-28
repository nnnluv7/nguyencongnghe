// Opt-in, browser-local editing. The public template remains fixed until the
// owner finishes editing and the revised text is committed to returns.js.
const templateID='sales-doi-tra-bao-hanh';
const draftKey='ncn:returns:text-draft:v1';
const policyURL='https://www.dienmayxanh.com/chinh-sach-bao-hanh-san-pham';
const blocks=()=>/<(p|h1)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

export function cleanReturnsText(value){
 if(typeof value!=='string'||value.length>8000)throw new Error('Đoạn văn bản quá dài. Anh rút gọn lại giúp em nhé.');
 const source=value.replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 return (source.match(/<[^>]*>|[^<]+|</g)||[]).map(part=>{
  if(!part.startsWith('<'))return part;
  const tag=/^<\s*(\/?)\s*([a-z][\w:-]*)\b[^>]*>$/i.exec(part);
  if(!tag)return '';
  const close=tag[1],name=tag[2].toLowerCase();
  if(name==='div'||name==='p')return close?'':'<br>';
  if(!['strong','b','em','i','u','br','a'].includes(name))return '';
  if(name==='br')return close?'':'<br>';
  return '<'+close+name+(!close&&name==='a'?' href="'+policyURL+'"':'')+'>';
 }).join('').replace(/^(?:<br>)+/,'');
}

export function applyReturnsTextDraft(prototype,edits){
 if(!edits||typeof edits!=='object'||Array.isArray(edits))throw new Error('Bản sửa chưa hợp lệ.');
 let index=0;
 return prototype.replace(blocks(),(whole,tag,attributes='',html)=>{
  const key=String(index++);
  return Object.hasOwn(edits,key)?'<'+tag+attributes+'>'+cleanReturnsText(edits[key])+'</'+tag+'>':whole;
 });
}
const signature=text=>{let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16);};

export function mountReturnsTextEditor({controller,app,doc=document,win=window}){
 const state=controller.getState();
 if(state.layout?.id!==templateID)return;
 const layout=state.layout,original=layout.prototype,base=signature(original),defaults=[...original.matchAll(blocks())].map(match=>match[3]);
 let edits={},child=null,boundRoot=null,unbind=()=>{},composing=false;
 try{const draft=JSON.parse(win.localStorage.getItem(draftKey)||'null');if(draft?.base===base){applyReturnsTextDraft(original,draft.edits);edits=draft.edits;}}catch{}
 const panel=doc.createElement('section');panel.id='nt-returns-text-editor';panel.className='st-panel';
 const heading=doc.createElement('h3');heading.textContent='Đang sửa văn bản';
 const hint=doc.createElement('p');hint.textContent='Bấm vào chữ trên phiếu để sửa trực tiếp. Khi sửa xong, anh nhắn “lưu” trong cuộc trò chuyện để em chốt bản mới.';
 const message=doc.createElement('p');message.setAttribute('role','status');message.textContent='Bố cục, logo và khổ giấy được giữ nguyên.';
 panel.append(heading,hint,message);app.querySelector('.ncn-print-sidebar').prepend(panel);
 const frame=doc.getElementById('nt-preview');
 function persist(){
  try{win.localStorage.setItem(draftKey,JSON.stringify({base,edits}));message.textContent='Đã lưu nháp trên trình duyệt này. Anh nhắn “lưu” khi hoàn tất.';}
  catch{message.textContent='Chưa lưu được nháp trên máy. Anh giữ trang này mở và nhắn “lưu” khi hoàn tất.';}
 }
 function update(target){
  if(!target||composing)return;
  const index=Number(target.dataset.ncnReturnBlock);
  if(!Number.isSafeInteger(index)||index<0||index>=defaults.length)return;
  try{
   const html=cleanReturnsText(target.innerHTML);
   if(html===defaults[index])delete edits[index];else edits[index]=html;
   layout.prototype=applyReturnsTextDraft(original,edits);
   for(const other of child.querySelectorAll('[data-ncn-return-block="'+index+'"]'))if(other!==target)other.innerHTML=html;
   persist();
  }catch(error){message.textContent=error.message;}
 }
 function bind(){
  const currentDocument=frame.contentDocument;
  if(currentDocument?.documentElement===boundRoot)return;
  unbind();child=currentDocument;boundRoot=child?.documentElement;
  const active=controller.getState().layout?.id===templateID;panel.hidden=!active;
  if(!active||!child?.querySelector('.returns-slip'))return;
  doc.getElementById('nt-static-note').hidden=true;
  const help=app.querySelector('.ncn-direct-heading');
  help.firstChild.textContent='Bấm vào chữ trên phiếu để sửa';help.lastChild.textContent='Hai phiếu dùng chung bản sửa.';
  for(const slip of child.querySelectorAll('.returns-slip')){
   [...slip.querySelectorAll('p,h1')].forEach((node,index)=>{
    if(Object.hasOwn(edits,String(index))){const html=cleanReturnsText(edits[index]);if(node.innerHTML!==html)node.innerHTML=html;}
    node.contentEditable='true';node.spellcheck=false;node.dataset.ncnReturnBlock=String(index);
    node.setAttribute('role','textbox');node.setAttribute('aria-multiline','true');node.setAttribute('aria-label','Sửa đoạn '+(index+1));
   });
  }
  const style=child.createElement('style');style.textContent='@media screen{[data-ncn-return-block]{cursor:text;caret-color:#205ab0;outline:1px dashed #205ab044;outline-offset:-1px}[data-ncn-return-block]:focus{outline:2px solid #205ab0;background-color:#edf4ff}}@media print{[data-ncn-return-block]{outline:none!important;background:transparent!important}}';child.head.append(style);
  const target=event=>event.target.closest?.('[data-ncn-return-block]');
  const bindings=[];const listen=(type,fn)=>{child.addEventListener(type,fn);bindings.push([type,fn]);};
  listen('input',event=>{if(!event.isComposing)update(target(event));});
  listen('compositionstart',()=>{composing=true;});
  listen('compositionend',event=>{composing=false;update(target(event));});
  listen('focusout',event=>update(target(event)));
  // Paste only text: imported markup cannot change table geometry, load remote
  // assets or execute handlers inside the same-origin preview frame.
  listen('paste',event=>{
   const node=target(event);if(!node)return;event.preventDefault();
   const selection=child.getSelection();if(!selection?.rangeCount)return;
   const range=selection.getRangeAt(0);if(!node.contains(range.commonAncestorContainer))return;
   const text=child.createTextNode(event.clipboardData?.getData('text/plain')||'');range.deleteContents();range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);update(node);
  });
  listen('drop',event=>{if(target(event))event.preventDefault();});
  listen('click',event=>{if(target(event)&&event.target.closest?.('a'))event.preventDefault();});
  const current=child;unbind=()=>{for(const [type,fn] of bindings)current.removeEventListener(type,fn);};
 }
 layout.prototype=applyReturnsTextDraft(original,edits);
 frame.addEventListener('ncn-frame-rendered',bind);frame.addEventListener('load',bind);
 controller.updatePreview();
 return {destroy(){unbind();frame.removeEventListener('ncn-frame-rendered',bind);frame.removeEventListener('load',bind);panel.remove();}};
}
