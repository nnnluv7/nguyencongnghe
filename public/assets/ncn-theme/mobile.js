/* Responsive wrappers preserve the original input nodes, handlers and print sheet. */
(() => {
  'use strict';
  if (window.NCNMobile?.version === '20261015-1') return;
  const jobs = [];
  let started = false;
  const mobile = window.matchMedia?.('(max-width: 900px)');
  const isMobile = () => mobile ? mobile.matches : window.innerWidth <= 900;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function mobileUI(tag, text) {
    const node = element(tag, '', text);
    node.setAttribute('data-ncn-mobile-ui', '');
    return node;
  }
  function enhanceFIFO(post) {
    const table = post.querySelector('table.nhaplieu');
    const sheet = post.querySelector('#printMe');
    if (!table || !sheet || !post.querySelector('#ff1')) return;
    document.body.classList.add('ncn-mobile-fifo');
    const hint = mobileUI('p', 'Vuốt ngang bảng để nhập đủ 7 nhóm FIFO.');
    hint.id = 'ncn-fifo-mobile-hint';
    const scroll = element('div', 'ncn-mobile-table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Bảng nhập liệu FIFO');
    scroll.setAttribute('aria-describedby', hint.id);
    table.before(hint, scroll);
    scroll.append(table);
    for (let n = 1; n <= 7; n++) {
      for (const [prefix, label] of [['ff', 'Ngày FIFO'], ['mau', 'Màu'], ['ver', 'Phiên bản'], ['sl', 'Số lượng']]) {
        const field = post.querySelector('#' + prefix + n);
        if (field && !field.hasAttribute('aria-label')) field.setAttribute('aria-label', `${label} nhóm ${n}`);
        if (field && prefix === 'sl') field.setAttribute('inputmode', 'numeric');
      }
    }
    const controls = mobileUI('div');
    const caption = element('span', '', 'Xem trước tem FIFO');
    const button = element('button', '', 'Phóng to');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    controls.append(caption, button);
    const viewport = element('div', 'ncn-mobile-sheet-viewport');
    const frame = element('div', 'ncn-mobile-sheet-frame');
    viewport.setAttribute('aria-label', 'Xem trước tem FIFO');
    viewport.tabIndex = 0;
    sheet.before(controls, viewport);
    viewport.append(frame);
    frame.append(sheet);
    let fullSize = false;
    function resize() {
      if (!isMobile()) {
        frame.style.removeProperty('--ncn-fit-scale');
        return;
      }
      const styles = window.getComputedStyle(sheet);
      const width = sheet.offsetWidth || parseFloat(styles.width) || 775;
      const height = Math.max(sheet.scrollHeight, sheet.offsetHeight, parseFloat(styles.height) || 560);
      const available = viewport.clientWidth || post.clientWidth;
      // A hidden tab will be measured again by ResizeObserver when it becomes visible.
      if (!(available > 0) || !(width > 0)) return;
      const scale = fullSize ? 1 : Math.min(1, available / width);
      frame.style.setProperty('--ncn-sheet-width', width + 'px');
      frame.style.setProperty('--ncn-sheet-height', height + 'px');
      frame.style.setProperty('--ncn-fit-scale', String(scale));
    }
    button.addEventListener('click', () => {
      fullSize = !fullSize;
      button.textContent = fullSize ? 'Vừa màn hình' : 'Phóng to';
      button.setAttribute('aria-pressed', String(fullSize));
      resize();
    });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(resize);
      observer.observe(viewport);
      observer.observe(sheet);
    }
    jobs.push(resize);
  }
  function enhanceQR(post) {
    const input = post.querySelector('#textCode');
    const code = post.querySelector('#qrcode');
    if (!input || !code) return;
    document.body.classList.add('ncn-mobile-qr');
    if (!input.hasAttribute('aria-label')) input.setAttribute('aria-label', 'Nội dung cần tạo mã QR');
    let timer;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (typeof window.makeCode1 === 'function') window.makeCode1();
      }, 120);
    });
  }
  function refresh() {
    if (!isMobile()) {
      document.body.classList.remove('ncn-menu-open');
      const backdrop = document.getElementById('ncn-menu-backdrop');
      if (backdrop) backdrop.hidden = true;
      document.getElementById('ncn-menu-open')?.setAttribute('aria-expanded', 'false');
    }
    jobs.forEach(job => job());
  }
  function boot() {
    if (started || !document.body?.classList.contains('ncn-modern')) return;
    started = true;
    const post = document.getElementById('postBody');
    if (post) {
      if (post.querySelector('#giaban') && post.querySelector('#nhomhang') && post.querySelector('#tratruoc')) {
        document.body.classList.add('ncn-mobile-insurance');
      }
      enhanceFIFO(post);
      enhanceQR(post);
    }
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('pageshow', refresh);
    if (mobile?.addEventListener) mobile.addEventListener('change', refresh);
    else if (mobile?.addListener) mobile.addListener(refresh);
    refresh();
  }
  window.NCNMobile = Object.freeze({ version: '20261015-1', boot, refresh });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
