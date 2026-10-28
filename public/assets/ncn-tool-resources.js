// Public catalogues are discovered in the document head. The large spreadsheet
// reader is needed only after a person imports or exports an Excel file.
const spreadsheets=new WeakMap();
export function catalogueURL(source,doc=document){
  const path=source.split(/[?#]/)[0];
  return doc.querySelector('link[data-ncn-catalogue="'+path+'"]')?.getAttribute('href')||source;
}
export function loadSpreadsheet({doc=document,win=window}={}){
  if(win.XLSX)return Promise.resolve(win.XLSX);
  if(spreadsheets.has(doc))return spreadsheets.get(doc);
  let promise;promise=new Promise((resolve,reject)=>{
    const resource=doc.querySelector('link[data-ncn-spreadsheet]'),script=doc.createElement('script');
    script.src=resource?.getAttribute('href')||'/assets/vendor/125962e77eb283b9aa.js';script.async=true;
    if(resource?.getAttribute('integrity'))script.integrity=resource.getAttribute('integrity');
    if(resource?.getAttribute('crossorigin'))script.crossOrigin=resource.getAttribute('crossorigin');
    const finish=error=>{win.clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else resolve(win.XLSX);};
    const failure=()=>finish(new Error('Chưa đọc được tệp Excel do kết nối chậm. Anh thử lại nhé.'));
    const timer=win.setTimeout(failure,30000);
    script.onload=()=>win.XLSX?finish():failure();script.onerror=failure;doc.head.append(script);
  }).catch(error=>{if(spreadsheets.get(doc)===promise)spreadsheets.delete(doc);throw error;});
  spreadsheets.set(doc,promise);return promise;
}
