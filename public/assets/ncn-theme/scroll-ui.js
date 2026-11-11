/* The same scroll behavior is used by the portal, print editors and the game. */
import {installToolbarClock} from './clock.js?v=20261025-toolbar-1';
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
  const clock=installToolbarClock({doc,win});
  const direction=createScrollDirection(),listeners=[],positions=new WeakMap();
  const scrollTargets='.ncn-direct-stage,.ncn-print-stage,.ncn-mobile-sheet-viewport,.ncn-print-sidebar';
  const menuOpen=()=>body.matches('.ncn-menu-open,.ncn-game-menu-open');
  let previous=Math.max(0,win.scrollY||0),frame=0,destroyed=false,keyboardFocus=false,touchY=null,width=win.innerWidth;
  let hidden=false,space=0,hasNotice=body.classList.contains('ncn-has-announcements');
  const listen=(node,event,handler,options)=>{node?.addEventListener(event,handler,options);listeners.push(()=>node?.removeEventListener(event,handler,options));};
  const locked=()=>menuOpen()||
    Boolean(doc.querySelector('#ncn-search-dialog[open],.ncn-account-menu[open]'))||
    (keyboardFocus&&chrome.some(node=>node.contains(doc.activeElement)));
  function apply(next){
    if(destroyed||hidden===next)return;
    hidden=next;
    body.classList.toggle('ncn-chrome-hidden',hidden);
  }
  function show(){direction.reset();apply(false);}
  function move(delta,atTop=false){
    const next=direction.move(delta,{atTop});
    if(next&&!hidden&&locked())show();
    else apply(next);
  }
  function measure(){
    frame=0;if(destroyed)return;
    let bottom=0;
    for(const node of chrome){
      const height=node.offsetHeight;
      if(node.hidden||!height)continue;
      const style=win.getComputedStyle(node);
      // Layout positions stay constant while CSS translate animates the chrome.
      bottom=Math.max(bottom,(parseFloat(style.top)||0)+(parseFloat(style.marginTop)||0)+height);
    }
    const next=Math.ceil(bottom+12);
    if(space===next)return;
    space=next;
    root.style.setProperty('--ncn-chrome-space',space+'px');
    root.style.setProperty('--ncn-chrome-hide-distance',(space+12)+'px');
  }
  function scheduleMeasure(){if(!frame)frame=win.requestAnimationFrame(measure);}
  // Use the actual scroll position in the document and its panels. Preview
  // iframes also need gesture handling when their paper fills the viewport.
  function wheel(event){
    if(event.ctrlKey||Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
    keyboardFocus=false;
    if(event.currentTarget!==doc||(hidden&&previous<=8&&event.deltaY<0))move(event.deltaY);
  }
  function touchStart(event){touchY=event.touches?.[0]?.clientY??null;keyboardFocus=false;}
  function touchMove(event){
    const next=event.touches?.[0]?.clientY;
    if(touchY!==null&&Number.isFinite(next))move(touchY-next);
    touchY=next??null;
  }
  function keyDown(event){if(['Tab','Escape','Home'].includes(event.key)){keyboardFocus=true;show();}}
  function onScroll(event){
    // Tab can scroll a field into view, including inside the paper iframe.
    // Keep navigation visible until the next pointer or scroll gesture.
    const target=event.target;
    if(target===doc||target===root||target===body){
      const next=Math.max(0,win.scrollY||root.scrollTop||0),delta=next-previous;previous=next;
      if(!keyboardFocus)move(delta,next<=8);
      return;
    }
    if(!target?.matches?.(scrollTargets))return;
    const next=target.scrollTop||0,last=positions.get(target)||0;positions.set(target,next);
    if(!keyboardFocus)move(next-last);
  }
  body.classList.add('ncn-scroll-ready');measure();
  listen(doc,'scroll',onScroll,{capture:true,passive:true});
  listen(doc,'wheel',wheel,{capture:true,passive:true});
  listen(doc,'touchstart',touchStart,{capture:true,passive:true});
  listen(doc,'pointerdown',()=>{keyboardFocus=false;},{capture:true,passive:true});
  listen(doc,'focusin',event=>{if(chrome.some(node=>node.contains(event.target)))show();});
  listen(doc,'keydown',keyDown);
  listen(doc,'toggle',()=>{if(locked())show();},true);
  // Browser address bars and print-preview measurements also emit resize.
  // Neither is a request to reveal navigation while the user scrolls down.
  listen(win,'resize',()=>{if(win.innerWidth!==width){width=win.innerWidth;show();}scheduleMeasure();},{passive:true});
  listen(win,'pageshow',()=>{previous=Math.max(0,win.scrollY||0);show();scheduleMeasure();});
  const observer=win.MutationObserver?new win.MutationObserver(records=>{
    if(menuOpen())show();
    const next=body.classList.contains('ncn-has-announcements');
    if(hasNotice!==next||records.some(record=>record.target!==body))scheduleMeasure();
    hasNotice=next;
  }):null;
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
  const frameSelector='.ncn-direct-stage iframe,.ncn-print-stage iframe';
  function registerFrame(frame){
    if(frames.has(frame))return;
    frames.add(frame);
    bindFrame(frame);
  }
  function scanFrames(node){
    if(node.nodeType!==1)return;
    if(node.matches(frameSelector))registerFrame(node);
    else node.querySelectorAll(frameSelector).forEach(registerFrame);
  }
  scanFrames(body);
  const frameObserver=win.MutationObserver?new win.MutationObserver(records=>{
    for(const record of records)record.addedNodes.forEach(scanFrames);
  }):null;
  frameObserver?.observe(body,{childList:true,subtree:true});
  const api={show,destroy(){destroyed=true;clock?.destroy();listeners.forEach(remove=>remove());observer?.disconnect();frameObserver?.disconnect();resize?.disconnect();win.cancelAnimationFrame(frame);body.classList.remove('ncn-chrome-hidden','ncn-scroll-ready');root.style.removeProperty('--ncn-chrome-space');root.style.removeProperty('--ncn-chrome-hide-distance');controllers.delete(doc);}};
  controllers.set(doc,api);return api;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installScrollUI(),{once:true});
  else installScrollUI();
}
