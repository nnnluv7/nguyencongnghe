/* Excel import for the eight printable templates: one preview and one print job. */
(() => {
  'use strict';
  const groups = window.CG_IMPORT_MAP;
  if (!groups?.length) return;
  const fileInput = document.getElementById('input');
  const printButton = document.getElementById('button');
  let rows = [], page = 0;
  const notify = message => window.CG?.toast(message) || window.alert(message);
  const valueOf = (row, field) => row?.[field] ?? '';
  function fill(root, sourceRows, offset) {
    groups.forEach((group, slot) => group.forEach(mapping => {
      const element = root.querySelector(`#${mapping.id}`);
      if (!element) return;
      const raw = valueOf(sourceRows[offset + slot], mapping.field);
      const value = mapping.number && raw !== '' && Number.isFinite(Number(raw)) ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : String(raw);
      element.value = value;
      if (element.tagName === 'TEXTAREA') element.textContent = value;
      else element.setAttribute('value', value);
    }));
  }
  function render() {
    fill(document, rows, page * groups.length);
    const total = Math.ceil(rows.length / groups.length);
    nav.querySelector('[data-counter]').textContent = rows.length ? `Trang ${page + 1}/${total} · ${rows.length} sản phẩm` : 'Chưa chọn dữ liệu';
    nav.querySelector('[data-prev]').disabled = page === 0;
    nav.querySelector('[data-next]').disabled = page + 1 >= total;
  }
  function loadRows(sourceRows) { rows=sourceRows.filter(row=>Object.values(row).some(value=>String(value ?? '').trim()));page=0;render(); }
  const nav = document.createElement('div');
  nav.className='cg-batchnav';
  nav.innerHTML='<button type="button" data-prev>‹ Trang trước</button><span data-counter>Chưa chọn dữ liệu</span><button type="button" data-next>Trang sau ›</button><button type="button" data-print-page>In trang đang xem</button>';
  printButton.parentNode.insertBefore(nav, printButton.nextSibling);
  nav.querySelector('[data-prev]').onclick=()=>{if(page>0){page--;render();}};
  nav.querySelector('[data-next]').onclick=()=>{if(page+1<Math.ceil(rows.length/groups.length)){page++;render();}};
  nav.querySelector('[data-print-page]').onclick=()=>window.print();
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    printButton.disabled=true;
    const reader = new FileReader();
    reader.onload=()=>{
      try {
        const workbook=XLSX.read(reader.result,{type:'array'});
        const sourceRows=workbook.SheetNames.flatMap(name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:''}));
        const expected=new Set(groups.flat().map(mapping=>mapping.field));
        if (!sourceRows.length) throw new Error('File chưa có sản phẩm.');
        if (!Object.keys(sourceRows[0]).some(key=>expected.has(key))) throw new Error('Cột dữ liệu chưa đúng. Anh/chị tải file mẫu rồi nhập lại nhé.');
        loadRows(sourceRows);
        notify(`Đã nhập ${rows.length} sản phẩm. Có thể xem từng trang trước khi in.`);
      } catch(error) { notify(error.message || 'Không đọc được file Excel.'); }
      finally { printButton.disabled=false; }
    };
    reader.onerror=()=>{ printButton.disabled=false;notify('Không đọc được file. Anh/chị chọn lại nhé.'); };
    reader.readAsArrayBuffer(file);
  });
  printButton.addEventListener('click', () => {
    if (!rows.length) { notify('Anh/chị chọn file Excel có dữ liệu trước nhé.'); return; }
    const target=window.open('','_blank');
    if (!target) { notify('Anh/chị cho phép cửa sổ bật lên để in tất cả mẫu nhé.');return; }
    const root=document.querySelector('.post-body');
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.outerHTML).join('');
    const sheets=[];
    for(let offset=0;offset<rows.length;offset+=groups.length){
      const clone=root.cloneNode(true);
      fill(clone,rows,offset);
      clone.querySelectorAll('script, .cg-batchnav, #tbl_exporttable_to_xls').forEach(element=>element.remove());
      clone.querySelectorAll('input[type="file"],button').forEach(element=>element.remove());
      clone.querySelectorAll('input').forEach(element=>element.setAttribute('value',element.value));
      clone.querySelectorAll('textarea').forEach(element=>element.textContent=element.value);
      sheets.push(`<section class="cg-print-sheet">${clone.outerHTML}</section>`);
    }
    target.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><base href="${location.origin}/"><title>In mẫu nguyencongnghe.com</title>${styles}<style>body{background:#fff!important;margin:0!important;padding:0!important}.cg-print-sheet{break-after:page;page-break-after:always}.cg-print-sheet:last-child{break-after:auto;page-break-after:auto}.cg-print-sheet .post-body{margin:0!important}input[type=file],button,.cg-batchnav{display:none!important}@media print{body{background:#fff!important}}</style></head><body class="item item-view"><main class="item-post">${sheets.join('')}</main></body></html>`);
    target.document.close();
    target.addEventListener('load',()=>{target.focus();target.print();},{once:true});
  });
  window.ExportToExcel = (type='xlsx',filename,downloadOnly) => {
    const workbook=XLSX.utils.table_to_book(document.getElementById('tbl_exporttable_to_xls'),{sheet:'sheet1'});
    if(downloadOnly) return XLSX.write(workbook,{bookType:type,bookSST:true,type:'base64'});
    return XLSX.writeFile(workbook,filename||'file-mau.'+type);
  };
  window.CG_PrintImport={groups,loadRows,fill,getRows:()=>rows,getPage:()=>page};
  render();
})();
