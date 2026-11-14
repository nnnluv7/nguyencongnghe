import {escapeHTML} from './core.js';

const storageKey='ncn:delivery-print-draft:v1';
const editSelector='[data-delivery-text]';
const changeLimit=600;
const clean=value=>value.replace(/\s+/g,' ').trim().slice(0,changeLimit);

export function createDeliveryDraft({layout,workspace,frame,selectPaper,updatePreview,doc=document,win=window}){
 const template=doc.createElement('template');
 template.innerHTML=layout.prototype;
 const originals=[];
 const walker=doc.createTreeWalker(template.content,win.NodeFilter.SHOW_TEXT);
 const textNodes=[];
 for(let node=walker.nextNode();node;node=walker.nextNode())textNodes.push(node);
 for(const node of textNodes){
  const original=node.data.trim();
  if(!original||original.includes('{{field:')||node.parentElement?.closest('[aria-hidden=true]'))continue;
  const start=node.data.indexOf(original),marker=doc.createElement('span');
  marker.dataset.deliverySlot=String(originals.push(original)-1);
  node.replaceWith(node.data.slice(0,start),marker,node.data.slice(start+original.length));
 }
 const source=template.innerHTML,changes=new Map();
 const notice=doc.createElement('section');
 notice.className='delivery-draft-tools';
 notice.setAttribute('aria-label','Bản nháp phiếu');
 notice.innerHTML='<div class="delivery-draft-main"><div><strong>Bản nháp nội dung phiếu</strong><p data-draft-help></p></div><div class="delivery-draft-actions"><button type="button" class="st-button st-secondary" data-draft-toggle></button><button type="button" class="st-button" data-draft-copy>Sao chép phần đã sửa</button></div></div><p role="status" data-draft-status></p><textarea rows="6" readonly hidden aria-label="Phần nội dung đã sửa"></textarea>';
 workspace.querySelector('.st-work-top').after(notice);
 const toggle=notice.querySelector('[data-draft-toggle]'),copy=notice.querySelector('[data-draft-copy]');
 const help=notice.querySelector('[data-draft-help]'),status=notice.querySelector('[data-draft-status]'),fallback=notice.querySelector('textarea');
 let editing=true,frameDoc=null;
 function announce(message){status.textContent=message;}
 function renderControls(){
  help.textContent=editing?'Bấm vào chữ có viền xanh trên phiếu để sửa. Chọn A5 để xem chữ lớn hơn.':'Anh đang xem nội dung đã sửa ở khổ giấy đã chọn.';
  toggle.textContent=editing?'Xem bản in':'Sửa tiếp';
  copy.disabled=changes.size===0;
 }
 function save(){
  try{
   const records=[...changes].map(([index,value])=>({index,original:originals[index],value}));
   win.localStorage.setItem(storageKey,JSON.stringify(records));
   announce(changes.size?'Đã lưu nháp trên trình duyệt này.':'Bản nháp đang dùng nội dung gốc.');
  }catch{
   announce('Anh sao chép phần đã sửa trước khi đóng trang để lưu lại.');
  }
  fallback.hidden=true;renderControls();
 }
 try{
  const saved=JSON.parse(win.localStorage.getItem(storageKey)||'[]');
  if(Array.isArray(saved))for(const {index,original,value} of saved.filter(x=>x&&typeof x==='object')){
   if(Number.isInteger(index)&&originals[index]===original&&typeof value==='string'&&clean(value)!==original)changes.set(index,clean(value));
  }
 }catch{}
 if(changes.size)announce('Đã mở lại phần anh lưu trên trình duyệt này.');
 function onInput(event){
  const element=event.target.closest?.(editSelector);
  if(!element)return;
  const index=Number(element.dataset.deliveryText),value=clean(element.innerText);
  if(value===originals[index])changes.delete(index);else changes.set(index,value);
  for(const other of frameDoc.querySelectorAll('[data-delivery-text="'+index+'"]')){
   if(other!==element)other.textContent=value;
  }
  save();
 }
 function beforeInput(event){
  const element=event.target.closest?.(editSelector);
  if(!element)return;
  const selected=frameDoc.getSelection()?.toString().length??0;
  if(['insertParagraph','insertLineBreak'].includes(event.inputType)||event.data&&element.textContent.length-selected+event.data.length>changeLimit)event.preventDefault();
 }
 function paste(event){
  if(!event.target.closest?.(editSelector)||!event.clipboardData)return;
  event.preventDefault();
  const element=event.target.closest(editSelector);
  const selected=frameDoc.getSelection()?.toString().length??0;
  const text=clean(event.clipboardData.getData('text/plain')).slice(0,Math.max(0,changeLimit-element.textContent.length+selected));
  if(text)frameDoc.execCommand('insertText',false,text);
 }
 function stopDrop(event){if(event.target.closest?.(editSelector))event.preventDefault();}
 function bindFrame(){
  frameDoc?.removeEventListener('input',onInput);
  frameDoc?.removeEventListener('beforeinput',beforeInput);
  frameDoc?.removeEventListener('paste',paste);
  frameDoc?.removeEventListener('drop',stopDrop);
  frameDoc=frame.contentDocument;
  frameDoc?.addEventListener('input',onInput);
  frameDoc?.addEventListener('beforeinput',beforeInput);
  frameDoc?.addEventListener('paste',paste);
  frameDoc?.addEventListener('drop',stopDrop);
 }
 frame.addEventListener('load',bindFrame);
 const paperLabel=selectPaper.closest('label'),paperHome=paperLabel.parentElement,paperNext=paperLabel.nextSibling;
 function show(visible){
  notice.hidden=!visible;
  if(visible)notice.querySelector('.delivery-draft-actions').prepend(paperLabel);
  else paperHome.insertBefore(paperLabel,paperNext);
 }
 toggle.addEventListener('click',()=>{editing=!editing;renderControls();updatePreview();});
 copy.addEventListener('click',async()=>{
  const text='BẢO HÀNH · GIAO HÀNG — NỘI DUNG ĐÃ SỬA\n\n'+[...changes].sort((a,b)=>a[0]-b[0]).map(([index,value])=>
   'Mục '+(index+1)+'\nGốc: '+originals[index]+'\nSửa thành: '+(value||'[bỏ dòng này]')
  ).join('\n\n');
  try{
   await win.navigator.clipboard.writeText(text);
   announce('Đã sao chép. Anh dán vào chat và nhắn “Chốt” khi sửa xong.');
  }catch{
   fallback.hidden=false;fallback.value=text;fallback.select();
   announce('Anh sao chép phần đang chọn rồi dán vào chat.');
  }
 });
 renderControls();
 return {
  show,
  render(preview=false){
   const interactive=preview&&editing;
   const prototype=source.replace(/<span data-delivery-slot="(\d+)"><\/span>/g,(_,key)=>{
    const index=Number(key),value=escapeHTML(changes.get(index)??originals[index]).replaceAll('{','&#123;');
    return interactive?'<span data-delivery-text="'+index+'" contenteditable="plaintext-only" spellcheck="false">'+value+'</span>':value;
   });
   const editCSS='\n.delivery-slip{overflow-wrap:anywhere}'+(interactive?'\n@media screen{[data-delivery-text]{outline:1px dashed #5179c4;outline-offset:1px;cursor:text}[data-delivery-text]:focus{outline:2px solid #2755a8;background:#eaf1ff}[data-delivery-text]:empty::before{content:"…";color:#406bb0}}':'');
   return {...layout,prototype,css:layout.css+editCSS};
  },
  destroy(){frame.removeEventListener('load',bindFrame);frameDoc?.removeEventListener('input',onInput);frameDoc?.removeEventListener('beforeinput',beforeInput);frameDoc?.removeEventListener('paste',paste);frameDoc?.removeEventListener('drop',stopDrop);show(false);notice.remove();}
 };
}
