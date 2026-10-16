/* Simple NCN navigation and task-focused forms. Existing controls retain their handlers. */
const VERSION='20261016-one-theme-1';
const PRIMARY=['sticker','popup-a7','popup-large','event','gvgs','cash','sales','decor'];
const SHORT={sticker:'Sticker','popup-a7':'Popup A7 / LED','popup-large':'Popup A4 / A5 / A6',event:'Event VIP',gvgs:'Giờ Vàng VIP',cash:'Kiểm quỹ',sales:'Bán hàng',decor:'Trang trí'};
export function installEasyUI({doc=document,win=window,config={},preview=false}={}){
  const $=id=>doc.getElementById(id),listeners=[],observers=[];
  const listen=(node,event,fn)=>{node?.addEventListener(event,fn);listeners.push(()=>node?.removeEventListener(event,fn));};
  const make=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n;};
  doc.body.classList.add('ncn-easy');
  if(!$('ncn-easy-style')){const link=make('link');link.id='ncn-easy-style';link.rel='stylesheet';link.href='/assets/ncn-theme/site.css?v='+VERSION;doc.head.append(link);}
  const brand=doc.querySelector('#ncn-sidebar .ncn-brand'),header=doc.querySelector('.ncn-topbar-left');
  if(brand&&header&&!header.querySelector('.ncn-header-brand')){const clone=brand.cloneNode(true);clone.classList.add('ncn-header-brand');header.append(clone);}
  const nav=$('ncn-navigation');
  if(nav&&!nav.dataset.easy){
    const path=a=>{try{return new URL(a.href,win.location.href).pathname;}catch{return a.getAttribute('href');}};
    nav.dataset.easy='true';const links=[...nav.querySelectorAll('a.ncn-nav-link')],home=links.find(a=>path(a)==='/'),more=make('details','ncn-nav-more'),summary=make('summary','','Thêm công cụ ▾'),moreBody=make('div','ncn-nav-more-body');
    const chosen=[];if(home){home.querySelector('span').textContent='Trang chủ';chosen.push(home);}
    for(const id of PRIMARY){const tool=(config.tools||[]).find(t=>t.id===id);const link=tool&&links.find(a=>path(a)===tool.href);if(link){const text=link.querySelector('span');if(text)text.textContent=SHORT[id];chosen.push(link);}}
    for(const link of links)if(!chosen.includes(link))moreBody.append(link);
    more.append(summary,moreBody);nav.replaceChildren(...chosen);if(moreBody.childElementCount)nav.append(more);
    listen(doc,'click',e=>{if(!more.contains(e.target))more.open=false;});listen(nav,'click',e=>{if(e.target.closest('a'))more.open=false;});
  }
  const home=$('ncn-home');
  if(home&&!home.dataset.easy){
    home.dataset.easy='true';const title=home.querySelector('.ncn-welcome h2');if(title)title.textContent='Anh cần công cụ nào hôm nay?';
    const articles=$('ncn-articles')?.closest('section');if(articles){const details=make('details','ncn-article-disclosure'),summary=make('summary','','Bài viết & hướng dẫn');articles.before(details);details.append(summary,articles);}
  }
  function disclosure(node,label,className='ncn-advanced'){
    if(!node||node.closest('details.'+className))return null;
    const details=make('details',className),summary=make('summary','',label);node.before(details);details.append(summary,node);return details;
  }
  function enhanceEditor(app){
    if(!app||app.dataset.easy)return;app.dataset.easy='true';
    const prefix=app.id==='ncn-store-app'?'nt':'st',workspace=$(prefix+'-workspace'),catalogue=app.querySelector('.st-catalogue');
    if(workspace&&catalogue){
      const change=$(prefix+'-change-model');if(change)change.textContent='← Chọn mẫu khác';
      function sync(){const editing=!workspace.hidden;catalogue.hidden=editing;app.classList.toggle('ncn-editing',editing);}
      sync();if(win.MutationObserver){const o=new win.MutationObserver(sync);o.observe(workspace,{attributes:true,attributeFilter:['hidden']});observers.push(o);}
      listen(change,'click',()=>{workspace.hidden=true;catalogue.hidden=false;app.classList.remove('ncn-editing');catalogue.scrollIntoView?.({behavior:'smooth',block:'start'});const first=catalogue.querySelector('input,button');first?.focus({preventScroll:true});});
    }
    const settings=app.querySelector('.st-settings,.nt-settings'),imports=app.querySelector('.st-import-actions');
    if(settings)settings.classList.add('st-settings');
    if(imports)disclosure(imports,'Nhập danh sách từ Excel / CSV');
    if(settings){const toggle=make('button','st-text-button ncn-font-toggle','Chỉnh cỡ chữ');toggle.type='button';toggle.setAttribute('aria-pressed','false');settings.after(toggle);listen(toggle,'click',()=>{const on=app.classList.toggle('ncn-show-font-tools');toggle.setAttribute('aria-pressed',String(on));toggle.textContent=on?'Ẩn chỉnh cỡ chữ':'Chỉnh cỡ chữ';});}
    const industries=$('pp-industries');if(industries&&app.contains(industries))disclosure(industries,'Lọc thêm theo ngành hàng');
    const title=$('pp-title');if(title&&app.contains(title)&&settings){const label=title.closest('label'),filter=app.querySelector('.pp-filter-bar'),note=$('pp-title-note');if(label)settings.prepend(label);if(note){note.classList.add('ncn-popup-title-note');settings.after(note);}if(filter)filter.hidden=true;}
    if(prefix==='nt'){const quick=$('nt-letter-control');if(quick&&!quick.hidden)quick.classList.add('ncn-letter-quick');}
  }
  function enhanceVip(){
    const app=$('ncn-event-app');if(!app||app.dataset.easy)return;app.dataset.easy='true';
    const source=app.querySelector('.ev-source');if(source)disclosure(source,'ADMIN · Cập nhật / lưu bảng giá','ncn-vip-source');
    const stock=app.querySelector('.ev-stock');if(stock)disclosure(stock,'Nhập danh sách từ file tồn kho / ERP','ncn-stock-import');
    const workspace=app.querySelector('.ev-workspace');if(workspace)workspace.classList.add('ncn-workspace-compact');
    const hero=app.querySelector('.ev-hero p');if(hero)hero.textContent='Chọn bảng giá → thêm sản phẩm → chọn mẫu và in.';
  }
  for(const id of ['ncn-sticker-app','ncn-popup-app','ncn-store-app'])enhanceEditor($(id));
  enhanceVip();
  if($('vip-app')&&win.MutationObserver){const o=new win.MutationObserver(enhanceVip);o.observe($('vip-app'),{childList:true});observers.push(o);}

  const cash=$('ncn-cash-app');
  if(cash&&!cash.dataset.easy){
    cash.dataset.easy='true';const screen=cash.querySelector('.cq-screen'),summary=cash.querySelector('.cq-summary'),erp=$('cq-erp')?.closest('label'),side=cash.querySelector('.cq-side'),workspace=cash.querySelector('.cq-workspace');
    if(screen&&summary&&erp){erp.classList.add('cq-erp-top');for(const node of erp.childNodes)if(node.nodeType===3)node.textContent='Tiền giữ ERP (VND)';summary.before(erp);const error=$('cq-erp-error');if(error)erp.after(error);}
    if(side&&workspace){const detail=make('details','ncn-cash-options'),caption=make('summary','','Đối chiếu & tùy chọn phiếu in');workspace.after(detail);detail.append(caption,side);}
    const container=$('center-container');if(container&&!$('ncn-cash-rail')){
      container.classList.add('ncn-cash-layout');const rail=make('aside','ncn-cash-rail');rail.id='ncn-cash-rail';rail.setAttribute('aria-label','Tài khoản và công cụ liên quan');
      const account=make('section','ncn-account-card'),caption=make('span','','TÀI KHOẢN NCN'),accountTitle=make('strong','','Công cụ cho ngày làm việc'),accountInfo=make('p','','Đăng nhập để xem gói VIP của bạn.'),membershipLink=make('a','','Đăng nhập / Nâng cấp VIP');membershipLink.href='/premium/';account.append(caption,accountTitle,accountInfo,membershipLink);rail.append(account);
      for(const [title,info,url]of [['Sticker Event','Tra giá, lọc tồn kho và in sticker.','/in-event/'],['Giờ Vàng Giá Sốc','In mẫu GV-2 chữ lớn từ bảng giá VIP.','/in-gvgs/'],['Liên hệ hỗ trợ','Hỗ trợ sử dụng các công cụ NCN.',config.contactUrl||'/p/contact-us.html']]){const card=make('a','ncn-quick-card');card.href=url;card.append(make('strong','',title+' ↗'),make('p','',info));rail.append(card);}
      container.append(rail);
      if(!preview&&typeof win.fetch==='function'){
        import('../ncn-identity-client.js').then(client=>client.ensureSession()).then(()=>win.fetch('/.netlify/functions/ncn-billing?route=me',{credentials:'same-origin',cache:'no-store'})).then(r=>r.ok?r.json():null).then(data=>{
          const user=data?.user;if(!user)return;accountTitle.textContent=user.admin?'ADMIN':user.vipSource==='manual'?'VIP do ADMIN cấp':user.vip?'VIP đang hoạt động':'Thành viên NCN';
          const expiration=user.vipExpiresAt?new Date(user.vipExpiresAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'';accountInfo.textContent=user.vipSource==='payment'?'Hết hạn: '+expiration:user.admin||user.vipSource==='manual'?'Không giới hạn thời gian':expiration?'VIP hết hạn: '+expiration:'Chưa có gói VIP.';membershipLink.textContent=user.admin||user.vipSource==='manual'?'Mở công cụ VIP':'Mua / Gia hạn VIP';membershipLink.href=user.admin||user.vipSource==='manual'?'/in-gvgs/':'/premium/';
        }).catch(()=>{});
      }
    }
  }
  return {destroy(){listeners.forEach(remove=>remove());observers.forEach(o=>o.disconnect());}};
}
