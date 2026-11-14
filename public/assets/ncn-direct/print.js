/* One passive print frame per page. The visible editor is never printed or cleared. */
const controllers=new WeakMap();
export const isIOS=win=>/iPad|iPhone|iPod/.test(win.navigator?.userAgent||'')||(/Macintosh/.test(win.navigator?.userAgent||'')&&win.navigator?.maxTouchPoints>1);

function controller(doc,win){
  if(controllers.has(doc))return controllers.get(doc);
  const subscribers=new Set();let current=null,notice=0;
  const notify=reason=>{
    if(notice)win.cancelAnimationFrame(notice);
    notice=win.requestAnimationFrame(()=>{notice=0;for(const callback of subscribers)callback({reason,ios:isIOS(win)});});
  };
  function finish(reason){
    if(!current){if(reason==='afterprint')notify(reason);return;}
    const job=current;if(!job.started)return;
    const focused=doc.activeElement===job.frame;
    current=null;job.cleanup();
    // Safari can retain the print iframe as its focused view after closing AirPrint.
    // Restore the parent without focusing or navigating the preview document.
    if(focused)win.focus?.();
    if(job.origin?.isConnected&&job.origin!==job.frame)job.origin.focus?.({preventScroll:true});
    notify(reason);
  }
  const before=()=>{if(current)current.started=true;};
  const after=()=>finish('afterprint');
  const focus=()=>{if(current?.started)finish('focus');};
  const visible=()=>{if(doc.hidden){if(current?.started)current.hidden=true;}else if(current?.hidden)finish('visible');};
  const show=event=>{if(current?.started)finish('pageshow');else if(event.persisted)notify('pageshow');};
  win.addEventListener('beforeprint',before);win.addEventListener('afterprint',after);
  win.addEventListener('focus',focus);win.addEventListener('pageshow',show);doc.addEventListener('visibilitychange',visible);
  const api={
    subscribe(callback){subscribers.add(callback);return ()=>subscribers.delete(callback);},
    replace(job){if(current){current.cleanup();current=null;}current=job;},
    discard(job){if(current===job)current=null;job.cleanup();},
    finish,notify
  };
  controllers.set(doc,api);return api;
}

export function watchPrintReturn(callback,{doc=document,win=window}={}){
  return controller(doc,win).subscribe(callback);
}

async function bounded(promise,win,message){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(new Error(message)),20000);})]);}
  finally{win.clearTimeout(timer);}
}

export async function printDocument(html,{title='Bản in nguyencongnghe.com',doc=document,win=window}={}){
  if(typeof html!=='string'||!html.trim())throw new Error('Chưa có bản in. Anh mở lại mẫu rồi thử nhé.');
  const lifecycle=controller(doc,win),frame=doc.createElement('iframe'),origin=doc.activeElement;
  frame.title=title;frame.dataset.ncnPrintJob='true';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
  frame.setAttribute('sandbox','allow-same-origin allow-modals');
  Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'800px',height:'1125px',border:'0',pointerEvents:'none'});
  let child=null,fallback=0,removed=false,loaded;
  const after=()=>lifecycle.finish('afterprint');
  const job={frame,origin,started:false,hidden:false,cleanup(){
    if(removed)return;removed=true;win.clearTimeout(fallback);frame.removeEventListener('load',loaded);
    child?.removeEventListener('afterprint',after);frame.remove();
  }};
  lifecycle.replace(job);
  try{
    const ready=new Promise(resolve=>{
      loaded=()=>{if(frame.contentDocument?.documentElement?.hasAttribute('data-ncn-print-document'))resolve();};
      frame.addEventListener('load',loaded);
    });
    frame.srcdoc=/<html\b/i.test(html)?html.replace(/<html\b/i,'<html data-ncn-print-document'):('<!doctype html><html data-ncn-print-document><body>'+html+'</body></html>');
    doc.body.append(frame);
    const slow='Bản in tải chậm. Anh thử lại hoặc chọn Tải bản in HTML.';
    await bounded(ready,win,slow);
    const paper=frame.contentDocument;
    await bounded(Promise.all([
      paper.fonts?.ready,
      ...[...paper.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))
    ]),win,slow);
    if(removed)throw new Error('Bản in đã được thay bằng mẫu khác. Anh bấm In ngay lại nhé.');
    child=frame.contentWindow;child.addEventListener('afterprint',after);job.started=true;
    // Do not focus an off-screen iframe: on iPhone this can leave the visible
    // scaled preview blank when the native print view returns to the editor.
    child.print();
    // Desktop print() blocks until the dialog closes; iOS may return earlier.
    if(!isIOS(win))lifecycle.finish('returned');
    else{
      const release=()=>{if(removed)return;if(doc.hidden){fallback=win.setTimeout(release,60000);return;}lifecycle.finish('fallback');};
      if(!removed)fallback=win.setTimeout(release,60000);
    }
  }catch(error){lifecycle.discard(job);throw error;}
}
