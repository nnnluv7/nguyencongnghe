export const DENOMINATIONS=Object.freeze([500000,200000,100000,50000,20000,10000,5000,2000,1000,500]);
export const MAX_COUNT=999999999n;
export const MAX_AMOUNT=999999999999999999999n;
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const numberText=value=>BigInt(value).toLocaleString('vi-VN');
export const moneyText=value=>numberText(value)+' ₫';
export function parseInteger(raw,{optional=false,currency=false,max=MAX_COUNT}={}){
  let value=String(raw??'').trim();
  if(currency)value=value.replace(/\s*(?:₫|đ|VND)$/i,'').trim();
  if(!value)return optional?null:0n;
  const plain=/^\d+$/.test(value),grouped=/^\d{1,3}([., \u00a0\u202f])\d{3}(?:\1\d{3})*$/.test(value);
  if(!plain&&!grouped)throw new Error('Chỉ nhập số nguyên không âm; dùng dấu chấm hoặc dấu phẩy để phân nhóm nghìn.');
  const digits=value.replace(/[., \u00a0\u202f]/g,'');
  if(digits.length>24)throw new Error('Giá trị quá lớn.');
  const parsed=BigInt(digits);
  if(parsed>max)throw new Error('Giá trị tối đa là '+numberText(max)+'.');
  return parsed;
}
export function calculate(counts={},erpRaw=''){
  const errors={},rows=[];let total=0n,totalCount=0n;
  for(const denomination of DENOMINATIONS){
    try{const count=parseInteger(counts[denomination]);const amount=count*BigInt(denomination);rows.push({denomination,count,amount});total+=amount;totalCount+=count;}
    catch(error){errors[denomination]=error.message;rows.push({denomination,count:null,amount:null});}
  }
  const cashValid=Object.keys(errors).length===0;
  let erp=null;
  try{erp=parseInteger(erpRaw,{optional:true,currency:true,max:MAX_AMOUNT});}catch(error){errors.erp=error.message;}
  const difference=cashValid&&!errors.erp&&erp!==null?erp-total:null;
  return {valid:Object.keys(errors).length===0,cashValid,rows,total:cashValid?total:null,totalCount:cashValid?totalCount:null,erp,difference,errors};
}
export function balanceLabel(result){
  if(!result.valid)return {kind:'invalid',label:'Kiểm tra số liệu',description:'Sửa ô nhập chưa hợp lệ trước khi đối chiếu hoặc in.'};
  if(result.erp===null)return {kind:'pending',label:'Chờ nhập ERP',description:'Nhập tiền giữ ERP để đối chiếu với tiền thực tế.'};
  if(result.difference===0n)return {kind:'match',label:'Khớp ERP',description:'Tiền thực tế bằng tiền giữ ERP.'};
  if(result.difference>0n)return {kind:'short',label:'Thiếu '+moneyText(result.difference),description:'Tiền thực tế ít hơn tiền giữ ERP.'};
  return {kind:'over',label:'Thừa '+moneyText(-result.difference),description:'Tiền thực tế nhiều hơn tiền giữ ERP.'};
}
export const timestampText=value=>new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));
export const dateKey=value=>new Intl.DateTimeFormat('en-CA',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));
export function reportContent(result,checkedAt,{includeERP=false}={}){
  if(!result.valid)throw new Error('Số liệu chưa hợp lệ.');
  const rows=result.rows.map(row=>`<tr><td>${numberText(row.denomination)}</td><td>${numberText(row.count)}</td><td>${numberText(row.amount)}</td></tr>`).join('');
  const balance=balanceLabel(result);
  return `<section class="cq-report"><header><div><strong>NCN</strong><small>nguyencongnghe.com</small></div><h1>PHIẾU KIỂM QUỸ</h1></header><p class="cq-report-time">Kiểm lúc: ${escapeHTML(timestampText(checkedAt))}</p><table><thead><tr><th>Mệnh giá (đ)</th><th>Số tờ</th><th>Thành tiền (đ)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Tổng cộng</th><th>${numberText(result.totalCount)}</th><th>${numberText(result.total)}</th></tr></tfoot></table><div class="cq-report-total">Tiền thực tế: <b>${moneyText(result.total)}</b></div>${includeERP&&result.erp!==null?`<div class="cq-report-erp"><p>Tiền giữ ERP: <b>${moneyText(result.erp)}</b></p><p>Chênh lệch (ERP − thực tế): <b>${moneyText(result.difference)}</b></p><p>${escapeHTML(balance.label)}</p></div>`:''}<footer>Người kiểm quỹ: ....................................</footer></section>`;
}
export const PRINT_CSS=`@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;font:12px/1.5 Arial,sans-serif;color:#111;background:#fff}.cq-report{max-width:175mm;margin:0 auto}.cq-report header{display:flex;align-items:center;justify-content:space-between;padding-bottom:15px;border-bottom:2px solid #222}.cq-report header strong{display:block;font-size:22px;letter-spacing:1px}.cq-report header small{font-size:10px}.cq-report h1{font-size:20px;margin:0}.cq-report-time{margin:15px 0}.cq-report table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.cq-report th,.cq-report td{border:1px solid #aaa;padding:8px 12px;text-align:right}.cq-report th:first-child,.cq-report td:first-child{text-align:left}.cq-report th{background:#f1f1f1;font-weight:700}.cq-report tr{break-inside:avoid}.cq-report-total{text-align:right;font-size:16px;margin-top:15px}.cq-report-erp{text-align:right;margin-top:15px}.cq-report-erp p{margin:5px 0}.cq-report footer{margin-top:40px;font-size:12px}`;
export function printDocument(result,checkedAt,options={}){
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu kiểm quỹ · NCN</title><style>'+PRINT_CSS+'</style></head><body>'+reportContent(result,checkedAt,options)+'</body></html>';
}
export function textReport(result,checkedAt){
  if(!result.valid)throw new Error('Số liệu chưa hợp lệ.');
  return ['KIỂM QUỸ · NCN',...result.rows.map(row=>`${numberText(row.denomination)} × ${numberText(row.count)} = ${moneyText(row.amount)}`),'Tổng số tờ: '+numberText(result.totalCount),'Tiền thực tế: '+moneyText(result.total),...(result.erp===null?[]:['Tiền giữ ERP: '+moneyText(result.erp),'Chênh lệch (ERP − thực tế): '+moneyText(result.difference),balanceLabel(result).label]),'Kiểm lúc: '+timestampText(checkedAt)].join('\n');
}
export function csvReport(result,checkedAt){
  if(!result.valid)throw new Error('Số liệu chưa hợp lệ.');
  const cell=value=>'"'+String(value).replace(/"/g,'""')+'"';
  const rows=[['Mệnh giá (VND)','Số tờ','Thành tiền (VND)'],...result.rows.map(row=>[row.denomination,row.count,row.amount]),['Tổng cộng',result.totalCount,result.total],['Tiền giữ ERP','',result.erp??''],['ERP - thực tế','',result.difference??''],['Kiểm lúc','',timestampText(checkedAt)]];
  return '\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
