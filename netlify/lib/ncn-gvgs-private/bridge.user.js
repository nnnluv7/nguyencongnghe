// ==UserScript==
// @name         NCN - Ket noi gia GVGS Mien Tay 2
// @namespace    https://nguyencongnghe.com/
// @version      1.0.0
// @description  Doc bang gia GVGS bang phien dang nhap cua ban; khong luu mat khau, khong gui du lieu len may chu NCN.
// @match        https://nguyencongnghe.com/in-gvgs*
// @match        https://www.nguyencongnghe.com/in-gvgs*
// @connect      mientay2.pro
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @noframes
// @downloadURL  https://nguyencongnghe.com/downloads/ncn-gvgs-bridge.user.js
// @updateURL    https://nguyencongnghe.com/downloads/ncn-gvgs-bridge.user.js
// ==/UserScript==
/* NCN GVGS tools: file matching, source parsing and printable labels. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NCNGVGSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fold(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function code(value) {
    return String(value == null ? '' : value).trim().replace(/^'/, '').replace(/^(\d+)\.0$/, '$1');
  }
  function numeric(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    var s = String(value == null ? '' : value).trim().replace(/[₫đĐ\s]/g, '').replace(/VND/gi, '');
    if (!s || !/^-?[\d.,]+$/.test(s)) return NaN;
    if (/^-?\d{1,3}([.,]\d{3})+([.,]00)?$/.test(s)) return Number(s.replace(/[.,]/g, '').replace(/00$/, function (m) { return /[.,]00$/.test(s) ? '' : m; }));
    if (s.indexOf('.') >= 0 && s.indexOf(',') >= 0) {
      var last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
      return Number(s.slice(0,last).replace(/[.,]/g,'') + '.' + s.slice(last+1));
    }
    return Number(s.replace(',', '.'));
  }
  function money(value) { return Math.round(Number(value) || 0).toLocaleString('vi-VN'); }
  var aliases = {
    code:['code','productid','masanpham','masp','msp','productcode','sku','mahang','mahanghoa','itemcode'],
    name:['tensanpham','tensp','tenhang','tenhanghoa','model','productname'],
    qty:['soluong','soluongton','soluongtonkho','tonkho','tonthuc','tonthucte','tonkhathudung','tonkhadung','slton','slin','sl','quantity','qty'],
    originalPrice:['giany','giagoc','giany','gianiem yet','gianiem yetvnd','gianiem yetdong','giaban','originalprice','regularprice','giathuong'],
    eventPrice:['giagvgs','giogiavanggiasoc','gvgs','giaevent','giaevn','giakhuyenmai','giakm','giasoc','giaontop','giaban event','eventprice','saleprice','giagiam'],
    serial:['imei','serial','serialnumber','soimei','imeiserial','soserial']
  };
  Object.keys(aliases).forEach(function (key) { aliases[key] = aliases[key].map(fold); });
  function detectHeader(rows, mode) {
    var best = null;
    rows.slice(0,50).forEach(function (row,index) {
      var fields = {};
      row.forEach(function (cell, col) {
        var text=fold(cell);
        Object.keys(aliases).forEach(function (key) { if (fields[key] == null && aliases[key].indexOf(text) >= 0) fields[key]=col; });
      });
      if (fields.code == null) return;
      var score = Object.keys(fields).length + (fields.eventPrice != null ? 3 : 0) + (fields.qty != null ? 1 : 0);
      if (!best || score > best.score) best={row:index,fields:fields,score:score};
    });
    if (best) return best;
    var i = rows.findIndex(function(row) { return row.some(function(v) {return String(v).trim();}); });
    if (mode !== 'catalog' && i >= 0 && /^\d+$/.test(code(rows[i][0])) && rows[i].length >= 2) {
      return {row:i-1,fields:{code:0,name:1,qty:2},score:0};
    }
    throw new Error('Không nhận diện được cột Mã sản phẩm. Dùng file WebReport/ERP hoặc tải file mẫu.');
  }
  function parseRows(rows, mode) {
    var header=detectHeader(rows,mode), f=header.fields, map=new Map(), rejected=[], serials=new Set();
    if (mode === 'catalog' && (f.originalPrice == null || f.eventPrice == null)) throw new Error('Bảng giá cần các cột Mã sản phẩm, Tên sản phẩm, Giá gốc, Giá GVGS.');
    rows.slice(header.row+1).forEach(function(row,offset) {
      var id=code(row[f.code]), name=f.name == null ? id : String(row[f.name] || '').trim();
      if (!id || ['tong','tongcong','grandtotal','masanpham','msp'].indexOf(fold(id))>=0 || !row.some(function(v){return String(v).trim();})) return;
      var item={code:id,name:name || id};
      if (mode === 'catalog') {
        item.originalPrice=numeric(row[f.originalPrice]);item.eventPrice=numeric(row[f.eventPrice]);
        if (!(item.originalPrice > 0 && item.eventPrice > 0 && item.originalPrice >= item.eventPrice)) {
          rejected.push({code:id,name:item.name,row:header.row+offset+2,reason:'Giá trống, không hợp lệ hoặc giá GVGS cao hơn giá gốc'});return;
        }
        var old=map.get(id);
        if (old && (old.originalPrice!==item.originalPrice || old.eventPrice!==item.eventPrice)) throw new Error('Mã '+id+' có nhiều mức giá khác nhau trong cùng bảng. Chọn riêng một chương trình GVGS.');
        map.set(id,item);
      } else {
        var raw=f.qty == null ? '' : row[f.qty];
        var qty=raw === '' || raw == null ? 1 : numeric(raw);
        if (!Number.isFinite(qty) || qty<0 || !Number.isInteger(qty)) {rejected.push({code:id,name:item.name,row:header.row+offset+2,reason:'Số lượng không hợp lệ'});return;}
        if (qty===0) return;
        var serial=f.serial == null ? '' : String(row[f.serial] || '').trim();
        if (serial && qty===1) {var sk=id+':'+serial;if(serials.has(sk))return;serials.add(sk);}
        item.qty=qty;
        if(map.has(id))map.get(id).qty+=qty;else map.set(id,item);
      }
    });
    return {items:Array.from(map.values()),rejected:rejected,headerRow:header.row+1,fields:f};
  }
  function matchStock(stock,catalog,maxPerCode) {
    var index=new Map(catalog.map(function(item){return [code(item.code),item];})), matches=[],missing=[];
    var cap=Number(maxPerCode || 0);
    if(!Number.isInteger(cap)||cap<0)throw new Error('Tối đa/mã phải là số nguyên từ 0 trở lên.');
    stock.forEach(function(row) {
      var item=index.get(code(row.code));
      if(!item){missing.push({code:code(row.code),name:row.name,qty:row.qty,reason:'Không thuộc chương trình đang chọn'});return;}
      matches.push(Object.assign({},item,{qty:cap?Math.min(row.qty,cap):row.qty}));
    });
    return {items:matches,missing:missing};
  }
  function mergeItems(current,additions) {
    var map=new Map(current.map(function(item){return [code(item.code),Object.assign({},item)];}));
    additions.forEach(function(item){var id=code(item.code),old=map.get(id);if(old)old.qty+=item.qty;else map.set(id,Object.assign({},item,{code:id}));});
    return Array.from(map.values());
  }
  function search(catalog,query) {
    var q=fold(query);if(!q)return [];
    return catalog.filter(function(p){return fold(p.code).indexOf(q)>=0||fold(p.name).indexOf(q)>=0;}).slice(0,8);
  }
  function decodePackedScript(source) {
    if (source.length>15000000) throw new Error('Bảng giá quá lớn để đọc.');
    var m=source.match(/\}\("([^"]+)",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/);
    if(!m)return source;
    var alphabet=m[3],offset=Number(m[4]),radix=Number(m[5]),out=[];
    if(radix<2||radix>64||alphabet.length<=radix)throw new Error('Định dạng nguồn giá chưa được hỗ trợ.');
    m[1].split(alphabet[radix]).forEach(function(part){
      if(!part)return;var n=0;
      Array.from(part).forEach(function(c){var digit=alphabet.indexOf(c);if(digit<0||digit>=radix)throw new Error('Nguồn giá không hợp lệ.');n=n*radix+digit;});
      var b=n-offset;if(b<0||b>255)throw new Error('Nguồn giá không hợp lệ.');out.push(b);
    });
    return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(out));
  }
  function extractCatalogue(source) {
    var text=decodePackedScript(source),m=/\b(?:const|let|var)\s+source\s*=\s*/.exec(text);
    if(!m)throw new Error('Chưa tìm thấy bảng giá. Nguồn Miền Tây 2 có thể đã đổi định dạng.');
    var start=m.index+m[0].length,first=text[start];
    if(first!=='{'&&first!=='[')throw new Error('Bảng giá không có định dạng JSON.');
    var depth=0,quote=false,escape=false,end=-1;
    for(var i=start;i<text.length;i++){
      var c=text[i];
      if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
      if(c==='"'){quote=true;continue;}
      if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(depth===0){end=i+1;break;}}
    }
    if(end<0)throw new Error('Bảng giá chưa tải đủ.');
    var raw=JSON.parse(text.slice(start,end)),items=[],invalid=0;
    Object.entries(raw).forEach(function(entry){
      var p=entry[1],id=code(entry[0]);if(!p||typeof p!=='object'){invalid++;return;}
      var original=numeric(p.giany),event=numeric(p.giaevn);
      if(!id||!p.tensp||!(original>0&&event>0&&original>=event)){invalid++;return;}
      items.push({code:id,name:String(p.tensp),originalPrice:original,eventPrice:event});
    });
    return {items:items,invalid:invalid};
  }
  function parseProviderDocument(doc,needProducts) {
    if(doc.querySelector('input[name="password"],input[type="password"]'))throw new Error('Đăng nhập Miền Tây 2 trong cùng trình duyệt, rồi bấm lấy giá lại.');
    var select=doc.querySelector('select.select-group')||doc.querySelector('select[name="form-select1"]');
    var campaigns=select?Array.from(select.options).filter(function(o){return /^[a-z0-9_-]{1,40}$/i.test(o.value);}).map(function(o){return {id:o.value,name:o.textContent.trim()};}):[];
    if(!campaigns.length)throw new Error('Không đọc được danh sách GVGS. Kiểm tra phiên đăng nhập hoặc định dạng nguồn.');
    var update=Array.from(doc.querySelectorAll('small,p,div,span')).map(function(e){return e.textContent.trim();}).find(function(t){return t.length<200&&/SP (?:GVGS|EVENT).*cập nhật/i.test(t);})||'';
    var result={campaigns:campaigns,update:update};
    if(needProducts){
      var source=Array.from(doc.scripts).filter(function(s){return !s.src;}).map(function(s){return s.textContent;}).find(function(s){return /\b(?:const|let|var)\s+source\s*=/.test(s)||/\}\("[^"\r]+",\d+,"[^"\r]+",\d+,\d+,\d+\)\)/.test(s);});
      if(!source)throw new Error('Nguồn chưa có bảng giá cho chương trình này.');
      var catalog=extractCatalogue(source);result.items=catalog.items;result.invalid=catalog.invalid;
      if(!result.items.length)throw new Error('Chương trình này chưa có bảng giá sản phẩm.');
    }
    return result;
  }
  return {parseProviderDocument:parseProviderDocument};
});

