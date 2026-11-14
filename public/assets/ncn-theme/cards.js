import {installCardRotation} from './card-rotation.js';

/* The buttons use the catalogue's actual layouts and sizes. */
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Coordinates in the shared 4 × 4 catalogue illustration.
const categoryCovers={
  ML:[0,1],TVTL:[1,1],MG:[2,1],MLN:[3,1],GD:[0,2],
  'tra-cham':[3,2],'bao-hiem':[0,3],'cong-viec':[1,3]
};
const modelCovers={
  pk:[2,0],'laptop-hssv':[3,0],qdh:[1,2],
  'tk-ht':[3,2],'tk-tc':[3,2]
};
function coverPosition(model){
  if(model.section==='decor')return [3,3];
  return modelCovers[model.id]||
    categoryCovers[model.industry]||
    (model.industry==='ICT'?(model.id.startsWith('led-')?[1,0]:[0,0]):null)||
    categoryCovers[model.group]||[2,2];
}

export function catalogueCard(model,layouts,selectedId,{illustrated=true}={}){
  const id=escape(model.id),name=escape(model.name);
  const atlasSize=100/3;
  const buttons=model.variants.map((variant,index)=>{
    const layout=layouts.find(item=>item.id===variant.layout),count=Number(layout?.perPage||1);
    const color=count>=4?'small':count>=2?'medium':'large';
    return `<button type="button" class="st-size-${color}" data-model="${id}" data-variant="${index}" aria-label="${name}: ${escape(variant.size)}">${model.variants.length===1?'Chọn mẫu · ':''}${escape(variant.size)}</button>`;
  }).join('');
  const thumbnail=`<img class="st-card-thumbnail" src="${escape(model.thumbnail)}" alt="Mẫu ${name}" loading="lazy" decoding="async" width="220" height="205">`;
  const [column,row]=illustrated?coverPosition(model):[];
  const visual=illustrated?`<span class="st-card-visual" style="--st-cover-position:${column*atlasSize}% ${row*atlasSize}%">${thumbnail}</span>`:thumbnail;
  return `<article class="st-card" data-card-model="${id}" data-current="${model.id===selectedId}">
  <button type="button" class="st-card-preview" data-model="${id}" aria-label="${name}: chọn mẫu">
    ${visual}
    <strong>${name}</strong>${model.note?`<span class="st-card-description">${escape(model.note)}</span>`:''}
  </button>
  ${illustrated?`<button type="button" class="st-card-peek" aria-label="Xem mẫu in ${name}" aria-pressed="false">Xem mẫu in</button>`:''}
  <div class="st-card-sizes" aria-label="Chọn cỡ ${name}">${buttons}</div>
</article>`;
}

export function installCataloguePreview(cards,{win=window}={}){
  const catalogue=cards.closest('.st-catalogue');
  const rotation=installCardRotation(catalogue,{selector:'.st-card',win});
  function clear(){
    const fixed=cards.querySelector('[data-preview-choice]');
    if(!fixed)return;
    fixed.removeAttribute('data-preview-choice');
    const button=fixed.querySelector('.st-card-peek');
    button.setAttribute('aria-pressed','false');
    button.textContent='Xem mẫu in';
  }
  function show(event){
    const button=event.target.closest('.st-card-peek');
    if(!button)return;
    const card=button.closest('.st-card'),choice=card.dataset.previewChoice;
    const showSample=choice!=='sample';
    clear();
    card.dataset.previewChoice=showSample?'sample':'cover';
    button.setAttribute('aria-pressed',String(showSample));
    button.textContent=showSample?'Hiện minh họa':'Xem mẫu in';
  }
  function markLoaded(image){
    if(image.complete&&image.naturalWidth)image.closest('.st-card').setAttribute('data-sample-ready','');
  }
  function loaded(event){
    if(event.target.matches('.st-card-thumbnail'))markLoaded(event.target);
  }
  function refresh(){
    cards.querySelectorAll('.st-card-thumbnail').forEach(markLoaded);
    rotation.refresh();
  }
  cards.addEventListener('click',show);
  cards.addEventListener('load',loaded,true);
  return {clear,refresh,destroy(){
    clear();
    cards.removeEventListener('click',show);
    cards.removeEventListener('load',loaded,true);
    rotation.destroy();
  }};
}
