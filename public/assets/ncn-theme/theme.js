import '../ncn-account.js?v=20261024-account-2';
import {installAppearance} from './appearance.js?v=20261017-mobile-dark-1';
// A metrics request must never delay or prevent the actual interface.
if(typeof window!=='undefined')import('./visitor-counter.js?v=20261016-easy-2').catch(()=>{});
import {installToolUI} from './tool-ui.js?v=20261024-first-paint-1';
import {installFloatingMenu,orderTools,navigationHTML} from './menu.js?v=20261017-mobile-dark-1';
/* NCN portal: navigation and local display preferences. VIP authorization stays on the server. */
const ICONS = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  printer:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 12h.01"/>',
  bag:'<path d="M5 7h14l2 14H3ZM8 7V5a4 4 0 0 1 8 0v2"/>',
  box:'<path d="m12 3 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4"/>',
  sticker:'<path d="M21 12a9 9 0 1 0-9 9h2l7-7Z"/><path d="M14 21v-5a2 2 0 0 1 2-2h5M8 9h.01M15 9h.01M8 13c1 2 3 3 5 2"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h4M7 16h8M15 6h.01M18 6h.01"/>',
  layers:'<path d="m12 3 10 6-10 6L2 9ZM2 13l10 6 10-6M2 17l10 6 10-6"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6"/>',
  tag:'<path d="M3 3h9l9 9-9 9-9-9ZM7 7h.01"/>',
  wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h15V7M20 11h-5v6h5M17 14h.01"/>',
  qr:'<path d="M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h3v3h3v3h-6ZM21 12v3M12 3v3M12 9v3H9M12 18v3M3 12h3"/>',
  book:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v15"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  sliders:'<path d="M4 5h5M15 5h5M4 12h9M19 12h1M4 19h1M11 19h9"/><circle cx="12" cy="5" r="3"/><circle cx="16" cy="12" r="3"/><circle cx="8" cy="19" r="3"/>',
  star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>'
};

