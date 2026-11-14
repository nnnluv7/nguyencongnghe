const sales='/assets/ncn-store-tools/sales/';

export const insuranceLogo=sales+'18003b4df479008ad390.png';
export const warrantyFontFamily='"Returns Serif","Times New Roman","Liberation Serif",serif';

const fonts=[
 {path:sales+'returns-serif-regular.woff2',mime:'font/woff2',sha256:'b1ee3cf81433a3df12875a9df72bf86029262d5f6b9fbb3561f72b9c6e403218',bytes:24984,weight:400},
 {path:sales+'returns-serif-bold.woff2',mime:'font/woff2',sha256:'20e66ec5efa31ef5a28b1a78d6b5b55408ca14492fde208af6d65257fb705ad7',bytes:23648,weight:700}
];

export const warrantyFontCSS=fonts.map(({path,weight})=>
 `@font-face{font-family:"Returns Serif";src:url("${path}") format("woff2");font-weight:${weight}}`
).join('\n');

export function withWarrantyFonts(assets){
 return assets.some(asset=>asset.path===fonts[0].path)?assets:[...fonts,...assets];
}
