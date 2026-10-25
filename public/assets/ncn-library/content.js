/* One passive renderer for editor previews and published articles. Raw HTML is text. */
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value){
  const s=String(value??'').trim();if(!s||/[\u0000-\u0020\u007f\\]/.test(s))return '';
  if(s.startsWith('/')&&!s.startsWith('//'))return s;
  try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export const slugify=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75)||'bai-viet';
function inline(source){
  const pattern=/!?\[([^\]\n]{0,500})\]\(([^)\s]{1,2048})\)|\*\*([^*\n]{1,1000})\*\*|\*([^*\n]{1,1000})\*|`([^`\n]{1,1000})`/g;
  let out='',end=0;
  for(const m of source.matchAll(pattern)){
    out+=escapeHTML(source.slice(end,m.index));end=m.index+m[0].length;
    if(m[1]!==undefined){
      const url=safeURL(m[2]);
      out+=!url?escapeHTML(m[0]):m[0][0]==='!'?`<img src="${escapeHTML(url)}" alt="${escapeHTML(m[1])}" loading="lazy" decoding="async">`:`<a href="${escapeHTML(url)}"${url.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${escapeHTML(m[1])}</a>`;
    }else if(m[3])out+='<strong>'+escapeHTML(m[3])+'</strong>';
    else if(m[4])out+='<em>'+escapeHTML(m[4])+'</em>';
    else out+='<code>'+escapeHTML(m[5])+'</code>';
  }
  return out+escapeHTML(source.slice(end));
}
export function renderMarkdown(value){
  const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n'),out=[];let paragraph=[],list=null,code=null;
  const flush=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];}if(list){out.push('</'+list+'>');list=null;}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i],trim=line.trim();
    if(trim.startsWith('```')){flush();if(code){out.push('<pre><code>'+escapeHTML(code.join('\n'))+'</code></pre>');code=null;}else code=[];continue;}
    if(code){code.push(line);continue;}
    if(!trim){flush();continue;}
    const heading=trim.match(/^(#{1,3})\s+(.+)$/),item=trim.match(/^([-*]|\d+\.)\s+(.+)$/);
    if(heading){flush();const n=Math.max(2,heading[1].length);out.push(`<h${n}>${inline(heading[2])}</h${n}>`);continue;}
    if(item){const tag=/\d/.test(item[1])?'ol':'ul';if(list!==tag){flush();list=tag;out.push('<'+tag+'>');}out.push('<li>'+inline(item[2])+'</li>');continue;}
    if(trim.startsWith('> ')){flush();out.push('<blockquote>'+inline(trim.slice(2))+'</blockquote>');continue;}
    if(/^---+$/.test(trim)){flush();out.push('<hr>');continue;}
    if(list)flush();paragraph.push(trim);
  }
  flush();if(code)out.push('<pre><code>'+escapeHTML(code.join('\n'))+'</code></pre>');return out.join('\n');
}
