// Image handling without sharp (native module, unavailable on Workers).
//
// The Netlify code re-encodes uploads with sharp (resize + WebP/JPEG output +
// EXIF strip). On Cloudflare the original bytes are stored and served as-is;
// this module only VALIDATES the upload (format allow-list, still image,
// dimension/pixel limits) by parsing image headers, and sniffs the MIME type
// back at serve time so responses carry the correct Content-Type.
//
// LIMITATIONS (documented in IMPLEMENTATION.md):
// - No resize/thumbnail: story "thumb" requests serve the full original.
// - No EXIF strip: original uploads keep their metadata. Uploads are capped
//   at the same byte limits as before, and only JPEG/PNG/WebP are accepted.

function u16be(b, o) { return (b[o] << 8) | b[o + 1]; }
function u32be(b, o) { return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]; }
function u16le(b, o) { return b[o] | (b[o + 1] << 8); }
function ascii(b, o, n) { return String.fromCharCode(...b.subarray(o, o + n)); }

// PNG: scan chunks for acTL (animated PNG). Stops at IDAT/IEND.
function pngAnimated(b) {
  let o = 8;
  while (o + 8 <= b.length) {
    const length = u32be(b, o), type = ascii(b, o + 4, 4);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    if (!Number.isSafeInteger(length) || length < 0 || o + 12 + length > b.length) return false;
    o += 12 + length;
  }
  return false;
}

// JPEG: walk markers to the first SOF segment (0xC0-0xCF except DHT/DAC/JPG).
function jpegDimensions(b) {
  let o = 2;
  for (let steps = 0; steps < 200 && o + 4 <= b.length; steps++) {
    if (b[o] !== 0xFF) return null;
    let marker = b[o + 1];
    // Skip padding 0xFF bytes.
    while (marker === 0xFF && o + 2 < b.length) { o++; marker = b[o + 1]; }
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { o += 2; continue; }
    if (marker === 0xD9) return null;
    const length = u16be(b, o + 2);
    if (length < 2 || o + 2 + length > b.length) return null;
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      if (length < 7) return null;
      return {width: u16be(b, o + 7), height: u16be(b, o + 5)};
    }
    o += 2 + length;
  }
  return null;
}

function webpInfo(b) {
  if (b.length < 12 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X' && b.length >= 30) {
    const animated = (b[20] & 0x02) !== 0;
    const width = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const height = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return {format: 'webp', mime: 'image/webp', width, height, animated};
  }
  if (chunk === 'VP8 ' && b.length >= 30) {
    if (b[23] !== 0x9D || b[24] !== 0x01 || b[25] !== 0x2A) return {format: 'webp', mime: 'image/webp', width: null, height: null, animated: false};
    return {format: 'webp', mime: 'image/webp', width: u16le(b, 26) & 0x3FFF, height: u16le(b, 28) & 0x3FFF, animated: false};
  }
  if (chunk === 'VP8L' && b.length >= 25) {
    if (b[20] !== 0x2F) return {format: 'webp', mime: 'image/webp', width: null, height: null, animated: false};
    const width = (b[21] | ((b[22] & 0x3F) << 8)) + 1;
    const height = ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0F) << 10)) + 1;
    return {format: 'webp', mime: 'image/webp', width, height, animated: false};
  }
  return {format: 'webp', mime: 'image/webp', width: null, height: null, animated: false};
}

// Identify an image from its header bytes. Returns
// {format:'jpeg'|'png'|'webp', mime, width, height, animated} or null when the
// bytes are not a recognised still-image header. width/height are null when
// the format was recognised but the dimensions could not be parsed.
export function sniffImage(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) {
    return {format: 'png', mime: 'image/png', width: u32be(b, 16), height: u32be(b, 20), animated: pngAnimated(b)};
  }
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
    const dims = jpegDimensions(b);
    return {format: 'jpeg', mime: 'image/jpeg', width: dims?.width ?? null, height: dims?.height ?? null, animated: false};
  }
  if (b.length >= 12) return webpInfo(b);
  return null;
}

// Drop-in replacement for the sharp-based scorePhoto() injected into the
// profile/scores handlers. Validates the upload the same way (format
// allow-list, still image, 1M input-pixel cap when dimensions parse) but
// returns the ORIGINAL bytes unchanged — no resize, no WebP re-encode.
export async function cfScorePhoto(bytes, size = 768) {
  void size; // Kept for signature compatibility; no resize happens on Workers.
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const info = sniffImage(buf);
  if (!info || !['jpeg', 'png', 'webp'].includes(info.format) || info.animated) {
    throw new Error('Unsupported image');
  }
  if (info.width && info.height && info.width * info.height > 1_000_000) {
    throw new Error('Unsupported image');
  }
  return buf;
}
