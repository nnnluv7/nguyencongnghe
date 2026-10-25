/* One live Vietnam-time clock shared by every website toolbar. */
const controllers=new WeakMap();
const dateFormat=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
const shortFormat=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'});
const timeFormat=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function toolbarDateTime(date=new Date()){return {date:dateFormat.format(date),shortDate:shortFormat.format(date),time:timeFormat.format(date),iso:date.toISOString()};}
export function installToolbarClock({doc=document,win=window}={}){
  if(controllers.has(doc))return controllers.get(doc);
  const toolbar=doc.getElementById('ncn-topbar')||doc.getElementById('ncn-game-topbar');if(!toolbar)return null;
  const clock=doc.createElement('div');clock.id='ncn-toolbar-clock';clock.className='ncn-toolbar-clock';clock.setAttribute('aria-live','off');
  clock.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div><time data-clock-time></time><span data-clock-date></span><span data-clock-short-date></span></div>';
  const time=clock.querySelector('[data-clock-time]'),date=clock.querySelector('[data-clock-date]'),shortDate=clock.querySelector('[data-clock-short-date]');
  const tick=()=>{const value=toolbarDateTime();time.textContent=value.time;time.dateTime=value.iso;date.textContent=value.date;shortDate.textContent=value.shortDate;clock.title=value.date+' · '+value.time+' · Giờ Việt Nam';clock.setAttribute('aria-label',clock.title);};
  const left=toolbar.querySelector('.ncn-topbar-left');
  if(left)left.append(clock);else toolbar.querySelector('.brand')?.after(clock);
  tick();
  const update=()=>{if(!doc.hidden)tick();},timer=win.setInterval(update,1000);
  doc.addEventListener('visibilitychange',update);win.addEventListener('pageshow',update);
  const api={destroy(){win.clearInterval(timer);doc.removeEventListener('visibilitychange',update);win.removeEventListener('pageshow',update);clock.remove();controllers.delete(doc);}};
  controllers.set(doc,api);return api;
}
