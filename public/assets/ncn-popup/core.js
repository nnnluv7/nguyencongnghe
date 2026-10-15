import {editableInput,editableStyles} from '../ncn-direct/preview.js?v=20261015-direct-1';
export const MAX_LABELS = 1500;
export const MAX_PAGES = 300;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function defaultRow(layout, id='row-1') {
  return {id,qty:layout.perPage,values:layout.fields.map(f=>f.date?printDate(f.dateTime):f.initial),scales:layout.fields.map(()=>100)};
}

export function printDate(withTime=false,now=new Date()) {
 const options={timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})};
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',options).formatToParts(now).map(p=>[p.type,p.value]));
 return `NGÀY IN: ${withTime?parts.hour+':'+parts.minute+' ':''}${parts.day}/${parts.month}/${parts.year}`;
}

export function paperSize(layout,paper) {
 const landscape=paper==='A5'&&layout.defaultOrientation==='landscape';
 return {w:paper==='A4'||landscape?210:148,h:paper==='A4'?297:landscape?148:210,orientation:landscape?'landscape':'portrait',ratio:paper==='A5'&&!landscape?148/210:1};
}

export function withHeader(layout,titles,selected='grq') {
 if(!layout.titleSlot)return layout;
 const title=titles.find(t=>t.id===selected);if(!title)throw new Error('Tiêu đề popup không hợp lệ.');
 if(title.available?.[layout.titleSlot]===false)throw new Error('Tiêu đề này chưa có hình phù hợp cho mẫu đang chọn.');
 return {...layout,css:layout.css.split(layout.titleURL).join(title.images[layout.titleSlot])};
}

export function normalizeRows(layout, rows) {
  if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_LABELS)throw new Error('Cần có ít nhất một nội dung để in.');
  let total=0;
  const result=rows.map((row,index)=>{
    const qty=Number(row.qty);
    if(!Number.isSafeInteger(qty)||qty<1||qty>MAX_LABELS)throw new Error(`Nội dung ${index+1}: số lượng phải từ 1 đến ${MAX_LABELS}.`);
    total+=qty;
    return {id:String(row.id||`row-${index+1}`),qty,
      values:layout.fields.map((f,i)=>{
        let value=String(row.values?.[i]??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,160);
        if(f.percent) value=value.replace(/%/g,'').trim();
        return value;
      }),
      scales:layout.fields.map((f,i)=>{
        const scale=Number(row.scales?.[i]??100);
        if(!Number.isFinite(scale)||scale<20||scale>200)throw new Error('Cỡ chữ phải từ 20% đến 200%.');
        return scale;
      })
    };
  });
  if(total>MAX_LABELS)throw new Error(`Mỗi lượt in tối đa ${MAX_LABELS} popup.`);
  if(Math.ceil(total/layout.perPage)>MAX_PAGES)throw new Error(`Mỗi lượt in tối đa ${MAX_PAGES} tờ.`);
  return result;
}

export function validateForPrint(layout,rows) {
  const checked=normalizeRows(layout,rows);
  checked.forEach((row,r)=>layout.fields.forEach((f,i)=>{
    if(f.required&&!row.values[i].trim())throw new Error(`Nội dung ${r+1}: anh chưa nhập “${f.label}”.`);
  }));
  return checked;
}

function frame(layout,row,{examples=false,position=0,editable=false,copyIndex=0}={}) {
  return (layout.prototypes?.[position]||layout.prototype).replace(/<input\b[^>]*>/g,tag=>{
    const index=Number(tag.match(/\bdata-field="(\d+)"/)?.[1]);
    const field=layout.fields[index];
    if(!field)throw new Error('Mẫu in không hợp lệ.');
    let value=row.values[index]||'';
    if(examples&&!editable&&!value)value=field.example;
    tag=tag.replace(/\svalue="[^"]*"/g,'').replace(/\sstyle="[^"]*"/g,'');
    const scale=row.scales[index]??100;
    const style=scale===100?'':` style="font-size:${(field.fontSize*scale/100).toFixed(2)}px"`;
    const rendered=tag.replace(/\s*\/?>(\s*)$/,(_,space)=>` value="${escapeHTML(value)}"${style}>${space}`);
    return editable?editableInput(rendered,field,copyIndex):rendered;
  });
}

export function paginate(layout,rows) {
  const checked=normalizeRows(layout,rows),pages=[];
  let current=[];
  checked.forEach(row=>{
    for(let i=0;i<row.qty;i++){
      current.push(row);
      if(current.length===layout.perPage){pages.push(current);current=[];}
    }
  });
  if(current.length)pages.push(current);
  return pages;
}

