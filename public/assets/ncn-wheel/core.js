/* NCN lucky wheel: unbiased selection and geometry, independent of the interface. */
export const MAX_ENTRIES=500;
export const MAX_HISTORY=500;
export const MAX_NAME=80;
export const STORAGE_KEY='ncn.lucky-wheel.v1';
export const COLORS=['#0d86dc','#e84894','#10a88c','#efb645','#8260db','#e75e4e','#147f9e','#6ca846'];
export const normalizeName=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
export const nameKey=value=>normalizeName(value).toLocaleLowerCase('vi-VN');
export function parseNames(value){
 const names=String(value??'').split(/\r?\n/).map(normalizeName).filter(Boolean);
 if(names.some(n=>n.length>MAX_NAME))throw new Error(`Mỗi tên tối đa ${MAX_NAME} ký tự. Anh rút gọn tên rồi thêm lại nhé.`);
 return names;
}
export function secureIndex(count,cryptoAPI=globalThis.crypto){
 if(!Number.isInteger(count)||count<1||count>MAX_ENTRIES)throw new RangeError('Số người tham gia không hợp lệ.');
 if(!cryptoAPI?.getRandomValues)throw new Error('Không tạo được số ngẫu nhiên. Mở trang qua HTTPS rồi thử lại nhé.');
 const span=2**32,limit=span-span%count,buffer=new Uint32Array(1);
 let value;do{cryptoAPI.getRandomValues(buffer);value=buffer[0];}while(value>=limit);
 return value%count;
}
export const normalizeAngle=value=>((value%360)+360)%360;
export function landingRotation(current,index,count,turns=6){
 if(!Number.isFinite(current)||!Number.isInteger(count)||count<1||count>MAX_ENTRIES||!Number.isInteger(index)||index<0||index>=count||!Number.isInteger(turns)||turns<1)throw new RangeError('Vòng quay không hợp lệ.');
 const target=normalizeAngle(-(index+.5)*360/count);
 return current+turns*360+normalizeAngle(target-normalizeAngle(current));
}
export function indexAtPointer(rotation,count){
 if(!Number.isFinite(rotation)||!Number.isInteger(count)||count<1||count>MAX_ENTRIES)throw new RangeError('Vòng quay không hợp lệ.');
 return Math.floor(normalizeAngle(-rotation)/360*count)%count;
}
export function sectorPath(index,count,radius=280,center=300){
 if(count===1)return `M ${center-radius} ${center} a ${radius} ${radius} 0 1 0 ${radius*2} 0 a ${radius} ${radius} 0 1 0 ${-radius*2} 0`;
 const step=360/count,point=angle=>{const r=angle*Math.PI/180;return [center+radius*Math.cos(r),center+radius*Math.sin(r)];};
 const a=point(-90+index*step),b=point(-90+(index+1)*step);
 return `M ${center} ${center} L ${a[0]} ${a[1]} A ${radius} ${radius} 0 ${step>180?1:0} 1 ${b[0]} ${b[1]} Z`;
}
export function emptyState(){return {version:1,entries:[],history:[],duration:5,removeWinner:true,nextDraw:1};}
export function restoreState(raw){
 const state=emptyState();let value;
 try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return state;}
 if(!value||typeof value!=='object'||value.version!==1)return state;
 const ids=new Set(),names=new Set();
 for(const row of Array.isArray(value.entries)?value.entries.slice(0,MAX_ENTRIES):[]){
  if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||typeof row.name!=='string')continue;
  const name=normalizeName(row.name),key=nameKey(name);
  if(!name||name.length>MAX_NAME||ids.has(row.id)||names.has(key))continue;
  ids.add(row.id);names.add(key);state.entries.push({id:row.id,name});
 }
 const draws=new Set();
 for(const row of Array.isArray(value.history)?value.history.slice(0,MAX_HISTORY):[]){
  if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||typeof row.name!=='string'||!Number.isSafeInteger(row.draw)||row.draw<1||!Number.isFinite(row.at)||row.at<0||row.at>8640000000000000||draws.has(row.draw))continue;
  const name=normalizeName(row.name);if(!name||name.length>MAX_NAME)continue;
  draws.add(row.draw);state.history.push({id:row.id,name,draw:row.draw,at:row.at});
 }
 state.history.sort((a,b)=>b.draw-a.draw);
 state.duration=Number.isInteger(value.duration)&&value.duration>=1&&value.duration<=20?value.duration:5;
 state.removeWinner=typeof value.removeWinner==='boolean'?value.removeWinner:true;
 const latest=state.history.reduce((n,r)=>Math.max(n,r.draw),0)+1;
 state.nextDraw=Number.isSafeInteger(value.nextDraw)&&value.nextDraw>=latest?value.nextDraw:latest;
 return state;
}
