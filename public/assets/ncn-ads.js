// Only the dedicated banner can request an ad, once it approaches the viewport.
export function mountInlineAd({doc=document,win=window}={}){
  const host=doc.getElementById('ncn-inline-ad'),slot=host?.querySelector('ins.adsbygoogle');
  if(!slot||host.dataset.ncnAdMounted)return;
  host.dataset.ncnAdMounted='true';
  const status=new win.MutationObserver(()=>{
    if(slot.getAttribute('data-ad-status')==='unfilled'){host.hidden=true;status.disconnect();}
  });
  status.observe(slot,{attributes:true,attributeFilter:['data-ad-status']});
  const request=()=>{
    if(host.dataset.ncnAdRequested)return true;
    if(!slot.getClientRects().length||slot.getBoundingClientRect().width<320||win.matchMedia('print').matches)return false;
    host.dataset.ncnAdRequested='true';
    try{(win.adsbygoogle=win.adsbygoogle||[]).push({});}catch{host.hidden=true;}
    return true;
  };
  if(win.IntersectionObserver){
    const observer=new win.IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)&&request())observer.disconnect();
    },{rootMargin:'180px 0px'});
    observer.observe(host);
  }else request();
}

if(typeof document!=='undefined')mountInlineAd();
