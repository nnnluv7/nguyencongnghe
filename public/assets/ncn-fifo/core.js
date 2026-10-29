// The supplied workbook prints B15:I49: eight columns, six rows. Input row
// 16 maps to physical position 1; disabled positions never compact the data.
export const COUNT=48,COLS=8,ROWS=6,VERSION=1;
export const STORAGE_KEY='ncn:fifo:48:v1';
export const PAPERS={A4:{width:210,height:297,label:'A4 dọc'},A5:{width:210,height:148,label:'A5 ngang'}};
export const DEFAULT_GEOMETRY={paper:'A4',left:3.97,top:7.97,pitchX:24.34,pitchY:26.81};
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>String(value??'').trim();
const folded=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]/g,'');
export function today(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=type=>parts.find(p=>p.type===type).value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);if(y<1900||y>2199)return false;
  const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function formatDate(value,format='mm/dd'){
  if(!validDate(value))return '';const [,m,d]=value.split('-');return format==='dd/mm'?d+'/'+m:m+'/'+d;
}
export const blankRows=()=>Array.from({length:COUNT},()=>({color:'',imei:''}));
export function createState(now){return {version:VERSION,date:today(now),autoDate:true,dateFormat:'mm/dd',showDate:true,showColor:true,showIMEI:true,imeiDigits:4,onlyFilled:true,quickColor:'',enabled:Array(COUNT).fill(true),rows:blankRows(),geometry:{...DEFAULT_GEOMETRY}};}
export function geometryError(g){
  const p=PAPERS[g?.paper];if(!p)return 'Chọn khổ giấy A4 hoặc A5.';
  if(!['left','top','pitchX','pitchY'].every(k=>Number.isFinite(g[k])))return 'Nhập đủ thông số canh in.';
  if(g.left<0||g.top<0||g.pitchX<18||g.pitchY<18)return 'Lề không được âm; bước tem tối thiểu 18 mm.';
  if(g.left+COLS*g.pitchX>p.width+.01||g.top+ROWS*g.pitchY>p.height+.01)return 'Lưới tem vượt khổ giấy. Giảm lề hoặc bước tem trước khi in.';
  return '';
}
export function readState(raw,now){
  try{
    const v=typeof raw==='string'?JSON.parse(raw):raw;if(!v||v.version!==VERSION||!Array.isArray(v.rows)||v.rows.length!==COUNT||!Array.isArray(v.enabled)||v.enabled.length!==COUNT)return null;
    const s=createState(now);
    for(const k of ['autoDate','showDate','showColor','showIMEI','onlyFilled'])if(typeof v[k]==='boolean')s[k]=v[k];
    if(!validDate(v.date))return null;s.date=s.autoDate?today(now):v.date;
    if(['mm/dd','dd/mm'].includes(v.dateFormat))s.dateFormat=v.dateFormat;
    if([4,6,0].includes(v.imeiDigits))s.imeiDigits=v.imeiDigits;
    if(typeof v.quickColor!=='string'||v.quickColor.length>40)return null;s.quickColor=v.quickColor;
    if(v.enabled.some(x=>typeof x!=='boolean'))return null;s.enabled=v.enabled.slice();
    // A draft can contain a field the user is still fixing. Bound and escape
    // it, then let the form show its error; never discard 47 good rows for one
    // temporarily invalid identifier.
    s.rows=v.rows.map(row=>{if(!row||typeof row.color!=='string'||typeof row.imei!=='string'||row.color.length>40||row.imei.length>64)throw Error('Invalid draft row');return {color:row.color,imei:row.imei};});
    if(v.geometry){s.geometry={...DEFAULT_GEOMETRY,...Object.fromEntries(['paper','left','top','pitchX','pitchY'].map(k=>[k,v.geometry[k]]))};if(geometryError(s.geometry))return null;}
    return s;
  }catch{return null;}
}
export function record(row){
  const color=text(row?.color),imei=text(row?.imei);
  if(color.length>40)throw Error('Màu / dung lượng dài quá 40 ký tự.');
  if(imei.length>64)throw Error('IMEI / serial dài quá 64 ký tự.');
  if(/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(imei))throw Error('IMEI đang ở dạng số khoa học. Chuyển cột IMEI sang văn bản rồi nhập lại để giữ đúng số.');
  return {color,imei};
}
export const hasInput=row=>!!(text(row.color)||text(row.imei));
export function resolveRows(rows){let previous='';return rows.map((row,index)=>{if(text(row.color))previous=text(row.color);return {...row,color:previous,index};});}
export function printPlan(state){
  const day=state.showDate?formatDate(state.date,state.dateFormat):'';
  return resolveRows(state.rows).map((row,i)=>{
    const active=state.enabled[i]&&(!state.onlyFilled||hasInput(state.rows[i]));
    const serial=text(row.imei),date=active?day:'',color=active&&state.showColor?row.color:'',imei=active&&state.showIMEI?(state.imeiDigits?serial.slice(-state.imeiDigits):serial):'';
    return {position:i+1,date,color,imei,printed:!!(date||color||imei)};
  });
}
export function nextSlot(state,start=0){
  for(let n=0;n<COUNT;n++){const i=(Math.max(0,start)+n)%COUNT;if(state.enabled[i]&&!text(state.rows[i].imei))return i;}return -1;
}
export function addScan(state,value,start=0){
  const imei=record({imei:value}).imei;if(!imei)throw Error('Bắn hoặc nhập IMEI trước khi thêm.');
  const index=nextSlot(state,start);if(index<0)throw Error('Các vị trí đang chọn đã đủ IMEI. Bật thêm vị trí hoặc xoá dữ liệu để nhập tờ mới.');
  const rows=state.rows.map(row=>({...row}));rows[index]={color:text(state.quickColor)||rows[index].color,imei};
  const duplicate=state.rows.findIndex(row=>row.imei===imei);
  return {state:{...state,rows},index,duplicate};
}
// Quoted CSV, TSV and scanner lists. Empty color cells intentionally inherit
// the preceding color. Identifiers remain strings, including leading zeros.
export function delimitedRows(source){
  source=String(source??'').replace(/^\uFEFF/,'');if(source.length>262144)throw Error('Danh sách quá dài. Mỗi tờ nhận tối đa 48 dòng.');
  const first=source.split(/\r?\n/)[0],separator=first.includes('\t')?'\t':first.includes(';')?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<=source.length;i++){
    const c=source[i];
    if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else cell+=c;}
    else if((c===separator||c==='\r'||c==='\n'||c===undefined)&&!quoted){row.push(cell);cell='';if(c!==separator){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&source[i+1]==='\n')i++;}}
    else if(c!==undefined)cell+=c;
  }
  if(quoted)throw Error('Dấu ngoặc kép trong danh sách chưa khép kín.');return rows;
}
export function recordsFromRows(matrix){
  const rows=matrix.filter(r=>r.some(v=>text(v)));if(!rows.length)throw Error('Danh sách chưa có dữ liệu.');
  const first=rows[0].map(folded),imeiColumn=first.findIndex(v=>/^(?:ban)?imei(?:serial)?$|^serial$/.test(v)),colorColumn=first.findIndex(v=>v==='mau'||v==='maudungluong'||v==='mausac'||v==='color');
  const header=imeiColumn>=0,data=header?rows.slice(1):rows;
  if(!header&&data.some(row=>row.length>2))throw Error('Dán một cột IMEI hoặc hai cột Màu / dung lượng, IMEI. Nếu có nhiều cột, thêm hàng tiêu đề để nhận đúng cột.');
  const records=data.map(row=>record({color:header?(colorColumn<0?'':row[colorColumn]):row.length>1?row[0]:'',imei:header?row[imeiColumn]:row.length>1?row[1]:row[0]})).filter(hasInput);
  if(!records.length)throw Error('Danh sách chưa có màu hoặc IMEI.');if(records.length>COUNT)throw Error('Có '+records.length+' dòng. Mỗi tờ chỉ có 48 vị trí; chia danh sách trước khi nhập.');return records;
}
export function applyRecords(state,records,mode='append'){
  const slots=state.enabled.map((on,i)=>on&&(mode==='replace'||!hasInput(state.rows[i]))?i:-1).filter(i=>i>=0);
  if(records.length>slots.length)throw Error('Có '+records.length+' dòng nhưng chỉ còn '+slots.length+' vị trí '+(mode==='replace'?'đang chọn.':'trống.'));
  const rows=mode==='replace'?blankRows():state.rows.map(row=>({...row}));
  records.forEach((row,i)=>{rows[slots[i]]=record(row);});return {...state,rows,onlyFilled:true,quickColor:''};
}
function cellValue(cell){
  if(!cell)return '';if(cell.t==='n'){
    if(!Number.isSafeInteger(cell.v)||cell.v<0)throw Error('Có IMEI dạng số không thể đọc chính xác. Đặt cột IMEI thành văn bản rồi nhập lại.');
    if(/^\d+$/.test(cell.w||''))return cell.w;return String(cell.v);
  }return text(cell.v);
}
export function templateData(workbook,now){
  const name=workbook.SheetNames.find(name=>folded(name).includes('infifotem'));
  if(!name)return null;const sheet=workbook.Sheets[name],get=address=>text(sheet[address]?.v),rows=blankRows();
  for(let i=0;i<COUNT;i++)rows[i]=record({color:get('K'+(16+i)),imei:cellValue(sheet['N'+(16+i)])});
  const enabled=Array.from({length:COUNT},(_,i)=>get(String.fromCharCode(75+i%COLS)+(8+Math.floor(i/COLS))).toLowerCase()==='x');
  const current=folded(get('B12'))==='hientai';let date=today(now);
  if(!current){const serial=Number(sheet.B11?.v);if(Number.isFinite(serial)&&serial>0){date=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10);if(!validDate(date))throw Error('Ngày trong file không hợp lệ.');}else throw Error('File chưa có ngày in hợp lệ.');}
  const visible=address=>folded(get(address))==='hienthi';
  return {kind:'template',rows,enabled,date,autoDate:current,dateFormat:'mm/dd',showDate:visible('C7'),showColor:visible('C8'),showIMEI:visible('C9'),imeiDigits:4,onlyFilled:false};
}
export function applyTemplate(state,data){
  return {...state,rows:data.rows.map(row=>({...row})),enabled:data.enabled.slice(),quickColor:'',...Object.fromEntries(['date','autoDate','dateFormat','showDate','showColor','showIMEI','imeiDigits','onlyFilled'].map(k=>[k,data[k]]))};
}
export function sheetHTML(state,{preview=false}={}){
  const g=state.geometry;
  return printPlan(state).map((row,i)=>{
    const tag=preview?'button':'div',selected=preview&&state.enabled[i],attributes=preview?' type="button" id="fifo-position-'+i+'" aria-label="Vị trí '+row.position+'" aria-pressed="'+state.enabled[i]+'"':'';
    return '<'+tag+attributes+' class="fifo-label'+(row.printed?' is-printed':'')+(selected?' is-selected':'')+'" data-position="'+row.position+'" style="left:'+Number(((i%COLS)*g.pitchX).toFixed(4))+'mm;top:'+Number((Math.floor(i/COLS)*g.pitchY).toFixed(4))+'mm">'+(preview?'<span class="fifo-slot-number" aria-hidden="true">'+row.position+'</span>':'')+'<span class="fifo-line fifo-label-date">'+escapeHTML(row.date)+'</span><span class="fifo-line fifo-label-color">'+escapeHTML(row.color)+'</span><span class="fifo-line fifo-label-imei'+(!state.imeiDigits?' fifo-full-imei':'')+'">'+escapeHTML(row.imei)+'</span></'+tag+'>';
  }).join('');
}
