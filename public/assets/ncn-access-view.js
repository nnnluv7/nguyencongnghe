const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Public layout only. Records, prices, roles and private editor code arrive from
// their authenticated endpoints; this frame never grants access to an action.
export function publicToolFrame(title = 'Công cụ', kind = 'print') {
  const heading = '<header><h2>'+escape(title)+'</h2></header>';
  const admin = '<div class="ncn-access-modules">'+['Thư viện','Thông báo','Thành viên'].map(label=>'<section><h3>'+label+'</h3></section>').join('')+'</div>';
  const print = '<div class="ncn-access-layout"><section><h3>In bổ sung / kiểm tra giá</h3><fieldset disabled><label>Chương trình<select><option>Chọn chương trình</option></select></label><label>Tìm sản phẩm<input type="search" placeholder="Nhập mã sản phẩm hoặc model"></label><div class="ncn-access-actions"><button type="button">Nhập file ERP</button><button type="button">Xuất Excel</button></div></fieldset><div class="ncn-access-columns"><span>Sản phẩm</span><span>Số lượng</span><span>Giá</span></div></section><section><h3>Xem trước</h3><div class="ncn-access-paper" aria-hidden="true"></div></section></div>';
  return '<section class="ncn-access-workspace" data-ncn-public-tool-shell aria-label="'+escape(title)+'">'+heading+(kind==='admin'?admin:print)+'</section>';
}

export function setAccessView({root, gate, content}, phase) {
  root.dataset.ncnAccessPhase = phase;
  root.setAttribute('aria-busy', String(phase === 'pending'));
  const visible = phase === 'pending' || phase === 'ready';
  gate.hidden = visible;
  content.hidden = !visible;
  content.inert = phase === 'pending';
}

// Shared by static builds and server-rendered pages. Future pages using the
// common VIP/Admin loaders inherit the same first-paint layout automatically.
export function prepareAccessViews(html) {
  html = html.replace(/<div\b([^>]*\bid="vip-app"[^>]*)>\s*<\/div>/g, (tag, attrs) => {
    const title = attrs.match(/data-ncn-tool-title="([^"]+)"/)?.[1] || 'Công cụ in';
    return '<div'+attrs+'>'+publicToolFrame(title)+'</div>';
  });
  return html.replace(/<div class="na-access" id="ncn-admin-access"[^>]*>[\s\S]*?<\/div>/g, tag => {
    const title = tag.match(/<h1>([^<]+)<\/h1>/)?.[1] || 'Quản trị Admin';
    return publicToolFrame(title, 'admin');
  });
}
