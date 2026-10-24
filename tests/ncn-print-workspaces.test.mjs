import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as Sticker from '../public/assets/ncn-sticker/core.js';
import * as Popup from '../public/assets/ncn-popup/core.js';
import * as Store from '../public/assets/ncn-store-tools/core.js';
import {editCopy,copyAt} from '../public/assets/ncn-direct/preview.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
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
