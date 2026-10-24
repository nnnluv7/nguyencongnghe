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
    if(fifo&&!fifo.dataset.ncnPrintReady){
      fifo.dataset.ncnPrintReady='true';
      const controls=doc.getElementById('ncn-fifo-preview-controls'),rail=fifo.querySelector('.ncn-print-sidebar');
      if(controls&&rail){controls.classList.add('ncn-print-zoom');rail.insertBefore(controls,rail.children[1]||null);}
    }
    doc.querySelectorAll('dialog.ncn-print-dialog:not([data-ncn-generated-print])').forEach(dialog=>{
      if(dialog.dataset.ncnPrintReady)return;dialog.dataset.ncnPrintReady='true';
      const stage=dialog.querySelector('.ncn-print-stage'),frame=stage?.querySelector('iframe'),rail=dialog.querySelector('.ncn-print-sidebar'),zoom=rail?.querySelector('.ncn-print-zoom');
      attachPrintViewport({stage,frame,controls:zoom,doc,win});
      if(rail&&!rail.querySelector('.ncn-print-help'))rail.append(printHelp(doc,{open:win.innerWidth>=960}));
      dialog.addEventListener('toggle',()=>win.requestAnimationFrame(()=>win.dispatchEvent(new Event('resize'))));
    });
    doc.querySelectorAll('.ncn-legacy-print .ncn-print-workspace').forEach(workspace=>{
      if(workspace.dataset.ncnPrintReady)return;workspace.dataset.ncnPrintReady='true';
      const rail=workspace.querySelector('.ncn-print-sidebar'),stage=workspace.querySelector('.ncn-print-stage'),sheet=stage?.querySelector('#printMe,.row-container');
      if(!rail||!sheet)return;
      const controls=rail.querySelector('.ncn-print-zoom');
      const fields=rail.querySelector('.ncn-print-fields');if(fields)fields.open=win.innerWidth>=960;
      // Existing title/help dialogs keep their original fixed positioning and handlers.
      rail.querySelectorAll('.modal,.modal_tit').forEach(modal=>workspace.after(modal));
      attachPrintViewport({stage,sheet,controls,doc,win});
      rail.querySelector('[data-ncn-print-now]')?.addEventListener('click',()=>win.print());
      rail.append(printHelp(doc,{open:win.innerWidth>=960}));
    });
  }
  const boot=()=>{enhance();const target=doc.getElementById('vip-app');if(target&&win.MutationObserver)new win.MutationObserver(enhance).observe(target,{childList:true,subtree:true});};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
if(typeof document!=='undefined')installPrintWorkspaces();
