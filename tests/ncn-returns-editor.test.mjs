import test from 'node:test';
import assert from 'node:assert/strict';
import {withReturnsTemplate} from '../public/assets/ncn-store-tools/returns.js';
import {applyReturnsTextDraft,cleanReturnsText} from '../public/assets/ncn-store-tools/returns-editor.js';
import {defaultRow,renderDocument} from '../public/assets/ncn-store-tools/core.js';

const layout=withReturnsTemplate({models:[],layouts:[],assets:[]}).layouts[0];
test('an empty edit keeps the original document byte for byte; edits replace only the chosen text block',()=>{
 assert.equal(applyReturnsTextDraft(layout.prototype,{}),layout.prototype);
 const title='TIÊU ĐỀ ĐÃ SỬA',edited=applyReturnsTextDraft(layout.prototype,{'0':title});
 assert.equal(edited,layout.prototype.replace(/(<h1>)[\s\S]*?(<\/h1>)/,'$1'+title+'$2'));
 assert.equal((edited.match(/<table\b/g)||[]).length,1);
 assert.throws(()=>applyReturnsTextDraft(layout.prototype,[]));
});
test('text edits keep emphasis and line breaks, without scripts, images, attributes or external links',()=>{
 const cleaned=cleanReturnsText('<strong onclick="bad()">Chính sách</strong><br><em>Thử</em><img src="https://outside.test/a"><script>bad()</script><a href="javascript:bad()">Chi tiết</a>');
 assert.equal(cleaned,'<strong>Chính sách</strong><br><em>Thử</em><a href="https://www.dienmayxanh.com/chinh-sach-bao-hanh-san-pham">Chi tiết</a>');
 assert.equal(cleanReturnsText('A<div>B</div>'),'A<br>B');
 assert.throws(()=>cleanReturnsText('x'.repeat(8001)));
});
test('edited text prints as two identical A5 halves on A4 or one A5, with no editing controls',()=>{
 const edited={...layout,prototype:applyReturnsTextDraft(layout.prototype,{'0':'TIÊU ĐỀ THỬ'})};
 for(const [paper,count] of [['A4',2],['A5',1]]){
  const html=renderDocument(edited,[defaultRow(edited)],{paper});
  assert.equal((html.match(/class="returns-slip"/g)||[]).length,count);
  assert.equal((html.match(/TIÊU ĐỀ THỬ/g)||[]).length,count);
  assert.doesNotMatch(html,/contenteditable|data-ncn-return-block|nt-returns-text-editor/);
  assert.equal((html.match(/class="ncn-sheet"/g)||[]).length,1);
 }
});
