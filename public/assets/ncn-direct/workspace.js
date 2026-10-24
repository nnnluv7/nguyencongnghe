/* Shared screen-only workspaces. Print documents and their artwork stay untouched. */
export function printHelp(doc=document,{margin='Không',open=false}={}){
  const details=doc.createElement('details');details.className='ncn-print-help';details.open=open;
  const summary=doc.createElement('summary');summary.textContent='Hướng dẫn in';details.append(summary);
  const list=doc.createElement('ol');
  for(const text of ['Chọn đúng khổ giấy và chiều giấy ghi trên mẫu.','Tỷ lệ 100% để giữ đúng kích thước.','Lề: '+margin+'; tắt đầu trang và chân trang.','Bật Đồ họa nền để in đủ hình và màu.']){
    const item=doc.createElement('li');item.textContent=text;list.append(item);
  }
  details.append(list);return details;
}

export function attachPrintViewport({stage,frame,sheet,controls,doc=document,win=window}={}){
  if(!stage||(!frame&&!sheet)||stage.dataset.ncnViewport)return;
  const originalWidth=sheet?Math.max(sheet.scrollWidth,sheet.offsetWidth,parseFloat(win.getComputedStyle(sheet).width)||0):0;
  stage.dataset.ncnViewport='true';
  const canvas=frame?(stage.querySelector('.ncn-print-canvas')||doc.createElement('div')):sheet.parentElement;
  canvas.classList.add('ncn-print-canvas');
  if(frame&&!canvas.contains(frame)){stage.append(canvas);canvas.append(frame);}
  let zoom=1,naturalWidth=originalWidth,destroyed=false,resizeFrame=0;
  function measureFrame(){
    try{
      const child=frame.contentDocument;
      const page=child?.querySelector('.ncn-sheet,.sheet,.page,.ev-page,.cq-report');
      // A report can be narrower than its physical A4 page; keep the full page.
      const fixed=page?(page.classList.contains('cq-report')?794:page.getBoundingClientRect().width):0;
      naturalWidth=fixed||Math.max(child?.documentElement.scrollWidth||0,child?.body.scrollWidth||0,794);
    }catch{naturalWidth=794;}
  }
  function scale(){
    if(destroyed||!stage.clientWidth)return;
    stage.dataset.ncnZoomed=String(zoom>1);
    if(frame){
      if(!naturalWidth)measureFrame();
      const width=naturalWidth+18; // Reserve the iframe's vertical scrollbar without clipping the paper.
      const ratio=stage.clientWidth/width*zoom;
      const height=stage.clientHeight||600;
      canvas.style.width=width*ratio+'px';canvas.style.height=height+'px';
      frame.style.width=width+'px';frame.style.height=height/ratio+'px';frame.style.transform=`scale(${ratio})`;
    }else{
      if(!naturalWidth)naturalWidth=Math.max(sheet.scrollWidth,sheet.offsetWidth,parseFloat(win.getComputedStyle(sheet).width)||0)||794;
      if(!naturalWidth)return;
      const ratio=Math.min(1,stage.clientWidth/naturalWidth)*zoom;
      canvas.style.setProperty('--ncn-print-natural-width',naturalWidth+'px');
      const height=Math.max(sheet.scrollHeight,sheet.offsetHeight,sheet.children.length?1:1123);
      canvas.style.setProperty('--ncn-print-scale',String(ratio));
      canvas.style.width=naturalWidth*ratio+'px';canvas.style.height=height*ratio+'px';
    }
  }
  function schedule(){if(!resizeFrame)resizeFrame=win.requestAnimationFrame(()=>{resizeFrame=0;scale();});}
  const toolbar=controls||doc.createElement('div');toolbar.classList.add('ncn-print-zoom');
  const handlers=[];
  const add=(text,label,action)=>{const button=doc.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.addEventListener('click',action);toolbar.append(button);handlers.push(()=>button.removeEventListener('click',action));return button;};
  const less=add('−','Thu nhỏ bản in',()=>{zoom=Math.max(1,zoom-.25);scale();});
  const more=add('+','Phóng to bản in',()=>{zoom=Math.min(4,zoom+.25);scale();});
  const fit=add('Vừa trang','Xem vừa trang',()=>{zoom=1;scale();});
  if(!controls)stage.before(toolbar);
  const loaded=()=>{naturalWidth=0;measureFrame();scale();try{frame.contentDocument?.fonts?.ready.then(schedule);}catch{}};
  if(frame)frame.addEventListener('load',loaded);
  const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;
  observer?.observe(stage);if(sheet)observer?.observe(sheet);
  win.addEventListener('resize',schedule);doc.fonts?.ready.then(schedule);schedule();
  return {scale,destroy(){destroyed=true;observer?.disconnect();win.cancelAnimationFrame(resizeFrame);win.removeEventListener('resize',schedule);if(frame)frame.removeEventListener('load',loaded);handlers.forEach(remove=>remove());}};
}

