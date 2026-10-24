/* The same scroll behavior is used by the portal, print editors and the game. */
export function createScrollDirection({down=20,up=10}={}){
  let direction=0,distance=0,hidden=false;
  return {
    move(delta,{atTop=false,locked=false}={}){
      if(atTop||locked){direction=0;distance=0;hidden=false;return hidden;}
      if(!Number.isFinite(delta)||Math.abs(delta)<1)return hidden;
      const sign=Math.sign(delta);
      if(sign!==direction){direction=sign;distance=0;}
      distance+=Math.abs(delta);
      if(direction>0&&distance>=down)hidden=true;
      if(direction<0&&distance>=up)hidden=false;
      return hidden;
    },
    reset(){direction=0;distance=0;hidden=false;return hidden;}
  };
}
const controllers=new WeakMap();
export function installScrollUI({doc=document,win=window}={}){
  if(controllers.has(doc))return controllers.get(doc);
  const body=doc.body,root=doc.documentElement;
  if(!body)return;
  const selector='#ncn-announcement,#ncn-topbar,#ncn-menu-open,#ncn-game-topbar,#ncn-game-menu';
  const chrome=[...doc.querySelectorAll(selector)];
  if(!chrome.length)return;
  const direction=createScrollDirection(),listeners=[],positions=new WeakMap();
  let previous=Math.max(0,win.scrollY||0),frame=0,destroyed=false;
  const listen=(node,event,handler,options)=>{node?.addEventListener(event,handler,options);listeners.push(()=>node?.removeEventListener(event,handler,options));};
  const locked=()=>body.matches('.ncn-menu-open,.ncn-game-menu-open')||
    Boolean(doc.querySelector('#ncn-search-dialog[open],.ncn-account-menu[open]'))||
    chrome.some(node=>node.contains(doc.activeElement));
  function apply(hidden){
    if(destroyed)return;
    body.classList.toggle('ncn-chrome-hidden',Boolean(hidden)&&!locked());
  }
  function show(){direction.reset();apply(false);}
  function measure(){
    frame=0;if(destroyed)return;
    let bottom=0;
    for(const node of chrome){
      if(node.hidden||!node.getClientRects().length)continue;
      const style=win.getComputedStyle(node);
      if(style.display==='none')continue;
      // Layout positions stay constant while CSS translate animates the chrome.
      bottom=Math.max(bottom,(parseFloat(style.top)||0)+(parseFloat(style.marginTop)||0)+node.offsetHeight);
    }
    root.style.setProperty('--ncn-chrome-space',Math.ceil(bottom+12)+'px');
    root.style.setProperty('--ncn-chrome-hide-distance',Math.ceil(bottom+24)+'px');
  }
  function scheduleMeasure(){if(!frame)frame=win.requestAnimationFrame(measure);}
  function onScroll(event){
    const target=event.target;
    if(target===doc||target===root||target===body){
      const next=Math.max(0,win.scrollY||root.scrollTop||0),delta=next-previous;previous=next;
      apply(direction.move(delta,{atTop:next<=8,locked:locked()}));return;
    }
    if(!target?.matches?.('.ncn-direct-stage,.ncn-print-stage,.ncn-mobile-sheet-viewport,.ncn-print-sidebar'))return;
    const next=target.scrollTop||0,last=positions.get(target)||0;positions.set(target,next);
    apply(direction.move(next-last,{locked:locked()}));
  }
  body.classList.add('ncn-scroll-ready');measure();
  listen(doc,'scroll',onScroll,{capture:true,passive:true});
  listen(doc,'focusin',event=>{if(chrome.some(node=>node.contains(event.target)))show();});
  listen(doc,'keydown',event=>{if(['Tab','Escape','Home'].includes(event.key))show();});
  listen(doc,'toggle',()=>{if(locked())show();},true);
  listen(win,'resize',()=>{show();scheduleMeasure();},{passive:true});
  listen(win,'pageshow',()=>{previous=Math.max(0,win.scrollY||0);show();scheduleMeasure();});
  const observer=win.MutationObserver?new win.MutationObserver(()=>{if(locked())show();scheduleMeasure();}):null;
  observer?.observe(body,{attributes:true,attributeFilter:['class']});
  const notice=doc.getElementById('ncn-announcement');
  if(notice)observer?.observe(notice,{attributes:true,attributeFilter:['hidden']});
  const resize=win.ResizeObserver?new win.ResizeObserver(scheduleMeasure):null;
  chrome.forEach(node=>resize?.observe(node));
  const api={show,destroy(){destroyed=true;listeners.forEach(remove=>remove());observer?.disconnect();resize?.disconnect();win.cancelAnimationFrame(frame);body.classList.remove('ncn-chrome-hidden','ncn-scroll-ready');root.style.removeProperty('--ncn-chrome-space');root.style.removeProperty('--ncn-chrome-hide-distance');controllers.delete(doc);}};
  controllers.set(doc,api);return api;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installScrollUI(),{once:true});
  else installScrollUI();
}
