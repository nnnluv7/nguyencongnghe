/* The buttons use the catalogue's actual layouts and sizes. */
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function catalogueCard(model,layouts,selectedId){
  const id=escape(model.id),name=escape(model.name),current=model.id===selectedId;
  const buttons=model.variants.map((variant,index)=>{
    const layout=layouts.find(item=>item.id===variant.layout),count=Number(layout?.perPage||1);
    const color=count>=4?'small':count>=2?'medium':'large';
    return `<button type="button" class="st-size-${color}" data-model="${id}" data-variant="${index}" aria-label="${name}: ${escape(variant.size)}">${model.variants.length===1?'Chọn mẫu · ':''}${escape(variant.size)}</button>`;
  }).join('');
  return `<article class="st-card" data-card-model="${id}" data-current="${current}"><button type="button" class="st-card-preview" data-model="${id}" aria-pressed="${current}" aria-label="${name}: chọn mẫu"><img src="${escape(model.thumbnail)}" alt="Mẫu ${name}" loading="lazy" width="220" height="205"><strong>${name}</strong>${model.note?`<span class="st-card-description">${escape(model.note)}</span>`:''}</button><div class="st-card-sizes" aria-label="Chọn cỡ ${name}">${buttons}</div></article>`;
}