export function renderDocument(layout,rows,{title='Popup · nguyencongnghe.com',paper='A4',fontCSS='',assets={},preview=false,pageLimit=MAX_PAGES,pageIndex=0,editable=false}={}) {
  if(!['A4','A5'].includes(paper))throw new Error('Khổ giấy không hợp lệ.');
  const start=preview?pageIndex:0;
  const pages=paginate(layout,rows).slice(start,start+pageLimit);
  const size=paperSize(layout,paper),ratio=size.ratio;
  const replaceAssets=text=>Object.entries(assets).reduce((out,[url,data])=>out.split(url).join(data),text);
  const css=replaceAssets(fontCSS+'\n'+layout.css);
  if(/<\/style/i.test(css))throw new Error('CSS mẫu in không hợp lệ.');
  const body=pages.map((rows,p)=>`<section class="ncn-sheet" aria-label="Tờ ${p+1+start}"><div class="paper"><div class="${escapeHTML(layout.contentClass)}">${layout.staticPage?'':rows.map((row,position)=>frame(layout,row,{examples:preview,position,editable,copyIndex:(start+p)*layout.perPage+position})).join('\n ')}</div></div></section>`).join('\n');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(title)}</title><style>
  ${css}
  html{box-sizing:border-box;color-scheme:light}*,*::before,*::after{box-sizing:inherit}
  body{margin:0;padding:0;min-width:0;background:#e9edf3;color:#000}
  .ncn-sheet{position:relative;width:${size.w}mm;height:${size.h}mm;margin:0 auto 18px;background:#fff;break-after:page;page-break-after:always;overflow:hidden}
  .ncn-sheet:last-child{break-after:auto;page-break-after:auto}
  .paper{position:absolute;left:50%;top:0;margin:0 0 0 -390px;width:780px;height:1100px;transform:scale(${ratio});transform-origin:top center}
  .paper_content{width:738px;margin:0 auto;padding-top:20px}
  input[type=text]{outline:none;border-radius:0;box-shadow:none;-webkit-appearance:none;appearance:none}
  @page{size:${paper} ${size.orientation};margin:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{body{background:#fff}.ncn-sheet{margin:0;box-shadow:none}}
  ${editable?editableStyles:''}
  </style></head><body>${body}</body></html>`;
}

export function parseCSV(text) {
  text=String(text).replace(/^\ufeff/,'');
  const firstLine=text.split(/\r?\n/,1)[0];
  const separator=(firstLine.match(/;/g)||[]).length>(firstLine.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){value+='"';i++;}
      else if(!quoted&&value.length)throw new Error('Tệp CSV có dấu nháy không hợp lệ.');
      else quoted=!quoted;
    }else if(!quoted&&c===separator){row.push(value);value='';}
    else if(!quoted&&(c==='\n'||c==='\r')){
      row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';
      if(c==='\r'&&text[i+1]==='\n')i++;
    }else value+=c;
  }
  if(quoted)throw new Error('Tệp CSV còn thiếu dấu nháy đóng.');
  row.push(value);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}

export function importTable(layout,table) {
  if(!Array.isArray(table)||table.length<2)throw new Error('Tệp cần có hàng tiêu đề và ít nhất một dòng dữ liệu.');
  const headers=table[0].map(normalize);
  const indices=layout.fields.map(f=>headers.indexOf(normalize(f.label)));
  if(indices.some((index,i)=>index<0&&layout.fields[i].required))throw new Error('Tiêu đề cột chưa đúng mẫu. Anh tải tệp mẫu của popup đang chọn rồi điền lại.');
  const quantityIndex=headers.indexOf(normalize('Số lượng'));
  const rows=table.slice(1).filter(row=>row.some(x=>String(x??'').trim())).map((row,r)=>({
    id:`import-${r+1}`,qty:quantityIndex<0?1:(row[quantityIndex]??1),
    values:indices.map((index,i)=>index<0?(layout.fields[i].date?printDate(layout.fields[i].dateTime):layout.fields[i].initial):String(row[index]??'')),scales:layout.fields.map(()=>100)
  }));
  return validateForPrint(layout,rows);
}

export function sampleCSV(layout) {
  const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
  return '\ufeff'+[layout.fields.map(f=>f.label).concat('Số lượng'),layout.fields.map(f=>f.example).concat('1')].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
