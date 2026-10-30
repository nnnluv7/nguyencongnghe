import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as Sticker from '../public/assets/ncn-sticker/core.js';
import * as Popup from '../public/assets/ncn-popup/core.js';
import * as Store from '../public/assets/ncn-store-tools/core.js';
import {editableInput,editCopy,copyAt,rowsForValidation} from '../public/assets/ncn-direct/preview.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
test('zero templates are real editable values while product names remain hints',()=>{
  let zeroFields=0,zeroLayouts=0,names=0;
  for(const [group,core] of [['ncn-sticker',Sticker],['ncn-popup',Popup],['ncn-store-tools',Store]]){
    const data=JSON.parse(read('public/assets/'+group+'/catalogue.json'));
    for(const layout of data.layouts){
      const row=core.defaultRow(layout);let hasZero=false;
      for(const [i,field] of layout.fields.entries()){
        if(field.placeholder===''&&/0/.test(field.example)){
          assert.equal(row.values[i],field.example,layout.id+': '+field.label);
          const input=editableInput('<input type="text">',field,0);
          assert.match(input,/placeholder=""/);
          assert.ok(input.includes('aria-label="'+field.label+'"'));
          zeroFields++;hasZero=true;
        }
        if(field.label==='Tên sản phẩm'){
          assert.equal(row.values[i],'',layout.id+': names must stay empty');
          assert.ok(editableInput('<input type="text">',field,0).includes('placeholder="'+field.example+'"'));
          names++;
        }
      }
      if(hasZero)zeroLayouts++;
    }
  }
  assert.equal(zeroFields,131);assert.equal(zeroLayouts,58);assert.ok(names>20);
});
test('default zero copies do not block a filled copy, but edited incomplete copies do',()=>{
  const data=JSON.parse(read('public/assets/ncn-sticker/catalogue.json'));
  const layout=data.layouts.find(l=>l.id==='gg2-1'),original=Sticker.defaultRow(layout);
  const named=editCopy(layout,[original],1,0,'SẢN PHẨM QA');
  const checked=Sticker.normalizeRows(layout,named.rows);
  assert.equal(rowsForValidation(layout,checked).length,1);
  assert.doesNotThrow(()=>Sticker.validateForPrint(layout,rowsForValidation(layout,checked)));
  const cleared=editCopy(layout,named.rows,1,1,'');
  assert.throws(()=>Sticker.validateForPrint(layout,rowsForValidation(layout,cleared.rows)),/Giá gốc/);
  const noName=editCopy(layout,[original],0,1,'12.345.000đ');
  assert.throws(()=>Sticker.validateForPrint(layout,rowsForValidation(layout,noName.rows)),/Tên sản phẩm/);
  const explicitZero=editCopy(layout,[original],0,1,'0');
  assert.equal(copyAt(explicitZero.rows,0).row.values[1],'0');
  assert.equal(copyAt(explicitZero.rows,1).row.values[1],'00.000.000đ');
  const imported=Sticker.importTable(layout,[['Tên sản phẩm','Giá gốc','Giá giảm','Thời gian áp dụng','Số lượng'],['QA','1.234.000đ','999.000đ','','1']]);
  assert.deepEqual(imported[0].values.slice(0,3),['QA','1.234.000đ','999.000đ']);
  assert.equal(imported[0].values[4],'','explicitly empty imports must stay empty');
  assert.equal(original.values[1],'00.000.000đ','edits must not mutate defaults');
});
for(const [group,core] of [['ncn-sticker',Sticker],['ncn-popup',Popup],['ncn-store-tools',Store]]){
  test(group+': every layout keeps paper sizes, passive exports and independent copy editing',()=>{
    const data=JSON.parse(read('public/assets/'+group+'/catalogue.json'));
    for(const layout of data.layouts){
      const row=core.defaultRow(layout);
      row.values=layout.fields.map(field=>field.type==='checkbox'?'1':String(field.example||field.initial||'NCN'));
      row.qty=layout.perPage;
      for(const paper of ['A4','A5']){
        const html=core.renderDocument(layout,[row],{paper,fontCSS:data.fontCSS});
        assert.ok(html.includes('@page{size:'+paper),layout.id);
        assert.equal((html.match(/class="ncn-sheet"/g)||[]).length,1,layout.id);
        assert.equal(html.includes('data-ncn-copy='),false,layout.id+': exported sheet must not contain preview controls');
        assert.equal(html.includes('ncn-print-sidebar'),false,layout.id);
      }
      if(layout.fields.length){
        const position=layout.perPage>1?1:0;
        const changed=editCopy(layout,[row],position,0,'NCN-KIEM-TRA');
        assert.equal(changed.rows.reduce((sum,item)=>sum+item.qty,0),row.qty,layout.id);
        assert.equal(copyAt(changed.rows,position).row.values[0],'NCN-KIEM-TRA',layout.id);
        if(position)assert.equal(copyAt(changed.rows,0).row.values[0],row.values[0],layout.id+': editing one copy changed another');
      }
    }
    for(const asset of data.assets){
      const path=new URL('../public'+asset.path,import.meta.url);
      assert.ok(existsSync(path),asset.path);
      assert.equal(hash(readFileSync(path)),asset.sha256,asset.path);
    }
  });
}
test('legacy printable sheets retain their exact original markup',()=>{
  const baseline=JSON.parse(read('docs/print-workspace-baseline.json'));
  for(const [path,expected] of Object.entries(baseline.sheetHashes)){
    const source=read('public/'+path);
    const match=source.match(/<div\b[^>]*(?:id="printMe"|class="row-container")[^>]*>/);
    assert.ok(match,path);let depth=0,end=0;
    for(const tag of source.slice(match.index).matchAll(/<\/?div\b[^>]*>/g)){
      depth+=tag[0].startsWith('</')?-1:1;
      if(depth===0){end=match.index+tag.index+tag[0].length;break;}
    }
    assert.equal(hash(source.slice(match.index,end)),expected,path);
  }
  for(const [path,expected] of Object.entries(baseline.rendererHashes))assert.equal(hash(readFileSync(new URL('../'+path,import.meta.url))),expected,path);
});
test('all VIP roles share one preview layout while preserving their action IDs',()=>{
  for(const group of ['ncn-event-private','ncn-gvgs-private'])for(const role of ['admin','vip']){
    const html=read('netlify/lib/'+group+'/'+role+'.html');
    assert.match(html,/class="ev-dialog ncn-print-dialog"/);
    assert.match(html,/class="ncn-print-stage"><iframe id="ev-preview-frame"/);
    assert.ok(html.indexOf('id="ev-preview-frame"')<html.indexOf('class="ncn-print-sidebar"'));
    for(const id of ['ev-print','ev-save-html','ev-close','ev-dialog-title','ev-preview-info'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,group+': '+id);
  }
});
test('duplicate sales and decoration URLs forward to their current editor',()=>{
  const redirects=read('public/_redirects');
  for(const [old,target] of [['p/ban-hang.html','/ban-hang/'],['p/trang-tri.html','/trang-tri/']]){
    assert.equal(existsSync(new URL('../public/'+old,import.meta.url)),false);
    assert.ok(redirects.includes('/'+old+'  '+target+'  301'));
  }
});