export function openPrintPreview(html,{title='Xem trước bản in',margin='Không',doc=document,win=window}={}){
  const previous=doc.querySelector('dialog[data-ncn-generated-print]');previous?.close?.();previous?.remove();
  const dialog=doc.createElement('dialog');dialog.className='ncn-print-dialog';dialog.dataset.ncnGeneratedPrint='true';dialog.setAttribute('aria-label',title);
  const stage=doc.createElement('div');stage.className='ncn-print-stage';
  const frame=doc.createElement('iframe');frame.title=title;frame.setAttribute('sandbox','allow-same-origin allow-modals');stage.append(frame);
  const rail=doc.createElement('aside');rail.className='ncn-print-sidebar';
  const heading=doc.createElement('h2');heading.textContent=title;rail.append(heading);
  const print=doc.createElement('button');print.type='button';print.className='ncn-print-primary';print.textContent='In ngay / Lưu PDF';print.disabled=true;rail.append(print);
  const zoom=doc.createElement('div');rail.append(zoom);rail.append(printHelp(doc,{margin,open:win.innerWidth>=960}));
  const close=doc.createElement('button');close.type='button';close.className='ncn-print-secondary';close.textContent='← Quay lại chỉnh sửa';rail.append(close);
  dialog.append(stage,rail);doc.body.append(dialog);
  const viewport=attachPrintViewport({stage,frame,controls:zoom,doc,win});
  let ready=Promise.resolve();
  frame.addEventListener('load',()=>{if(!frame.contentDocument?.body?.firstElementChild)return;ready=Promise.resolve(frame.contentDocument?.fonts?.ready).then(()=>{print.disabled=false;});});
  print.addEventListener('click',async()=>{await ready;frame.contentWindow?.focus();frame.contentWindow?.print();});
  const origin=doc.activeElement;
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;viewport?.destroy();dialog.remove();origin?.focus?.();};
  close.addEventListener('click',()=>{dialog.close();cleanup();});
  dialog.addEventListener('close',cleanup,{once:true});
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  frame.srcdoc=html;return dialog;
}

