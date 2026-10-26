// The lock belongs only to the visible fullscreen game, never to a background tab.
export function createScreenAwake({request,isVisible=()=>!document.hidden,onChange=()=>{}}={}){
 let wanted=false,lock=null,pending=null,generation=0,status='off';
 const emit=value=>{if(status!==value){status=value;onChange(value);}};
 const eligible=()=>wanted&&isVisible();
 const release=async sentinel=>{try{await sentinel?.release();}catch{}};
 async function reconcile(){
  if(!eligible()){const previous=lock;lock=null;emit(wanted?'paused':'off');await release(previous);return;}
  if(lock&&!lock.released){emit('active');return;}
  if(pending)return pending;
  if(typeof request!=='function'){emit('unavailable');return;}
  const ticket=generation;emit('pending');
  pending=(async()=>{
   try{
    const next=await request('screen');
    if(ticket!==generation||!eligible()){await release(next);return;}
    lock=next;
    next.addEventListener('release',()=>{if(lock===next){lock=null;emit(wanted?(isVisible()?'interrupted':'paused'):'off');}},{once:true});
    emit(next.released?'interrupted':'active');
   }catch{if(ticket===generation&&eligible())emit('unavailable');}
  })();
  try{await pending;}finally{pending=null;if(ticket!==generation&&eligible())void reconcile();}
 }
 return {
  setActive(value){value=!!value;if(wanted!==value){wanted=value;generation++;}return reconcile();},
  visibilityChanged(){generation++;return reconcile();},
  get status(){return status;},
  destroy(){wanted=false;generation++;return reconcile();}
 };
}
