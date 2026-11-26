export const isGenkArticle=row=>row?.source==='GenK'&&/^rss-genk-[a-f0-9]{20}$/.test(row.id||'');
export const genkArticleHref=row=>isGenkArticle(row)?'/tin-tuc-cong-nghe/?bai='+encodeURIComponent(row.id):'';
export const reactionOptions=[{id:'like',icon:'👍',label:'Thích'},{id:'dislike',icon:'👎',label:'Không thích'},{id:'love',icon:'❤️',label:'Tim'},{id:'angry',icon:'😠',label:'Giận'}];
export function shareURL(platform,url,title=''){
  if(platform==='facebook')return 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
  if(platform==='threads')return 'https://www.threads.com/intent/post?text='+encodeURIComponent(title)+'&url='+encodeURIComponent(url);
  return '';
}