export function installPrintWorkspaces({doc=document,win=window}={}){
  function enhance(){
    const fifo=doc.querySelector('.ncn-fifo-workbench');
    if(fifo&&fifo.dataset.layout!=='classic'&&!fifo.dataset.ncnPrintReady){
      fifo.dataset.ncnPrintReady='true';
      const controls=doc.getElementById('ncn-fifo-preview-controls'),rail=fifo.querySelector('.ncn-print-sidebar');
      if(controls&&rail){controls.classList.add('ncn-print-zoom');}
      enhancePrintWorkspace({workspace:fifo,preview:fifo.querySelector('.ncn-fifo-paper'),rail,controls,doc,win});
    }
    doc.querySelectorAll('dialog.ncn-print-dialog:not([data-ncn-generated-print])').forEach(dialog=>{
      if(dialog.dataset.ncnPrintReady)return;dialog.dataset.ncnPrintReady='true';
      const stage=dialog.querySelector('.ncn-print-stage'),frame=stage?.querySelector('iframe'),rail=dialog.querySelector('.ncn-print-sidebar'),zoom=rail?.querySelector('.ncn-print-zoom');
      rail?.querySelector('#ev-save-html')?.classList.add('ncn-print-secondary');
      attachPrintViewport({stage,frame,controls:zoom,doc,win});
      if(rail&&!rail.querySelector('.ncn-print-help'))rail.append(printHelp(doc,{open:win.innerWidth>=960}));
      dialog.addEventListener('toggle',()=>win.requestAnimationFrame(()=>win.dispatchEvent(new Event('resize'))));
    });
    doc.querySelectorAll('.ncn-legacy-print .ncn-print-workspace').forEach(workspace=>{
      if(workspace.dataset.ncnPrintReady)return;workspace.dataset.ncnPrintReady='true';
      const rail=workspace.querySelector('.ncn-print-sidebar'),stage=workspace.querySelector('.ncn-print-stage'),sheet=stage?.querySelector('#printMe,.row-container');
      if(!rail||!sheet)return;
      const controls=rail.querySelector('.ncn-print-zoom');
      const fields=rail.querySelector('.ncn-print-fields');if(fields)fields.open=true;
      // Existing title/help dialogs keep their original fixed positioning and handlers.
      rail.querySelectorAll('.modal,.modal_tit').forEach(modal=>workspace.after(modal));
      attachPrintViewport({stage,sheet,controls,doc,win});
      rail.querySelector('[data-ncn-print-now]')?.addEventListener('click',()=>win.print());
      rail.append(printHelp(doc));
      enhancePrintWorkspace({workspace,preview:workspace.querySelector('.ncn-print-preview'),rail,controls,doc,win});
    });
  }
  const boot=()=>{enhance();const target=doc.getElementById('vip-app');if(target&&win.MutationObserver)new win.MutationObserver(enhance).observe(target,{childList:true,subtree:true});};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}

