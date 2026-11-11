import {CAMPAIGN_LEVEL_COUNT} from '../../public/assets/ncn-arcade/campaign.js';

// The retained pages share these fragments. Remove them before rendering
// catalogue entries, notices, stories or managed article text.
const repeatedMarkup=[
  '<span><strong data-ncn-config="brand">NCN</strong><small data-ncn-config="tagline">Không gian công cụ của bạn</small></span>',
  '<span data-ncn-config="brand">NCN</span>',
  '<span class="ncn-eyebrow">TỪ THƯ VIỆN NCN</span>',
  '<a href="/">NCN</a><span>/</span>'
];
const repeatedLabels=/(?:NCN (?:Arcade|ARCADE|Blast|BLAST)|(?:Rắn Lướt|RẮN LƯỚT|Flappy Bird|Thư viện|THƯ VIỆN|Tài khoản|tài khoản|TÀI KHOẢN|Đăng nhập|Thành viên|thành viên|THÀNH VIÊN|TIỆN ÍCH|cộng đồng|Mã đơn|Line Admin) NCN)\b/g;
const campaignCopy=[
  ['Nối thú cổ điển, 30 màn dồn ô','Nối thú cổ điển, '+CAMPAIGN_LEVEL_COUNT+' màn dồn ô'],
  ['30 màn đổi hướng dồn ô',CAMPAIGN_LEVEL_COUNT+' màn đổi hướng dồn ô'],
  ['bắn trứng. 200 màn, 20 miền','bắn trứng. '+CAMPAIGN_LEVEL_COUNT+' màn, 20 miền'],
  ['Bắn Trứng Khủng Long · 200 màn','Bắn Trứng Khủng Long · '+CAMPAIGN_LEVEL_COUNT+' màn'],
  ['săn kim cương. 200 màn cổ điển','săn kim cương. '+CAMPAIGN_LEVEL_COUNT+' màn cổ điển'],
  ['combo cuồng ăn và lớn lên qua 6 vùng biển','combo cuồng ăn và lớn lên qua '+CAMPAIGN_LEVEL_COUNT+' màn ở 6 vùng biển']
];

export function trimPublicCopy(html){
  for(const markup of repeatedMarkup)html=html.replaceAll(markup,'');
  for(const [before,after] of campaignCopy)html=html.replaceAll(before,after);
  return html
    .replace(/(<small id="ncn-page-title">|<div class="lw-hub" aria-hidden="true">)NCN</g,'$1<')
    .replaceAll('Chào mừng đến với NCN','Chào mừng')
    .replaceAll('góp ý cho NCN','góp ý')
    .replace(/NCN (?:\| |· )| [|·] NCN(?=<|")/g,'')
    .replace(repeatedLabels,label=>label.replace('NCN','').trim());
}
