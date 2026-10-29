import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNT,DEFAULT_GEOMETRY,createState,readState,today,validDate,formatDate,printPlan,nextSlot,addScan,resolveRows,recordsFromRows,delimitedRows,applyRecords,templateData,applyTemplate,geometryError,sheetHTML} from '../public/assets/ncn-fifo/core.js';
const now=new Date('2026-10-28T18:30:00Z'),fresh=()=>createState(now);

test('FIFO follows the workbook date format and the current Vietnam date',()=>{
  assert.equal(today(now),'2026-10-29');assert.equal(fresh().date,'2026-10-29');
  assert.equal(formatDate('2026-10-29'),'10/29');assert.equal(formatDate('2026-10-29','dd/mm'),'29/10');
  assert.equal(validDate('2024-02-29'),true);for(const date of ['2026-02-29','2026-13-01','2026-04-31','0000-01-01','2026-1-01'])assert.equal(validDate(date),false,date);
});
test('48 physical positions stay fixed when holes are deselected',()=>{
  const s=fresh();s.rows[0]={color:'ĐEN 128GB',imei:'000000000000007'};s.rows[2]={color:'',imei:'000000000000009'};s.enabled[0]=false;
  const plan=printPlan(s);assert.equal(plan.length,48);assert.equal(plan[0].printed,false);assert.equal(plan[1].printed,false);
  assert.deepEqual(plan[2],{position:3,date:'10/29',color:'ĐEN 128GB',imei:'0009',printed:true});
  const html=sheetHTML(s);assert.match(html,/data-position="3" style="left:48\.68mm;top:0mm"/);assert.match(html,/data-position="48" style="left:170\.38mm;top:134\.05mm"/);
});
test('color inheritance matches blank workbook K cells without manufacturing records',()=>{
  const s=fresh();s.rows[0].color='ĐEN 6G';s.rows[3].color='XANH 128GB';s.rows[4].imei='12340000';
  const resolved=resolveRows(s.rows);assert.equal(resolved[2].color,'ĐEN 6G');assert.equal(resolved[47].color,'XANH 128GB');
  assert.equal(s.rows[1].color,'');assert.equal(printPlan(s).filter(r=>r.printed).length,3);
  s.onlyFilled=false;assert.equal(printPlan(s).filter(r=>r.printed).length,48);
});
test('scanner skips disabled and occupied IMEI slots, preserves zeros, and never overwrites a full sheet',()=>{
  let s=fresh();s.enabled.fill(false);s.enabled[4]=s.enabled[47]=true;s.quickColor='ĐEN';
  let result=addScan(s,'000000000000001');assert.equal(result.index,4);assert.equal(result.state.rows[4].imei,'000000000000001');assert.equal(s.rows[4].imei,'');s=result.state;
  result=addScan(s,'000000000000002',5);assert.equal(result.index,47);s=result.state;assert.equal(nextSlot(s),-1);
  assert.throws(()=>addScan(s,'000000000000003'),/đã đủ IMEI/);assert.equal(s.rows[47].imei,'000000000000002');
});
test('visibility and serial options preserve the same three line positions',()=>{
  const s=fresh();s.rows[0]={color:'ĐEN',imei:'000001234567890'};s.showDate=false;s.imeiDigits=0;
  assert.deepEqual(printPlan(s)[0],{position:1,date:'',color:'ĐEN',imei:'000001234567890',printed:true});
  s.showColor=false;s.showIMEI=false;assert.equal(printPlan(s)[0].printed,false);
  assert.match(sheetHTML(s),/fifo-label-date"><\/span><span class="fifo-line fifo-label-color"><\/span>/);
  s.showIMEI=true;s.imeiDigits=4;s.rows[0].imei=' 000000000000012 ';assert.equal(printPlan(s)[0].imei,'0012');
});
test('CSV and tab paste retain identifiers, quoted text and blank inherited colors',()=>{
  const csv='\uFEFFMàu / dung lượng,IMEI\r\n"ĐEN, 128GB",000000000000001\r\n,000000000000002';
  assert.deepEqual(recordsFromRows(delimitedRows(csv)),[{color:'ĐEN, 128GB',imei:'000000000000001'},{color:'',imei:'000000000000002'}]);
  assert.deepEqual(recordsFromRows(delimitedRows('Màu\tIMEI\nĐEN\t0011\n\t0022')),[{color:'ĐEN',imei:'0011'},{color:'',imei:'0022'}]);
  assert.deepEqual(recordsFromRows(delimitedRows('0011\n0022')),[{color:'',imei:'0011'},{color:'',imei:'0022'}]);
  assert.deepEqual(recordsFromRows([['STT','Màu','BẮN IMEI'],[1,'ĐEN','0011']]),[{color:'ĐEN',imei:'0011'}]);
});
test('ambiguous, oversized or lossy imports fail atomically',()=>{
  assert.throws(()=>recordsFromRows([['1','ĐEN','1234']]),/hai cột/);
  assert.throws(()=>delimitedRows('"ĐEN,0011'),/ngoặc kép/);
  assert.throws(()=>recordsFromRows(Array.from({length:49},(_,i)=>[String(i)])),/49 dòng/);
  assert.throws(()=>recordsFromRows([['1.2345E+14']]),/số khoa học/);
  const s=fresh();s.enabled.fill(false);s.enabled[47]=true;
  assert.throws(()=>applyRecords(s,[{imei:'0011'},{imei:'0022'}]),/chỉ còn 1/);assert.equal(s.rows[47].imei,'');
});
test('bulk replace fills only selected physical positions and append retains existing entries',()=>{
  const s=fresh();s.enabled.fill(false);s.enabled[2]=s.enabled[8]=true;s.rows[2]={color:'ĐEN',imei:'0001'};s.quickColor='MÀU CŨ';
  const appended=applyRecords(s,[{color:'XANH',imei:'0002'}]);assert.equal(appended.rows[2].imei,'0001');assert.equal(appended.rows[8].imei,'0002');
  assert.equal(appended.quickColor,'');
  const replaced=applyRecords(appended,[{color:'ĐỎ',imei:'0003'}],'replace');assert.equal(replaced.rows[2].imei,'0003');assert.equal(replaced.rows[8].imei,'');assert.equal(replaced.enabled[0],false);
});
test('the actual template schema maps K8:R13 and K16/N16 to fixed slots, retaining its date and visibility choices',()=>{
  const sheet={B12:{v:'Hiện Tại'},C7:{v:'Hiển Thị'},C8:{v:'Hiển Thị'},C9:{v:'Ẩn'},K8:{v:'X'},R13:{v:'x'},K16:{v:'ĐEN 6G'},N16:{t:'s',v:'000000000000001'},N63:{t:'n',v:123456789012345,w:'1.23457E+14'}};
  const wb={SheetNames:['IN FIFO TEM 105','Sheet1'],Sheets:{'IN FIFO TEM 105':sheet}},data=templateData(wb,now),s=applyTemplate(fresh(),data);
  assert.deepEqual(s.enabled.map((v,i)=>v?i+1:0).filter(Boolean),[1,48]);assert.equal(s.rows[47].imei,'123456789012345');assert.equal(s.date,'2026-10-29');assert.equal(s.onlyFilled,false);assert.equal(s.showIMEI,false);assert.equal(s.geometry.paper,'A4');
  sheet.B12.v='Nhập Tay';sheet.B11={v:45838};assert.equal(templateData(wb,now).date,'2025-06-30');
  sheet.N16={t:'n',v:9999999999999999};assert.throws(()=>templateData(wb,now),/không thể đọc chính xác/);
});
test('saved drafts are bounded and auto dates refresh; manual dates and layout survive',()=>{
  const s=fresh();s.rows[47]={color:'ĐỎ',imei:'000000000000001'};s.enabled[0]=false;
  let read=readState(JSON.stringify(s),new Date('2026-10-30T01:00:00Z'));assert.equal(read.date,'2026-10-30');assert.equal(read.rows[47].imei,'000000000000001');assert.equal(read.enabled[0],false);
  s.autoDate=false;s.date='2025-06-30';assert.equal(readState(s,now).date,'2025-06-30');
  for(const bad of [{...s,version:99},{...s,rows:[]},{...s,enabled:[true]},{...s,geometry:{...DEFAULT_GEOMETRY,left:400}},{...s,quickColor:'x'.repeat(41)}])assert.equal(readState(bad),null);
  s.rows[0].imei='1.23E+14';read=readState(s,now);assert.equal(read.rows[0].imei,'1.23E+14');assert.equal(read.rows[47].imei,'000000000000001');
});
test('print bounds, escaping and the source geometry prevent extra rows or executable content',()=>{
  assert.equal(geometryError(DEFAULT_GEOMETRY),'');assert.ok(geometryError({...DEFAULT_GEOMETRY,pitchX:30}));assert.ok(geometryError({...DEFAULT_GEOMETRY,paper:'A5'}));assert.ok(geometryError({...DEFAULT_GEOMETRY,top:NaN}));
  const s=fresh();s.rows[0]={color:'<img src=x onerror=alert(1)>',imei:'<&0001'};
  const html=sheetHTML(s,{preview:true});assert.equal((html.match(/data-position=/g)||[]).length,COUNT);assert.equal(html.includes('<img'),false);assert.match(html,/&lt;img/);assert.equal((html.match(/fifo-slot-number/g)||[]).length,48);assert.equal(sheetHTML(s).includes('fifo-slot-number'),false);
});
