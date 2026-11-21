import {CAMPAIGN_LEVEL_COUNT} from '../../public/assets/ncn-arcade/campaign.js';
import {AUDIO_MIC,AUDIO_TOOL,withAudioTool} from '../../public/assets/ncn-audio/shared.js';
import {homeCardArt} from '../../public/assets/ncn-theme/home-card-art.js';
import {POPUP_TOOL,withMergedPopup} from '../../public/assets/ncn-theme/popup-tool.js';
import {CASH_FUND_ICON,CASH_FUND_TOOL,withCashFundTool} from '../../public/assets/ncn-theme/cash-fund-tool.js';

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
    .replace(repeatedLabels,label=>label.replace('NCN','').trim())
    // Normalize the retained navigation without touching article text or assets.
    .replace(/(<a\b[^>]*\shref=["'])(?:https?:\/\/(?:www\.)?nguyencongnghe\.com)?\/thu-vien(?:\/index\.html|\/)?([?#][^"']*)?(["'][^>]*>)([\s\S]*?)(<\/a>)/gi,
      (_,open,suffix='',attrs,label,close)=>open+'/tin-tuc-cong-nghe/'+suffix+attrs+label.replace(/thư viện(?: bài viết)?/giu,'Tin tức công nghệ')+close);
}

// Use the same first entry for the initial HTML, fallback config and hydrated menu.
export function publicToolConfig(config){return {...config,tools:withMergedPopup(withCashFundTool(withAudioTool(config.tools)))};}
const audioIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+AUDIO_MIC+'</svg>';
const receiptIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+CASH_FUND_ICON+'</svg>';
const pinIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z"/></svg>';
export function addAudioTool(html){
 const {id,title,href,description,tone}=AUDIO_TOOL;
 html=html.replace(/(<script id="ncn-initial-config" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,start,config,end)=>start+JSON.stringify(publicToolConfig(JSON.parse(config))).replace(/</g,'\\u003c')+end);
 const link='<a class="ncn-nav-link" href="'+href+'" data-ncn-tool="'+id+'"'+(html.includes('id="ncn-audio-app"')?' aria-current="page"':'')+'>'+audioIcon+'<span>'+title+'</span><b class="ncn-nav-pill ncn-new-badge">NEW</b></a>';
 html=html.replace(/(<nav id="ncn-navigation"[^>]*>\s*<p class="ncn-nav-label">Mở nhanh<\/p>)(?!<a class="ncn-nav-link" href="\/thu-audio\/")/,'$1'+link);
 const card='<article class="ncn-tool-card ncn-tone-'+tone+'" data-ncn-tool="'+id+'"><a class="ncn-tool-link" href="'+href+'"><div class="ncn-tool-top"><span class="ncn-tool-icon">'+audioIcon+'</span><span class="ncn-tool-badge ncn-new-badge">NEW</span></div><h3>'+title+'</h3><p>'+description+'</p><span class="ncn-card-open">Mở công cụ ↗</span></a><button type="button" class="ncn-pin" data-ncn-pin="'+id+'" aria-pressed="false" aria-label="Ghim '+title+'">'+pinIcon+'</button></article>';
 if(!html.includes('data-ncn-pin="'+id+'"')&&html.includes('id="ncn-tool-grid"')){
  html=html.replace(/(<div id="ncn-tool-grid"[^>]*>)/,'$1'+card);
  html=html.replace(/(<p id="ncn-tool-count"[^>]*>)(\d+) \/ (\d+) công cụ/,(_,start,shown,total)=>start+(Number(shown)+1)+' / '+(Number(total)+1)+' công cụ');
 }
 return html;
}

