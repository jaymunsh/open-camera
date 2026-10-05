export function filmFixture(kind: 'gradient' | 'checker' | 'light', width = 320, height = 240): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#102030'); gradient.addColorStop(.5, '#808080'); gradient.addColorStop(1, '#f0d0b0');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  } else if (kind === 'checker') {
    const colors = ['#d94832', '#58a16a', '#426cb1', '#e5cd7a', '#a268a7', '#60b2b8', '#292929', '#808080', '#eee9df'];
    colors.forEach((color, index) => { ctx.fillStyle = color; ctx.fillRect(index % 3 * width / 3, Math.floor(index / 3) * height / 3, width / 3, height / 3); });
  } else { ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fff'; ctx.fillRect(width * .45, height * .45, width * .1, height * .1); }
  return canvas;
}
export function readFilmPixels(canvas: HTMLCanvasElement): Uint8Array {
  const gl = canvas.getContext('webgl2')!; const data = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data;
}
export async function filmPixelHash(canvas: HTMLCanvasElement): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', readFilmPixels(canvas).buffer as ArrayBuffer))).map(n => n.toString(16).padStart(2, '0')).join('');
}
export function fixedLegacyRandom(): () => void {
  const old = Math.random; let state = 1;
  Math.random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  return () => { Math.random = old; };
}
