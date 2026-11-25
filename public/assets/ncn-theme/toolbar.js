/* The same two toolbar groups are rendered on the server and retained pages. */
export function toolbarHTML(html){
  const header=html.match(/<header\b[^>]*id="ncn-topbar"[^>]*>[\s\S]*?<\/header>/)?.[0];
  if(!header||header.includes('data-ncn-toolbar-groups'))return html;
  const menu=html.match(/<button\b[^>]*id="ncn-menu-open"[^>]*>[\s\S]*?<\/button>/)?.[0];
  const search=header.match(/<button\b[^>]*class="ncn-top-search"[^>]*>[\s\S]*?<\/button>/)?.[0];
  if(!menu||!search)return html;
  const icon=search.match(/<span\b[^>]*data-ncn-icon="search"[^>]*>[\s\S]*?<\/span>/)?.[0];
  if(!icon)return html;
  const compactSearch='<button type="button" class="ncn-top-search" data-ncn-search-open aria-label="Tìm công cụ, bài viết" title="Tìm công cụ, bài viết (Ctrl/⌘ K)">'+icon+'</button>';
  const grouped=header.replace('<header','<header data-ncn-toolbar-groups')
    .replace('<div class="ncn-topbar-left">','<div class="ncn-topbar-left">'+menu)
    .replace(search,'').replace('<div class="ncn-topbar-right">','<div class="ncn-topbar-right">'+compactSearch);
  return html.replace(menu,'').replace(header,grouped);
}

// Compatibility for source previews and a previously cached page shell.
export function installToolbarLayout(doc=document){
  const bar=doc.getElementById('ncn-topbar');if(!bar||bar.hasAttribute('data-ncn-toolbar-groups'))return;
  const left=bar.querySelector('.ncn-topbar-left'),right=bar.querySelector('.ncn-topbar-right');
  const menu=doc.getElementById('ncn-menu-open'),search=bar.querySelector('.ncn-top-search');
  if(!left||!right||!menu||!search)return;
  left.prepend(menu);right.prepend(search);
  search.setAttribute('aria-label','Tìm công cụ, bài viết');search.title='Tìm công cụ, bài viết (Ctrl/⌘ K)';
  [...search.children].filter(node=>!node.matches('[data-ncn-icon="search"]')).forEach(node=>node.remove());
  bar.setAttribute('data-ncn-toolbar-groups','');
}
