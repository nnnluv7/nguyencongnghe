/* One floating menu on desktop and mobile. It works before the config request completes. */
export const PRIORITY=['event','gvgs','cash','insurance'];
export const MENU_LABELS={event:'Event VIP',gvgs:'Giờ Vàng VIP',cash:'Kiểm quỹ',insurance:'Bảo Hiểm & Trả Chậm'};
export function orderTools(tools=[]){return [...PRIORITY.flatMap(id=>tools.filter(t=>t.id===id)),...tools.filter(t=>!PRIORITY.includes(t.id))];}
export function navigationHTML(tools,link){
 const ordered=orderTools(tools),first=ordered.filter(t=>PRIORITY.includes(t.id)),rest=ordered.filter(t=>!PRIORITY.includes(t.id));
 return '<p class="ncn-nav-label">Mở nhanh</p>'+first.map(t=>link(t.href,MENU_LABELS[t.id]||t.title,t.icon,t.access==='vip',t.id)).join('')+'<p class="ncn-nav-label">Tất cả công cụ</p>'+link('/','Trang chủ','home')+rest.map(t=>link(t.href,t.title,t.icon,t.access==='vip',t.id)).join('')+link('/thu-vien/','Thư viện bài viết','book');
}
const controllers=new WeakMap();
export function installFloatingMenu({doc=document,win=window}={}){
 if(controllers.has(doc))return controllers.get(doc);
 const $=id=>doc.getElementById(id),panel=$('ncn-sidebar'),button=$('ncn-menu-open'),backdrop=$('ncn-menu-backdrop'),listeners=[],background=new Map();
 let open=false,closingTimer=null,destroyed=false;
 const listen=(node,event,handler)=>{node?.addEventListener(event,handler);listeners.push(()=>node?.removeEventListener(event,handler));};
 const reduce=()=>Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const unlock=()=>{for(const [node,hadInert]of background){if(!hadInert)node.removeAttribute('inert');}background.clear();};
 function setOpen(value,restoreFocus=true,immediate=false){
  if(destroyed||!panel||!button)return;
  const next=Boolean(value);if(next===open&&!immediate)return;open=next;
  if(closingTimer!==null){win.clearTimeout(closingTimer);closingTimer=null;}
  button.setAttribute('aria-expanded',String(open));panel.setAttribute('aria-hidden',String(!open));
  if(open){
   panel.hidden=false;panel.removeAttribute('inert');if(backdrop)backdrop.hidden=false;
   for(const id of ['outer-wrapper','ncn-topbar','ncn-page-actions']){const node=$(id);if(node&&!panel.contains(node)){background.set(node,node.hasAttribute('inert'));node.setAttribute('inert','');}}
   panel.getBoundingClientRect();doc.body.classList.add('ncn-menu-open');$('ncn-menu-close')?.focus({preventScroll:true});
  }else{
   doc.body.classList.remove('ncn-menu-open');panel.setAttribute('inert','');unlock();
   const hide=()=>{panel.hidden=true;if(backdrop)backdrop.hidden=true;closingTimer=null;};
   if(immediate||reduce())hide();else closingTimer=win.setTimeout(hide,180);
   if(restoreFocus)button.focus({preventScroll:true});
  }
 }
 listen(button,'click',()=>setOpen(!open));listen($('ncn-menu-close'),'click',()=>setOpen(false));listen(backdrop,'click',()=>setOpen(false));
 listen(panel,'click',e=>{if(e.target.closest('a[href]'))setOpen(false,false);});
 listen(doc,'keydown',e=>{
  if(!open)return;
  if(e.key==='Escape'){e.preventDefault();setOpen(false);return;}
  if(e.key!=='Tab')return;
  const items=[...panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&!n.closest('[hidden],[inert]'));
  if(!items.length){e.preventDefault();return;}
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&(doc.activeElement===first||!panel.contains(doc.activeElement))){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(doc.activeElement===last||!panel.contains(doc.activeElement))){e.preventDefault();first.focus();}
 });
 listen(win,'pageshow',e=>{if(e.persisted)setOpen(false,false,true);});
 const api={setOpen,isOpen:()=>open,destroy(){setOpen(false,false,true);destroyed=true;listeners.splice(0).forEach(remove=>remove());unlock();controllers.delete(doc);}};
 controllers.set(doc,api);return api;
}
