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
  let previous=Math.max(0,win.scrollY||0),frame=0,destroyed=false,keyboardFocus=false,touchY=null,width=win.innerWidth;
  const listen=(node,event,handler,options)=>{node?.addEventListener(event,handler,options);listeners.push(()=>node?.removeEventListener(event,handler,options));};
  const locked=()=>body.matches('.ncn-menu-open,.ncn-game-menu-open')||
    Boolean(doc.querySelector('#ncn-search-dialog[open],.ncn-account-menu[open]'))||
    (keyboardFocus&&chrome.some(node=>node.contains(doc.activeElement)));
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
  // Clicking a toolbar button leaves focus on it. Only keyboard focus should
  // hold the header open; a later wheel/touch gesture must be able to hide it.
  function gesture(delta){
    keyboardFocus=false;
    apply(direction.move(delta,{locked:locked()}));
  }
  function wheel(event){if(!event.ctrlKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX))gesture(event.deltaY);}
  function touchStart(event){touchY=event.touches?.[0]?.clientY??null;keyboardFocus=false;}
  function touchMove(event){const next=event.touches?.[0]?.clientY;if(touchY!==null&&Number.isFinite(next))gesture(touchY-next);touchY=next??null;}
  function keyDown(event){if(['Tab','Escape','Home'].includes(event.key)){keyboardFocus=true;show();}}
  function onScroll(event){
    // Tab can scroll a field into view, including inside the paper iframe.
    // Keep navigation visible until the next pointer or scroll gesture.
    if(keyboardFocus){show();return;}
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
  listen(doc,'wheel',wheel,{capture:true,passive:true});
  listen(doc,'touchstart',touchStart,{capture:true,passive:true});
  listen(doc,'touchmove',touchMove,{capture:true,passive:true});
  listen(doc,'pointerdown',()=>{keyboardFocus=false;},{capture:true,passive:true});
  listen(doc,'focusin',event=>{if(chrome.some(node=>node.contains(event.target)))show();});
  listen(doc,'keydown',keyDown);
  listen(doc,'toggle',()=>{if(locked())show();},true);
  // Browser address bars and print-preview measurements also emit resize.
  // Neither is a request to reveal navigation while the user scrolls down.
  listen(win,'resize',()=>{if(win.innerWidth!==width){width=win.innerWidth;show();}scheduleMeasure();},{passive:true});
  listen(win,'pageshow',()=>{previous=Math.max(0,win.scrollY||0);show();scheduleMeasure();});
  const observer=win.MutationObserver?new win.MutationObserver(()=>{if(locked())show();scheduleMeasure();}):null;
  observer?.observe(body,{attributes:true,attributeFilter:['class']});
  const notice=doc.getElementById('ncn-announcement');
  if(notice)observer?.observe(notice,{attributes:true,attributeFilter:['hidden']});
  const resize=win.ResizeObserver?new win.ResizeObserver(scheduleMeasure):null;
  chrome.forEach(node=>resize?.observe(node));
  // Preview documents have their own event boundary, even when they use srcdoc.
  function bindFrame(frame){
    let cleanup=()=>{};
    const bind=()=>{cleanup();try{
      const child=frame.contentDocument;if(!child)return;
      const options={capture:true,passive:true},events=[['wheel',wheel],['touchstart',touchStart],['touchmove',touchMove],['keydown',keyDown]];
      events.forEach(([type,handler])=>child.addEventListener(type,handler,options));
      cleanup=()=>events.forEach(([type,handler])=>child.removeEventListener(type,handler,options));
    }catch{/* A cross-origin preview cannot be observed. */}};
    listen(frame,'load',bind);listeners.push(()=>cleanup());bind();
  }
  const frames=new WeakSet();
  function scanFrames(){doc.querySelectorAll('.ncn-direct-stage iframe,.ncn-print-stage iframe').forEach(frame=>{if(!frames.has(frame)){frames.add(frame);bindFrame(frame);}});}
  scanFrames();
  const frameObserver=win.MutationObserver?new win.MutationObserver(scanFrames):null;
  frameObserver?.observe(body,{childList:true,subtree:true});
  const api={show,destroy(){destroyed=true;listeners.forEach(remove=>remove());observer?.disconnect();frameObserver?.disconnect();resize?.disconnect();win.cancelAnimationFrame(frame);body.classList.remove('ncn-chrome-hidden','ncn-scroll-ready');root.style.removeProperty('--ncn-chrome-space');root.style.removeProperty('--ncn-chrome-hide-distance');controllers.delete(doc);}};
  controllers.set(doc,api);return api;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installScrollUI(),{once:true});
  else installScrollUI();
}
