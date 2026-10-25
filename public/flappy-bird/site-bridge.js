/* NCN portal bridge – menu from shared config and instant shared light/dark mode. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const drawer = $('ncn-game-sidebar'), shade = $('ncn-game-shade'), openBtn = $('ncn-game-menu');
  const closeBtn = $('ncn-game-close'), nav = $('ncn-game-nav'), themeBtn = $('ncn-game-theme');
  const defaultLine = 'https://line.me/ti/p/dLN_MZNtTG';
  const defaultGroup = 'https://line.me/R/ti/g/g2w-fXhc4e';
  const priority = ['event', 'gvgs', 'cash', 'insurance'];
  /* BEGIN NCN GAME ICON SYNC 20261017-v2 */
  const ICONS = {
    fish:'<ellipse cx="13" cy="12" rx="8" ry="6"/><path d="m5 12-4-5v10ZM17 10h.01M11 6l2-3 3 4M10 17l3 4 3-4"/>',
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
    book:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v15"/>'
  };
  function svg(name){ return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.spark) + '</svg>'; }
  const label = { event: 'Event VIP', gvgs: 'Giờ Vàng VIP', cash: 'Kiểm quỹ', insurance: 'Bảo Hiểm & Trả Chậm' };
  let lastFocus = null;

  function getMode() {
    try {
      const value = localStorage.getItem('ncn-theme');
      if (value === 'dark' || value === 'light') return value;
      if (localStorage.getItem('mode') === 'darkmode') return 'dark';
    } catch (_) {}
    return 'light';
  }
  function applyMode(value, save = false) {
    const mode = value === 'dark' ? 'dark' : 'light';
    root.dataset.ncnTheme = mode;
    document.body.classList.toggle('dark', mode === 'dark');
    themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    themeBtn.title = mode === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
    themeBtn.setAttribute('aria-label', themeBtn.title);
    themeBtn.innerHTML = mode === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/></svg>';
    if (save) try { localStorage.setItem('ncn-theme', mode); } catch (_) {}
  }
  applyMode(root.dataset.ncnTheme || getMode());
  themeBtn.addEventListener('click', () => applyMode(root.dataset.ncnTheme === 'dark' ? 'light' : 'dark', true));
  addEventListener('storage', event => { if (event.key === null || event.key === 'ncn-theme' || event.key === 'mode') applyMode(getMode()); });
  addEventListener('pageshow', () => applyMode(getMode()));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyMode(getMode()); });

  function isOpen() { return !drawer.hidden; }
  function setOpen(next) {
    if (next === isOpen()) return;
    if (next) {
      lastFocus = document.activeElement;
      // Opening navigation is not a game input: pause flight before changing focus.
      window.dispatchEvent(new Event('blur'));
      drawer.hidden = false; drawer.removeAttribute('inert'); drawer.setAttribute('aria-hidden', 'false');
      shade.hidden = false; document.body.classList.add('ncn-game-menu-open'); openBtn.setAttribute('aria-expanded','true');
      closeBtn.focus({preventScroll:true});
    } else {
      drawer.hidden = true; drawer.setAttribute('inert',''); drawer.setAttribute('aria-hidden','true');
      shade.hidden = true; document.body.classList.remove('ncn-game-menu-open'); openBtn.setAttribute('aria-expanded','false');
      (lastFocus?.isConnected ? lastFocus : openBtn).focus({preventScroll:true});
    }
  }
  openBtn.addEventListener('click', () => setOpen(!isOpen()));
  closeBtn.addEventListener('click', () => setOpen(false));
  shade.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', e => { if (e.target.closest('a[href]')) setOpen(false); });
  // Stop gameplay key handlers while the menu has focus.
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setOpen(false); return; }
    if (e.key === 'Tab') {
      const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled])')].filter(x=>x.getClientRects().length);
      if (!focusable.length) { e.preventDefault(); return; }
      const first=focusable[0],last=focusable[focusable.length-1];
      if (e.shiftKey && document.activeElement===first){ e.preventDefault();last.focus(); }
      if (!e.shiftKey && document.activeElement===last){ e.preventDefault();first.focus(); }
      e.stopImmediatePropagation();
      return;
    }
    if (['Space','ArrowUp','KeyW','ShiftLeft','ShiftRight','KeyD','KeyP','KeyR'].includes(e.code)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  const safe = href => {
    if (typeof href !== 'string' || /[\\\s\x00-\x1f]/.test(href)) return '';
    if (href.startsWith('/') && !href.startsWith('//')) return href;
    try { const u=new URL(href);return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; }
  };
  function section(text) { const el=document.createElement('span'); el.className='ncn-section'; el.textContent=text; nav.append(el); }
  function anchor(title, href, options={}) {
    const url=safe(href); if (!url) return;
    const a=document.createElement('a'); a.href=url;
    const icon=document.createElement('span');icon.className='ncn-item-icon';icon.innerHTML=svg(options.icon||'spark');
    const name=document.createElement('span');name.className='ncn-item-title';name.textContent=title;
    a.append(icon,name);
    if (options.vip) {const badge=document.createElement('b');badge.className='ncn-vip-pill';badge.textContent='VIP';a.append(badge);}
    if (new URL(url,location.href).pathname.replace(/\/+$/,'')===location.pathname.replace(/\/+$/,''))a.setAttribute('aria-current','page');
    nav.append(a);
  }
  function populate(cfg) {
    const items=(Array.isArray(cfg?.tools)?cfg.tools:[]).filter(t=>t&&typeof t.id==='string'&&t.title&&safe(t.href));
    const front=priority.flatMap(id=>items.filter(t=>t.id===id));
    const back=items.filter(t=>!priority.includes(t.id));
    const adminLink=nav.querySelector('[data-ncn-announcement-admin]');
    nav.replaceChildren();if(adminLink)nav.append(adminLink);section('MỞ NHANH');
    for (const t of front) anchor(label[t.id]||t.title,t.href,{icon:t.icon||'spark',vip:t.access==='vip'});
    section('TẤT CẢ CÔNG CỤ');anchor('Trang chủ','/',{icon:'home'});
    for (const t of back)anchor(t.title,t.href,{icon:t.icon||'spark',vip:t.access==='vip'});
    if (!items.some(t=>t.id==='flappy-bird'))anchor('Bay Đi Đừng Cáu','/flappy-bird/',{icon:'spark'});
    anchor('Thư viện bài viết','/thu-vien/',{icon:'book'});
    // Use the user's new Admin contacts even on deployments with stale config.
    const logo = safe(cfg?.logo);
    if (logo && $('ncn-game-logo')) $('ncn-game-logo').src = logo;
    $('ncn-game-line').href=defaultLine;
    $('ncn-game-group').href=defaultGroup;
  }
  // Initial markup and its embedded config already use the latest NCN icons/logo.
  try{const cfg=JSON.parse($('ncn-game-config')?.textContent||'null');if(cfg)populate(cfg);}catch{ /* Complete static navigation stays usable. */ }
})();
