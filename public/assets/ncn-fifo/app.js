import {COUNT,ROWS,STORAGE_KEY,PAPERS,createState,readState,blankRows,today,validDate,record,geometryError,hasInput,resolveRows,printPlan,nextSlot,addScan,delimitedRows,recordsFromRows,applyRecords,templateData,applyTemplate,sheetHTML} from './core.js';
import {loadSpreadsheet} from '../ncn-tool-resources.js';

const $=id=>document.getElementById(id),app=$('ncn-fifo-app');
if(app){
  let state=createState(),storage=true,cursor=0,saveTimer,undo=null,pending=null,importToken=0,importBusy=false,geometryInvalid='',dateInvalid='';
  try{state=readState(localStorage.getItem(STORAGE_KEY))||state;}catch{storage=false;}
  const rowNodes=Array.from({length:COUNT},(_,i)=>({color:$('fifo-color-'+i),imei:$('fifo-imei-'+i),check:$('fifo-enabled-'+i),row:$('fifo-row-'+i)}));
  const booleanFields=['showDate','showColor','showIMEI','onlyFilled'];
  const control={showDate:'fifo-show-date',showColor:'fifo-show-color',showIMEI:'fifo-show-imei',onlyFilled:'fifo-only-filled'};
  const canvas=document.createElement('canvas'),measure=canvas.getContext('2d');
  const status=(message,error=false)=>{const node=$('fifo-status');node.textContent=message;node.dataset.error=String(error);};
  function save(){
    clearTimeout(saveTimer);if(geometryInvalid||dateInvalid)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storage=true;}catch{storage=false;}
    $('fifo-save-note').textContent=storage?'Nháp được nhớ trên trình duyệt này.':'Trình duyệt chưa lưu được nháp. Vẫn có thể nhập và in.';
  }
  const changed=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(save,180);render();};
  function remember(){undo=JSON.stringify(state);$('fifo-undo').hidden=false;}
  function sync(){
    $('fifo-date').value=state.date;$('fifo-today').setAttribute('aria-pressed',String(state.autoDate));
    $('fifo-date-format').value=state.dateFormat;$('fifo-imei-digits').value=String(state.imeiDigits);$('fifo-quick-color').value=state.quickColor;
    booleanFields.forEach(k=>$(control[k]).checked=state[k]);
    for(const k of ['paper','left','top','pitchX','pitchY'])$('fifo-'+k).value=state.geometry[k];
    rowNodes.forEach((nodes,i)=>{nodes.color.value=state.rows[i].color;nodes.imei.value=state.rows[i].imei;});
    geometryInvalid='';dateInvalid='';
  }
  function typography(plan){
    const sizes=[],available=(Math.min(23,state.geometry.pitchX)-2)*96/25.4;let warning='';
    for(const row of plan){
      const result={};
      for(const [field,points,family]of [['date',14,'Impact, "Arial Narrow", Arial'],['color',9,'Arial'],['imei',10,'Tahoma, Arial']]){
        const value=row[field];if(!measure||!value){result[field]=points;continue;}
        measure.font='bold '+points*96/72+'px '+family;
        const natural=measure.measureText(value).width,fit=Math.min(points,points*available/Math.max(1,natural));
        if(fit<6&&!warning)warning='Nội dung ở vị trí '+row.position+' quá dài. Viết gọn màu / dung lượng hoặc chọn 4 số cuối IMEI.';
        result[field]=Math.max(6,fit);
      }sizes.push(result);
    }return {sizes,warning};
  }
  function fitPreview(){
    const width=PAPERS[state.geometry.paper].width*96/25.4,height=Math.min(PAPERS[state.geometry.paper].height,state.geometry.top+ROWS*state.geometry.pitchY+4)*96/25.4;
    const available=$('fifo-preview-viewport').clientWidth-24,scale=Math.min(1,Math.max(.1,available/width));
    $('fifo-preview-frame').style.width=width*scale+'px';$('fifo-preview-frame').style.height=height*scale+'px';
    $('fifo-preview-sheet').style.transform='scale('+scale+')';
    $('fifo-preview-sheet').style.setProperty('--fifo-slot-font',8/scale+'px');
  }
  function render(){
    const plan=printPlan(state),printed=plan.filter(row=>row.printed).length,selected=state.enabled.filter(Boolean).length,filled=state.rows.filter(hasInput).length,resolved=resolveRows(state.rows);
    let inputError='';for(let i=0;i<COUNT&&!inputError;i++)try{record(state.rows[i]);}catch(error){inputError='Vị trí '+(i+1)+': '+error.message;}
    const {sizes,warning}=typography(plan),problem=geometryInvalid||dateInvalid||(state.showDate&&!validDate(state.date)?'Chọn ngày in hợp lệ.':'')||geometryError(state.geometry)||inputError||warning;
    const g=state.geometry,paper=PAPERS[g.paper];
    for(const [id,preview]of [['fifo-preview-sheet',true],['printMe',false]]){
      const sheet=$(id);sheet.innerHTML='<div class="fifo-grid">'+sheetHTML(state,{preview})+'</div>';
      for(const [key,value]of [['width',paper.width],['height',paper.height],['left',g.left],['top',g.top],['pitch-x',g.pitchX],['pitch-y',g.pitchY]])sheet.style.setProperty('--fifo-'+key,value+'mm');
      sheet.querySelectorAll('.fifo-label').forEach((node,i)=>{for(const field of ['date','color','imei'])node.querySelector('.fifo-label-'+field).style.fontSize=sizes[i][field]+'pt';});
    }
    $('fifo-page-style').textContent='@page{size:'+paper.width+'mm '+paper.height+'mm;margin:0}';
    $('fifo-print-root').style.setProperty('--fifo-width',paper.width+'mm');$('fifo-print-root').style.setProperty('--fifo-height',paper.height+'mm');
    rowNodes.forEach((nodes,i)=>{
      nodes.check.checked=state.enabled[i];nodes.row.dataset.enabled=String(state.enabled[i]);nodes.row.dataset.printed=String(plan[i].printed);
      nodes.color.placeholder=state.rows[i].color?'Màu / dung lượng':resolved[i].color||'Dùng màu dòng trên';
    });
    const next=nextSlot(state,cursor);$('fifo-next-slot').textContent=next<0?'Đã đủ IMEI ở các vị trí đang chọn':'Nhập tiếp vị trí '+(next+1);
    $('fifo-selected-count').textContent=selected+' / 48 vị trí';$('fifo-data-count').textContent=filled+' dòng đã nhập';
    $('fifo-preview-note').textContent=paper.label+' · '+printed+' tem sẽ in';
    $('fifo-imei-caption').textContent=state.imeiDigits?state.imeiDigits+' số cuối IMEI':'Toàn bộ IMEI / serial';
    for(const id of ['fifo-print','fifo-print-review']){$(id).textContent=printed?'In '+printed+' tem':'In tem';$(id).disabled=!!problem||printed===0;}
    $('fifo-print-error').textContent=problem||(!printed?'Chọn vị trí và nhập nội dung để in.':'');$('fifo-print-error').hidden=!problem&&printed>0;
    $('fifo-empty-note').hidden=printed>0;
    $('fifo-save-note').textContent=storage?'Nháp được nhớ trên trình duyệt này.':'Trình duyệt chưa lưu được nháp. Vẫn có thể nhập và in.';
    fitPreview();app.dataset.ready='true';
  }
  function scan(event){
    event.preventDefault();
    try{
      const result=addScan(state,$('fifo-scan').value,cursor);state=result.state;cursor=(result.index+1)%COUNT;
      rowNodes[result.index].color.value=state.rows[result.index].color;rowNodes[result.index].imei.value=state.rows[result.index].imei;
      $('fifo-scan').value='';changed();status('Đã thêm vị trí '+(result.index+1)+(result.duplicate>=0?' · IMEI này cũng có ở vị trí '+(result.duplicate+1):''));$('fifo-scan').focus({preventScroll:true});
      const scroller=$('fifo-table-scroll'),row=rowNodes[result.index].row;
      const top=row.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
      if(top+row.offsetHeight>scroller.scrollTop+scroller.clientHeight)scroller.scrollTop=top+row.offsetHeight-scroller.clientHeight;
      else if(top<scroller.scrollTop+40)scroller.scrollTop=Math.max(0,top-40);
    }catch(error){status(error.message,true);$('fifo-scan').focus({preventScroll:true});}
  }
  $('fifo-scan-form').addEventListener('submit',scan);
  $('fifo-quick-color').addEventListener('input',event=>{state.quickColor=event.target.value;changed();});
  $('fifo-date').addEventListener('change',event=>{
    state.date=event.target.value;state.autoDate=false;dateInvalid=validDate(state.date)?'':'Chọn ngày in hợp lệ.';$('fifo-today').setAttribute('aria-pressed','false');changed();
  });
  $('fifo-today').addEventListener('click',()=>{state.date=today();state.autoDate=true;dateInvalid='';$('fifo-date').value=state.date;$('fifo-today').setAttribute('aria-pressed','true');changed();});
  for(const [id,key,parse]of [['fifo-date-format','dateFormat',String],['fifo-imei-digits','imeiDigits',Number]])$(id).addEventListener('change',event=>{state[key]=parse(event.target.value);changed();});
  booleanFields.forEach(key=>$(control[key]).addEventListener('change',event=>{state[key]=event.target.checked;changed();}));
  function toggle(index){state.enabled[index]=!state.enabled[index];cursor=0;changed();}
  $('fifo-preview-sheet').addEventListener('click',event=>{const button=event.target.closest('button[data-position]');if(button){const index=Number(button.dataset.position)-1;toggle(index);$('fifo-position-'+index)?.focus({preventScroll:true});}});
  rowNodes.forEach((nodes,i)=>{
    nodes.check.addEventListener('change',event=>{state.enabled[i]=event.target.checked;cursor=0;changed();});
    for(const key of ['color','imei']){
      nodes[key].addEventListener('input',event=>{state.rows[i][key]=event.target.value;changed();});
      nodes[key].addEventListener('keydown',event=>{if(event.key!=='Enter'||event.isComposing)return;event.preventDefault();cursor=(i+1)%COUNT;const next=nextSlot(state,cursor);if(next>=0)rowNodes[next][key].focus();else status('Đã đến cuối danh sách đang chọn.');});
    }
  });
  for(const [id,fn]of [['fifo-select-all',()=>Array(COUNT).fill(true)],['fifo-select-none',()=>Array(COUNT).fill(false)],['fifo-select-data',()=>state.rows.map(hasInput)]])$(id).addEventListener('click',()=>{state.enabled=fn();cursor=0;changed();});
  $('fifo-paper').addEventListener('change',event=>{
    const paper=event.target.value;state.geometry=paper==='A5'?{paper,left:3.97,top:3,pitchX:24.34,pitchY:23.4}:{paper,left:3.97,top:7.97,pitchX:24.34,pitchY:26.81};sync();changed();
  });
  for(const key of ['left','top','pitchX','pitchY'])$('fifo-'+key).addEventListener('input',()=>{
    const candidate={paper:state.geometry.paper,...Object.fromEntries(['left','top','pitchX','pitchY'].map(k=>[k,parseFloat($('fifo-'+k).value)]))};
    geometryInvalid=geometryError(candidate);if(!geometryInvalid)state.geometry=candidate;changed();
  });
  $('fifo-reset-alignment').addEventListener('click',()=>{state.geometry=state.geometry.paper==='A5'?{paper:'A5',left:3.97,top:3,pitchX:24.34,pitchY:23.4}:{paper:'A4',left:3.97,top:7.97,pitchX:24.34,pitchY:26.81};sync();changed();});
  $('fifo-clear').addEventListener('click',()=>{remember();state.rows=blankRows();state.quickColor='';cursor=0;$('fifo-scan').value='';sync();changed();status('Đã xoá nội dung. Bấm Hoàn tác nếu cần lấy lại.');});
  $('fifo-undo').addEventListener('click',()=>{if(!undo)return;state=JSON.parse(undo);undo=null;$('fifo-undo').hidden=true;sync();changed();status('Đã lấy lại nội dung trước đó.');});
  for(const id of ['fifo-print','fifo-print-review'])$(id).addEventListener('click',()=>{if($(id).disabled)return;save();window.print();});
  window.addEventListener('beforeprint',()=>{if(state.autoDate){state.date=today();$('fifo-date').value=state.date;}render();});
  window.addEventListener('pagehide',save);
  const refreshDate=()=>{if(state.autoDate&&state.date!==today()){state.date=today();$('fifo-date').value=state.date;changed();}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshDate();});setInterval(refreshDate,60000);
  new ResizeObserver(fitPreview).observe($('fifo-preview-viewport'));

  const dialog=$('fifo-import-dialog'),importStatus=(message,error=false)=>{const node=$('fifo-import-status');node.textContent=message;node.dataset.error=String(error);};
  function resetImport(){importToken++;pending=null;importBusy=false;$('fifo-file').value='';$('fifo-paste').value='';$('fifo-apply-import').disabled=false;importStatus('Dán danh sách hoặc chọn một file.');}
  $('fifo-import-open').addEventListener('click',()=>{resetImport();dialog.showModal();});
  $('fifo-import-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{importToken++;importBusy=false;});
  $('fifo-paste').addEventListener('input',()=>{importToken++;pending=null;importBusy=false;$('fifo-file').value='';$('fifo-apply-import').disabled=false;importStatus('Danh sách sẽ đi lần lượt vào các vị trí đang chọn.');});
  $('fifo-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;const token=++importToken;pending=null;importBusy=true;$('fifo-paste').value='';$('fifo-apply-import').disabled=true;importStatus('Đang đọc file…');let candidate=null;
    try{
      if(file.size>5*1024*1024)throw Error('Chọn file nhỏ hơn 5 MB.');
      if(/\.(?:csv|tsv|txt)$/i.test(file.name))candidate={kind:'rows',records:recordsFromRows(delimitedRows(await file.text()))};
      else if(/\.(?:xlsx|xlsm|xls)$/i.test(file.name)){
        const XLSX=await loadSpreadsheet();if(token!==importToken||!dialog.open)return;
        const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellText:true,cellDates:false});
        candidate=templateData(wb);
        if(!candidate){const sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet)throw Error('File không có bảng dữ liệu.');candidate={kind:'rows',records:recordsFromRows(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''}))};}
      }else throw Error('Chọn Excel (.xlsx, .xlsm, .xls), CSV hoặc TSV.');
      if(token!==importToken||!dialog.open)return;
      pending=candidate;
      if(pending.kind==='template'){
        $('fifo-import-mode').value='replace';
        importStatus('Đã đọc mẫu 48 tem: '+pending.rows.filter(hasInput).length+' dòng, '+pending.enabled.filter(Boolean).length+' vị trí được đánh dấu. Áp dụng sẽ thay nội dung, ngày và vị trí theo file.');
      }else importStatus('Đã đọc '+pending.records.length+' dòng. Kiểm tra cách nhập rồi bấm Áp dụng.');
    }catch(error){if(token!==importToken||!dialog.open)return;pending=null;$('fifo-file').value='';importStatus(error.message||'Chưa đọc được file. Vui lòng thử lại.',true);}
    finally{if(token===importToken&&dialog.open){importBusy=false;$('fifo-apply-import').disabled=false;}}
  });
  $('fifo-apply-import').addEventListener('click',()=>{
    if(importBusy)return;
    try{
      const data=pending||{kind:'rows',records:recordsFromRows(delimitedRows($('fifo-paste').value))};
      if(data.kind==='template'&&$('fifo-import-mode').value!=='replace')throw Error('Mẫu FIFO có vị trí riêng. Chọn Thay danh sách để giữ đúng vị trí trong file.');
      const next=data.kind==='template'?applyTemplate(state,data):applyRecords(state,data.records,$('fifo-import-mode').value);
      remember();state=next;cursor=0;sync();changed();dialog.close();status('Đã nhập '+state.rows.filter(hasInput).length+' dòng. Kiểm tra vùng tem trước khi in.');
    }catch(error){importStatus(error.message,true);}
  });
  sync();render();
}
