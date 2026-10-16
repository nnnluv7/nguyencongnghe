// Read the same template and artwork used by /popup-a4-a5-a6/?mau=gv-2.
// Embed assets once so downloaded VIP printouts also work offline.
'use strict';
const {readFileSync} = require('node:fs');
const path = require('node:path');
module.exports = function loadGV2Assets(publicDirectory) {
  const catalogue = JSON.parse(readFileSync(path.join(publicDirectory, 'assets/ncn-popup/catalogue.json'), 'utf8'));
  const layout = catalogue.layouts.find(item => item.id === 'gv-2');
  const fonts = (catalogue.fontCSS.match(/@font-face\s*\{[^}]*\}/g) || []).filter(rule => rule.includes('ncn-gv2-')).join('\n');
  if (!layout || !fonts) throw new Error('Chưa tải được mẫu Giờ vàng giá sốc 2.');
  const css = (fonts + '\n' + layout.css).replace(/url\((['"]?)(\/assets\/ncn-popup\/media\/gv2-[a-z0-9-]+\.(png|woff2))\1\)/g, (_, quote, url, extension) => {
    const data = readFileSync(path.join(publicDirectory, url.slice(1))).toString('base64');
    return 'url("data:' + (extension === 'png' ? 'image/png' : 'font/woff2') + ';base64,' + data + '")';
  });
  if (/url\((?!["']?data:)/.test(css) || /<\/style/i.test(css)) throw new Error('Tài nguyên mẫu Giờ vàng giá sốc 2 chưa hợp lệ.');
  return {layout, css};
};
