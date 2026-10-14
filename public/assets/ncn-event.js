(function () {
  'use strict';
  function init() {
    if(!document.getElementById('ncn-event-app'))return;
    var C=window.NCNEventCore,CHANNEL='NCN_EVENT_SOURCE_V1',HISTORY='ncn:event:history:v1';
    var state={catalog:[],stock:[],selected:[],missing:[],campaigns:[],kind:'',campaign:'',undo:null,print:null,history:[]};
    var pending=new Map(),bridge=false,results=[];
    function el(id){return document.getElementById('ev-'+id);}
    function message(text,bad){var e=el('status');e.hidden=false;e.classList.toggle('ev-error',!!bad);e.textContent=text;}
    function guarded(fn){return function(e){if(e&&e.type==='submit')e.preventDefault();Promise.resolve().then(function(){return fn(e);}).catch(function(error){message(error.message||'Không thực hiện được thao tác.',true);});};}
    function cleanName(value){return String(value||'event-ncn').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^\w.-]+/g,'-').slice(0,100);}
    function exportExcel(rows,name){
      if(!window.XLSX)throw new Error('Không tải được thư viện Excel. Tải lại trang.');
      var ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
      ws['!cols']=[{wch:18},{wch:60},{wch:15},{wch:18},{wch:18}];
      XLSX.utils.book_append_sheet(wb,ws,'EVENT');XLSX.writeFile(wb,cleanName(name)+'.xlsx');
    }
    function listRows(items){return [['Mã sản phẩm','Tên sản phẩm','Số lượng','Giá gốc','Giá event']].concat(items.map(function(p){return [p.code,p.name,p.qty||1,p.originalPrice||'',p.eventPrice||''];}));}
    function reader(file){
      return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=function(){reject(new Error('Không đọc được file.'));};r.readAsArrayBuffer(file);});
    }
    async function readFile(file,mode){
      if(!file)throw new Error('Chọn file Excel trước.');
      if(file.size>30*1024*1024)throw new Error('File lớn hơn 30 MB. Chia nhỏ file rồi nhập lại.');
      if(!window.XLSX)throw new Error('Không tải được thư viện Excel. Tải lại trang.');
      var wb=XLSX.read(new Uint8Array(await reader(file)),{type:'array'}),best=null,lastError;
      wb.SheetNames.forEach(function(name){
        try{
          var rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:'',blankrows:false});
          var parsed=C.parseRows(rows,mode);parsed.sheet=name;
          if(!best||parsed.items.length>best.items.length)best=parsed;
        }catch(error){lastError=error;}
      });
      if(!best)throw lastError||new Error('File không có dữ liệu phù hợp.');
      if(!best.items.length)throw new Error('File không có dòng hợp lệ. Kiểm tra mã sản phẩm, số lượng và giá.');
      return best;
    }
    function add(items){
      state.selected=C.mergeItems(state.selected,items);render();
    }
    function render(){
      el('rows').innerHTML=state.selected.map(function(p,i){return '<tr><td><strong>'+C.esc(p.name)+'</strong><small>'+C.esc(p.code)+'</small></td><td><input data-qty="'+i+'" aria-label="Số lượng in '+C.esc(p.code)+'" type="number" min="1" step="1" value="'+p.qty+'"></td><td class="ev-original">'+C.money(p.originalPrice)+'</td><td class="ev-event-price">'+C.money(p.eventPrice)+'</td><td><button class="ev-remove" data-remove="'+i+'" type="button" aria-label="Bỏ sản phẩm '+C.esc(p.code)+'">×</button></td></tr>';}).join('');
      el('empty').hidden=state.selected.length>0;
      el('count').textContent=state.selected.length;
      el('label-count').textContent=state.selected.reduce(function(n,p){return n+p.qty;},0).toLocaleString('vi-VN');
      el('undo').hidden=!state.undo;
      el('export-prices').disabled=!state.catalog.length;
      el('missing').hidden=!state.missing.length;
      el('missing-title').textContent=state.missing.length+' mã chưa áp dụng / cần kiểm tra';
      el('missing-rows').innerHTML=state.missing.map(function(p){return '<tr><td>'+C.esc(p.code)+'</td><td>'+C.esc(p.name)+'</td><td>'+C.esc(p.qty||'')+'</td><td>'+C.esc(p.reason)+'</td></tr>';}).join('');
      updateEstimate();
    }
    function updateEstimate(){
      try{
        var l=C.layout(el('width').value,el('height').value),total=state.selected.reduce(function(n,p){return n+p.qty;},0);
        el('page-estimate').textContent=l.perPage+' nhãn/A4'+(total?' · '+Math.ceil(total/l.perPage)+' trang':'');
      }catch(error){el('page-estimate').textContent=error.message;}
    }
    function closeResults(){el('results').hidden=true;el('search').setAttribute('aria-expanded','false');}
    function showResults(){
      results=C.search(state.catalog,el('search').value);
      if(!el('search').value.trim()){closeResults();return;}
      el('results').innerHTML=results.length?results.map(function(p,i){return '<button role="option" type="button" data-result="'+i+'"><span><strong>'+C.esc(p.name)+'</strong><small>'+C.esc(p.code)+'</small></span><span><del>'+C.money(p.originalPrice)+'</del><b>'+C.money(p.eventPrice)+'₫</b></span></button>';}).join(''):'<p>'+(!state.catalog.length?'Nhập bảng giá hoặc lấy giá Miền Tây 2 trước.':'Không tìm thấy sản phẩm trong chương trình này.')+'</p>';
      el('results').hidden=false;el('search').setAttribute('aria-expanded','true');
    }
    function request(action,campaign){
      if(!bridge)throw new Error('Chưa có kết nối Tampermonkey. Mở “Kết nối lấy giá tự động” để cài, hoặc nhập bảng giá Excel.');
      var id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      return new Promise(function(resolve,reject){
        var timer=setTimeout(function(){pending.delete(id);reject(new Error('Kết nối chưa phản hồi. Kiểm tra Tampermonkey và phiên đăng nhập Miền Tây 2.'));},35000);
        pending.set(id,{resolve:resolve,reject:reject,timer:timer});
        window.postMessage({channel:CHANNEL,role:'request',action:action,campaign:campaign,id:id},location.origin);
      });
    }
    window.addEventListener('message',function(e){
      var d=e.data;
      if(e.source!==window||e.origin!==location.origin||!d||d.channel!==CHANNEL)return;
      if(d.role==='ready'){bridge=true;el('connect').classList.add('ev-connected');return;}
      if(d.role!=='response'||!pending.has(d.id))return;
      var p=pending.get(d.id);pending.delete(d.id);clearTimeout(p.timer);
      if(d.error)p.reject(new Error(d.error));else p.resolve(d.result);
    });
    function useCatalog(items,name,kind,details){
      state.catalog=items;state.kind=kind;
      if(state.selected.length){
        state.undo=state.selected.map(function(p){return Object.assign({},p);});
        var matched=C.matchStock(state.selected,items,0);
        state.selected=matched.items;state.missing=matched.missing;
      }
      el('source-info').textContent=name+' · '+items.length.toLocaleString('vi-VN')+' sản phẩm'+(details?' · '+details:'');
      render();showResults();
    }
    async function loadCampaign(id){
      el('connect').disabled=true;el('campaign').disabled=true;
      try{
        var data=await request('catalog',id);
        if(!data||!Array.isArray(data.items))throw new Error('Nguồn không trả bảng giá hợp lệ.');
        var catalog=data.items.filter(function(p){return p&&typeof p.code==='string'&&typeof p.name==='string'&&p.originalPrice>0&&p.eventPrice>0&&p.originalPrice>=p.eventPrice;});
        if(!catalog.length)throw new Error('Chưa có giá hợp lệ trong event này.');
        state.campaign=id;
        var name=state.campaigns.find(function(p){return p.id===id;});
        useCatalog(catalog,name?name.name:'Miền Tây 2','mt2',data.update||'Cập nhật '+new Date().toLocaleString('vi-VN'));
        message('Đã lấy '+catalog.length.toLocaleString('vi-VN')+' sản phẩm. Có thể nhập tồn kho hoặc tìm model để in.'+(data.invalid?' '+data.invalid+' dòng giá không hợp lệ đã được bỏ qua.':''));
      }finally{el('connect').disabled=false;el('campaign').disabled=false;}
    }
    el('connect').addEventListener('click',guarded(async function(){
      el('connect').disabled=true;
      try{
        message('Đang đọc danh sách event từ Miền Tây 2…');
        var data=await request('discover');
        if(!data||!Array.isArray(data.campaigns)||!data.campaigns.length)throw new Error('Nguồn chưa có chương trình event.');
        state.campaigns=data.campaigns.filter(function(p){return p&&/^[a-z0-9_-]{1,40}$/i.test(p.id)&&typeof p.name==='string';});
        var pick=state.campaigns.find(function(p){return p.id===state.campaign;})||state.campaigns.find(function(p){return /ĐMX|DMX/.test(p.name);})||state.campaigns[0];
        if(!pick)throw new Error('Danh sách event chưa hợp lệ.');
        el('campaign').innerHTML=state.campaigns.map(function(p){return '<option value="'+C.esc(p.id)+'">'+C.esc(p.name)+'</option>';}).join('');
        el('campaign').value=pick.id;await loadCampaign(pick.id);
      }finally{el('connect').disabled=false;}
    }));
    el('campaign').addEventListener('change',guarded(async function(){
      if(el('campaign').value==='file')return;
      var previous=state.campaign;
      try{await loadCampaign(el('campaign').value);}catch(error){el('campaign').value=previous;throw error;}
    }));
    el('import-prices').addEventListener('click',function(){el('price-file').click();});
    el('price-file').addEventListener('change',guarded(async function(){
      var file=el('price-file').files[0];if(!file)return;
      try{
        var parsed=await readFile(file,'catalog');
        el('campaign').innerHTML='<option value="file">'+C.esc(file.name)+'</option>';state.campaign='file';
        useCatalog(parsed.items,file.name,'file','Sheet '+parsed.sheet);
        message('Đã nhập '+parsed.items.length+' sản phẩm.'+(parsed.rejected.length?' '+parsed.rejected.length+' dòng giá cần kiểm tra.':''));
        state.missing=parsed.rejected;render();
      }finally{el('price-file').value='';}
    }));
    el('stock-file').addEventListener('change',guarded(async function(){
      var file=el('stock-file').files[0];if(!file)return;
      try{
        var parsed=await readFile(file,'stock');state.stock=parsed.items;
        state.stockRejected=parsed.rejected;
        el('stock-name').textContent=file.name+' · '+parsed.items.length+' mã · Sheet '+parsed.sheet;
        message('Đã đọc file tồn kho. Bấm “Xử lý tồn kho” để ghép với giá event.');
      }finally{el('stock-file').value='';}
    }));
    el('process-stock').addEventListener('click',guarded(function(){
      if(!state.catalog.length)throw new Error('Lấy giá hoặc nhập bảng giá event ở bước 1 trước.');
      if(!state.stock.length)throw new Error('Chọn file tồn kho trước.');
      var result=C.matchStock(state.stock,state.catalog,el('max').value);
      state.undo=state.selected.length?state.selected.map(function(p){return Object.assign({},p);}):null;
      state.selected=result.items;state.missing=result.missing.concat(state.stockRejected||[]);render();
      message('Đã ghép '+result.items.length+' mã. '+result.missing.length+' mã không có trong event đang chọn.');
    }));
    el('search').addEventListener('input',showResults);
    el('search').addEventListener('keydown',function(e){if(e.key==='Escape')closeResults();if(e.key==='Enter'&&results.length){e.preventDefault();add([Object.assign({},results[0],{qty:1})]);el('search').value='';closeResults();}});
    el('results').addEventListener('click',function(e){var b=e.target.closest('[data-result]');if(!b)return;var p=results[Number(b.dataset.result)];if(p)add([Object.assign({},p,{qty:1})]);el('search').value='';closeResults();});
    document.addEventListener('click',function(e){if(!e.target.closest('.ev-search'))closeResults();});
    el('rows').addEventListener('change',function(e){
      if(!e.target.hasAttribute('data-qty'))return;
      var p=state.selected[Number(e.target.dataset.qty)],qty=Number(e.target.value);
      if(!p)return;
      if(!Number.isInteger(qty)||qty<1){e.target.value=p.qty;message('Số lượng in phải là số nguyên lớn hơn 0.',true);return;}
      p.qty=qty;render();
    });
    el('rows').addEventListener('click',function(e){var b=e.target.closest('[data-remove]');if(!b)return;state.undo=state.selected.map(function(p){return Object.assign({},p);});state.selected.splice(Number(b.dataset.remove),1);render();});
    el('clear').addEventListener('click',function(){if(!state.selected.length)return;state.undo=state.selected.map(function(p){return Object.assign({},p);});state.selected=[];render();message('Đã làm mới danh sách. Có thể bấm “Khôi phục” để lấy lại.');});
    el('undo').addEventListener('click',function(){if(!state.undo)return;state.selected=state.undo;state.undo=null;render();});
    el('manual-form').addEventListener('submit',guarded(function(e){
      e.preventDefault();
      var p={code:C.code(el('manual-code').value),name:el('manual-name').value.trim(),originalPrice:C.numeric(el('manual-original').value),eventPrice:C.numeric(el('manual-event').value),qty:Number(el('manual-qty').value)};
      C.printable([p],settings());
      var old=state.selected.find(function(item){return item.code===p.code;});
      if(old&&(old.originalPrice!==p.originalPrice||old.eventPrice!==p.eventPrice))throw new Error('Mã này đã có mức giá khác trong danh sách. Bỏ dòng cũ trước khi thêm giá mới.');
      add([p]);el('manual-form').reset();message('Đã thêm '+p.code+' vào danh sách in.');
    }));
    el('import-list').addEventListener('click',function(){el('list-file').click();});
    el('list-file').addEventListener('change',guarded(async function(){
      var file=el('list-file').files[0];if(!file)return;
      try{
        if(!state.catalog.length)throw new Error('Chọn bảng giá ở bước 1 trước khi nhập ERP.');
        var parsed=await readFile(file,'list'),result=C.matchStock(parsed.items,state.catalog,0);
        add(result.items);state.missing=result.missing.concat(parsed.rejected);render();
        message('Đã thêm '+result.items.length+' mã từ ERP. '+result.missing.length+' mã chưa áp dụng.');
      }finally{el('list-file').value='';}
    }));
    el('price-template').addEventListener('click',guarded(function(){exportExcel([['Mã sản phẩm','Tên sản phẩm','Giá gốc','Giá event']],'mau-bang-gia-event');}));
    el('stock-template').addEventListener('click',guarded(function(){exportExcel([['Mã sản phẩm','Tên sản phẩm','Số lượng']],'mau-ton-kho-event');}));
    el('export-prices').addEventListener('click',guarded(function(){if(!state.catalog.length)throw new Error('Chưa có bảng giá.');exportExcel(listRows(state.catalog),'bang-gia-event');}));
    el('export-list').addEventListener('click',guarded(function(){if(!state.selected.length)throw new Error('Danh sách đang trống.');exportExcel(listRows(state.selected),el('name').value||'danh-sach-in-event');}));
    el('export-missing').addEventListener('click',guarded(function(){exportExcel([['Mã sản phẩm','Tên sản phẩm','Số lượng','Lý do']].concat(state.missing.map(function(p){return [p.code,p.name,p.qty||'',p.reason];})),'event-chua-ap-dung');}));
    function settings(){return {name:el('name').value||'Sticker Event NCN',store:el('store').value,title:el('title').value,period:el('period').value,width:Number(el('width').value),height:Number(el('height').value),cut:el('cut').checked,color:el('color').checked};}
    function applySettings(s){['name','store','title','period','width','height'].forEach(function(key){if(s[key]!=null)el(key).value=s[key];});el('cut').checked=!!s.cut;el('color').checked=!!s.color;el('size').value='custom';}
    el('size').addEventListener('change',function(){var v=el('size').value;if(v==='custom')return;var p=v.split('x');el('width').value=p[0];el('height').value=p[1];updateEstimate();});
    ['width','height'].forEach(function(id){el(id).addEventListener('input',function(){el('size').value='custom';updateEstimate();});});
    function historyRender(){
      el('history').innerHTML=state.history.length?state.history.map(function(h,i){return '<div class="ev-history-item"><div><strong>'+C.esc(h.settings.name)+'</strong><small>'+C.esc(new Date(h.createdAt).toLocaleString('vi-VN'))+' · '+h.labels+' nhãn · '+h.pages+' trang</small></div><button type="button" data-history="'+i+'" class="ev-button ev-secondary ev-small">Mở lại</button><button type="button" data-delete-history="'+i+'" class="ev-remove" aria-label="Bỏ lịch sử '+C.esc(h.settings.name)+'">×</button></div>';}).join(''):'<p class="ev-note">Chưa có bản in. Lịch sử sẽ xuất hiện sau khi tạo mẫu.</p>';
    }
    function persistHistory(){try{localStorage.setItem(HISTORY,JSON.stringify(state.history));}catch(error){message('Đã tạo mẫu in. Thiết bị không đủ dung lượng lưu lịch sử; tải bản in để giữ lại.',true);}historyRender();}
    function preview(record){
      var s=record?record.settings:settings(),items=record?record.items:state.selected;
      state.print=C.printable(items,s);el('preview-frame').srcdoc=state.print.html;
      el('dialog-title').textContent=s.name;el('preview-info').textContent=state.print.labels+' nhãn · '+state.print.pages+' trang A4 · '+s.width+' × '+s.height+' mm';
      if(typeof el('dialog').showModal==='function')el('dialog').showModal();else el('dialog').setAttribute('open','');
      if(!record){state.history.unshift({createdAt:new Date().toISOString(),settings:s,items:items.map(function(p){return Object.assign({},p);}),labels:state.print.labels,pages:state.print.pages});state.history=state.history.slice(0,15);persistHistory();}
    }
    el('preview').addEventListener('click',guarded(function(){preview();}));
    el('close').addEventListener('click',function(){if(typeof el('dialog').close==='function')el('dialog').close();else el('dialog').removeAttribute('open');});
    el('print').addEventListener('click',guarded(function(){var f=el('preview-frame');if(!state.print||!f.contentWindow)throw new Error('Mở xem trước trước khi in.');f.contentWindow.focus();f.contentWindow.print();}));
    el('save-html').addEventListener('click',guarded(function(){if(!state.print)throw new Error('Chưa có bản in.');var url=URL.createObjectURL(new Blob([state.print.html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=cleanName(el('dialog-title').textContent)+'.html';a.click();setTimeout(function(){URL.revokeObjectURL(url);},10000);}));
    el('history').addEventListener('click',guarded(function(e){
      var open=e.target.closest('[data-history]'),del=e.target.closest('[data-delete-history]');
      if(open){var h=state.history[Number(open.dataset.history)];if(h)preview(h);}
      if(del){state.history.splice(Number(del.dataset.deleteHistory),1);persistHistory();}
    }));
    try{
      var history=JSON.parse(localStorage.getItem(HISTORY)||'[]');
      if(Array.isArray(history))state.history=history.filter(function(h){return h&&h.settings&&Array.isArray(h.items)&&h.createdAt&&Number.isFinite(h.labels)&&Number.isFinite(h.pages);}).slice(0,15);
    }catch(error){}
    historyRender();render();
    window.postMessage({channel:CHANNEL,role:'request',action:'ping'},location.origin);
    setTimeout(function(){window.postMessage({channel:CHANNEL,role:'request',action:'ping'},location.origin);},1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
