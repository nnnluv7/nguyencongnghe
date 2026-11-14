export const POPUP_TOOL={
  id:'popup-a7',
  title:'Bộ Popup A4–A7 / LED',
  description:'Chọn mẫu giảm giá, trả chậm và dịch vụ theo ngành hàng.'
};

export const mergedPopupId=id=>id==='popup-large'?POPUP_TOOL.id:id;

export function withMergedPopup(tools){
  return tools.filter(tool=>tool?.id!=='popup-large').map(tool=>tool?.id===POPUP_TOOL.id?{...tool,...POPUP_TOOL}:tool);
}
