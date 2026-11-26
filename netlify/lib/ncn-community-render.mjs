import {escapeHTML} from '../../public/assets/ncn-library/content.js';

const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function withArticleCommunity(html,item){
  if(!item?.id||html.includes('id="ncn-article-community"'))return html;
  const target={kind:'article',id:item.id,title:item.title,url:'https://nguyencongnghe.com'+item.href};
  const panel='<section id="ncn-article-community" class="ncn-community" data-ncn-community aria-label="Bình luận và tương tác"><h2>Bình luận &amp; tương tác</h2><p>Chia sẻ cảm nhận của bạn về bài viết.</p><noscript>Bật JavaScript để bình luận và tương tác.</noscript></section>';
  return html.replace('</main>',panel+'</main>').replace('</head>','<script id="ncn-community-target" type="application/json">'+json(target)+'</script></head>');
}
export function genkSummaryHTML(item){
  // Show the complete RSS description in the reader. The catalogue keeps its
  // short preview, while the full article remains at the original source.
  return '<div class="ncn-news-source"><span>TÓM TẮT TỪ GENK</span><p>'+escapeHTML(item.summaryLong||item.summary||'Mở bài gốc để đọc đầy đủ nội dung.')+'</p><a class="ncn-news-original" href="'+escapeHTML(item.link)+'" target="_blank" rel="noopener noreferrer">Đọc toàn bộ bài trên GenK</a><small>Nguồn: GenK · Nội dung đầy đủ và bản quyền thuộc nguồn xuất bản.</small></div>';
}
