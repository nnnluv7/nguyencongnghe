/* Shared metadata for editable print previews. Exported documents stay passive. */
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function editableInput(tag,field,copyIndex) {
  tag=tag.replace(/\s(?:readonly|disabled|tabindex|aria-readonly)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'');
  tag=tag.replace(/\s(?:placeholder|maxlength|data-ncn-copy)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'');
  const text=field.type!=='checkbox';
  const label=/\saria-label\s*=/i.test(tag)?'':` aria-label="${escape(field.label)}"`;
  const spelling=field.placeholder===''&&!/\sspellcheck\s*=/i.test(tag)?' spellcheck="false"':'';
  return tag.replace(/\s*\/?\s*>$/,` data-ncn-copy="${copyIndex}"${label}${spelling}${text?` placeholder="${escape(field.placeholder??field.example??'')}" maxlength="${field.maxLength||160}" autocomplete="off"`:''}>`);
}

export const editableStyles = `
@media screen {
  input[data-ncn-copy]{pointer-events:auto!important;cursor:text;outline:1px dashed #3e55fa38!important;outline-offset:-1px;caret-color:#243dce}
  input[data-ncn-copy]::placeholder{color:#757b88!important;opacity:.7!important}
  input[data-ncn-copy]:hover{outline-color:#3e55fa99!important}
  input[data-ncn-copy]:focus{outline:2px solid #3e55fa!important;outline-offset:-2px;background-color:#eaf0ff!important}
  input[type=checkbox][data-ncn-copy]{cursor:pointer;accent-color:#000}
}
@media print {
  input[data-ncn-copy]{outline:none!important;box-shadow:none!important}
  input[data-ncn-copy]::placeholder{color:transparent!important;opacity:0!important}
}`;

export function copyAt(rows,copyIndex) {
  if(!Number.isSafeInteger(copyIndex)||copyIndex<0)throw new Error('Vị trí mẫu chưa hợp lệ.');
  let start=0;
  for(let i=0;i<rows.length;i++){
    const qty=Number(rows[i].qty);
    if(copyIndex<start+qty)return {row:rows[i],rowIndex:i,within:copyIndex-start,start};
    start+=qty;
  }
  throw new Error('Mẫu đang xem đã thay đổi. Anh chọn lại tờ cần sửa.');
}

let serial=0;
export function editCopy(layout,rows,copyIndex,fieldIndex,value,{linked=false}={}) {
  if(!Number.isSafeInteger(fieldIndex)||!layout.fields[fieldIndex])throw new Error('Ô nhập chưa hợp lệ.');
  const target=copyAt(rows,copyIndex),current=target.row,next=rows.slice();
  const text=String(value??'');
  if(String(current.values[fieldIndex]??'')===text)return {rows:next,selected:target.rowIndex};
  const used=new Set(rows.map(r=>r.id));
  const newID=()=>{let id;do{id='ncn-direct-'+(++serial);}while(used.has(id));used.add(id);return id;};
  const clone=(row,qty,id)=>({...row,id,qty,values:[...row.values],scales:[...row.scales]});
  if(linked||Number(current.qty)===1){
    next[target.rowIndex]=clone(current,Number(current.qty),current.id);
    next[target.rowIndex].values[fieldIndex]=text;
    return {rows:next,selected:target.rowIndex};
  }
  const parts=[];
  if(target.within)parts.push(clone(current,target.within,current.id));
  const selected=target.rowIndex+parts.length,changed=clone(current,1,newID());
  changed.values[fieldIndex]=text;parts.push(changed);
  const after=Number(current.qty)-target.within-1;
  if(after)parts.push(clone(current,after,target.within?newID():current.id));
  next.splice(target.rowIndex,1,...parts);
  return {rows:next,selected};
}

export function rowsForValidation(layout,rows) {
  const required=layout.fields.map((f,i)=>f.required?i:-1).filter(i=>i>=0);
  if(!required.length)return rows;
  // Real zero templates are editable defaults, just like an initially empty name.
  const untouched=row=>required.every(i=>String(row.values[i]??'')===String(layout.fields[i].initial??''))&&layout.fields.every((field,i)=>
    field.required||field.date||String(row.values[i]??'')===String(field.initial??'')
  );
  return rows.filter(row=>!untouched(row));
}
