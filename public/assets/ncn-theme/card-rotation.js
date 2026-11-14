export function installCardRotation(host,{selector,win=window}){
  if(!host||!win.IntersectionObserver)return {refresh(){},destroy(){}};
  const doc=host.ownerDocument;
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  const visible=new Set();
  const control=host.querySelector('.ncn-card-motion');
  let timer,paused=false;

  function schedule(){
    win.clearTimeout(timer);
    if(paused||reduced.matches||doc.hidden||!visible.size)return;
    timer=win.setTimeout(()=>{
      host.toggleAttribute('data-preview-phase');
      schedule();
    },3000);
  }
  function reset(){
    host.removeAttribute('data-preview-phase');
    schedule();
  }
  const observer=new win.IntersectionObserver(entries=>{
    const wasVisible=visible.size>0;
    for(const {target,isIntersecting,intersectionRatio} of entries){
      if(!host.contains(target))continue;
      const inView=isIntersecting&&intersectionRatio>=.1;
      target.toggleAttribute('data-card-visible',inView);
      if(inView)visible.add(target);
      else visible.delete(target);
    }
    if(wasVisible!==(visible.size>0))reset();
  },{threshold:.1});

  function refresh(){
    observer.disconnect();
    observer.takeRecords();
    visible.clear();
    host.querySelectorAll(selector).forEach(card=>{
      card.removeAttribute('data-card-visible');
      observer.observe(card);
    });
    reset();
  }
  function syncControl(){
    if(control){
      control.hidden=reduced.matches;
      control.textContent=paused?'Bật đổi hình':'Tạm dừng đổi hình';
    }
  }
  function toggle(){
    paused=!paused;
    syncControl();
    reset();
  }
  function preferenceChanged(){
    syncControl();
    reset();
  }
  doc.addEventListener('visibilitychange',reset);
  reduced.addEventListener('change',preferenceChanged);
  control?.addEventListener('click',toggle);
  syncControl();
  refresh();
  return {refresh,destroy(){
    win.clearTimeout(timer);
    observer.disconnect();
    doc.removeEventListener('visibilitychange',reset);
    reduced.removeEventListener('change',preferenceChanged);
    control?.removeEventListener('click',toggle);
  }};
}
