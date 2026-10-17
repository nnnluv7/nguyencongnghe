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
    const icon=document.createElement('span');icon.className='ncn-item-icon';icon.textContent=options.icon||'✦';
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
    nav.replaceChildren();section('MỞ NHANH');
    for (const t of front) anchor(label[t.id]||t.title,t.href,{icon:'✦',vip:t.access==='vip'});
    section('TẤT CẢ CÔNG CỤ');anchor('Trang chủ','/',{icon:'⌂'});
    for (const t of back)anchor(t.title,t.href,{icon:t.id==='flappy-bird'?'🎮':'▦',vip:t.access==='vip'});
    if (!items.some(t=>t.id==='flappy-bird'))anchor('Bay Đi Đừng Cáu','/flappy-bird/',{icon:'🎮'});
    anchor('Thư viện bài viết','/thu-vien/',{icon:'▤'});
    // Use the user's new Admin contacts even on deployments with stale config.
    $('ncn-game-line').href=defaultLine;
    $('ncn-game-group').href=defaultGroup;
  }
  populate({tools:[]});
  fetch('/assets/ncn-theme/config.json?v=20261017-ncn-arcade-1',{credentials:'same-origin',cache:'no-store'})
    .then(r => {if(!r.ok)throw Error('config');return r.json();})
    .then(populate)
    .catch(() => { /* Fallback navigation already available offline. */ });
})();
