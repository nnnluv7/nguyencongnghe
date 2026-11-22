import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {sniffImage, cfScorePhoto} from '../functions/_cf/photo.mjs';

const fixtures = [
  '../public/assets/ncn-theme/logo.png',
  '../public/assets/ncn-popup/media/49e65b8932bb582b.jpg',
  '../public/assets/ncn-popup/media/gv-2-cover-8e08ae7302e4.webp',
  '../public/assets/ncn-popup/media/sample-btn-tc-1f991f21ae2d.webp',
  '../public/assets/ncn-sticker/media/2268bac1d05bebbc.jpg',
];

test('sniffImage agrees with sharp on real files', async () => {
  for (const rel of fixtures) {
    const bytes = readFileSync(new URL(rel, import.meta.url));
    const meta = await sharp(bytes).metadata();
    const info = sniffImage(bytes);
    assert.ok(info, rel + ' should be recognised');
    assert.equal(info.format, meta.format, rel);
    assert.equal(info.width, meta.width, rel);
    assert.equal(info.height, meta.height, rel);
    assert.equal(info.animated, false, rel);
  }
});

test('sniffImage rejects non-images and detects animation flags', () => {
  assert.equal(sniffImage(Buffer.from('not an image at all, just text........')), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
  assert.equal(sniffImage(Buffer.from([0xFF, 0xD8])), null);
  // Minimal VP8X header with the animation flag set.
  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0);
  webp.writeUInt32LE(22, 4);
  webp.write('WEBP', 8);
  webp.write('VP8X', 12);
  webp.writeUInt32LE(10, 16);
  webp[20] = 0x02; // animation flag
  webp[24] = 9; // width-1 = 9 -> 10
  webp[27] = 19; // height-1 = 19 -> 20
  const info = sniffImage(webp);
  assert.equal(info.format, 'webp');
  assert.equal(info.animated, true);
  assert.equal(info.width, 10);
  assert.equal(info.height, 20);
});

test('cfScorePhoto passes valid images through unchanged and rejects the rest', async () => {
  const png = readFileSync(new URL('../public/assets/ncn-popup/media/gv-2-cover-8e08ae7302e4.webp', import.meta.url));
  const out = await cfScorePhoto(png);
  assert.deepEqual(out, png);
  await assert.rejects(cfScorePhoto(Buffer.from('hello world, not an image........')), /Unsupported image/);
  // A PNG header claiming 2000x2000 exceeds the 1M input-pixel cap.
  const big = Buffer.alloc(32);
  big[0] = 0x89; big.write('PNG', 1); big[4] = 0x0D; big[5] = 0x0A; big[6] = 0x1A; big[7] = 0x0A;
  big.writeUInt32BE(2000, 16);
  big.writeUInt32BE(2000, 20);
  await assert.rejects(cfScorePhoto(big), /Unsupported image/);
});
