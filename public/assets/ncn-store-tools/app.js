import {catalogueCard} from '../ncn-theme/cards.js?v=20261016-easy-2';
import {defaultRow,normalize,escapeHTML,normalizeRows,validateForPrint,paginate,paperSize,renderDocument,parseCSV,sampleCSV,importTable} from './core.js?v=20261015-direct-1';
import {createDirectEditor} from '../ncn-direct/editor.js?v=20261024-selection-1';
import {rowsForValidation} from '../ncn-direct/preview.js?v=20261015-direct-1';
export function createStoreApp({app,data,doc=document,win=window,fetcher=fetch}) {
 const $=id=>doc.getElementById(id),section=app.dataset.section||'sales',models=data.models.filter(m=>m.section===section),groups=data.groups.filter(g=>models.some(m=>m.group===g.id));
 let model=null,layout=null,rows=[],selected=0,group='all',paper='A4',counter=0,previewIndex=0,printing=false,timer=null;
 const drafts=new Map(),assetCache=new Map(),listeners=[];
 const listen=(node,event,fn,options)=>{node?.addEventListener(event,fn,options);listeners.push(()=>node?.removeEventListener(event,fn,options));};
 const status=(message,error=false)=>{const el=$('nt-status');el.textContent=message;el.hidden=!message;el.classList.toggle('st-error',error);};
 const safe=fn=>event=>{try{fn(event);}catch(error){status(error.message,true);}},scrollTo=node=>node?.scrollIntoView?.({behavior:'smooth',block:'start'}),selectedRow=()=>rows[selected],total=()=>rows.reduce((n,r)=>n+Number(r.qty||0),0),groupName=id=>groups.find(g=>g.id===id)?.name||'';
 function showCatalogue() {
  const query=normalize($('nt-search').value),matches=models.filter(m=>(group==='all'||m.group===group)&&normalize(m.name+' '+groupName(m.group)).includes(query));
  $('nt-groups').innerHTML=[{id:'all',name:'Tất cả'},...groups].map(g=>`<button type="button" data-group="${escapeHTML(g.id)}" aria-pressed="${g.id===group}">${escapeHTML(g.name)}</button>`).join('');
  $('nt-result-count').textContent=`${matches.length} / ${models.length} mẫu`;
  $('nt-cards').innerHTML=matches.map(m=>catalogueCard(m,data.layouts,model?.id)).join('')||'<p>Không tìm thấy mẫu. Anh thử từ khóa khác.</p>';
 }
 function showFields() {
  const row=selectedRow();if(!row)return;
  $('nt-row-list').innerHTML=rows.map((r,i)=>`<button type="button" data-row="${i}" aria-pressed="${i===selected}">${escapeHTML((r.values.find((v,j)=>layout.fields[j]?.type!=='checkbox'&&v)||`Nội dung ${i+1}`).slice(0,26))} · ${r.qty} bản</button>`).join('');
  $('nt-fields').innerHTML=layout.fields.map((f,i)=>f.type==='checkbox'?`<label class="nt-check"><input type="checkbox" data-field-index="${i}"${row.values[i]?' checked':''}>${escapeHTML(f.label)}</label>`:`<label class="st-field" for="nt-field-${i}">${escapeHTML(f.label)}${f.required?' *':''}<span class="st-input-pair"><input id="nt-field-${i}" type="text" maxlength="${f.maxLength||320}" value="${escapeHTML(row.values[i])}" data-field-index="${i}" placeholder="${escapeHTML(f.example||'')}" autocomplete="off"><span class="st-scale"><input type="number" min="20" max="200" step="5" value="${row.scales[i]}" data-scale-index="${i}" aria-label="Cỡ chữ ${escapeHTML(f.label)}, phần trăm">%</span></span></label>`).join('');
  $('nt-static-note').hidden=layout.fields.length>0;$('nt-quantity').value=row.qty;$('nt-delete-row').disabled=rows.length<2;$('nt-outline-control').hidden=!layout.outlineTextSupported;$('nt-outline').checked=Boolean(row.outline);$('nt-import-actions').hidden=layout.fields.length===0;$('nt-letter-control').hidden=!model.letters;
  if(model.letters){$('nt-letter-text').value=row.values.join('');$('nt-letter-text').maxLength=layout.fields.length;}
 }
 function scalePreview() { direct.scale(); }

 function updatePreview() {
  if(!layout)return;try{
   const checked=normalizeRows(layout,rows),count=paginate(layout,checked).length;previewIndex=Math.max(0,Math.min(previewIndex,count-1));
   const html=renderDocument(layout,checked,{fontCSS:data.fontCSS,paper,preview:true,editable:true,pageIndex:previewIndex,pageLimit:1,assets:win.NCN_STORE_PREVIEW_ASSETS||{},title:model.name+' · NCN'});direct.render(html,{paperSize:paperSize(layout,paper),pageIndex:previewIndex,pages:count,editable:layout.fields.length>0});
   $('nt-summary').textContent=`${total()} ${layout.perPage===1?'tờ mẫu':'bản'} · ${count} tờ ${paper}`;$('nt-preview-size').textContent=`Tờ ${previewIndex+1}/${count} · ${paper}`;$('nt-prev').disabled=previewIndex===0;$('nt-next').disabled=previewIndex>=count-1;scalePreview();if($('nt-status').classList.contains('st-error'))status('');
  }catch(error){status(error.message,true);}
 }
 function chooseModel(id,{scroll=true}={}) {
  const chosen=models.find(m=>m.id===id);if(!chosen)throw new Error('Mẫu không tồn tại ở trang này.');if(model)drafts.set(model.id,{rows:structuredClone(rows),selected,paper,previewIndex});
  model=chosen;layout=data.layouts.find(l=>l.id===model.variants[0].layout);if(!layout)throw new Error('Thiếu bố cục in của mẫu.');const previous=drafts.get(model.id);
  rows=previous?structuredClone(previous.rows):[defaultRow(layout,`row-${++counter}`)];selected=previous?.selected||0;paper=previous?.paper||layout.defaultPaper||'A4';previewIndex=previous?.previewIndex||0;
  $('nt-paper').value=paper;$('nt-model-title').textContent=model.name;$('nt-model-group').textContent=groupName(model.group);$('nt-workspace').hidden=false;showFields();showCatalogue();updatePreview();status('');
  try{const url=new URL(win.location.href);url.searchParams.set('mau',model.id);win.history.replaceState(null,'',url);}catch{}direct.open({scroll});
 }
 function download(contents,type,name) {
  const blob=new win.Blob([contents],{type}),url=win.URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;doc.body.append(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),30000);
 }
 async function inlineAssets(targetLayout) {
  const paths=new Set((targetLayout.css+targetLayout.prototype+data.fontCSS).match(/\/assets\/ncn-store-tools\/[a-zA-Z0-9/_.-]+/g)||[]);
  return Object.fromEntries(await Promise.all([...paths].map(async path=>{
   if(!assetCache.has(path))assetCache.set(path,(async()=>{
    const info=data.assets.find(a=>a.path===path);if(!info)throw new Error('Thiếu hình hoặc phông chữ của mẫu.');const response=await fetcher(path);if(!response.ok)throw new Error('Chưa tải được hình/phông chữ. Anh tải lại trang rồi thử lại.');const bytes=new Uint8Array(await response.arrayBuffer());
    if(win.crypto?.subtle){const digest=await win.crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==info.sha256)throw new Error('Tài nguyên in chưa đồng bộ. Anh tải lại trang rồi thử lại.');}
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return `data:${info.mime};base64,${win.btoa(binary)}`;
   })().catch(error=>{assetCache.delete(path);throw error;}));return [path,await assetCache.get(path)];
  })));
 }
 async function output({print=false}={}) {
  if(printing)return;try{
   if(!layout)throw new Error('Anh chọn một mẫu trước khi in.');direct.flush();const printLayout=layout,printModel=model,printPaper=paper,checked=normalizeRows(layout,rows);validateForPrint(layout,rowsForValidation(layout,checked));
   printing=true;$('nt-print').disabled=true;$('nt-download').disabled=true;status('Đang chuẩn bị hình và phông chữ cho bản in…');const assets=await inlineAssets(printLayout),html=renderDocument(printLayout,checked,{paper:printPaper,fontCSS:data.fontCSS,assets,title:printModel.name+' · nguyencongnghe.com'});
   if(!print){download(html,'text/html;charset=utf-8',`ncn-${printModel.id}-${printPaper.toLowerCase()}.html`);status('Đã tạo tệp in kèm hình và phông chữ. Mở bằng trình duyệt rồi nhấn Ctrl+P.');}
   else{
    const frame=doc.createElement('iframe');frame.title='Bản in NCN';frame.setAttribute('sandbox','allow-same-origin allow-modals');Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'800px',height:'1125px',border:'0'});
    let timeout;const ready=new Promise((resolve,reject)=>{frame.addEventListener('load',()=>{win.clearTimeout(timeout);resolve();},{once:true});timeout=win.setTimeout(()=>reject(new Error('Bản in tải chậm. Anh dùng Tải bản in HTML để mở và in.')),20000);});frame.srcdoc=html;doc.body.append(frame);
    try{await ready;if(frame.contentDocument.fonts)await frame.contentDocument.fonts.ready;await Promise.all([...frame.contentDocument.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));frame.contentWindow.focus();frame.contentWindow.print();status('Chọn đúng khổ giấy, lề Không, tỷ lệ 100% và bật Đồ họa nền.');}finally{win.clearTimeout(timeout);win.setTimeout(()=>frame.remove(),60000);}
   }return html;
  }catch(error){status(error.message,true);return null;}finally{printing=false;$('nt-print').disabled=false;$('nt-download').disabled=false;}
 }
 const direct=createDirectEditor({app,frame:$('nt-preview'),stage:$('nt-preview-stage'),doc,win,
  getState:()=>({layout,rows,paper,previewIndex}),
  onChange:(next,index)=>{win.clearTimeout(timer);rows=normalizeRows(layout,next);selected=index;showFields();},
  onSelect:index=>{win.clearTimeout(timer);selected=index;showFields();},
  onPage:index=>{previewIndex=index;updatePreview();},onPrint:()=>output({print:true}),onError:message=>status(message,true)
 });
 listen($('nt-groups'),'click',safe(e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;showCatalogue();}}));listen($('nt-search'),'input',showCatalogue);listen($('nt-cards'),'click',safe(e=>{const b=e.target.closest('[data-model]');if(b)chooseModel(b.dataset.model);}));listen($('nt-change-model'),'click',()=>scrollTo($('nt-cards')));
 listen($('nt-row-list'),'click',safe(e=>{const b=e.target.closest('[data-row]');if(b){selected=Number(b.dataset.row);previewIndex=Math.floor(rows.slice(0,selected).reduce((n,r)=>n+Number(r.qty),0)/layout.perPage);showFields();updatePreview();}}));
 listen($('nt-fields'),'input',safe(e=>{const input=e.target;if(input.dataset.fieldIndex!==undefined){const i=Number(input.dataset.fieldIndex);selectedRow().values[i]=input.type==='checkbox'?(input.checked?'1':''):input.value;}else if(input.dataset.scaleIndex!==undefined)selectedRow().scales[Number(input.dataset.scaleIndex)]=Number(input.value);if(model.letters)$('nt-letter-text').value=selectedRow().values.join('');win.clearTimeout(timer);timer=win.setTimeout(updatePreview,100);}));
 listen($('nt-letter-text'),'input',safe(e=>{const letters=Array.from(e.target.value.normalize('NFC'));selectedRow().values=layout.fields.map((f,i)=>letters[i]||'');showFields();updatePreview();}));listen($('nt-outline'),'change',safe(e=>{selectedRow().outline=e.target.checked;updatePreview();}));listen($('nt-quantity'),'input',safe(e=>{selectedRow().qty=Number(e.target.value);updatePreview();}));listen($('nt-paper'),'change',safe(e=>{paper=e.target.value;updatePreview();}));
 listen($('nt-add-row'),'click',safe(()=>{const row=defaultRow(layout,`row-${++counter}`);row.qty=1;rows.push(row);selected=rows.length-1;previewIndex=Math.floor((total()-1)/layout.perPage);showFields();updatePreview();}));listen($('nt-duplicate'),'click',safe(()=>{rows.push({...structuredClone(selectedRow()),id:`row-${++counter}`});selected=rows.length-1;previewIndex=Math.floor((total()-Number(selectedRow().qty))/layout.perPage);showFields();updatePreview();}));listen($('nt-delete-row'),'click',safe(()=>{if(rows.length>1){rows.splice(selected,1);selected=Math.min(selected,rows.length-1);showFields();updatePreview();}}));
 listen($('nt-prev'),'click',()=>{previewIndex--;updatePreview();});listen($('nt-next'),'click',()=>{previewIndex++;updatePreview();});listen($('nt-sample'),'click',safe(()=>download(sampleCSV(layout),'text/csv;charset=utf-8',`mau-${model.id}.csv`)));listen($('nt-print'),'click',()=>output({print:true}));listen($('nt-download'),'click',()=>output());
 listen($('ncn-page-print'),'click',e=>{e.preventDefault();e.stopImmediatePropagation();output({print:true});},true);listen(win,'keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'&&model){e.preventDefault();output({print:true});}});
 listen($('nt-file'),'change',async e=>{const file=e.target.files?.[0];if(!file||!layout)return;try{
  if(file.size>8*1024*1024)throw new Error('Tệp tối đa 8 MB.');const current=layout;let table;
  if(/\.(xlsx|xls)$/i.test(file.name)){if(!win.XLSX)throw new Error('Anh lưu tệp thành CSV rồi nhập lại.');const book=win.XLSX.read(await file.arrayBuffer(),{type:'array'});table=win.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});}else table=/\.tsv$/i.test(file.name)?(await file.text()).replace(/^\ufeff/,'').split(/\r?\n/).filter(x=>x.trim()).map(x=>x.split('\t')):parseCSV(await file.text());
  const next=importTable(current,table);if(layout!==current)throw new Error('Anh đã đổi mẫu khi tệp đang được đọc. Chọn lại tệp cho mẫu hiện tại.');rows=next;selected=0;previewIndex=0;showFields();updatePreview();status(`Đã nhập ${rows.length} nội dung.`);
 }catch(error){status(error.message,true);}finally{e.target.value='';}});
 const observer=win.ResizeObserver?new win.ResizeObserver(scalePreview):null;if(observer)observer.observe($('nt-preview-stage'));else listen(win,'resize',scalePreview);
 showCatalogue();const initial=new URL(win.location.href).searchParams.get('mau');if(initial&&models.some(m=>m.id===initial))chooseModel(initial,{scroll:false});app.dataset.ready='true';
 return {chooseModel,updatePreview,output,direct,getState:()=>({model,layout,rows,selected,group,paper,previewIndex}),setRows:next=>{rows=normalizeRows(layout,next);selected=0;previewIndex=0;showFields();updatePreview();},destroy:()=>{direct.destroy();listeners.forEach(fn=>fn());observer?.disconnect();win.clearTimeout(timer);}};
}
if(typeof document!=='undefined'&&document.getElementById('ncn-store-app')&&!window.NCN_STORE_TEST){const app=document.getElementById('ncn-store-app');fetch('/assets/ncn-store-tools/catalogue.json?v=20261015-store-1').then(r=>{if(!r.ok)throw new Error('Chưa tải được danh mục mẫu.');return r.json();}).then(data=>createStoreApp({app,data})).catch(error=>{const s=document.getElementById('nt-status');s.hidden=false;s.classList.add('st-error');s.textContent=error.message+' Anh tải lại trang bằng Cmd+Shift+R hoặc Ctrl+Shift+R.';});}
