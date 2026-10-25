import {escapeHTML,safeURL} from '../ncn-library/content.js?v=20261025-admin-1';
export const libraryLabelName=value=>({'PrintMWG':'In ấn','In Ấn':'In ấn','tin-tuc-bao-moi':'Tin tức','tin-tuc-cong-nghe':'Công nghệ','ung-dung-windows':'Phần mềm Windows','thu-thuat':'Thủ thuật','giai-tri':'Giải trí','trend':'Xu hướng'}[value]||value);
export const libraryLabels=row=>[...new Set((row.labels||[]).filter(label=>!/^(Fix-Title|Căn giữa tiêu đề|post)$/i.test(label)).map(libraryLabelName))];
const path=value=>{try{return new URL(value,'https://nguyencongnghe.com').pathname.replace(/\/$/,'');}catch{return '';}};
export const latestArticles=(rows,tools=[])=>rows.filter(row=>row.isArticle!==false&&!row.isPage&&!tools.some(t=>path(t.href)===path(row.link))).slice(0,4);
export const featuredArticles=(rows,tools=[])=>{const pinned=rows.filter(row=>row.featured===true);return (pinned.length?pinned:latestArticles(rows,tools)).slice(0,3);};
export function articleCardHTML(row,{logo='/assets/ncn-theme/logo.png',imageURL=value=>value,icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/></svg>'}={}){
  const href=safeURL(row.link);if(!href)return '';
  let image=safeURL(row.thumbnail?.src),date='';if(image.startsWith('https://i.ibb.co/'))image=safeURL(logo);if(image)image=imageURL(image);
  const time=new Date(row.datetime);if(!Number.isNaN(time.getTime()))date=new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(time);
  const label=libraryLabels(row)[0]||(row.isPage?'Trang nội dung':'Bài viết'),summary=String(row.summary||'').replace(/\(?full-width\)?/gi,'').replace(/^\s*Đang tải dữ liệu\.{3}\s*$/,'').trim(),external=row.source==='GenK';
  return `<a class="ncn-article-card" href="${escapeHTML(href)}"${external?' target="_blank" rel="noopener noreferrer" data-ncn-source="genk"':''}>${image?`<img class="ncn-article-image" src="${escapeHTML(image)}" alt="" loading="lazy" width="640" height="360" decoding="async">`:`<div class="ncn-article-placeholder">${icon}</div>`}<div class="ncn-article-card-body"><div class="ncn-article-meta"><span>${escapeHTML(label)}</span>${external?'<span class="ncn-article-source">GenK</span>':''}<time datetime="${escapeHTML(row.datetime)}">${escapeHTML(date)}</time></div><h3>${escapeHTML(row.title)}</h3><p>${escapeHTML(summary||'Mở trang để xem nội dung.')}</p><span class="ncn-article-read">${external?'Đọc trên GenK':'Xem nội dung'} ↗</span></div></a>`;
}
