/* The buttons use the catalogue's actual layouts and sizes. */
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Coordinates in the shared 4 × 4 catalogue illustration.
const categoryCovers={
  ML:[0,1],TVTL:[1,1],MG:[2,1],MLN:[3,1],GD:[0,2],
  'tra-cham':[3,2],'bao-hiem':[0,3],'cong-viec':[1,3]
};
const modelCovers={
  pk:[2,0],'laptop-hssv':[3,0],qdh:[1,2],
  'tk-ht':[3,2],'tk-tc':[3,2],
  'work-bang-ten':[2,3],'work-bang-ten-new':[2,3],
  'work-sticker-may-1':[1,0],'work-sticker-may-2':[1,0],
  'sales-bhxm':[0,3],'sales-tv-bh':[0,3],'sales-tdbh':[0,3],
  'sales-bh-giao-hang':[0,3],'sales-doi-tra-bao-hanh':[0,3],
  'sales-tv-tc':[3,2],'sales-the-tt':[3,2],'sales-ptk':[3,2]
};
// These older catalogue images are product icons or reused placeholders.
const renderPopups=new Set(['btn-tc','led-tc','ml-tc','mg-tc','tvtl-tc','mln-full','gv-2']);

function coverPosition(model){
  if(model.section==='decor')return [3,3];
  return modelCovers[model.id]||
    categoryCovers[model.industry]||
    (model.industry==='ICT'?(model.id.startsWith('led-')?[1,0]:[0,0]):null)||
    categoryCovers[model.group]||[2,2];
}

export function catalogueCard(model,layouts){
  const id=escape(model.id),name=escape(model.name),render=renderPopups.has(model.id);
  const [column,row]=coverPosition(model),atlasSize=100/3;
  const buttons=model.variants.map((variant,index)=>{
    const layout=layouts.find(item=>item.id===variant.layout),count=Number(layout?.perPage||1);
    const color=count>=4?'small':count>=2?'medium':'large';
    return `<button type="button" class="st-size-${color}" data-model="${id}" data-variant="${index}" aria-label="${name}: ${escape(variant.size)}">${model.variants.length===1?'Chọn mẫu · ':''}${escape(variant.size)}</button>`;
  }).join('');
  return `<article class="st-card" data-card-model="${id}"${render?' data-render-preview':''}>
  <button type="button" class="st-card-preview" data-model="${id}" aria-label="${name}: chọn mẫu">
    <span class="st-card-visual" style="--st-cover-position:${column*atlasSize}% ${row*atlasSize}%">
      ${render?'':`<img class="st-card-thumbnail" src="${escape(model.thumbnail)}" alt="Mẫu ${name}" loading="lazy" decoding="async" width="220" height="205">`}
    </span>
    <strong>${name}</strong>${model.note?`<span class="st-card-description">${escape(model.note)}</span>`:''}
  </button>
  <button type="button" class="st-card-peek" aria-label="Xem mẫu in ${name}" aria-pressed="false">Xem mẫu in</button>
  <div class="st-card-sizes" aria-label="Chọn cỡ ${name}">${buttons}</div>
</article>`;
}

export function installCataloguePreview(cards,{win=window,renderPreview}={}){
  const doc=cards.ownerDocument;
  let frame;
  function clear(){
    const active=frame?.closest('[data-card-model]');
    frame?.remove();frame=null;
    active?.removeAttribute('data-preview-ready');
  }
  function reveal(card){
    if(!renderPreview||!card?.hasAttribute('data-render-preview')||frame?.closest('[data-card-model]')===card)return;
    clear();
    frame=doc.createElement('iframe');
    frame.className='st-card-live';
    frame.setAttribute('sandbox','allow-same-origin');
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    frame.title='Mẫu '+card.querySelector('strong').textContent;
    frame.srcdoc=renderPreview(card.dataset.cardModel);
    const preview=frame;
    preview.addEventListener('load',async()=>{
      const content=preview.contentDocument;
      const sample=content?.querySelector('.paper>div>div');
      if(!sample)return;
      await content.fonts?.ready;
      if(frame!==preview||!preview.isConnected)return;
      const visual=preview.parentElement;
      const box=sample.getBoundingClientRect();
      if(box.width<=0||box.height<=0||visual.clientWidth<=16||visual.clientHeight<=16)return;
      const scale=Math.min((visual.clientWidth-16)/box.width,(visual.clientHeight-16)/box.height);
      const sheet=content.querySelector('.ncn-sheet');
      sheet.style.transformOrigin='0 0';
      sheet.style.transform=`translate(${(visual.clientWidth-box.width*scale)/2-box.left*scale}px,${(visual.clientHeight-box.height*scale)/2-box.top*scale}px) scale(${scale})`;
      card.dataset.previewReady='';
    },{once:true});
    card.querySelector('.st-card-visual').append(preview);
  }
  function show(event){
    const button=event.target.closest('.st-card-peek');
    if(!button)return;
    const active=button.getAttribute('aria-pressed')==='true';
    cards.querySelectorAll('.st-card-peek[aria-pressed=true]').forEach(open=>{
      open.setAttribute('aria-pressed','false');
      open.textContent='Xem mẫu in';
    });
    if(!active){
      button.setAttribute('aria-pressed','true');
      button.textContent='Hiện minh họa';
      reveal(button.closest('[data-card-model]'));
    }else clear();
  }
  function point(event){
    if(event.pointerType==='mouse')reveal(event.target.closest('[data-card-model]'));
  }
  function focus(event){if(event.target.matches(':focus-visible'))reveal(event.target.closest('[data-card-model]'));}
  function leave(event){
    const card=frame?.closest('[data-card-model]');
    if(card&&!card.contains(event.relatedTarget)&&!card.matches(':hover')&&!card.querySelector(':focus-visible')&&!card.querySelector('[aria-pressed=true].st-card-peek'))clear();
  }
  function resize(){
    const card=frame?.closest('[data-card-model]');
    if(card?.querySelector('[aria-pressed=true].st-card-peek')||card?.querySelector(':focus-visible')||card?.matches(':hover')){
      clear();
      reveal(card);
    }else clear();
  }
  cards.addEventListener('click',show);
  if(renderPreview){
    cards.addEventListener('pointerover',point);
    cards.addEventListener('pointerout',leave);
    cards.addEventListener('focusin',focus);
    cards.addEventListener('focusout',leave);
    win.addEventListener('resize',resize);
  }
  return ()=>{
    clear();
    cards.removeEventListener('click',show);
    cards.removeEventListener('pointerover',point);
    cards.removeEventListener('pointerout',leave);
    cards.removeEventListener('focusin',focus);
    cards.removeEventListener('focusout',leave);
    win.removeEventListener('resize',resize);
  };
}
