import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,balanceLabel,erpInputText,reportContent,textReport,csvReport} from '../public/assets/ncn-cash/core.js';

const counts={500000:'2',200000:'3',100000:'1',50000:'4',20000:'5',10000:'6',5000:'7',2000:'8',1000:'9',500:'10'};
test('cash counts and all export formats exclude retired 500đ notes',()=>{
  const result=calculate(counts,'2,200,000');
  assert.equal(result.valid,true);assert.equal(result.total,2120000n);assert.equal(result.totalCount,45n);
  assert.equal(result.rows.length,9);assert.equal(result.rows.at(-1).denomination,1000);
  const page=readFileSync(new URL('../public/2024/02/kiem-quy.html',import.meta.url),'utf8');
  assert.deepEqual([...page.matchAll(/class="cq-qty" id="cq-qty-(\d+)"/g)].map(x=>Number(x[1])),result.rows.map(row=>row.denomination));
  const time='2026-10-24T02:00:00Z';
  const html=reportContent(result,time,{includeERP:true});
  assert.equal((html.match(/<tr><td>/g)||[]).length,9);
  assert.equal(html.includes('<tr><td>500</td>'),false);
  assert.equal(/^500 ×/m.test(textReport(result,time)),false);
  assert.equal(/^"500";/m.test(csvReport(result,time)),false);
});
test('formatted ERP still distinguishes missing, matching, short and over cash',()=>{
  assert.equal(calculate(counts).difference,null);
  for(const [erp,difference,kind] of [['2,200,000',80000n,'short'],['2,120,000',0n,'match'],['2,100,000',-20000n,'over']]){
    const result=calculate(counts,erp);assert.equal(result.difference,difference);assert.equal(balanceLabel(result).kind,kind);
  }
});
test('ERP grouping uses commas without changing integer precision or accepting decimals',()=>{
  for(const [input,formatted] of [['',''],['1234567','1,234,567'],['1.234.567','1,234,567'],['1,234,567 ₫','1,234,567'],['999999999999999999999','999,999,999,999,999,999,999']]){
    assert.equal(erpInputText(input),formatted);
    assert.equal(calculate({},formatted).erp,formatted===''?null:BigInt(formatted.replaceAll(',','')));
  }
  for(const invalid of ['-1','1.5','1,5','abc']){assert.throws(()=>erpInputText(invalid));assert.equal(calculate({},invalid).valid,false);}
});
