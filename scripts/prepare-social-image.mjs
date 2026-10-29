import sharp from 'sharp';

// The existing NCN logo and code-native gradients keep the share card in the
// approved visual system. PNG is readable by chat crawlers that reject SVG.
const background=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#eaf8ff"/><stop offset=".5" stop-color="#dbf3ee"/><stop offset="1" stop-color="#e9e9ff"/></linearGradient><linearGradient id="glass" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".86"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient><radialGradient id="blue"><stop stop-color="#b5d9ff" stop-opacity=".75"/><stop offset="1" stop-color="#b5d9ff" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/><ellipse cx="1020" cy="70" rx="480" ry="430" fill="url(#blue)"/>
<path d="M800-70C550 100 1180 180 1030 440" fill="none" stroke="#fff" stroke-opacity=".36" stroke-width="2"/>
<rect x="48" y="52" width="1104" height="534" rx="48" fill="#183b61" opacity=".045"/>
<rect x="48" y="48" width="1104" height="534" rx="48" fill="url(#glass)" stroke="#fff" stroke-width="2"/>
<g font-family="DejaVu Sans, sans-serif" fill="#18344d"><rect x="916" y="93" width="188" height="52" rx="26" fill="#fff" fill-opacity=".68"/><text x="1010" y="126" text-anchor="middle" font-size="17" font-weight="700" letter-spacing="2">NCN TOOLS</text>
<text x="88" y="365" font-size="48" font-weight="700" letter-spacing="-1">nguyencongnghe.com</text>
<text x="91" y="424" font-size="26" fill="#4b657c">Công cụ cho ngày làm việc</text>
<text x="91" y="510" font-size="22" fill="#4b657c">In ấn  ·  Bán hàng  ·  Kho  ·  Tiện ích</text></g></svg>`);
const logo=await sharp('public/assets/ncn-theme/logo.png').resize({width:350,height:145,fit:'inside'}).png().toBuffer();
await sharp(background).composite([{input:logo,left:86,top:114}]).png({compressionLevel:9,palette:false}).toFile('public/assets/ncn-theme/share-ncn-20261029.png');
console.log('Created NCN share card, 1200 × 630.');
