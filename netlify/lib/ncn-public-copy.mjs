import {CAMPAIGN_LEVEL_COUNT} from '../../public/assets/ncn-arcade/campaign.js';
import {AUDIO_MIC,AUDIO_TOOL,withAudioTool} from '../../public/assets/ncn-audio/shared.js';

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

// Use the same first entry for the initial HTML, fallback config and hydrated menu.
export function audioToolConfig(config){return {...config,tools:withAudioTool(config.tools)};}
const audioIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+AUDIO_MIC+'</svg>';
export function addAudioTool(html){
 const {id,title,href,description,tone}=AUDIO_TOOL;
 html=html.replace(/(<script id="ncn-initial-config" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,start,config,end)=>start+JSON.stringify(audioToolConfig(JSON.parse(config))).replace(/</g,'\\u003c')+end);
 const link='<a class="ncn-nav-link" href="'+href+'" data-ncn-tool="'+id+'"'+(html.includes('id="ncn-audio-app"')?' aria-current="page"':'')+'>'+audioIcon+'<span>'+title+'</span><b class="ncn-nav-pill ncn-new-badge">NEW</b></a>';
 html=html.replace(/(<nav id="ncn-navigation"[^>]*>\s*<p class="ncn-nav-label">Mở nhanh<\/p>)(?!<a class="ncn-nav-link" href="\/thu-audio\/")/,'$1'+link);
 const star='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z"/></svg>';
 const card='<article class="ncn-tool-card ncn-tone-'+tone+'" data-ncn-tool="'+id+'"><a class="ncn-tool-link" href="'+href+'"><div class="ncn-tool-top"><span class="ncn-tool-icon">'+audioIcon+'</span><span class="ncn-tool-badge ncn-new-badge">NEW</span></div><h3>'+title+'</h3><p>'+description+'</p><span class="ncn-card-open">Mở công cụ ↗</span></a><button type="button" class="ncn-pin" data-ncn-pin="'+id+'" aria-pressed="false" aria-label="Ghim '+title+'">'+star+'</button></article>';
 if(!html.includes('data-ncn-pin="'+id+'"')&&html.includes('id="ncn-tool-grid"')){
  html=html.replace(/(<div id="ncn-tool-grid"[^>]*>)/,'$1'+card);
  html=html.replace(/(<p id="ncn-tool-count"[^>]*>)(\d+) \/ (\d+) công cụ/,(_,start,shown,total)=>start+(Number(shown)+1)+' / '+(Number(total)+1)+' công cụ');
 }
 return html;
}
