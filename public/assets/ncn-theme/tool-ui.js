/* Simple NCN navigation and task-focused forms. Existing controls retain their handlers. */
const VERSION='20261024-first-paint-1';
export function installToolUI({doc=document,win=window,config={},preview=false}={}){
  const $=id=>doc.getElementById(id),listeners=[];
  const listen=(node,event,fn)=>{node?.addEventListener(event,fn);listeners.push(()=>node?.removeEventListener(event,fn));};
  const make=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n;};
  doc.body.classList.add('ncn-modern');
  if(!$('ncn-site-style')&&!$('ncn-easy-style')){const link=make('link');link.id='ncn-site-style';link.rel='stylesheet';link.href='/assets/ncn-theme/site.css?v='+VERSION;doc.head.append(link);}
  const articles=$('ncn-articles')?.closest('section');
  if(articles&&!articles.hasAttribute('data-ncn-home-latest')&&!articles.closest('details.ncn-article-disclosure')){const details=make('details','ncn-article-disclosure'),summary=make('summary','','Bài viết & hướng dẫn');articles.before(details);details.append(summary,articles);}
  function disclosure(node,label,className='ncn-advanced'){
    if(!node||node.closest('details.'+className))return null;
    const details=make('details',className),summary=make('summary','',label);node.before(details);details.append(summary,node);return details;
  }
  function enhanceEditor(app){
    if(!app||app.dataset.easy)return;app.dataset.easy='true';
    const prefix=app.id==='ncn-store-app'?'nt':'st';
    const settings=app.querySelector('.st-settings,.nt-settings'),imports=app.querySelector('.st-import-actions');
    if(settings)settings.classList.add('st-settings');
    if(imports)disclosure(imports,'Nhập danh sách từ Excel / CSV');
    if(settings){const toggle=make('button','st-text-button ncn-font-toggle','Chỉnh cỡ chữ');toggle.type='button';toggle.setAttribute('aria-pressed','false');settings.after(toggle);listen(toggle,'click',()=>{const on=app.classList.toggle('ncn-show-font-tools');toggle.setAttribute('aria-pressed',String(on));toggle.textContent=on?'Ẩn chỉnh cỡ chữ':'Chỉnh cỡ chữ';});}
    const industries=$('pp-industries');if(industries&&app.contains(industries))disclosure(industries,'Lọc thêm theo ngành hàng');
    const title=$('pp-title');if(title&&app.contains(title)&&settings){const label=title.closest('label'),filter=app.querySelector('.pp-filter-bar'),note=$('pp-title-note');if(label)settings.prepend(label);if(note){note.classList.add('ncn-popup-title-note');settings.after(note);}if(filter)filter.hidden=true;}
    if(prefix==='nt'){const quick=$('nt-letter-control');if(quick&&!quick.hidden)quick.classList.add('ncn-letter-quick');}
  }
  for(const id of ['ncn-sticker-app','ncn-popup-app','ncn-store-app'])enhanceEditor($(id));

  const cash=$('ncn-cash-app');
  if(cash&&!cash.dataset.easy){
    cash.dataset.easy='true';const screen=cash.querySelector('.cq-screen'),summary=cash.querySelector('.cq-summary'),erp=$('cq-erp')?.closest('label'),side=cash.querySelector('.cq-side'),workspace=cash.querySelector('.cq-workspace'),table=cash.querySelector('.cq-count-panel');
    if(screen&&summary&&erp&&side&&workspace&&table){
      // Move the original nodes; cash calculations, keyboard entry and printing retain their handlers.
      const grid=make('div','cq-compact-grid'),dashboard=make('aside','cq-dashboard');
      dashboard.setAttribute('aria-label','Tổng tiền và đối chiếu ERP');summary.before(grid);
      const actual=summary.querySelector('.cq-metric-main');if(actual)dashboard.append(actual);
      erp.classList.add('cq-erp-top');for(const node of erp.childNodes)if(node.nodeType===3)node.textContent='Tiền giữ ERP (VND)';dashboard.append(erp);
      const error=$('cq-erp-error');if(error)dashboard.append(error);
      dashboard.append(summary);
      const detail=make('details','ncn-cash-options'),caption=make('summary','','Đối chiếu & tùy chọn phiếu in');detail.append(caption,side);dashboard.append(detail);
      grid.append(dashboard,table);workspace.remove();cash.classList.add('cq-compact');
    }
  }
  return {destroy(){listeners.forEach(remove=>remove());}};
}

// Compatibility for already-open pages importing the former helper URL.
export {installToolUI as installEasyUI};
