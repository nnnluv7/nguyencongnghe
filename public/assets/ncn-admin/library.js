import {escapeHTML,renderMarkdown,safeURL} from '../ncn-library/content.js?v=20261025-admin-1';

const statuses={published:'Đang hiện',hidden:'Đang ẩn',draft:'Bản nháp',trash:'Thùng rác'};
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
export function mountLibraryAdmin({host,api,doc=document,win=window}){
  const $=id=>host.querySelector('#'+id),listeners=[];
  let items=[],selected=null,draftId='',snapshot='',dirty=false,busy=false,epoch=0,disposed=false;
  const listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
  const message=(text,error=false)=>{if(disposed)return;$('nl-status').textContent=text;$('nl-status').classList.toggle('na-error',error);};
  function collect(){
    const kind=$('nl-kind').value,mode=kind==='legacy'?$('nl-mode').value:kind==='article'?'markdown':'link';
    return {id:selected?.id||draftId,version:selected?.version??null,kind,mode,title:$('nl-title').value.trim(),summary:$('nl-summary').value.trim(),image:$('nl-image').value.trim(),labels:$('nl-labels').value.split(',').map(x=>x.trim()).filter(Boolean),status:$('nl-state').value,href:$('nl-href').value.trim(),body:mode==='markdown'?$('nl-body').value:''};
  }
  function controls(){
    const trash=selected?.status==='trash';
    $('nl-form').querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=busy||trash);
    $('nl-kind').disabled=busy||!!selected;
    $('nl-restore').disabled=busy;$('nl-restore').hidden=!trash;
    $('nl-save').hidden=trash;$('nl-trash').hidden=!selected||trash;
    $('nl-visibility').hidden=!selected||!['published','hidden'].includes(selected.status);
    $('nl-visibility').textContent=selected?.status==='published'?'Ẩn khỏi Thư viện':'Hiện trong Thư viện';
    $('nl-new').disabled=busy;$('nl-refresh').disabled=busy;
    $('nl-list').querySelectorAll('button').forEach(button=>button.disabled=busy);
    const kind=$('nl-kind').value;
    $('nl-mode-field').hidden=kind!=='legacy'||!selected?.managedPage;
    $('nl-tool-note').hidden=kind!=='legacy'||!!selected?.managedPage;
    $('nl-body-section').hidden=!(kind==='article'||kind==='legacy'&&selected?.managedPage&&$('nl-mode').value==='markdown');
    $('nl-state').querySelector('[value=draft]').disabled=kind==='legacy';
    $('nl-href').readOnly=kind!=='link';$('nl-href').required=kind==='link';
    $('nl-href-help').textContent=kind==='link'?'Đường dẫn của bài viết trên website hoặc trang khác.':kind==='legacy'?'Đường dẫn gốc được giữ nguyên.':'Đường dẫn được tạo tự động khi lưu bài.';
    $('nl-open').hidden=!selected||selected.status==='draft'||selected.status==='trash'&&selected.pageRemoved;
  }
  function preview(){
    const input=collect(),image=safeURL(input.image);
    $('nl-preview').innerHTML='<h2>'+escapeHTML(input.title||'Tiêu đề bài viết')+'</h2>'+(image?'<img src="'+escapeHTML(image)+'" alt="">':'')+renderMarkdown(input.body);
  }
  function changed(){dirty=JSON.stringify(collect())!==snapshot;controls();if(!$('nl-preview').hidden)preview();}
  const discard=()=>!dirty||win.confirm('Anh có thay đổi chưa lưu. Chuyển bài và bỏ những thay đổi này?');
  function list(){
    const query=fold($('nl-search').value),filter=$('nl-filter').value;
    const rows=items.filter(item=>(filter==='all'?item.status!=='trash':item.status===filter)&&fold(item.title+' '+item.labels.join(' ')).includes(query));
    rows.sort((a,b)=>(Date.parse(b.updatedAt||b.datetime)||0)-(Date.parse(a.updatedAt||a.datetime)||0));
    $('nl-count').textContent=rows.length+' mục · '+items.filter(x=>x.status==='trash').length+' trong Thùng rác';
    $('nl-list').innerHTML=rows.map(item=>'<button type="button" class="nl-list-item" data-article-id="'+escapeHTML(item.id)+'" aria-pressed="'+(selected?.id===item.id)+'"><span>'+escapeHTML(item.title)+'</span><small>'+escapeHTML(statuses[item.status])+' · '+escapeHTML(item.labels[0]||'Chưa phân loại')+'</small></button>').join('')||'<p class="na-muted nl-list-empty">Chưa có bài trong mục này.</p>';
    $('nl-categories').innerHTML=[...new Set(items.flatMap(x=>x.labels))].sort((a,b)=>a.localeCompare(b,'vi')).map(name=>'<option value="'+escapeHTML(name)+'"></option>').join('');
    controls();
  }
  async function refresh(){const result=await api('manage');if(disposed)return;items=result.items;list();}
  function fill(item=null,body='',original=''){
    selected=item;draftId=item?.id||'post-'+win.crypto.randomUUID();
    $('nl-kind').value=item?.kind||'article';$('nl-title').value=item?.title||'';$('nl-summary').value=item?.summary||'';$('nl-image').value=item?.image||'';
    $('nl-labels').value=(item?.labels||[]).join(', ');$('nl-state').value=item?.status==='trash'?(item.previousStatus||'published'):item?.status||'draft';
    $('nl-mode').value=item?.mode==='markdown'?'markdown':'original';$('nl-body').value=body||original;$('nl-href').value=item?.href||'';
    $('nl-editor-title').textContent=!item?'Thêm bài viết':item.status==='trash'?'Bài trong Thùng rác':'Chỉnh sửa bài viết';
    $('nl-source').textContent=!item?'Bài mới':item.kind==='legacy'?(item.managedPage?'Bài đã có trên website':'Lối tắt công cụ'):item.kind==='link'?'Bài liên kết':'Bài viết trên website';
    $('nl-open').href=item?.href||'/thu-vien/';$('nl-preview').hidden=true;$('nl-preview-toggle').setAttribute('aria-expanded','false');
    snapshot=JSON.stringify(collect());dirty=false;list();controls();
  }
  async function edit(id,{force=false}={}){
    if(!force&&!discard())return;const generation=++epoch;
    const result=await api('detail',null,{id});if(disposed||generation!==epoch)return;
    fill(result.item,result.body,result.originalBody);
    const url=new URL(win.location.href);url.searchParams.set('id',id);win.history.replaceState(null,'',url);
    message(result.item.status==='trash'?'Bài đang trong Thùng rác. Chọn Khôi phục để đưa bài trở lại.':'Đã mở bài viết.');
  }
  async function run(action){
    if(busy||disposed)return;busy=true;controls();
    try{await action();}
    catch(error){message(error.message,true);if(error.status===409)await refresh().catch(()=>{});}
    finally{busy=false;if(!disposed)controls();}
  }
  function announce(){
    win.dispatchEvent(new win.Event('ncn-library-changed'));
    try{win.localStorage.setItem('ncn:library:changed',String(Date.now()));}catch{}
  }
  listen($('nl-form'),'input',changed);listen($('nl-form'),'change',changed);
  listen($('nl-search'),'input',list);listen($('nl-filter'),'change',list);
  listen($('nl-list'),'click',event=>{const button=event.target.closest('[data-article-id]');if(button&&!busy)run(()=>edit(button.dataset.articleId));});
  listen($('nl-new'),'click',()=>{if(busy||!discard())return;++epoch;fill();const url=new URL(win.location.href);url.searchParams.delete('id');win.history.replaceState(null,'',url);$('nl-title').focus();message('Bài mới đang là bản nháp. Anh chọn trạng thái Đang hiện để công khai khi lưu.');});
  listen($('nl-refresh'),'click',()=>run(async()=>{await refresh();message('Đã tải danh sách mới nhất. Nội dung đang soạn được giữ lại.');}));
  listen($('nl-preview-toggle'),'click',()=>{$('nl-preview').hidden=!$('nl-preview').hidden;$('nl-preview-toggle').setAttribute('aria-expanded',String(!$('nl-preview').hidden));preview();});
  listen($('nl-form'),'submit',event=>{event.preventDefault();run(async()=>{const result=await api('save',collect());await refresh();await edit(result.item.id,{force:true});announce();message(result.item.status==='draft'?'Đã lưu bản nháp. Bài chưa công khai.':result.item.status==='hidden'?'Đã lưu bài và ẩn khỏi danh sách Thư viện.':'Đã lưu và cập nhật bài trong Thư viện.');});});
  listen($('nl-visibility'),'click',()=>{if(!discard())return;run(async()=>{const result=await api('visibility',{id:selected.id,version:selected.version});await refresh();await edit(result.item.id,{force:true});announce();message(result.item.status==='hidden'?'Đã ẩn khỏi Thư viện. Trang gốc vẫn mở được bằng liên kết.':'Đã hiện bài trong Thư viện.');});});
  const trashDialog=$('nl-trash-dialog');
  function trashHelp(){
    $('nl-trash-help').textContent=selected?.kind==='article'||$('nl-remove-page').checked?'Bài sẽ được gỡ khỏi Thư viện và trang bài viết sẽ tạm ngừng công khai. Anh có thể khôi phục cả hai từ Thùng rác.':'Chỉ gỡ bài khỏi danh sách Thư viện. Liên kết trang gốc vẫn mở được. Anh có thể khôi phục từ Thùng rác.';
  }
  listen($('nl-trash'),'click',()=>{if(busy||!discard())return;$('nl-trash-name').textContent=selected.title;$('nl-remove-page-option').hidden=selected.kind!=='legacy'||!selected.managedPage;$('nl-remove-page').checked=selected.kind==='article';trashHelp();trashDialog.showModal();});
  listen($('nl-remove-page'),'change',trashHelp);listen($('nl-trash-cancel'),'click',()=>trashDialog.close());
  listen($('nl-trash-confirm'),'click',()=>{trashDialog.close();run(async()=>{const result=await api('trash',{id:selected.id,version:selected.version,removePage:$('nl-remove-page').checked});await refresh();await edit(result.item.id,{force:true});announce();message('Đã đưa bài vào Thùng rác. Anh có thể khôi phục khi cần.');});});
  listen($('nl-restore'),'click',()=>run(async()=>{const result=await api('restore',{id:selected.id,version:selected.version});await refresh();await edit(result.item.id,{force:true});announce();message('Đã khôi phục bài viết và trạng thái trước khi xoá.');}));
  listen(host,'click',event=>{
    const button=event.target.closest('[data-format]');if(!button)return;
    const field=$('nl-body'),start=field.selectionStart,end=field.selectionEnd,text=field.value.slice(start,end)||'nội dung';
    const formats={heading:'\n## '+text+'\n',bold:'**'+text+'**',italic:'*'+text+'*',list:'\n- '+text+'\n',link:'['+text+'](https://duong-dan)',image:'\n![Mô tả ảnh](https://duong-dan-anh)\n'};
    field.setRangeText(formats[button.dataset.format],start,end,'select');field.focus();changed();
  });
  const beforeUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};win.addEventListener('beforeunload',beforeUnload);
  fill();run(async()=>{await refresh();const id=new URL(win.location.href).searchParams.get('id');if(id)await edit(id,{force:true});else message('Thư viện đã sẵn sàng. Chọn bài để sửa hoặc thêm bài viết mới.');});
  return {destroy(){disposed=true;++epoch;listeners.forEach(remove=>remove());win.removeEventListener('beforeunload',beforeUnload);if(trashDialog.open)trashDialog.close();}};
}
