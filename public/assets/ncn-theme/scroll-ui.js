/* Compact navigation stays visible; only its measured space and clock update. */
import {installToolbarClock} from './clock.js?v=20261025-toolbar-1';
const controllers=new WeakMap();
export function installScrollUI({doc=document,win=window}={}){
  if(controllers.has(doc))return controllers.get(doc);
  const body=doc.body,root=doc.documentElement;if(!body)return;
  const chrome=[...doc.querySelectorAll('#ncn-announcement,#ncn-topbar,#ncn-menu-open,#ncn-game-topbar,#ncn-game-menu')];
  if(!chrome.length)return;
  const clock=installToolbarClock({doc,win}),listeners=[];
  let frame=0,destroyed=false,space=0,hasNotice=body.classList.contains('ncn-has-announcements');
  const show=()=>{if(body.classList.contains('ncn-chrome-hidden'))body.classList.remove('ncn-chrome-hidden');};
  function measure(){
    frame=0;if(destroyed)return;
    let bottom=0;
    for(const node of chrome){
      if(node.hidden||!node.offsetHeight)continue;
      const style=win.getComputedStyle(node);
      bottom=Math.max(bottom,(parseFloat(style.top)||0)+(parseFloat(style.marginTop)||0)+node.offsetHeight);
    }
    const next=Math.ceil(bottom+8);if(space===next)return;
    space=next;root.style.setProperty('--ncn-chrome-space',space+'px');
  }
  function schedule(){if(!frame)frame=win.requestAnimationFrame(measure);}
  for(const event of ['resize','pageshow']){
    win.addEventListener(event,schedule,{passive:true});listeners.push(()=>win.removeEventListener(event,schedule));
  }
  const observer=win.MutationObserver?new win.MutationObserver(records=>{
    const next=body.classList.contains('ncn-has-announcements');
    if(next!==hasNotice||records.some(record=>record.target!==body))schedule();hasNotice=next;
    show();
  }):null;
  observer?.observe(body,{attributes:true,attributeFilter:['class']});
  const notice=doc.getElementById('ncn-announcement');if(notice)observer?.observe(notice,{attributes:true,attributeFilter:['hidden']});
  const resize=win.ResizeObserver?new win.ResizeObserver(schedule):null;chrome.forEach(node=>resize?.observe(node));
  show();body.classList.add('ncn-scroll-ready');measure();
  const api={show,destroy(){destroyed=true;clock?.destroy();listeners.forEach(remove=>remove());observer?.disconnect();resize?.disconnect();win.cancelAnimationFrame(frame);body.classList.remove('ncn-chrome-hidden','ncn-scroll-ready');root.style.removeProperty('--ncn-chrome-space');controllers.delete(doc);}};
  controllers.set(doc,api);return api;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installScrollUI(),{once:true});
  else installScrollUI();
}
