import {escapeHTML} from '../../public/assets/ncn-library/content.js';
import {articleCardHTML,libraryLabelName,libraryLabels,latestArticles,featuredArticles} from '../../public/assets/ncn-theme/catalogue.js';

const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const region=(html,name,content)=>html.replace(new RegExp('(<!-- NCN:'+name+':start -->)[\\s\\S]*?(<!-- NCN:'+name+':end -->)'),(_,start,end)=>start+content+end);
export function renderPublicHTML(html,catalog,{notices=[],stories=null,now=Date.now(),query=new URLSearchParams()}={}){
  html=html.replace(/site\.css\?v=[^"']+/g,'site.css?v=20261025-sync-1').replace(/theme\.js\?v=[^"']+/g,'theme.js?v=20261025-sync-1');
  html=html.replace(/<link rel="modulepreload" href="\/assets\/ncn-theme\/(?:theme|catalogue)\.js[^"<>]*">\n?/g,'');
  if(/<script[^>]*src="\/assets\/ncn-theme\/theme\.js/.test(html)){
    const first=html.search(/<script\b[^>]*src=/),links='<link rel="modulepreload" href="/assets/ncn-theme/theme.js?v=20261025-sync-1">\n<link rel="modulepreload" href="/assets/ncn-theme/catalogue.js?v=20261025-sync-1">\n';
    html=html.slice(0,first)+links+html.slice(first);
  }
  let config={};try{config=JSON.parse(html.match(/<script id="ncn-initial-config"[^>]*>([\s\S]*?)<\/script>/)?.[1]||'{}');}catch{}
  const rows=catalog.slice().sort((a,b)=>(Date.parse(b.datetime)||0)-(Date.parse(a.datetime)||0)),options={logo:config.logo},card=row=>articleCardHTML(row,options);
  html=region(html,'articles',latestArticles(rows,config.tools).map(card).join('')||'<p class="ncn-empty">Chưa có bài viết được công khai.</p>');
  const featured=featuredArticles(rows,config.tools);html=region(html,'featured',featured.map(card).join(''));
  html=html.replace(/(<section id="ncn-library-featured"[^>]*)(>)/,(_,start,end)=>start.replace(/ hidden/g,'')+(featured.length?'':' hidden')+end);
  if(html.includes('id="ncn-library"')){
    const labels=[...new Set(rows.flatMap(libraryLabels))].sort((a,b)=>a.localeCompare(b,'vi'));
    const q=query.get('q')||'',wanted=libraryLabelName(query.get('label')),label=labels.includes(wanted)?wanted:'',source=['ncn','genk'].includes(query.get('source'))?query.get('source'):'';
    const result=rows.filter(row=>(!label||libraryLabels(row).includes(label))&&(!source||(source==='genk')===(row.source==='GenK'))&&fold(row.title+' '+(row.summary||'')+' '+libraryLabels(row).join(' ')).includes(fold(q)));
    const pages=Math.max(1,Math.ceil(result.length/12)),page=Math.max(1,Math.min(Number(query.get('page'))||1,pages));
    html=region(html,'results',result.slice((page-1)*12,page*12).map(card).join('')||'<p class="ncn-empty">Không tìm thấy nội dung. Thử bỏ bộ lọc hoặc đổi từ khóa.</p>');
    html=region(html,'count',result.length+' nội dung'+(q?' phù hợp':''));html=region(html,'page','Trang '+page+' / '+pages);
    html=region(html,'labels','<option value="">Tất cả</option>'+labels.map(x=>'<option value="'+escapeHTML(x)+'"'+(x===label?' selected':'')+'>'+escapeHTML(x)+'</option>').join(''));
    html=html.replace(/(<input id="ncn-library-query"[^>]*)(>)/,(_,start,end)=>start.replace(/ value="[^"]*"/g,'')+' value="'+escapeHTML(q)+'"'+end);
    html=html.replace(/(<option value="(?:ncn|genk)")(?: selected)*/g,(tag)=>tag.replace(/ selected/g,'')+(tag.includes('"'+source+'"')?' selected':''));
    html=html.replace(/(id="ncn-library-(?:prev|next)")(?: disabled)*/g,'$1');
    if(page===1)html=html.replace('id="ncn-library-prev"','id="ncn-library-prev" disabled');if(page===pages)html=html.replace('id="ncn-library-next"','id="ncn-library-next" disabled');
    const visible=(stories||[]).filter(x=>Date.parse(x.expiresAt)>now);
    html=region(html,'stories',visible.map(item=>'<button type="button" class="ncn-story-tile" data-story-id="'+escapeHTML(item.id)+'" aria-label="Xem Story của '+escapeHTML(item.name)+'"><img src="/.netlify/functions/ncn-stories?route=image&amp;id='+escapeHTML(item.id)+'&amp;size=thumb" alt="" loading="lazy" width="140" height="196"><span class="ncn-story-tile-copy"><span class="ncn-story-avatar">'+escapeHTML(item.name.slice(0,1).toUpperCase())+'</span><strong>'+escapeHTML(item.name)+'</strong><small>'+escapeHTML(item.caption)+'</small></span></button>').join('')||'<div class="ncn-story-empty"><span class="ncn-story-empty-title">Bắt đầu câu chuyện đầu tiên</span><p>Đăng nhập và chia sẻ bức ảnh của bạn tại đây.</p></div>');
    html=region(html,'story-status',visible.length?visible.length+' khoảnh khắc từ cộng đồng':'Ảnh của thành viên sẽ xuất hiện tại đây.');
  }
  const text=notices.filter(x=>typeof x.text==='string').map(x=>x.text).join('     •     ');
  if(text){html=html.replace(/(<body\b[^>]*class=")/,'$1ncn-has-announcements ').replace(/(<aside id="ncn-announcement"[^>]*?) hidden/,'$1').replace(/(<span id="ncn-announcement-text">)[\s\S]*?<\/span>/,(_,start)=>start+escapeHTML(text)+'</span>');}
  const snapshot='<script>window.NCN_NOTICE_SNAPSHOT='+json({items:notices})+';'+(Array.isArray(stories)&&html.includes('id="ncn-stories"')?'window.NCN_STORIES_SNAPSHOT='+json({items:stories,serverNow:new Date(now).toISOString()})+';':'')+'</script>';
  return html.replace('</head>',snapshot+'</head>');
}