export const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeHref(value) {
  const s=String(value ?? '').trim();
  if (!s || /[\u0000-\u0020\\]/.test(s)) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try { const url=new URL(s); return url.protocol==='https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.spark}</svg>`;
const canonicalPath=value=>{
  try {
    let path=new URL(value,'https://nguyencongnghe.com').pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
    return ({'/p/sticker.html':'/sticker','/p/popup-a7.html':'/popup-a7','/p/popup-a4-a5-a6.html':'/popup-a4-a5-a6'})[path]||path;
  } catch { return ''; }
};
const usefulLabel=value=>!/^tắt\b/i.test(value) && !/^(private|nguyencongnghe\.com|chuyengia\.vip|Tools)$/i.test(value);
const normalizeCatalog=catalog=>{
  const seen=new Set();
  return (Array.isArray(catalog)?catalog:[]).filter(row=>{
    const href=safeHref(row?.link),key=canonicalPath(href);
    if (!href || !row.title || seen.has(key) || key==='/thu-vien') return false;
    seen.add(key); return true;
  }).map(row=>({...row,link:safeHref(row.link),labels:(Array.isArray(row.labels)?row.labels:[]).filter(x=>typeof x==='string'&&usefulLabel(x))}));
};

export function createTheme({doc=document,win=window,config,catalog=win.CG_CATALOG||[],preview=false}={}) {
  const $=id=>doc.getElementById(id),listeners=[];
  const listen=(node,event,fn)=>{ if(node){node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));} };
  const text=(id,value)=>{ if($(id)) $(id).textContent=value; };
  const read=key=>{try{return win.localStorage.getItem(key);}catch{return null;}};
  const write=(key,value)=>{try{win.localStorage.setItem(key,value);}catch{/* Display works even when storage is blocked. */}};
  const cfg=(config&&typeof config==='object')?config:{};
  const imageURL=value=>preview&&win.NCN_THEME_PREVIEW_ASSETS?.[value]||safeHref(value);
  const previewLinks=root=>{if(preview)(root||doc).querySelectorAll('.ncn-ui a[href^="/"],a.ncn-search-result[href^="/"],a.ncn-search-all[href^="/"]').forEach(a=>{a.href='https://nguyencongnghe.com'+a.getAttribute('href');a.target='_blank';a.rel='noopener';});};
  const groups=(Array.isArray(cfg.groups)?cfg.groups:[]).filter(g=>g&&typeof g.id==='string'&&g.name);
  const tools=orderTools((Array.isArray(cfg.tools)?cfg.tools:[]).filter(t=>t&&/^[a-z0-9-]+$/i.test(t.id)&&t.title&&safeHref(t.href)).map(t=>({...t,href:safeHref(t.href)})));
  const toolIds=new Set(tools.map(t=>t.id));
  let rows=normalizeCatalog(catalog);
  let favorites;
  try { const value=JSON.parse(read('ncn-favorites')||'[]'); favorites=new Set(Array.isArray(value)?value.filter(x=>toolIds.has(x)):[]); } catch {favorites=new Set();}
  const icons=root=>(root||doc).querySelectorAll('[data-ncn-icon]').forEach(el=>{el.innerHTML=svg(el.dataset.ncnIcon);});
  const configText=(key)=>key.split('.').reduce((value,part)=>value&&Object.hasOwn(value,part)?value[part]:undefined,cfg);
  doc.querySelectorAll('[data-ncn-config]').forEach(el=>{const value=configText(el.dataset.ncnConfig); if(typeof value==='string') el.textContent=value;});
  doc.querySelectorAll('[data-ncn-logo]').forEach(el=>{if(safeHref(cfg.logo)) el.src=imageURL(cfg.logo);});
  if($('ncn-announce-link') && safeHref(cfg.announcement?.href)) $('ncn-announce-link').href=safeHref(cfg.announcement.href);
  for(const node of doc.querySelectorAll('[data-ncn-admin-line]')){const url=safeHref(cfg.adminContact?.line||cfg.contactUrl);if(url)node.href=url;}
  for(const node of doc.querySelectorAll('[data-ncn-admin-group]')){const url=safeHref(cfg.adminContact?.groupLine);if(url)node.href=url;}
  text('ncn-today',new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()));
  doc.body.classList.add('ncn-modern');
  // These are the original nodes: login handlers, ADMIN labels and quick tools keep their identity.
  const auth=$('auth-header-desktop'),account=$('ncn-account-host');
  if(auth&&account) account.replaceChildren(auth);
  const sidebar=$('sidebar-container'),sidebarHost=$('ncn-page-tools-host');
  if(sidebar&&sidebarHost) sidebarHost.append(sidebar);
  const actions=$('ncn-page-actions'),center=$('center-container');
  if(actions&&center){actions.classList.add('ncn-ui');center.before(actions);}
  const home=Boolean($('ncn-home')),library=Boolean($('ncn-library'));
  const path=canonicalPath(win.location.pathname),currentTool=tools.find(t=>canonicalPath(t.href)===path);
  const protectedTool=doc.body.matches('.ncn-sticker-page,.ncn-popup-page,.ncn-event-page');
  if(actions) actions.hidden=home||library;
  if($('ncn-tools-toggle')) $('ncn-tools-toggle').hidden=!sidebar||protectedTool;
  if($('ncn-page-print')) $('ncn-page-print').hidden=protectedTool;
  // Printing editors uses the existing tool's own print button and dedicated print frame.
  listen($('ncn-page-print'),'click',()=>win.print());
  text('ncn-page-section',home?'Tổng quan':library?'Thư viện':currentTool?groups.find(g=>g.id===currentTool.group)?.name||'Công cụ':'Nội dung');
  text('ncn-page-title',home?'Cổng công cụ NCN':library?'Bài viết & hướng dẫn':currentTool?.title||doc.title.replace(/\s*\|\s*nguyencongnghe\.com$/i,''));
  function navLink(href,title,icon,badge='',id='') {
    const active=canonicalPath(href)===path;
    return `<a class="ncn-nav-link" href="${escapeHTML(href)}"${id?` data-ncn-tool="${escapeHTML(id)}"`:""}${active?' aria-current="page"':''}>${svg(icon)}<span>${escapeHTML(title)}</span>${badge?'<b class="ncn-nav-pill">VIP</b>':''}</a>`;
  }
  if(tools.length&&$('ncn-navigation')) $('ncn-navigation').innerHTML=navigationHTML(tools,navLink);
  doc.dispatchEvent(new win.CustomEvent('ncn-navigation-ready'));
  // A repository without Event still gets a useful portal, without dead VIP links.
  if(!tools.some(t=>t.id==='event')) doc.querySelectorAll('#ncn-site-shell a[href="/in-event/"],.ncn-hero-actions a[href="/in-event/"]').forEach(a=>a.hidden=true);
  icons();const appearance=installAppearance({doc,win});appearance.refresh();
  const menu=installFloatingMenu({doc,win}),setMenu=(value,restoreFocus=true)=>menu.setOpen(value,restoreFocus);
  function setDrawer(open) {
    if($('ncn-page-tools')) $('ncn-page-tools').hidden=!open;
    $('ncn-tools-toggle')?.setAttribute('aria-expanded',String(open));
    if(open) $('ncn-tools-close')?.focus();else $('ncn-tools-toggle')?.focus();
  }
  listen($('ncn-tools-toggle'),'click',()=>setDrawer($('ncn-page-tools')?.hidden));
  listen($('ncn-tools-close'),'click',()=>setDrawer(false));
  listen(doc,'click',e=>{const details=doc.querySelector('.ncn-account-menu');if(details&&!details.contains(e.target)) details.open=false;});
  const buildSearchItems=()=>[...tools.map(t=>({title:t.title,link:t.href,summary:t.description,labels:[groups.find(g=>g.id===t.group)?.name||'Công cụ'],kind:t.access==='vip'?'Công cụ VIP':'Công cụ',icon:t.icon})),...rows.filter(row=>!tools.some(t=>canonicalPath(t.href)===canonicalPath(row.link))).map(row=>({...row,kind:row.isPage?'Trang':'Bài viết',icon:'book'}))];
  let searchItems=buildSearchItems();
  const matches=(row,query)=>fold(`${row.title} ${row.summary||row.description||''} ${(row.labels||[]).join(' ')}`).includes(fold(query));
  function renderSearch() {
    const query=$('ncn-global-query')?.value||'',result=searchItems.filter(row=>matches(row,query));
    const host=$('ncn-global-results');if(!host)return;
    host.innerHTML=`<p class="ncn-search-caption">${query?`${result.length} kết quả`:'Mở nhanh công cụ'}</p>`+result.slice(0,12).map(row=>`<a class="ncn-search-result" href="${escapeHTML(row.link)}"><span class="ncn-search-result-icon">${svg(row.icon)}</span><span><strong>${escapeHTML(row.title)}</strong><small>${escapeHTML(row.kind)}</small></span><span aria-hidden="true">↗</span></a>`).join('')+(result.length?'':'<p class="ncn-empty">Chưa có kết quả. Thử tên công cụ hoặc từ khóa khác.</p>')+(result.length>12?`<a class="ncn-search-all" href="/thu-vien/?q=${encodeURIComponent(query)}">Xem thêm trong thư viện →</a>`:'');
    previewLinks();
  }
  let searchFocus=null;
  const dialog=$('ncn-search-dialog');
  function openSearch() {
    if(!dialog)return;setMenu(false,false);searchFocus=doc.activeElement;
    if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
    renderSearch();$('ncn-global-query')?.focus();
  }
  function closeSearch(){if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');searchFocus?.focus();}
  doc.querySelectorAll('[data-ncn-search-open]').forEach(button=>listen(button,'click',openSearch));
  listen($('ncn-search-close'),'click',closeSearch);listen($('ncn-global-query'),'input',renderSearch);
  listen(dialog,'click',e=>{if(e.target===dialog)closeSearch();});
  listen(doc,'keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}
    if(e.key==='Escape'){if(dialog?.open)closeSearch();if(doc.body.classList.contains('ncn-menu-open'))setMenu(false);if(!$('ncn-page-tools')?.hidden)setDrawer(false);}
  });
  let homeGroup='',homeQuery='';
  function toolCard(t) {
    const pinned=favorites.has(t.id),tone=['blue','violet','teal','amber','coral','navy'].includes(t.tone)?t.tone:'blue';
    return `<article class="ncn-tool-card ncn-tone-${tone}"><a class="ncn-tool-link" href="${escapeHTML(t.href)}"><div class="ncn-tool-top"><span class="ncn-tool-icon">${svg(t.icon)}</span>${t.access==='vip'?'<span class="ncn-tool-badge">VIP</span>':''}</div><h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.description)}</p><span class="ncn-card-open"><span>${t.access==='vip'?'Tài khoản được duyệt':'Mở công cụ'}</span>${svg('arrow')}</span></a><button type="button" class="ncn-pin" data-ncn-pin="${escapeHTML(t.id)}" aria-pressed="${pinned}" aria-label="${pinned?'Bỏ ghim':'Ghim'} ${escapeHTML(t.title)}">${svg('star')}</button></article>`;
  }
  function renderTools() {
    const items=tools.filter(t=>(!homeGroup||t.group===homeGroup)&&matches(t,homeQuery));
    if($('ncn-tool-grid')) $('ncn-tool-grid').innerHTML=items.map(toolCard).join('')||'<p class="ncn-empty">Không tìm thấy công cụ. Thử từ khóa khác.</p>';
    text('ncn-tool-count',`${items.length} / ${tools.length} công cụ · Chọn ngôi sao để ghim lối tắt.`);
    doc.querySelectorAll('[data-ncn-group]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ncnGroup===homeGroup)));
    if($('ncn-favorites-section')) $('ncn-favorites-section').hidden=!favorites.size;
    if($('ncn-favorites')) $('ncn-favorites').innerHTML=tools.filter(t=>favorites.has(t.id)).map(toolCard).join('');
    previewLinks();
  }
  if(home){
    if($('ncn-home-filters')) $('ncn-home-filters').innerHTML=[{id:'',name:'Tất cả'},...groups].map(g=>`<button type="button" data-ncn-group="${escapeHTML(g.id)}" aria-pressed="${!g.id}">${escapeHTML(g.name)}</button>`).join('');
    listen($('ncn-home-filters'),'click',e=>{const button=e.target.closest('[data-ncn-group]');if(button){homeGroup=button.dataset.ncnGroup;renderTools();}});
    listen($('ncn-tool-query'),'input',e=>{homeQuery=e.target.value;renderTools();});
    listen($('ncn-home'),'click',e=>{const button=e.target.closest('[data-ncn-pin]');if(!button)return;const id=button.dataset.ncnPin;if(!toolIds.has(id))return;favorites.has(id)?favorites.delete(id):favorites.add(id);write('ncn-favorites',JSON.stringify([...favorites]));renderTools();const replacement=doc.querySelector(`#ncn-tool-grid [data-ncn-pin="${id}"]`)||doc.querySelector(`#ncn-favorites [data-ncn-pin="${id}"]`);replacement?.focus();});
    renderTools();
  }
  const libraryLabelName=value=>({'PrintMWG':'In ấn','In Ấn':'In ấn','tin-tuc-bao-moi':'Tin tức','tin-tuc-cong-nghe':'Công nghệ','ung-dung-windows':'Phần mềm Windows','thu-thuat':'Thủ thuật','giai-tri':'Giải trí','trend':'Xu hướng'}[value]||value);
  const libraryLabels=row=>[...new Set(row.labels.filter(label=>!/^(Fix-Title|Căn giữa tiêu đề|post)$/i.test(label)).map(libraryLabelName))];
  function articleCard(row) {
    let image=safeHref(row.thumbnail?.src),date='';
    if(image && image.startsWith('https://i.ibb.co/') && safeHref(cfg.logo))image=safeHref(cfg.logo);
    if(image)image=imageURL(image);
    const time=new Date(row.datetime);if(!Number.isNaN(time.getTime())) date=new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(time);
    const label=(library?libraryLabels(row):row.labels)[0]|| (row.isPage?'Trang nội dung':'Bài viết');
    const summary=library?String(row.summary||'').replace(/\(?full-width\)?/gi,'').replace(/^\s*Đang tải dữ liệu\.{3}\s*$/,'').trim():row.summary;
    return `<a class="ncn-article-card" href="${escapeHTML(row.link)}">${image?`<img class="ncn-article-image" src="${escapeHTML(image)}" alt="" loading="lazy">`:`<div class="ncn-article-placeholder">${svg('book')}</div>`}<div class="ncn-article-card-body"><div class="ncn-article-meta"><span>${escapeHTML(label)}</span><time>${escapeHTML(date)}</time></div><h3>${escapeHTML(row.title)}</h3><p>${escapeHTML(summary||'Mở trang để xem nội dung.')}</p><span class="ncn-article-read">Xem nội dung ↗</span></div></a>`;
  }
  let sortedRows=rows.slice().sort((a,b)=>(Date.parse(b.datetime)||0)-(Date.parse(a.datetime)||0));
  function renderArticleFeed(){if($('ncn-articles')) $('ncn-articles').innerHTML=sortedRows.filter(row=>!row.isPage&&!tools.some(t=>canonicalPath(t.href)===canonicalPath(row.link))).slice(0,3).map(articleCard).join('')||'<p class="ncn-empty">Các bài viết sẽ xuất hiện khi danh mục nội dung được tải.</p>';}
  renderArticleFeed();
  let page=1,libraryQuery='',libraryLabel='';
  const PAGE_SIZE=12;
  function renderLibrary() {
    const result=sortedRows.filter(row=>matches({...row,labels:libraryLabels(row)},libraryQuery)&&(!libraryLabel||libraryLabels(row).includes(libraryLabel)));
    const pages=Math.max(1,Math.ceil(result.length/PAGE_SIZE));page=Math.max(1,Math.min(page,pages));
    if($('ncn-library-results')) $('ncn-library-results').innerHTML=result.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(articleCard).join('')||'<p class="ncn-empty">Không tìm thấy nội dung. Thử bỏ bộ lọc hoặc đổi từ khóa.</p>';
    text('ncn-library-count',`${result.length} nội dung${libraryQuery?' phù hợp':''}`);text('ncn-library-page',`Trang ${page} / ${pages}`);
    if($('ncn-library-prev')) $('ncn-library-prev').disabled=page===1;
    if($('ncn-library-next')) $('ncn-library-next').disabled=page===pages;
    previewLinks();
  }
  function updateLibraryURL(){if(preview)return;try{const url=new URL(win.location.href);for(const [k,v] of [['q',libraryQuery],['label',libraryLabel]]) v?url.searchParams.set(k,v):url.searchParams.delete(k);win.history.replaceState(null,'',url);}catch{/* file preview has no site route. */}}
  if(library){
    const labels=[...new Set(rows.flatMap(libraryLabels))].sort((a,b)=>a.localeCompare(b,'vi'));
    if($('ncn-library-label')) $('ncn-library-label').innerHTML='<option value="">Tất cả</option>'+labels.map(label=>`<option value="${escapeHTML(label)}">${escapeHTML(label)}</option>`).join('');
    const query=new URLSearchParams(win.location.search),requestedLabel=libraryLabelName(query.get('label'));libraryQuery=query.get('q')||'';libraryLabel=labels.includes(requestedLabel)?requestedLabel:'';
    if($('ncn-library-query')) $('ncn-library-query').value=libraryQuery;if($('ncn-library-label')) $('ncn-library-label').value=libraryLabel;
    listen($('ncn-library-query'),'input',e=>{libraryQuery=e.target.value;page=1;updateLibraryURL();renderLibrary();});
    listen($('ncn-library-label'),'change',e=>{libraryLabel=e.target.value;page=1;updateLibraryURL();renderLibrary();});
    listen($('ncn-library-prev'),'click',()=>{page--;renderLibrary();});listen($('ncn-library-next'),'click',()=>{page++;renderLibrary();});renderLibrary();
  }
  function replaceCatalogue(catalog){
    rows=normalizeCatalog(catalog);sortedRows=rows.slice().sort((a,b)=>(Date.parse(b.datetime)||0)-(Date.parse(a.datetime)||0));searchItems=buildSearchItems();renderArticleFeed();
    if(library){
      const labels=[...new Set(rows.flatMap(libraryLabels))].sort((a,b)=>a.localeCompare(b,'vi'));
      if(!labels.includes(libraryLabel))libraryLabel='';
      $('ncn-library-label').innerHTML='<option value="">Tất cả</option>'+labels.map(label=>`<option value="${escapeHTML(label)}">${escapeHTML(label)}</option>`).join('');
      $('ncn-library-label').value=libraryLabel;renderLibrary();
    }
    if(dialog?.open)renderSearch();
  }
  listen(win,'storage',e=>{if(e.key==='ncn-favorites'){try{const value=JSON.parse(e.newValue||'[]');favorites=new Set(Array.isArray(value)?value.filter(x=>toolIds.has(x)):[]);}catch{favorites=new Set();}renderTools();}});
  if(preview){
    // The preview uses the same UI, and opens existing website routes in the browser.
    previewLinks();
  }
  const toolUI=installToolUI({doc,win,config:cfg,preview});
  return {tools,get rows(){return rows;},replaceCatalogue,renderTools,renderSearch,renderLibrary,openSearch,closeSearch,menu,appearance,destroy:()=>{menu.destroy();toolUI.destroy();listeners.splice(0).forEach(remove=>remove());}};
}

