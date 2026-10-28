/* Excel stocktaking keeps SKU text, handles empty workbooks and clamps navigation. */
(() => {
  'use strict';
  const input=document.getElementById('input');
  let file=null, rows=[], index=0, loading=false;
  const code=new QRCode('qrcode');
  const notice=message=>window.CG?.toast(message)||window.alert(message);
  const spreadsheet=()=>window.XLSX?Promise.resolve(window.XLSX):import('/assets/ncn-tool-resources.js').then(module=>module.loadSpreadsheet());
  function render(){
    if(!rows.length)return;
    const row=rows[index];
    const sku=String(row.masanpham ?? '').trim();
    document.getElementById('masanpham').textContent=sku;
    document.getElementById('tensanpham').textContent=String(row.tensanpham ?? '');
    document.getElementById('soluong').textContent=String(row.soluong ?? '');
    document.getElementById('current').textContent=String(index+1);
    document.getElementById('total').textContent=String(rows.length);
    document.getElementById('previous').disabled=index===0;
    document.getElementById('next').disabled=index===rows.length-1;
    code.clear();
    if(sku)code.makeCode(sku);
  }
  function loadRows(values){
    const normalized=values.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.trim().toLowerCase(),value])));
    if(normalized.length&&!('masanpham' in normalized[0]))throw new Error('File cần có cột masanpham theo mẫu.');
    rows=normalized.filter(row=>String(row.masanpham ?? '').trim());
    index=0;
    if(!rows.length)throw new Error('File chưa có mã sản phẩm để kiểm kê.');
    render();
  }
  input.addEventListener('change',()=>{file=input.files[0]||null;rows=[];index=0;});
  window.startkk=()=>{
    if(loading)return;
    if(rows.length){render();return;}
    if(!file){notice('Anh/chị chọn file Excel trước nhé.');return;}
    loading=true;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        await spreadsheet();
        const workbook=XLSX.read(reader.result,{type:'array'});
        const values=workbook.SheetNames.flatMap(name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:'',raw:false}));
        loadRows(values);
      }catch(error){notice(error.message||'Không đọc được file Excel.');}
      finally{loading=false;}
    };
    reader.onerror=()=>{loading=false;notice('Không đọc được file Excel.');};
    reader.readAsArrayBuffer(file);
  };
  window.nextkk=()=>{if(!rows.length)return;index=Math.min(index+1,rows.length-1);render();};
  window.prevkk=()=>{if(!rows.length)return;index=Math.max(index-1,0);render();};
  window.ExportToExcel=(type='xlsx',filename,downloadOnly)=>{
    if(!window.XLSX)return spreadsheet().then(()=>window.ExportToExcel(type,filename,downloadOnly)).catch(error=>notice(error.message));
    const worksheet=XLSX.utils.aoa_to_sheet([['masanpham','tensanpham','soluong'],['001234','Sản phẩm mẫu',1]]);
    worksheet.A2.t='s';
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,worksheet,'sheet1');
    if(downloadOnly)return XLSX.write(workbook,{bookType:type,bookSST:true,type:'base64'});
    return XLSX.writeFile(workbook,filename||'file-mau.'+type);
  };
  document.addEventListener('keydown',event=>{
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;
    if(event.key==='ArrowLeft'){event.preventDefault();window.prevkk();}
    else if(event.key==='ArrowRight'){event.preventDefault();window.nextkk();}
  });
  window.CG_Inventory={loadRows,getIndex:()=>index,getRows:()=>rows,code};
})();
