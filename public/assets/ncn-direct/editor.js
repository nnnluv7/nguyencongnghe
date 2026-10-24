import {copyAt,editCopy} from './preview.js?v=20261015-direct-1';
import {printHelp,enhancePrintWorkspace} from './workspace.js?v=20261024-selection-1';

export function createDirectEditor({app,frame,stage,getState,onChange,onSelect,onPage,onPrint,onError,doc=document,win=window}) {
  app.classList.add('ncn-direct-editor');
  const fieldHeading=app.querySelector('.st-editor-grid > .st-panel:not(.st-preview-panel) h4');
  if(fieldHeading)fieldHeading.textContent='Nội dung mẫu';
  const previewHeading=app.querySelector('.st-preview-panel .st-panel-heading h4');
  if(previewHeading)previewHeading.textContent='Xem trước bản in';
  const listeners=[];
  const listen=(node,event,fn,options)=>{node?.addEventListener(event,fn,options);listeners.push(()=>node?.removeEventListener(event,fn,options));};
  const make=(tag,className,text)=>{const el=doc.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
  const toolbar=make('div','ncn-direct-toolbar');toolbar.setAttribute('aria-label','Nhập trực tiếp trên mẫu');
  const heading=make('div','ncn-direct-heading');heading.append(make('strong','','Bấm vào chữ trên mẫu để nhập'),make('span','','Mỗi mẫu trên tờ được điền riêng.'));
  const tools=make('div','ncn-direct-controls');
  function button(text,label,fn){const b=make('button','',text);b.type='button';b.setAttribute('aria-label',label||text);listen(b,'click',fn);tools.append(b);return b;}
  let zoom=1,size=null,count=1,page=0,child=null,childCleanup=()=>{},generation=0,linked=false,composing=false,activeCopy=null,activeField=null;
  const previous=button('←','Tờ trước',()=>onPage?.(page-1)),pageLabel=make('span','ncn-direct-page-count','Tờ 1/1');tools.append(pageLabel);
  const next=button('→','Tờ sau',()=>onPage?.(page+1));
  button('−','Thu nhỏ',()=>{zoom=Math.max(1,zoom-.25);scale();});
  button('+','Phóng to',()=>{zoom=Math.min(4,zoom+.25);scale();});
  button('Vừa trang','Xem vừa trang',()=>{zoom=1;scale();});
  button('100%','Xem kích thước thật',()=>{const base=fitScale();zoom=Math.min(4,Math.max(1,1/base));scale();});
  const linkLabel=make('label','ncn-direct-link-toggle'),check=make('input');check.type='checkbox';
  linkLabel.append(check,make('span','','Áp dụng cho cả nhóm nội dung'));
  listen(check,'change',()=>{linked=check.checked;});
  toolbar.append(heading,tools);
  const grid=app.querySelector('.st-editor-grid'),fields=grid.querySelector('.st-panel:not(.st-preview-panel)');
  const rail=make('aside','ncn-print-sidebar');rail.setAttribute('aria-label','Chỉnh sửa và in mẫu');
  const actions=make('div','ncn-print-actions'),printButton=app.querySelector('#st-print,#nt-print'),download=app.querySelector('#st-download,#nt-download'),summary=app.querySelector('#st-summary,#nt-summary');
  // Move the original controls so every app keeps its existing validation/print handlers.
  if(printButton){printButton.textContent='In ngay';printButton.classList.add('ncn-print-primary');actions.append(printButton);}
  if(download){download.classList.add('ncn-print-secondary');actions.append(download);}
  if(summary){summary.classList.add('ncn-print-summary');actions.append(summary);}
  rail.append(actions,toolbar);
  const settings=app.querySelector('.st-settings,.nt-settings');
  if(settings){const details=make('details','ncn-print-settings'),caption=make('summary','','Cỡ mẫu, khổ giấy & nhập file');details.open=false;details.append(caption,settings);for(const extra of app.querySelectorAll('.ncn-font-toggle,.ncn-popup-title-note'))details.append(extra);rail.append(details);}
  if(fields){const details=make('details','ncn-print-fields'),caption=make('summary','','Chỉnh nội dung');details.open=true;details.append(caption,linkLabel,fields);rail.append(details);}
  else rail.append(linkLabel);
  rail.append(printHelp(doc));
  const help=app.querySelector('.st-help');if(help)rail.append(help);
  grid.append(rail);const oldBar=app.querySelector('.st-print-bar');if(oldBar)oldBar.hidden=true;
  const canvas=make('div','ncn-direct-canvas');stage.append(canvas);canvas.append(frame);
  stage.classList.add('ncn-direct-stage');
  const navigation=enhancePrintWorkspace({workspace:grid,preview:grid.querySelector('.st-preview-panel'),rail,controls:toolbar,doc,win});
  const stageObserver=win.ResizeObserver?new win.ResizeObserver(()=>scale()):null;stageObserver?.observe(stage);
  function fitScale(){return size?(stage.clientWidth||440)/(size.w*96/25.4):1;}
  function scale(){
    if(!size)return;const width=size.w*96/25.4,height=size.h*96/25.4,ratio=fitScale()*zoom;
    stage.style.aspectRatio=size.w+'/'+size.h;
    stage.dataset.ncnZoomed=String(zoom>1);
    canvas.style.width=width*ratio+'px';canvas.style.height=height*ratio+'px';
    frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${ratio})`;
  }
  function markActive({reveal=false}={}){
    if(!child||activeCopy===null||activeField===null)return;
    child.querySelectorAll('[data-ncn-active]').forEach(node=>node.removeAttribute('data-ncn-active'));
    const input=child.querySelector('input[data-ncn-copy="'+activeCopy+'"][data-field="'+activeField+'"]');
    if(!input)return;
    input.setAttribute('data-ncn-active','');
    const field=getState().layout?.fields[activeField];
    heading.lastChild.textContent='Đang sửa mẫu '+(activeCopy+1)+' · '+(field?.label||'Ô '+(activeField+1));
    if(reveal&&win.innerWidth>=960){
      const rect=input.getBoundingClientRect(),frameRect=frame.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
      const ratio=frame.offsetWidth?frameRect.width/frame.offsetWidth:1;
      const top=frameRect.top+rect.top*ratio-stageRect.top,bottom=top+rect.height*ratio;
      if(stage.dataset.ncnZoomed==='true'&&(top<24||bottom>stage.clientHeight-24)){
        const target=Math.max(0,stage.scrollTop+top-(stage.clientHeight-rect.height*ratio)/2);
        stage.scrollTo?.({top:target,behavior:win.matchMedia?.('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
      }
    }
  }
  listen(rail,'focusin',event=>{
    const input=event.target;if(input.dataset?.fieldIndex===undefined)return;
    const selected=Number(app.querySelector('[data-row][aria-pressed=true]')?.dataset.row||0),state=getState();
    activeCopy=state.rows.slice(0,selected).reduce((sum,row)=>sum+Number(row.qty),0);
    activeField=Number(input.dataset.fieldIndex);markActive({reveal:true});
  });
  function syncValues(){
    if(!child)return;const state=getState();if(!state.layout)return;
    child.querySelectorAll('input[data-ncn-copy][data-field]').forEach(input=>{
      let row;try{row=copyAt(state.rows,Number(input.dataset.ncnCopy)).row;}catch{return;}
      const value=String(row.values[Number(input.dataset.field)]??'');
      if(input.type==='checkbox'){input.checked=Boolean(value);return;}
      if(input===child.activeElement&&composing)return;
      if(input.value!==value){const start=input.selectionStart,end=input.selectionEnd;input.value=value;if(input===child.activeElement&&start!==null){try{input.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length));}catch{}}}
    });
    child.querySelectorAll('[data-ncn-mirror]').forEach(node=>{
      try{node.textContent=String(copyAt(state.rows,Number(node.dataset.ncnCopy)).row.values[Number(node.dataset.ncnMirror)]??'');}catch{}
    });
    markActive();
  }
  function commit(input){
    if(!input?.matches?.('input[data-ncn-copy][data-field]'))return;
    try{
      const state=getState(),copy=Number(input.dataset.ncnCopy),index=Number(input.dataset.field),value=input.type==='checkbox'?(input.checked?'1':''):input.value;
      const result=editCopy(state.layout,state.rows,copy,index,value,{linked});
      onChange(result.rows,result.selected);syncValues();
    }catch(error){onError?.(error.message);}
  }
  function flush(){if(child)commit(child.activeElement);}
  function bindDocument(document){
    if(!document?.body)return false;
    const stamp=document.documentElement.getAttribute('data-ncn-direct-generation');
    if(stamp&&Number(stamp)!==generation)return false;
    childCleanup();child=document;composing=false;
    const bindings=[];
    const bind=(type,fn)=>{child.addEventListener(type,fn);bindings.push(()=>document.removeEventListener(type,fn));};
    bind('focusin',e=>{const input=e.target;if(input?.matches?.('input[data-ncn-copy][data-field]')){activeCopy=Number(input.dataset.ncnCopy);activeField=Number(input.dataset.field);try{const row=copyAt(getState().rows,Number(input.dataset.ncnCopy));onSelect?.(row.rowIndex);syncValues();}catch(error){onError?.(error.message);}}});
    bind('input',e=>{if(!e.isComposing&&!composing)commit(e.target);});
    bind('change',e=>{if(e.target.type==='checkbox')commit(e.target);});
    bind('compositionstart',()=>{composing=true;});
    bind('compositionend',e=>{composing=false;commit(e.target);});
    bind('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();flush();onPrint?.();}});
    childCleanup=()=>{bindings.forEach(fn=>fn());child=null;};
    syncValues();return true;
  }
  listen(frame,'load',()=>{try{const target=frame.contentDocument;if(target?.documentElement?.hasAttribute('data-ncn-direct-generation'))bindDocument(target);}catch{onError?.('Chưa mở được ô nhập trên mẫu. Anh có thể nhập ở phần Ô nhập.');}});
  listen(win,'keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'&&getState().layout){e.preventDefault();flush();onPrint?.();}});
  const commonPrint=doc.getElementById('ncn-page-print');
  listen(commonPrint,'click',e=>{if(getState().layout){e.preventDefault();e.stopImmediatePropagation();flush();onPrint?.();}},true);
  function render(html,{paperSize,pageIndex=0,pages=1,editable=true}={}){
    childCleanup();size=paperSize;page=pageIndex;count=pages;generation++;
    previous.disabled=page===0;next.disabled=page>=count-1;pageLabel.textContent=`Tờ ${page+1}/${count}`;
    heading.firstChild.textContent=editable?'Bấm vào chữ trên mẫu để nhập':'Mẫu in sẵn';
    heading.lastChild.textContent=editable?'Mỗi mẫu trên tờ được điền riêng. Ô chưa nhập hiện chữ gợi ý.':'Anh chọn số lượng và khổ giấy rồi bấm In.';
    linkLabel.hidden=!editable;
    const screenRules='<style data-ncn-preview-viewport>@media screen{html,body{overflow:hidden!important}.ncn-sheet{margin:0!important}input[data-ncn-active]{outline:2px solid #2769b3!important;outline-offset:-2px;background-color:#eaf0ff!important}}</style>';
    frame.srcdoc=html.replace('</head>',screenRules+'</head>').replace('<html ',`<html data-ncn-direct-generation="${generation}" `);
    scale();
  }
  function open({scroll=true}={}){
    const workspace=app.querySelector('.st-workspace');if(!workspace)return;
    // Collapse the catalogue synchronously before calculating the scroll target.
    // A smooth scroll started against the old, tall catalogue lands at the footer.
    const catalogue=app.querySelector('.st-catalogue');if(catalogue)catalogue.hidden=true;
    app.classList.add('ncn-editing');workspace.hidden=false;
    navigation?.select('paper',{scroll:false});zoom=1;scale();
    stage.scrollTo?.({top:0,left:0,behavior:'instant'});
    if(scroll){
      const rect=workspace.getBoundingClientRect();
      const space=parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--ncn-chrome-space'))||100;
      // Switching views should cancel any catalogue animation and start at the
      // heading, below both fixed bars, rather than preserve the old scroll.
      win.scrollTo({top:Math.max(0,win.scrollY+rect.top-space-12),behavior:'instant'});
    }
  }
  return {render,open,scale,flush,bindDocument,syncValues,getZoom:()=>zoom,destroy:()=>{childCleanup();stageObserver?.disconnect();navigation?.destroy();listeners.forEach(fn=>fn());toolbar.remove();}};
}
