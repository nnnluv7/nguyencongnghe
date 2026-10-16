// Read the same template and artwork used by /popup-a4-a5-a6/?mau=gv-2.
// Embed assets once so downloaded VIP printouts also work offline.
'use strict';
const {readFileSync} = require('node:fs');
const path = require('node:path');
module.exports = function loadGV2Assets() {
  const catalogue = JSON.parse(readFileSync(path.join(process.cwd(), 'public/assets/ncn-popup/catalogue.json'), 'utf8'));
  const layout = catalogue.layouts.find(item => item.id === 'gv-2');
  const fonts = (catalogue.fontCSS.match(/@font-face\s*\{[^}]*\}/g) || []).filter(rule => rule.includes('ncn-gv2-')).join('\n');
  if (!layout || !fonts) throw new Error('Chưa tải được mẫu Giờ vàng giá sốc 2.');
  // Literal paths keep Netlify's dependency tracer inside this template's assets.
  // Do not pass the public directory as an argument: NFT scans that entire tree.
  const inlineAssets = {
    '/assets/ncn-popup/media/gv2-c58265ed88eabe63.png': 'data:image/png;base64,' + readFileSync(path.join(process.cwd(), 'public/assets/ncn-popup/media/gv2-c58265ed88eabe63.png')).toString('base64'),
    '/assets/ncn-popup/media/gv2-d257d3118827e9d6.woff2': 'data:font/woff2;base64,' + readFileSync(path.join(process.cwd(), 'public/assets/ncn-popup/media/gv2-d257d3118827e9d6.woff2')).toString('base64'),
    '/assets/ncn-popup/media/gv2-940ecfd5ee0f543e.woff2': 'data:font/woff2;base64,' + readFileSync(path.join(process.cwd(), 'public/assets/ncn-popup/media/gv2-940ecfd5ee0f543e.woff2')).toString('base64')
  };
  const css = (fonts + '\n' + layout.css).replace(/url\((['"]?)(\/assets\/ncn-popup\/media\/gv2-[a-z0-9-]+\.(png|woff2))\1\)/g, (_, quote, url) => {
    if (!Object.prototype.hasOwnProperty.call(inlineAssets, url)) throw new Error('Tài nguyên mẫu Giờ vàng giá sốc 2 chưa được đồng bộ.');
    return 'url("' + inlineAssets[url] + '")';
  });
  if (/url\((?!["']?data:)/.test(css) || /<\/style/i.test(css)) throw new Error('Tài nguyên mẫu Giờ vàng giá sốc 2 chưa hợp lệ.');
  return {layout, css};
};