export async function bootTheme() {
  installAppearance({doc:document,win:window});
  installFloatingMenu({doc:document,win:window});
  let config=window.NCN_THEME_CONFIG;
  let configFailed=false;
  // The final layout must not wait for a separate configuration request.
  if(!config)try{config=JSON.parse(document.getElementById('ncn-initial-config')?.textContent||'null');}catch{}
  if(!config){
    try {
      const response=await fetch('/assets/ncn-theme/config.json?v=20261016-floating-1');
      if(!response.ok) throw new Error('config');config=await response.json();
    } catch {
      try{config=JSON.parse(document.getElementById('ncn-initial-config')?.textContent||'null');}catch{}
      if(!config){configFailed=true;config={brand:'NCN',tagline:'Không gian công cụ của bạn',groups:[],tools:[]};}
    }
  }
  const result=createTheme({config,preview:window.NCN_THEME_PREVIEW===true});
  if(!window.NCN_THEME_PREVIEW){
    let pending=null;
    const refresh=()=>{
      if(pending)return pending;
      pending=fetch('/.netlify/functions/ncn-library?route=list',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async response=>{
        if(!response.ok)return;const data=await response.json();if(Array.isArray(data.items))result.replaceCatalogue(data.items);
      }).catch(()=>{}).finally(()=>pending=null);return pending;
    };
    const storage=event=>{if(event.key==='ncn:library:changed')refresh();};
    window.addEventListener('ncn-library-changed',refresh);window.addEventListener('storage',storage);
    const destroy=result.destroy;result.destroy=()=>{window.removeEventListener('ncn-library-changed',refresh);window.removeEventListener('storage',storage);destroy();};
    if(!window.NCN_LIBRARY_SNAPSHOT)refresh();
  }
  if(configFailed){const host=document.getElementById('ncn-tool-grid');if(host)host.innerHTML='<p class="ncn-empty">Chưa tải được danh mục công cụ. <a href="/thu-vien/">Mở thư viện</a> hoặc tải lại trang.</p>';}
  return result;
}
if(typeof window!=='undefined' && typeof document!=='undefined' && !window.NCN_THEME_TEST) {
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootTheme,{once:true});else bootTheme();
}