/* Only reads the GVGS page using the user's existing browser session. */
(function () {
  'use strict';
  var C=globalThis.NCNGVGSCore;
  var CHANNEL='NCN_GVGS_SOURCE_V1',ORIGIN=location.origin,BASE='https://mientay2.pro/in-online/auto/gvgs/';
  if(!['https://nguyencongnghe.com','https://www.nguyencongnghe.com'].includes(ORIGIN)||!/^\/in-gvgs(?:\/|$)/.test(location.pathname))return;
  function reply(id,result,error) {window.postMessage({channel:CHANNEL,role:'response',id:id,result:result,error:error||null},ORIGIN);}
  function ready() {window.postMessage({channel:CHANNEL,role:'ready',version:'1.0.0'},ORIGIN);}
  var busy=false;
  window.addEventListener('message',function(event){
    var request=event.data;
    if(event.source!==window||event.origin!==ORIGIN||!request||request.channel!==CHANNEL||request.role!=='request')return;
    if(request.action==='ping'){ready();return;}
    if(typeof request.id!=='string'||request.id.length>100||!['discover','catalog'].includes(request.action))return;
    if(busy){reply(request.id,null,'Đang lấy giá. Chờ lần cập nhật hiện tại hoàn tất.');return;}
    var campaign=request.campaign;
    if(request.action==='catalog'&&!/^[a-z0-9_-]{1,40}$/i.test(campaign||'')){reply(request.id,null,'Chọn chương trình GVGS hợp lệ.');return;}
    busy=true;
    GM_xmlhttpRequest({
      method:'GET',url:BASE+(request.action==='catalog'?'?p='+encodeURIComponent(campaign):''),anonymous:false,
      timeout:30000,headers:{Accept:'text/html'},
      onload:function(response){
        busy=false;
        try{
          var final=new URL(response.finalUrl||BASE);
          if(final.origin!=='https://mientay2.pro')throw new Error('Nguồn chuyển sang địa chỉ khác. Mở Miền Tây 2 để kiểm tra đăng nhập.');
          if(response.status<200||response.status>=300)throw new Error('Miền Tây 2 trả lỗi '+response.status+'. Thử lại sau.');
          var doc=new DOMParser().parseFromString(response.responseText,'text/html');
          var result=C.parseProviderDocument(doc,request.action==='catalog');
          result.loadedAt=new Date().toISOString();reply(request.id,result);
        }catch(error){reply(request.id,null,error.message||'Không đọc được bảng giá.');}
      },
      onerror:function(){busy=false;reply(request.id,null,'Không kết nối được Miền Tây 2. Kiểm tra mạng và phiên đăng nhập.');},
      ontimeout:function(){busy=false;reply(request.id,null,'Nguồn chưa phản hồi sau 30 giây. Thử lại sau.');}
    });
  });
  ready();
})();
