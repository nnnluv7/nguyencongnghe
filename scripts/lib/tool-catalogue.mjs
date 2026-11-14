// Each store-tool page needs one section. Preserve its original print layouts,
// font definitions and asset checksums while omitting the other section's data.
export function catalogueForSection(data,section){
  const models=data.models.filter(model=>model.section===section);
  if(!models.length)throw new Error('Unknown tool catalogue section: '+section);
  const ids=new Set(models.flatMap(model=>model.variants.map(variant=>variant.layout)));
  const layouts=data.layouts.filter(layout=>ids.has(layout.id));
  const used=JSON.stringify(layouts)+data.fontCSS;
  return {...data,models,layouts,
    groups:data.groups.filter(group=>models.some(model=>model.group===group.id)),
    assets:data.assets.filter(asset=>used.includes(asset.path))};
}
