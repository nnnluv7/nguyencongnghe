/* NCN visitor metrics: anonymous session-based counters, no cookies or IP collection. */
const API = '/.netlify/functions/ncn-visitors';
const ID_KEY = 'ncn.visitor.session.v1';
const ACK_KEY = 'ncn.visitor.counted.v1';
const formatter = new Intl.NumberFormat('vi-VN');

function sessionGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function sessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* Browser storage can be blocked. */ }
}

function mount() {
  const footer = document.getElementById('ncn-footer');
  if (!footer || document.getElementById('ncn-visitor-counter')) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/assets/ncn-theme/visitor-counter.css?v=1';
  document.head.appendChild(css);

  const section = document.createElement('section');
  section.id = 'ncn-visitor-counter';
  section.className = 'ncn-visitor-counter';
  section.setAttribute('aria-label', 'Thống kê truy cập trang web');
  section.innerHTML = `
    <span><i class="ncn-visitor-dot" aria-hidden="true"></i>Đang online <b data-ncn-counter="online">—</b></span>
    <span>Hôm nay <b data-ncn-counter="today">—</b></span>
    <span>Tổng truy cập <b data-ncn-counter="total">—</b></span>`;
  footer.appendChild(section);

  const id = sessionGet(ID_KEY) || crypto.randomUUID();
  sessionSet(ID_KEY, id);
  let acknowledged = sessionGet(ACK_KEY) === id;
  let pending = false;
  const render = data => {
    for (const key of ['online', 'today', 'total']) {
      const target = section.querySelector(`[data-ncn-counter="${key}"]`);
      if (target && Number.isFinite(data[key])) target.textContent = formatter.format(data[key]);
    }
  };
  async function update() {
    if (pending || document.hidden) return;
    pending = true;
    try {
      const response = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visit: !acknowledged }), cache: 'no-store', keepalive: true,
      });
      if (!response.ok) throw new Error('Counter failed');
      const data = await response.json();
      if (!acknowledged) { acknowledged = true; sessionSet(ACK_KEY, id); }
      render(data);
    } catch {
      section.title = 'Chưa cập nhật được lượt truy cập';
    } finally { pending = false; }
  }
  update();
  const timer = window.setInterval(update, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}
