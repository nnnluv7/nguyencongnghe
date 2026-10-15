import {escapeHTML,normalize,parseCSV} from '../ncn-popup/core.js?v=20261015-direct-1';
import {editableInput,editableStyles} from '../ncn-direct/preview.js?v=20261015-direct-1';
export {escapeHTML,normalize,parseCSV};
export const MAX_COPIES=1500,MAX_PAGES=300;
export function defaultRow(layout,id='row-1',now=new Date()) {
  const clock=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {id,qty:layout.perPage,values:layout.fields.map(f=>f.clock?clock[f.clock]:f.type==='checkbox'?(f.initial?'1':''):String(f.initial??'')),scales:layout.fields.map(()=>100),outline:false};
}
export function normalizeRows(layout,rows) {
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_COPIES)throw new Error('Cần có ít nhất một nội dung để in.');
  let total=0;
  const result=rows.map((row,r)=>{
    const qty=Number(row.qty);if(!Number.isSafeInteger(qty)||qty<1||qty>MAX_COPIES)throw new Error(`Nội dung ${r+1}: số bản phải từ 1 đến ${MAX_COPIES}.`);total+=qty;
    return {id:String(row.id||`row-${r+1}`),qty,outline:Boolean(row.outline),values:layout.fields.map((f,i)=>{
      if(f.type==='checkbox')return ['1','true','yes','x','có'].includes(String(row.values?.[i]??'').trim().toLowerCase())?'1':'';
      return String(row.values?.[i]??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,f.maxLength||320);
    }),scales:layout.fields.map((f,i)=>{const n=Number(row.scales?.[i]??100);if(!Number.isFinite(n)||n<20||n>200)throw new Error('Cỡ chữ phải từ 20% đến 200%.');return n;})};
  });
  if(total>MAX_COPIES||Math.ceil(total/layout.perPage)>MAX_PAGES)throw new Error(`Mỗi lượt tối đa ${MAX_COPIES} bản và ${MAX_PAGES} tờ.`);return result;
}
export function validateForPrint(layout,rows) {
  const checked=normalizeRows(layout,rows);checked.forEach((row,r)=>layout.fields.forEach((f,i)=>{if(f.required&&!row.values[i].trim())throw new Error(`Nội dung ${r+1}: chưa nhập “${f.label}”.`);}));return checked;
}
export function paginate(layout,rows) {
  const pages=[];let page=[];normalizeRows(layout,rows).forEach(row=>{for(let i=0;i<row.qty;i++){page.push(row);if(page.length===layout.perPage){pages.push(page);page=[];}}});if(page.length)pages.push(page);return pages;
}
export function paperSize(layout,paper='A4') {
  if(!['A4','A5'].includes(paper))throw new Error('Khổ giấy không hợp lệ.');const landscape=layout.defaultOrientation==='landscape',w=paper==='A4'?210:148,h=paper==='A4'?297:210;return {w:landscape?h:w,h:landscape?w:h,orientation:landscape?'landscape':'portrait',ratio:paper==='A4'?1:148/210};
}
export function renderFrame(layout,row,{preview=false,position=0,editable=false,copyIndex=0}={}) {
  const values=row.values.map((v,i)=>preview&&!editable&&!v&&layout.fields[i].type!=='checkbox'?(layout.fields[i].example||''):v);
  let prototype=layout.prototypes?.[position]||layout.prototype;
  prototype=prototype.replace(/<input\b[^>]*>/g,tag=>{
    const match=tag.match(/\bdata-field="(\d+)"/);if(!match)return tag;const i=Number(match[1]),field=layout.fields[i];if(!field)throw new Error('Trường nhập của mẫu chưa hợp lệ.');
    tag=tag.replace(/\svalue=("[^"]*"|'[^']*')/g,'').replace(/\schecked(?:=("[^"]*"|'[^']*'))?/g,'');
    if(field.type==='checkbox'){
      const rendered=tag.replace(/\s*\/?\s*>$/,`${values[i]?' checked':''} aria-readonly="true" tabindex="-1" style="pointer-events:none">`);
      return editable?editableInput(rendered,field,copyIndex):rendered;
    }
    let style=tag.match(/\sstyle="([^"]*)"/)?.[1]||'';
    if((row.scales[i]??100)!==100)style+=`;font-size:${(field.fontSize||16)*(row.scales[i]/100)}px!important`;
    if(row.outline&&layout.outlineTextSupported)style+=';color:white!important;-webkit-text-stroke:1px black';tag=tag.replace(/\sstyle="[^"]*"/g,'');
    const rendered=tag.replace(/\s*\/?\s*>$/,` value="${escapeHTML(values[i])}"${style?` style="${escapeHTML(style)}"`:''} readonly>`);
    return editable?editableInput(rendered,field,copyIndex):rendered;
  });
  return prototype.replace(/\{\{field:(\d+)\}\}/g,(_,i)=>editable?`<span data-ncn-copy="${copyIndex}" data-ncn-mirror="${i}">${escapeHTML(values[Number(i)]||'')}</span>`:escapeHTML(values[Number(i)]||''));
}
export function renderDocument(layout,rows,{paper='A4',fontCSS='',assets={},preview=false,pageIndex=0,pageLimit=MAX_PAGES,title='In ấn · NCN',editable=false}={}) {
  const pages=paginate(layout,rows),size=paperSize(layout,paper),selected=pages.slice(preview?pageIndex:0,(preview?pageIndex:0)+pageLimit),replaceAssets=text=>Object.entries(assets).reduce((out,[url,data])=>out.split(url).join(data),text);
  const css=replaceAssets(fontCSS+'\n'+layout.css);if(/<\/style/i.test(css))throw new Error('CSS mẫu chưa hợp lệ.');
  const content=selected.map((items,p)=>`<section class="ncn-sheet" aria-label="Tờ ${p+1+pageIndex}"><div class="paper"><div class="${escapeHTML(layout.contentClass||'ncn-store-content')}">${items.map((row,position)=>replaceAssets(renderFrame(layout,row,{preview,position,editable,copyIndex:(pageIndex+p)*layout.perPage+position}))).join('\n')}</div></div></section>`).join('\n');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>
  html{box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}body{font-family:'Times New Roman',serif;font-size:16px;color:#000}input{border-radius:0;box-shadow:none}
  .paper_content{width:738px;margin:0 auto;padding-top:20px}.ncn-store-content{width:100%;height:100%}
  ${css}
  html,body{margin:0;padding:0;min-width:0;color-scheme:light;background:#e9edf3}.ncn-sheet{position:relative;width:${size.w}mm;height:${size.h}mm;margin:0 auto 18px;background:#fff;overflow:hidden;break-after:page;page-break-after:always}.ncn-sheet:last-child{break-after:auto;page-break-after:auto}
  .paper{position:absolute;left:50%;top:0;margin:0 0 0 -390px;padding:0;width:780px;height:1100px;transform:scale(${size.ratio});transform-origin:top center;overflow:hidden}input[type=text]{outline:none;border-radius:0;box-shadow:none;-webkit-appearance:none;appearance:none}input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;accent-color:#000}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:${paper} ${size.orientation};margin:0}@media print{html,body{background:#fff}.ncn-sheet{margin:0;box-shadow:none}}
  ${editable?editableStyles:''}
  </style></head><body>${content}</body></html>`;
}
export function sampleCSV(layout) {
  const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';return '\ufeff'+[layout.fields.map(f=>f.label).concat('Số lượng'),layout.fields.map(f=>f.type==='checkbox'?'0':f.example||f.initial||'').concat('1')].map(r=>r.map(q).join(',')).join('\r\n')+'\r\n';
}
export function importTable(layout,table) {
  if(!Array.isArray(table)||table.length<2)throw new Error('Tệp cần hàng tiêu đề và ít nhất một dòng dữ liệu.');const headers=table[0].map(normalize),indices=layout.fields.map(f=>headers.indexOf(normalize(f.label))),qtyIndex=headers.indexOf(normalize('Số lượng'));
  if(indices.some((i,n)=>i<0&&layout.fields[n].required))throw new Error('Tên cột chưa đúng. Anh tải tệp mẫu của mẫu đang chọn rồi điền lại.');
  return validateForPrint(layout,table.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map((r,n)=>({...defaultRow(layout,`import-${n}`),qty:qtyIndex<0?1:r[qtyIndex],values:indices.map((i,j)=>i<0?layout.fields[j].initial||'':String(r[i]??''))})));
}
