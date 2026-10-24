import {DENOMINATIONS,calculate,balanceLabel,numberText,moneyText,erpInputText,timestampText,dateKey,reportContent,printDocument,textReport,csvReport} from './core.js?v=20261024-cash-simple-1';

export function printHTML(html,doc=document,win=window){
  const frame=doc.createElement('iframe');frame.title='Phiếu kiểm quỹ để in';frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
  let fallback;
  const cleanup=()=>{win.clearTimeout(fallback);frame.remove();};
  frame.onload=()=>{const child=frame.contentWindow;if(!child)return;child.addEventListener('afterprint',cleanup,{once:true});child.focus();child.print();fallback=win.setTimeout(cleanup,60000);};
  frame.srcdoc=html;doc.body.append(frame);return frame;
}

export function createCashApp({app,doc=document,win=window,clock=()=>new Date(),printer=html=>printHTML(html,doc,win)}={}){
  if(!app)throw new Error('Thiếu trình kiểm quỹ.');
  const $=id=>doc.getElementById(id),listeners=[];
  const listen=(node,event,handler,options)=>{if(node){node.addEventListener(event,handler,options);listeners.push(()=>node.removeEventListener(event,handler,options));}};
  let checkedAt=clock().toISOString(),result=calculate();
  $('cq-rows').innerHTML=DENOMINATIONS.map(value=>`<tr><td><span class="cq-note-value">${numberText(value)}</span></td><td><input class="cq-qty" id="cq-qty-${value}" data-cq-value="${value}" type="text" inputmode="numeric" autocomplete="off" maxlength="13" placeholder="0" aria-label="Số tờ mệnh giá ${numberText(value)} đồng" aria-describedby="cq-error-${value}"><p id="cq-error-${value}" class="cq-error" hidden></p></td><td><output id="cq-amount-${value}" for="cq-qty-${value}">0 ₫</output></td></tr>`).join('');
  $('cq-actual')?.setAttribute('role','status');$('cq-actual')?.setAttribute('aria-live','polite');
  const rawCounts=()=>Object.fromEntries(DENOMINATIONS.map(value=>[value,$('cq-qty-'+value).value]));
  function message(text,error=false){$('cq-message').textContent=text;$('cq-message').toggleAttribute('data-error',error);}
  function setError(input,errorElement,error){input.setAttribute('aria-invalid',String(Boolean(error)));errorElement.hidden=!error;errorElement.textContent=error||'';}
  function updatePrint(){
    if(!result.valid){$('cq-direct-print').innerHTML='<p>Số liệu chưa hợp lệ. Vui lòng sửa các ô nhập trước khi in phiếu.</p>';return;}
    $('cq-direct-print').innerHTML=reportContent(result,checkedAt,{includeERP:$('cq-include-erp').checked});
  }
  function render({changed=false}={}){
    if(changed)checkedAt=clock().toISOString();
    result=calculate(rawCounts(),$('cq-erp').value);
    for(const row of result.rows){
      $('cq-amount-'+row.denomination).textContent=row.amount===null?'—':moneyText(row.amount);
      setError($('cq-qty-'+row.denomination),$('cq-error-'+row.denomination),result.errors[row.denomination]);
    }
    setError($('cq-erp'),$('cq-erp-error'),result.errors.erp);
    $('cq-actual').textContent=result.total===null?'—':moneyText(result.total);
    $('cq-count').textContent=result.totalCount===null?'—':numberText(result.totalCount);
    $('cq-table-count').textContent=result.totalCount===null?'—':numberText(result.totalCount);
    $('cq-table-total').textContent=result.total===null?'—':moneyText(result.total);
    const balance=balanceLabel(result);$('cq-status-box').dataset.kind=balance.kind;$('cq-delta-card').dataset.kind=balance.kind;
    $('cq-balance-label').textContent=balance.label;$('cq-balance-description').textContent=balance.description;
    $('cq-delta').textContent=result.difference===null?(result.valid?'Chưa nhập ERP':'—'):(result.difference>0n?'+':'')+moneyText(result.difference);
    $('cq-delta').toggleAttribute('data-pending',result.difference===null);
    $('cq-delta-caption').textContent=result.difference===null?(result.valid?'Nhập tiền ERP để đối chiếu':'Có ô nhập chưa hợp lệ'):result.difference>0n?'Thiếu tiền':result.difference<0n?'Thừa tiền':'Tiền thực tế khớp ERP';
    $('cq-time').textContent=timestampText(checkedAt);$('cq-time').dateTime=checkedAt;
    for(const id of ['cq-copy','cq-csv','cq-print','ncn-page-print'])if($(id))$(id).disabled=!result.valid;
    if(!result.valid)message('Có '+Object.keys(result.errors).length+' ô nhập chưa hợp lệ. Kiểm tra các ô được đánh dấu.',true);
    else if(changed)message('');
    updatePrint();return result;
  }
  function formatERP(event){
    const input=$('cq-erp'),raw=input.value;
    try{
      // Deleting/inserting a digit can temporarily leave an incomplete comma group.
      // Pasted content still uses the strict parser so decimals stay invalid.
      const editing=event.inputType?.startsWith('delete')||event.inputType==='insertText'&&/^\d$/.test(event.data??'');
      const formatted=erpInputText(editing?raw.replaceAll(',',''):raw);if(formatted===raw)return;
      const caret=input.selectionStart??raw.length,digits=raw.slice(0,caret).replace(/\D/g,'').length;
      input.value=formatted;let position=0,seen=0;
      while(position<formatted.length&&seen<digits){if(/\d/.test(formatted[position]))seen++;position++;}
      input.setSelectionRange(position,position);
    }catch{/* Keep invalid input visible so the existing validation can explain it. */}
  }
  listen(app,'input',event=>{
    if(event.target.id==='cq-erp')formatERP(event);
    if(event.target.matches('[data-cq-value],#cq-erp'))render({changed:true});
  });
  listen(app,'focusout',event=>{
    const input=event.target;
    if(input.matches('[data-cq-value]')){const value=result.rows.find(row=>String(row.denomination)===input.dataset.cqValue)?.count;if(value!==null&&value!==undefined&&input.value.trim())input.value=numberText(value);}
    if(input.id==='cq-erp'&&!result.errors.erp&&result.erp!==null)input.value=erpInputText(result.erp);
  });
  listen($('cq-rows'),'keydown',event=>{
    const input=event.target.closest('[data-cq-value]');if(!input)return;
    const index=DENOMINATIONS.indexOf(Number(input.dataset.cqValue));
    const offset=event.key==='Enter'||event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;
    if(offset){event.preventDefault();const next=DENOMINATIONS[index+offset];if(next!==undefined)$('cq-qty-'+next).focus();}
  });
  listen($('cq-include-erp'),'change',updatePrint);
  function print(){if(!result.valid){message('Sửa số liệu chưa hợp lệ trước khi in.',true);return;}printer(printDocument(result,checkedAt,{includeERP:$('cq-include-erp').checked}));}
  listen($('cq-print'),'click',print);
  // The site's existing “In trang” button prints this tool's report, preserving the shell.
  listen($('ncn-page-print'),'click',event=>{event.preventDefault();event.stopImmediatePropagation();print();},true);
  listen(win,'beforeprint',updatePrint);
  listen($('cq-reset'),'click',()=>{
    if((DENOMINATIONS.some(value=>$('cq-qty-'+value).value.trim())||$('cq-erp').value.trim())&&!win.confirm('Xóa các số liệu trên bảng kiểm quỹ này?'))return;
    for(const value of DENOMINATIONS)$('cq-qty-'+value).value='';$('cq-erp').value='';render({changed:true});message('Đã xóa số liệu.');$('cq-qty-'+DENOMINATIONS[0]).focus();
  });
  const dialog=$('cq-copy-dialog');
  listen($('cq-copy'),'click',async()=>{
    if(!result.valid)return;
    const text=textReport(result,checkedAt);
    try{if(!win.navigator.clipboard?.writeText)throw new Error('clipboard');await win.navigator.clipboard.writeText(text);message('Đã sao chép bảng kiểm quỹ.');}
    catch{if(!dialog){message('Chưa sao chép được. Dùng Tải CSV để lưu kết quả.',true);return;}$('cq-copy-text').value=text;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');$('cq-copy-text').focus();$('cq-copy-text').select();}
  });
  listen($('cq-copy-close'),'click',()=>{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');$('cq-copy').focus();});
  listen($('cq-csv'),'click',()=>{
    if(!result.valid)return;
    try{const blob=new win.Blob([csvReport(result,checkedAt)],{type:'text/csv;charset=utf-8'}),url=win.URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='kiem-quy-ncn-'+dateKey(checkedAt)+'.csv';doc.body.append(link);link.click();link.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);message('Đã tạo tệp CSV kiểm quỹ.');}
    catch{message('Chưa tải được tệp. Dùng Sao chép để lấy kết quả.',true);}
  });
  render();
  return {render,print,getResult:()=>result,getTimestamp:()=>checkedAt,destroy:()=>listeners.splice(0).forEach(remove=>remove())};
}
export function bootCashApp(){const app=document.getElementById('ncn-cash-app');if(app&&!app.dataset.cqMounted){app.dataset.cqMounted='true';return createCashApp({app});}}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&!window.NCN_CASH_TEST){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCashApp,{once:true});else bootCashApp();}
