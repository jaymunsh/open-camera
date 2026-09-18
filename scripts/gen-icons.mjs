import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (c1, c2, t) => [
  Math.round(lerp(c1[0], c2[0], t)),
  Math.round(lerp(c1[1], c2[1], t)),
  Math.round(lerp(c1[2], c2[2], t)),
];

function iconPixel(size, artScale) {
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.24 * artScale;
  const ringW = size * 0.045 * artScale;
  const dotR = size * 0.07 * artScale;
  const top = [18, 18, 26];
  const bot = [88, 68, 210];
  const glow = [230, 126, 60];
  return (x, y) => {
    const t = y / size;
    let [r, g, b] = mix3(top, bot, t * t * (3 - 2 * t));
    const gd = Math.hypot(x - size * 0.85, y - size * 0.8) / size;
    const ga = Math.max(0, 1 - gd * 2.6) * 0.55;
    r = Math.round(lerp(r, glow[0], ga));
    g = Math.round(lerp(g, glow[1], ga));
    b = Math.round(lerp(b, glow[2], ga));
    const d = Math.hypot(x - cx, y - cy);
    const ring = 1 - Math.min(1, Math.abs(d - ringR) / ringW);
    const dot = 1 - Math.min(1, d / dotR);
    const a = Math.max(ring, dot * 0.9);
    r = Math.round(lerp(r, 255, a));
    g = Math.round(lerp(g, 255, a));
    b = Math.round(lerp(b, 255, a));
    return [r, g, b, 255];
  };
}

for (const [name, size, art] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 1],
]) {
  fs.writeFileSync(path.join(outDir, name), encodePNG(size, size, iconPixel(size, art)));
  console.log('wrote', name);
}