function addCashFundTool(html){
 const {id,title,href,description,tone}=CASH_FUND_TOOL;
 const link='<a class="ncn-nav-link" href="'+href+'" data-ncn-tool="'+id+'"'+(html.includes('id="ncn-cash-fund-app"')?' aria-current="page"':'')+'>'+receiptIcon+'<span>'+title+'</span></a>';
 html=html.replace(/(<nav id="ncn-(?:navigation|game-nav)"[^>]*>)([\s\S]*?)(<\/nav>)/g,(_,open,inside,close)=>{
  if(inside.includes('href="'+href+'"'))return open+inside+close;
  return open+inside.replace(/<a\b[^>]*href="\/2024\/02\/kiem-quy\.html"[^>]*>[\s\S]*?<\/a>/,'$&'+link)+close;
 });
 if(!html.includes('id="ncn-tool-grid"')||html.includes('data-ncn-pin="'+id+'"'))return html;
 const card='<article class="ncn-tool-card ncn-tone-'+tone+'" data-ncn-tool="'+id+'"><a class="ncn-tool-link" href="'+href+'"><div class="ncn-tool-top"><span class="ncn-tool-icon">'+receiptIcon+'</span></div><h3>'+title+'</h3><p>'+description+'</p><span class="ncn-card-open">Mở công cụ ↗</span></a><button type="button" class="ncn-pin" data-ncn-pin="'+id+'" aria-pressed="false" aria-label="Ghim '+title+'">'+pinIcon+'</button></article>';
 let inserted=false;
 html=html.replace(/<article class="ncn-tool-card[^"]*"[^>]*>[\s\S]*?<\/article>/g,prev=>{
  if(!prev.includes('data-ncn-pin="cash"'))return prev;
  inserted=true;
  return prev+card;
 });
 return inserted?html.replace(/(<p id="ncn-tool-count"[^>]*>)(\d+) \/ (\d+) công cụ/,(_,start,shown,total)=>start+(Number(shown)+1)+' / '+(Number(total)+1)+' công cụ'):html;
}

export function preparePublicTools(html){
  html=addCashFundTool(addAudioTool(html));
  // Keep the first paint and every retained public shell linked to Donate.
  html=html.replace(/(<nav id="ncn-(?:navigation|game-nav)"[^>]*>)([\s\S]*?)(<\/nav>)/g,(_,open,inside,close)=>open+inside+(inside.includes('href="/donate/#reg"')?'':'<a class="ncn-nav-link" href="/donate/#reg"><span>Donate · Thành viên ủng hộ</span></a>')+close);
  html=html.replace(/(<footer id="ncn-footer"[^>]*>)([\s\S]*?)(<\/footer>)/g,(_,open,inside,close)=>open+inside+(inside.includes('href="/donate/#reg"')?'':'<a class="ncn-footer-donate" href="/donate/#reg">Ủng hộ nguyencongnghe.com ♡</a>')+close);
  html=html.replace(/<a class="ncn-nav-link"[^>]*data-ncn-tool="(popup-large|popup-a7)"[^>]*>[\s\S]*?<\/a>/g,(link,id)=>
    id==='popup-large'?'':link.replace(/<span>Popup A7 \/ LED<\/span>/,'<span>'+POPUP_TOOL.title+'</span>'));
  let removedCard=false;
  html=html.replace(/<article class="ncn-tool-card[^"]*"[^>]*>[\s\S]*?<\/article>/g,card=>{
    const id=card.match(/data-ncn-pin="([^"]+)"/)?.[1];
    if(id==='popup-large'){
      removedCard=true;
      return '';
    }
    if(id===POPUP_TOOL.id){
      card=card.replaceAll('Popup A7 / LED',POPUP_TOOL.title).replace(/(<\/h3><p>)[^<]*/,'$1'+POPUP_TOOL.description);
    }
    if(/\bclass="ncn-tool-art(?:\s|")/.test(card))return card;
    return card.replace('<div class="ncn-tool-top">',homeCardArt(id)+'<div class="ncn-tool-top">');
  });
  if(removedCard){
    html=html.replace(/(<p id="ncn-tool-count"[^>]*>)(\d+) \/ (\d+) công cụ/,(_,start,shown,total)=>start+(Number(shown)-1)+' / '+(Number(total)-1)+' công cụ');
  }
  return html;
}
