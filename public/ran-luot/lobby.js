import {arcadeAPI} from './online.js?v=20261025-online-1';
import {getSettings} from '../assets/ncn-identity-client.js';
const $=id=>document.getElementById('rl-'+id);
export function mountLobby({onJoin,pause=()=>{}}){
 let ready=false,busy=false,room=new URLSearchParams(location.search).get('room')||'public',period='daily',boardRoom='public',facebook=false;
 if(room!=='public'&&!/^[\w-]{22}$/.test(room))room='invalid';
 const user=()=>window.NCNAccount?.state?.user;
 function render(){const signed=!!user();$('online-account').textContent=signed?'Đang chơi với tên '+(user().name?.includes('@')?'thành viên NCN':user().name||'thành viên NCN'):'Đăng nhập để chơi online và lưu điểm.';$('online-login').hidden=signed;$('online-facebook').hidden=signed||!facebook;$('online-play').disabled=!signed||busy;$('online-create').disabled=!signed||busy;$('online-play').textContent=busy?'Đang mở đấu trường…':room==='public'?'Vào đấu trường chung':'Vào phòng bạn bè';$('online-room').value=room==='public'?'':room;}
 function status(message){$('online-status').textContent=message;}
 function open(){if(!ready)return;pause();render();if(!$('online-dialog').open)$('online-dialog').showModal();}
 async function board(){
  try{const value=await arcadeAPI('leaderboard&room='+encodeURIComponent(boardRoom)),rows=value[period]?.items||[];$('rank-rows').replaceChildren();
   for(const entry of rows){const tr=document.createElement('tr');if(entry.you)tr.className='rl-rank-you';for(const value of [entry.rank,entry.name+(entry.you?' · Bạn':''),entry.score.toLocaleString('vi-VN')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('rank-rows').append(tr);}
   $('rank-status').textContent=rows.length?'Điểm do máy chủ xác nhận · '+(boardRoom==='public'?'Đấu trường chung':'Phòng bạn bè'):'Chưa có thành tích. Vào đấu trường và ghi tên đầu tiên!';
  }catch(error){$('rank-status').textContent=error.status===404?'Vào phòng bạn bè bằng liên kết mời để xem bảng điểm.':error.message;}
 }
 async function join(){
  if(busy)return;if(room!=='public'&&!/^[\w-]{22}$/.test(room)){status('Mã phòng không hợp lệ. Dán đủ mã được mời hoặc chọn đấu trường chung.');return;}if(!user()){window.NCNAccount?.open('login');return;}busy=true;status('Đang mở đấu trường…');render();
  try{await onJoin(room);$('online-dialog').close();boardRoom=room;$('rank-scope').value=room==='public'?'public':'friends';await board();}catch(error){status(error.message);}finally{busy=false;render();}
 }
 for(const id of ['online-start','online-open'])$(id).addEventListener('click',open);
 $('online-close').addEventListener('click',()=>$('online-dialog').close());$('online-dialog').addEventListener('click',e=>{if(e.target===$('online-dialog')&&!busy)$('online-dialog').close();});
 $('online-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('online-login').addEventListener('click',()=>window.NCNAccount?.open('login'));
 $('online-facebook').addEventListener('click',()=>window.NCNAccount?.facebook());
 $('online-public').addEventListener('click',()=>{room='public';status('');render();});
 $('online-room').addEventListener('input',()=>{room=$('online-room').value.trim()||'public';$('online-play').textContent=room==='public'?'Vào đấu trường chung':'Vào phòng bạn bè';});
 $('online-create').addEventListener('click',async()=>{if(busy||!user())return;busy=true;render();try{const value=await arcadeAPI('room',{method:'POST',data:{}});room=value.room;status('Đã tạo phòng. Sao chép link mời để bạn bè cùng vào.');}catch(error){status(error.message);}finally{busy=false;render();}});
 $('online-copy').addEventListener('click',async()=>{if(room==='public'){status('Tạo phòng bạn bè trước để lấy link mời.');return;}const link=new URL('/ran-luot/',location.origin);link.searchParams.set('room',room);try{await navigator.clipboard.writeText(link.href);status('Đã sao chép link mời vào phòng.');}catch{status(link.href);}});
 $('online-play').addEventListener('click',join);
 for(const button of document.querySelectorAll('[data-rank-period]'))button.addEventListener('click',()=>{period=button.dataset.rankPeriod;for(const b of document.querySelectorAll('[data-rank-period]'))b.setAttribute('aria-pressed',String(b===button));board();});
 $('rank-scope').addEventListener('change',()=>{boardRoom=$('rank-scope').value==='friends'&&room!=='public'?room:'public';board();});$('rank-refresh').addEventListener('click',board);
 for(const event of ['ncn-account-ready','ncn-account-change'])document.addEventListener(event,()=>{render();if(ready)board();});
 getSettings().then(settings=>{facebook=!!settings.providers?.facebook;render();}).catch(()=>{});
 arcadeAPI('config').then(config=>{if(!config.ready)return;ready=true;document.body.classList.add('ncn-online-enabled');$('stage').dataset.online='true';$('online-panel').hidden=false;$('online-start').hidden=false;$('start').className='rl-secondary';$('start').firstElementChild.textContent='Chơi với AI';document.querySelector('.rl-intro .rl-note').textContent='Chơi AI miễn phí. Online dùng tài khoản NCN hoặc Facebook và có bảng xếp hạng chung.';board();}).catch(()=>{});
 return {open,refresh:board,get room(){return room;},isOpen:()=>$('online-dialog').open};
}
