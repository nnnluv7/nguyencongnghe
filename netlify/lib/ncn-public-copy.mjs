// The retained pages share these fragments. Remove them before rendering
// catalogue entries, notices, stories or managed article text.
const repeatedMarkup=[
  '<span><strong data-ncn-config="brand">NCN</strong><small data-ncn-config="tagline">Không gian công cụ của bạn</small></span>',
  '<span data-ncn-config="brand">NCN</span>',
  '<span class="ncn-eyebrow">TỪ THƯ VIỆN NCN</span>',
  '<a href="/">NCN</a><span>/</span>'
];
const repeatedLabels=/(?:NCN (?:Arcade|ARCADE|Blast|BLAST)|(?:Rắn Lướt|RẮN LƯỚT|Flappy Bird|Thư viện|THƯ VIỆN|Tài khoản|tài khoản|TÀI KHOẢN|Đăng nhập|Thành viên|thành viên|THÀNH VIÊN|TIỆN ÍCH|cộng đồng|Mã đơn|Line Admin) NCN)\b/g;

export function trimPublicCopy(html){
  for(const markup of repeatedMarkup)html=html.replaceAll(markup,'');
  return html
    .replace(/(<small id="ncn-page-title">|<div class="lw-hub" aria-hidden="true">)NCN</g,'$1<')
    .replaceAll('Chào mừng đến với NCN','Chào mừng')
    .replaceAll('góp ý cho NCN','góp ý')
    .replace(/NCN (?:\| |· )| [|·] NCN(?=<|")/g,'')
    .replace(repeatedLabels,label=>label.replace('NCN','').trim());
}
