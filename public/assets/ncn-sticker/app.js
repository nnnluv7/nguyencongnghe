import {catalogueCard} from '../ncn-theme/cards.js?v=20261016-easy-2';
import {defaultRow,normalize,normalizeRows,validateForPrint,paginate,renderDocument,parseCSV,importTable,sampleCSV,escapeHTML} from './core.js?v=20261015-direct-1';
import {createDirectEditor} from '../ncn-direct/editor.js?v=20261024-scroll-1';
import {rowsForValidation} from '../ncn-direct/preview.js?v=20261015-direct-1';

export function createStickerApp({app,data,doc=document,win=window,fetcher=fetch}) {
  const $=id=>doc.getElementById(id);
  let model=null,layout=null,rows=[],selected=0,group='thong-tin',paper='A4',counter=0,timer=null,previewIndex=0;
  const drafts=new Map();
  const assetCache=new Map();
  let printing=false;
  const status=(message,error=false)=>{
    const el=$('st-status');el.textContent=message;el.hidden=!message;el.classList.toggle('st-error',error);
  };
  const total=()=>rows.reduce((sum,r)=>sum+Number(r.qty||0),0);
  const safe=fn=>event=>{try{fn(event);}catch(error){status(error.message,true);}};
  const currentRow=()=>rows[selected];
  const scrollTo=el=>{if(typeof el?.scrollIntoView==='function')el.scrollIntoView({behavior:'smooth',block:'start'});};
  const groupName=id=>data.groups.find(g=>g.id===id)?.name||'';

  function showCatalogue() {
    const query=normalize($('st-search').value);
    const matches=data.models.filter(m=>(group==='all'||m.group===group)&&normalize(m.name+' '+groupName(m.group)).includes(query));
    $('st-groups').innerHTML=[{id:'all',name:'Tất cả'},...data.groups].map(g=>`<button type="button" data-group="${g.id}" aria-pressed="${g.id===group}">${escapeHTML(g.name)}</button>`).join('');
    $('st-result-count').textContent=`${matches.length} mẫu${group==='all'?'':' · '+groupName(group)}`;
    $('st-cards').innerHTML=matches.map(m=>catalogueCard(m,data.layouts,model?.id)).join('')||'<p>Không tìm thấy mẫu. Anh thử từ khóa khác.</p>';
  }

  function showRowList() {
    $('st-row-list').innerHTML=rows.map((row,i)=>`<button type="button" data-row="${i}" aria-pressed="${i===selected}">${escapeHTML((row.values[0]||`Nội dung ${i+1}`).slice(0,28))} · ${row.qty} bản</button>`).join('');
    $('st-delete-row').disabled=rows.length<2;
  }

  function showFields() {
    const row=currentRow();if(!row)return;
    showRowList();
    $('st-fields').innerHTML=layout.fields.map((field,i)=>`<label class="st-field" for="st-field-${i}">${escapeHTML(field.label)}${field.required?' *':''}<span class="st-input-pair"><input id="st-field-${i}" type="text" data-field-index="${i}" maxlength="160" value="${escapeHTML(row.values[i])}" placeholder="${escapeHTML(field.example)}" autocomplete="off"><span class="st-scale"><input type="number" min="20" max="200" step="5" data-scale-index="${i}" value="${row.scales[i]}" aria-label="Cỡ chữ ${escapeHTML(field.label)}, phần trăm">%</span></span></label>`).join('');
    $('st-quantity').value=row.qty;
    $('st-static-note').hidden=layout.fields.length>0;
  }

  function scalePreview() { direct.scale(); }

  function updatePreview() {
    if(!layout)return;
    try {
      const checked=normalizeRows(layout,rows);
      const pages=Math.ceil(total()/layout.perPage);
      previewIndex=Math.max(0,Math.min(previewIndex,pages-1));
      $('st-summary').textContent=`${total()} ${layout.staticPage?'tờ mẫu':'sticker'} · ${pages} tờ ${paper}`;
      $('st-preview-size').textContent=`${paper} · ${layout.perPage} ${layout.staticPage?'mẫu':'sticker'}/tờ`;
      const html=renderDocument(layout,checked,{fontCSS:data.fontCSS,paper,preview:true,editable:true,pageIndex:previewIndex,pageLimit:1,title:model.name+' · NCN'});
      direct.render(html,{paperSize:(paper==='A5'?{w:148,h:210}:{w:210,h:297}),pageIndex:previewIndex,pages,editable:layout.fields.length>0});
      scalePreview();
      $('st-preview-note').textContent='Bấm vào chữ để nhập; dùng + để phóng to. Chữ gợi ý ở ô trống không được in.';
      if($('st-status').classList.contains('st-error'))status('');
    }catch(error){status(error.message,true);}
  }

  function saveDraft() {
    if(model&&layout)drafts.set(model.id,{layout:layout.id,rows:structuredClone(rows),selected,previewIndex});
  }

  function setURL() {
    try {
      const url=new URL(win.location.href);url.searchParams.set('mau',model.id);url.searchParams.set('co',String(model.variants.findIndex(v=>v.layout===layout.id)+1));url.searchParams.delete('nhom');
      win.history.replaceState(null,'',url);
    }catch{}
  }

  function chooseModel(id,variantIndex=null,{scroll=true}={}) {
    const chosen=data.models.find(m=>m.id===id);if(!chosen)throw new Error('Mẫu sticker không tồn tại.');
    saveDraft();model=chosen;
    const previous=drafts.get(id);
    layout=data.layouts.find(l=>l.id===(variantIndex!==null?model.variants[variantIndex]?.layout:previous?.layout||model.variants[0].layout));
    if(!layout)layout=data.layouts.find(l=>l.id===model.variants[0].layout);
    if(previous){rows=structuredClone(previous.rows);selected=Math.min(previous.selected,rows.length-1);previewIndex=previous.previewIndex||0;}
    else{rows=[defaultRow(layout,`row-${++counter}`)];selected=0;previewIndex=0;}
    $('st-workspace').hidden=false;
    $('st-model-title').textContent=model.name;
    $('st-model-group').textContent=groupName(model.group);
    $('st-size').innerHTML=model.variants.map(v=>`<option value="${v.layout}">${escapeHTML(v.size)}</option>`).join('');
    $('st-size').value=layout.id;$('st-size').disabled=model.variants.length===1;
    showCatalogue();showFields();updatePreview();setURL();status('');
    if(scroll)scrollTo($('st-workspace'));
  }

  function download(contents,type,name) {
    const blob=new Blob([contents],{type});const url=win.URL.createObjectURL(blob);
    const a=doc.createElement('a');a.href=url;a.download=name;doc.body.append(a);a.click();a.remove();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),30000);
  }

  async function inlineAssets(targetLayout) {
    const paths=new Set((targetLayout.css+'\n'+data.fontCSS).match(/\/assets\/ncn-sticker\/media\/[a-zA-Z0-9.-]+/g)||[]);
    const entries=await Promise.all([...paths].map(async path=>{
      if(!assetCache.has(path))assetCache.set(path,(async()=>{
        const info=data.assets.find(a=>a.path===path);if(!info)throw new Error('Thiếu tài nguyên của mẫu in.');
        const response=await fetcher(path);if(!response.ok)throw new Error('Chưa tải được hình/phông chữ. Anh tải lại trang rồi thử lại.');
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(win.crypto?.subtle){
          const digest=await win.crypto.subtle.digest('SHA-256',bytes);
          const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
          if(hash!==info.sha256)throw new Error('Tài nguyên in chưa đồng bộ. Anh tải lại trang rồi thử lại.');
        }
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        return `data:${info.mime};base64,${win.btoa(binary)}`;
      })().catch(error=>{assetCache.delete(path);throw error;}));
      return [path,await assetCache.get(path)];
    }));
    return Object.fromEntries(entries);
  }

  async function output({print=false}={}) {
    if(printing)return;
    try {
      const printLayout=layout,printModel=model,printPaper=paper;
      direct.flush();
      const checked=normalizeRows(printLayout,rows);
      validateForPrint(printLayout,rowsForValidation(printLayout,checked));
      printing=true;$('st-print').disabled=true;$('st-download').disabled=true;status('Đang chuẩn bị hình và phông chữ cho bản in…');
      const assets=await inlineAssets(printLayout);
      const html=renderDocument(printLayout,checked,{fontCSS:data.fontCSS,paper:printPaper,assets,title:printModel.name+' · nguyencongnghe.com'});
      if(!print){download(html,'text/html;charset=utf-8',`sticker-${printModel.id}-${printPaper.toLowerCase()}.html`);status('Đã tạo tệp in. Anh mở tệp bằng trình duyệt rồi nhấn Ctrl+P.');}
      else {
        const frame=doc.createElement('iframe');frame.title='Bản in sticker';frame.setAttribute('sandbox','allow-same-origin allow-modals');
        Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'800px',height:'1125px',border:'0'});
        const ready=new Promise((resolve,reject)=>{frame.addEventListener('load',resolve,{once:true});win.setTimeout(()=>reject(new Error('Bản in tải chậm. Anh chọn Tải bản in HTML để in bằng Ctrl+P.')),20000);});
        frame.srcdoc=html;doc.body.append(frame);
        try {
          await ready;
          const frameDoc=frame.contentDocument;
          if(frameDoc?.fonts)await frameDoc.fonts.ready;
          await Promise.all(Object.values(assets).filter(x=>x.startsWith('data:image')).map(src=>new Promise(resolve=>{const img=new win.Image();img.onload=resolve;img.onerror=resolve;img.src=src;})));
          frame.contentWindow.focus();frame.contentWindow.print();
          status('Chọn đúng khổ giấy, lề Không, tỷ lệ 100% và bật Đồ họa nền trong hộp thoại in.');
        }finally{win.setTimeout(()=>frame.remove(),60000);}
      }
    }catch(error){status(error.message,true);}
    finally{printing=false;$('st-print').disabled=false;$('st-download').disabled=false;}
  }

  const direct=createDirectEditor({app,frame:$('st-preview'),stage:$('st-preview-stage'),doc,win,
    getState:()=>({layout,rows,paper,previewIndex}),
    onChange:(next,index)=>{win.clearTimeout(timer);rows=normalizeRows(layout,next);selected=index;showFields();},
    onSelect:index=>{win.clearTimeout(timer);selected=index;showFields();},
    onPage:index=>{previewIndex=index;updatePreview();},onPrint:()=>output({print:true}),onError:message=>status(message,true)
  });
  $('st-groups').addEventListener('click',safe(event=>{const button=event.target.closest('[data-group]');if(button){group=button.dataset.group;showCatalogue();}}));
  $('st-search').addEventListener('input',showCatalogue);
  $('st-cards').addEventListener('click',safe(event=>{const button=event.target.closest('[data-model]');if(button)chooseModel(button.dataset.model,button.dataset.variant===undefined?null:Number(button.dataset.variant));}));
  $('st-row-list').addEventListener('click',safe(event=>{const button=event.target.closest('[data-row]');if(button){selected=Number(button.dataset.row);previewIndex=Math.floor(rows.slice(0,selected).reduce((n,r)=>n+Number(r.qty),0)/layout.perPage);showFields();updatePreview();}}));
  $('st-fields').addEventListener('input',safe(event=>{
    const input=event.target;
    if(input.dataset.fieldIndex!==undefined)currentRow().values[Number(input.dataset.fieldIndex)]=input.value;
    if(input.dataset.scaleIndex!==undefined)currentRow().scales[Number(input.dataset.scaleIndex)]=Number(input.value);
    showRowList();win.clearTimeout(timer);timer=win.setTimeout(updatePreview,140);
  }));
  $('st-quantity').addEventListener('input',safe(()=>{currentRow().qty=Number($('st-quantity').value);showRowList();updatePreview();}));
  $('st-size').addEventListener('change',safe(()=>{layout=data.layouts.find(l=>l.id===$('st-size').value);showFields();updatePreview();setURL();}));
  $('st-paper').addEventListener('change',safe(()=>{paper=$('st-paper').value;updatePreview();}));
  $('st-add-row').addEventListener('click',safe(()=>{const row=defaultRow(layout,`row-${++counter}`);row.qty=1;rows.push(row);selected=rows.length-1;previewIndex=Math.floor((total()-1)/layout.perPage);showFields();updatePreview();}));
  $('st-duplicate').addEventListener('click',safe(()=>{rows.push({...structuredClone(currentRow()),id:`row-${++counter}`});selected=rows.length-1;previewIndex=Math.floor((total()-Number(currentRow().qty))/layout.perPage);showFields();updatePreview();}));
  $('st-delete-row').addEventListener('click',safe(()=>{if(rows.length>1){rows.splice(selected,1);selected=Math.max(0,selected-1);showFields();updatePreview();}}));
  $('st-change-model').addEventListener('click',()=>scrollTo($('st-groups')));
  $('st-sample').addEventListener('click',safe(()=>download(sampleCSV(layout),'text/csv;charset=utf-8',`mau-${model.id}.csv`)));
  $('st-print').addEventListener('click',()=>output({print:true}));
  $('st-download').addEventListener('click',()=>output());
  $('st-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      const importLayout=layout;
      if(file.size>8*1024*1024)throw new Error('Tệp tối đa 8 MB.');
      let table;
      if(/\.(xlsx|xls)$/i.test(file.name)){
        if(!win.XLSX)throw new Error('Chưa có trình đọc Excel. Anh lưu tệp thành CSV rồi nhập lại.');
        const workbook=win.XLSX.read(await file.arrayBuffer(),{type:'array'});
        table=win.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,defval:'',raw:false});
      }else {
        const text=await file.text();
        table=/\.tsv$/i.test(file.name)?text.replace(/^\ufeff/,'').split(/\r?\n/).filter(line=>line.trim()).map(line=>line.split('\t')):parseCSV(text);
      }
      const imported=importTable(importLayout,table);
      if(layout.id!==importLayout.id)throw new Error('Anh đã đổi mẫu trong lúc đọc tệp. Anh chọn lại tệp cho mẫu đang dùng.');
      rows=imported;selected=0;previewIndex=0;showFields();updatePreview();status(`Đã nhập ${rows.length} nội dung. Anh kiểm tra xem trước trước khi in.`);
    }catch(error){status(error.message,true);}finally{event.target.value='';}
  });
  if(win.ResizeObserver)new win.ResizeObserver(scalePreview).observe($('st-preview-stage'));
  else win.addEventListener('resize',scalePreview);
  const initialURL=new URL(win.location.href);
  const initialGroup=initialURL.searchParams.get('nhom');
  if(data.groups.some(g=>g.id===initialGroup)||initialGroup==='all')group=initialGroup;
  const initialModel=initialURL.searchParams.get('mau');
  const initialVariant=Number(initialURL.searchParams.get('co')||1)-1;
  showCatalogue();
  if(initialModel&&data.models.some(m=>m.id===initialModel)){
    group=data.models.find(m=>m.id===initialModel).group;
    chooseModel(initialModel,initialVariant,{scroll:false});
  }
  app.dataset.ready='true';
  return {chooseModel,updatePreview,output,direct,destroy:()=>{direct.destroy();win.clearTimeout(timer);},getState:()=>({model,layout,rows,selected,group,paper,previewIndex}),setRows:next=>{rows=normalizeRows(layout,next);selected=0;previewIndex=0;showFields();updatePreview();}};
}

if(typeof document!=='undefined'&&document.getElementById('ncn-sticker-app')) {
  const app=document.getElementById('ncn-sticker-app');
  fetch('/assets/ncn-sticker/catalogue.json?v=20261014-1').then(response=>{
    if(!response.ok)throw new Error('Chưa tải được bộ mẫu sticker.');return response.json();
  }).then(data=>createStickerApp({app,data})).catch(error=>{
    const status=document.getElementById('st-status');status.hidden=false;status.classList.add('st-error');status.textContent=error.message+' Anh nhấn Ctrl+Shift+R để tải lại trang.';
  });
}
