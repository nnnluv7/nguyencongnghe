// Photo uploads can outlast a short public-read deadline on mobile connections.
export async function requestJSON(url,{data,timeout=12000,fetcher=fetch}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Request deadline exceeded','TimeoutError')),timeout);
 try{
 let response;
 try{
  response=await fetcher(url,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:controller.signal});
 }catch(cause){
  throw Object.assign(new Error('Kết nối đang chậm hoặc bị gián đoạn. Vui lòng thử lại.'),{retryable:true,cause});
 }
 let value;
 try{value=await response.json();}catch(cause){throw Object.assign(new Error('Máy chủ chưa trả lời đầy đủ. Vui lòng thử lại.'),{status:response.status,retryable:true,cause});}
 if(!value||typeof value!=='object')throw Object.assign(new Error('Máy chủ chưa trả lời đầy đủ. Vui lòng thử lại.'),{status:response.status,retryable:true});
 if(!response.ok)throw Object.assign(new Error(value.error||'Chưa kết nối được máy chủ. Vui lòng thử lại.'),{status:response.status,retryable:[408,429,500,502,503,504].includes(response.status)});
 return value;
 }finally{clearTimeout(timer);}
}
