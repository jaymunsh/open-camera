import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

// ---- sample photo for filter thumbnails ----
{
  const S = 512;
  const sky1 = [96, 150, 205];
  const sky2 = [185, 218, 238];
  const sun = [255, 238, 190];
  const mtn1 = [88, 96, 132];
  const mtn2 = [120, 126, 158];
  const grass1 = [84, 140, 84];
  const grass2 = [60, 110, 66];
  const checker = [
    [196, 48, 48],
    [228, 178, 32],
    [60, 160, 76],
    [64, 164, 200],
    [60, 80, 180],
    [172, 72, 160],
    [238, 238, 238],
    [40, 40, 40],
  ];
  const hill = (x, a, b, c) => a * Math.sin(x * b + c);
  const png = encodePNG(S, S, (x, y) => {
    const t = y / S;
    // color checker strip bottom 14%
    if (t > 0.86) {
      const i = Math.min(7, Math.floor((x / S) * 8));
      return [...checker[i], 255];
    }
    // sky
    let col = mix3(sky1, sky2, t / 0.86);
    // sun
    const d = Math.hypot(x - S * 0.72, y - S * 0.2) / S;
    col = mix3(col, sun, Math.max(0, 1 - d * 5) * 0.9 + Math.max(0, 1 - d * 14));
    // clouds
    const cl = Math.sin(x * 0.02 + 2) * Math.sin(y * 0.05);
    if (t < 0.4 && cl > 0.55) col = mix3(col, [245, 245, 248], Math.min(1, (cl - 0.55) * 3));
    // mountains
    const mline = 0.52 + hill(x / S, 0.07, 9, 1.5) + hill(x / S, 0.03, 23, 0);
    if (t > mline && t < 0.68) col = mix3(mtn1, mtn2, (t - mline) / (0.68 - mline));
    // hills/grass
    const gline = 0.66 + hill(x / S, 0.05, 6, 4);
    if (t > gline) {
      col = mix3(grass1, grass2, Math.min(1, (t - gline) * 6));
      // flowers
      const fx = Math.floor(x / 26);
      const fy = Math.floor(y / 26);
      const h = ((fx * 7349 + fy * 19211) % 97) / 97;
      if (h < 0.12 && Math.hypot((x % 26) - 13, (y % 26) - 13) < 4)
        col = h < 0.06 ? [230, 80, 90] : [240, 210, 80];
    }
    return [...col, 255];
  });
  fs.mkdirSync(path.join(root, 'public/samples'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/samples/sample1.png'), png);
  console.log('wrote sample1.png');
}
