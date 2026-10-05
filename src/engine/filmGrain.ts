// Independent v2 stream: never changes the saved version-1 pattern generator.
export function filmGrainTile(seed: number, size = 256): Uint8Array {
  if (!Number.isFinite(seed) || seed < 0 || seed >= 1 || !Number.isInteger(size) || size < 1 || size > 1024) throw new Error('필름 입자 값이 올바르지 않아요.');
  let state = (Math.floor(seed * 4294967296) ^ 0x46564D32) >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state); n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const pixels = new Uint8Array(size * size * 4), half = Math.floor(size * size / 2);
  // Antithetic pairs keep each channel centered without an image-wide tint.
  for (let i = 0; i < half; i++) for (let channel = 0; channel < 4; channel++) {
    const value = Math.round((random() + random() + random() + random()) * 255 / 4);
    pixels[i * 4 + channel] = value; pixels[(i + half) * 4 + channel] = 255 - value;
  }
  if (size * size % 2) pixels.fill(128, pixels.length - 4);
  return pixels;
}
