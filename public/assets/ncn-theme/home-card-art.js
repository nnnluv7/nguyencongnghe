export const HOME_TOOL_PREVIEWS='/assets/ncn-theme/home-tool-previews-67f26e949a2a.webp';

// Each cell has the same position in the illustration and preview images.
const positions={
  audio:[0,0],cash:[1,0],insurance:[2,0],'lucky-wheel':[3,0],sticker:[4,0],
  'popup-a7':[0,1],sales:[1,1],fifo:[2,1],inventory:[3,1],qr:[4,1],
  decor:[0,2],'ncn-arcade':[1,2],'flappy-bird':[2,2],event:[3,2],gvgs:[4,2],
  'ran-luot':[0,3],'ca-lon-nuot-ca-be':[1,3],pikachu:[2,3],'xep-hinh':[3,3],'ban-bong':[4,3],
  'dao-vang':[0,4],'ghep-khoi':[1,4]
};

export function homeCardArt(id){
  if(!Object.hasOwn(positions,id))return '';
  const [column,row]=positions[id];
  return '<div class="ncn-tool-art" aria-hidden="true" style="--ncn-tool-art-position:'+
    (column*25)+'% '+(row*25)+'%"></div>';
}
