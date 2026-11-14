export const HOME_TOOL_PREVIEWS='/assets/ncn-theme/home-tool-previews-67f26e949a2a.webp';

// Both 5-column images have slot 6 reserved for the former second Popup card.
// These slots belong to tool IDs, independent of menu order and VIP visibility.
const slots={
  audio:0,cash:1,insurance:2,'lucky-wheel':3,sticker:4,
  'popup-a7':5,sales:7,fifo:8,inventory:9,qr:10,
  decor:11,'ncn-arcade':12,'flappy-bird':13,event:14,gvgs:15,
  'ran-luot':16,'ca-lon-nuot-ca-be':17,pikachu:18,'xep-hinh':19,'ban-bong':20,
  'dao-vang':21,'ghep-khoi':22
};

export function homeCardArt(id){
  if(!Object.hasOwn(slots,id))return '';
  const slot=slots[id],column=slot%5,row=Math.floor(slot/5);
  return '<div class="ncn-tool-art" aria-hidden="true" style="--ncn-tool-art-position:'+
    (column*25)+'% '+(row*25)+'%"></div>';
}