let workspaceSerial=0;
const focusWorkspaces=new WeakMap();
export function enhancePrintWorkspace({workspace,preview,rail,controls,doc=document,win=window}={}){
  if(!workspace||!preview||!rail)return;
  if(focusWorkspaces.has(workspace))return focusWorkspaces.get(workspace);
  const make=(tag,cls,text)=>{const node=doc.createElement(tag);node.className=cls;if(text)node.textContent=text;return node;};
  const serial=++workspaceSerial,listeners=[];
  const listen=(node,event,fn)=>{node?.addEventListener(event,fn);listeners.push(()=>node?.removeEventListener(event,fn));};
  workspace.classList.add('ncn-workspace-focus');preview.classList.add('ncn-workspace-paper');rail.classList.add('ncn-workspace-fields');
  if(!preview.id)preview.id='ncn-workspace-paper-'+serial;
  if(!rail.id)rail.id='ncn-workspace-fields-'+serial;
  const bar=make('div','ncn-workspace-bar'),switcher=make('div','ncn-workspace-switch');
  switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Chuyển vùng làm việc');
  function choice(text,pane,target){
    const button=make('button','',text);button.type='button';button.dataset.ncnPane=pane;
    button.setAttribute('aria-controls',target.id);button.setAttribute('aria-pressed',String(pane==='paper'));
    switcher.append(button);return button;
  }
  const paper=choice('Bản in','paper',preview);
  const fields=choice(rail.querySelector('input,select,textarea')?'Nhập nội dung':'Tùy chọn','fields',rail);
  const print=rail.querySelector('.ncn-print-primary');
  const originalParent=print?.parentElement,originalNext=print?.nextSibling;
  bar.append(switcher);if(print)bar.append(print);
  if(controls)controls.classList.add('ncn-workspace-preview-controls');
  const media=win.matchMedia?.('(max-width:959px)');
  const mobile=()=>media?media.matches:win.innerWidth<960;
  const reduced=()=>Boolean(win.matchMedia?.('(prefers-reduced-motion:reduce)').matches);
  let pane='paper',resizeFrame=0,destroyed=false;
  function placeControls(){
    if(mobile()){
      workspace.prepend(bar);
      if(controls){const stage=preview.querySelector('.ncn-direct-stage,.ncn-print-stage,.ncn-mobile-sheet-viewport');if(stage)stage.before(controls);else preview.prepend(controls);}
    }else{
      rail.prepend(bar);
      if(controls){const actions=rail.querySelector('.ncn-print-actions');if(actions)actions.after(controls);else bar.after(controls);}
    }
  }
  function measure(){
    if(destroyed)return;
    workspace.style.setProperty('--ncn-workspace-bar-height',Math.ceil(bar.getBoundingClientRect().height||64)+'px');
  }
  function refresh(){
    placeControls();
    measure();
    paper.setAttribute('aria-pressed',String(pane==='paper'));fields.setAttribute('aria-pressed',String(pane==='fields'));
    if(!resizeFrame)resizeFrame=win.requestAnimationFrame(()=>{resizeFrame=0;win.dispatchEvent(new win.Event('resize'));});
  }
  function select(next,{focus=false,scroll=true}={}){
    pane=next==='fields'?'fields':'paper';workspace.dataset.ncnPane=pane;
    if(pane==='fields')rail.querySelectorAll('details.ncn-print-fields').forEach(node=>node.open=true);
    refresh();
    if(!scroll)return;
    const target=pane==='fields'?rail:preview;
    if(mobile()){
      // Only switch visible panels. Original inputs and their current values remain mounted.
      if(bar.getBoundingClientRect().top<0)workspace.scrollIntoView?.({behavior:reduced()?'instant':'smooth',block:'start'});
    }else if(pane==='fields'){
      const field=rail.querySelector('.ncn-print-fields input:not([type=hidden]),.ncn-print-fields select,.ncn-print-fields textarea')||rail.querySelector('input:not([type=hidden]),select,textarea');
      if(focus)field?.focus({preventScroll:true});
      rail.scrollIntoView?.({behavior:reduced()?'instant':'smooth',block:'start'});
    }else target.scrollIntoView?.({behavior:reduced()?'instant':'smooth',block:'start'});
  }
  listen(paper,'click',()=>select('paper'));listen(fields,'click',()=>select('fields',{focus:!mobile()}));
  const mediaChanged=()=>{
    // Keep keyboard focus on a visible panel when crossing the responsive breakpoint.
    if(rail.contains(doc.activeElement)){pane='fields';workspace.dataset.ncnPane=pane;}
    refresh();
  };
  media?.addEventListener?.('change',mediaChanged);
  const observer=win.ResizeObserver?new win.ResizeObserver(measure):null;observer?.observe(bar);
  rail.querySelectorAll('details.ncn-print-fields').forEach(node=>node.open=false);
  const help=rail.querySelector('.ncn-print-help');if(help)help.open=!mobile();
  workspace.dataset.ncnPane='paper';refresh();
  const api={select,refresh,destroy(){
    destroyed=true;listeners.forEach(remove=>remove());observer?.disconnect();win.cancelAnimationFrame(resizeFrame);media?.removeEventListener?.('change',mediaChanged);
    if(print&&originalParent)originalParent.insertBefore(print,originalNext?.parentNode===originalParent?originalNext:null);
    bar.remove();workspace.classList.remove('ncn-workspace-focus');preview.classList.remove('ncn-workspace-paper');rail.classList.remove('ncn-workspace-fields');delete workspace.dataset.ncnPane;focusWorkspaces.delete(workspace);
  }};
  focusWorkspaces.set(workspace,api);return api;
}

if(typeof document!=='undefined')installPrintWorkspaces();
