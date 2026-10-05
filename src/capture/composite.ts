import { drawDateStamp, exportSize, srcSize, type DateStampOptions } from '../engine/pipeline';
import type { CaptureMode, CompositionOptions } from './types';
import { compositionPaper } from './paper';

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지 저장에 실패했습니다')), 'image/jpeg', .95));
}
export function snapshotFrame(source: TexImageSource, ratio: { w: number; h: number } | null, mirror = false, maxEdge = 4096): HTMLCanvasElement {
  const { w, h } = srcSize(source);
  const out = exportSize(w, h, ratio);
  const scale = Math.min(1, maxEdge / Math.max(out.w, out.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(out.w * scale)); c.height = Math.max(1, Math.round(out.h * scale));
  const ctx = c.getContext('2d')!;
  const aspect = c.width / c.height;
  const sw = w / h > aspect ? h * aspect : w;
  const sh = w / h > aspect ? h : w / aspect;
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source as CanvasImageSource, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return c;
}
export function compositionLayout(fw: number, fh: number, mode: Exclude<CaptureMode, 'normal'>, options: Partial<CompositionOptions>, maxEdge = 2048) {
  const expected = mode === 'booth' ? 4 : mode === 'instant' ? 1 : 2;
  const cols = mode === 'half' ? 2 : mode === 'booth' ? options.layout === 'row' ? 4 : options.layout === 'strip' ? 1 : 2 : 1;
  const rows = mode === 'double' ? 1 : expected / cols;
  const gap = mode === 'booth' || mode === 'instant' ? Math.max(1, Math.round(fw * (mode === 'instant' ? .07 : .04))) : 0;
  const film = mode === 'booth' && options.frame === 'film';
  const side = film ? Math.max(gap, Math.round(fw * .12)) : gap;
  const footer = (mode === 'booth' || mode === 'instant') && options.frame === 'memory' ? Math.round(fw * .28) : 0;
  const fullW = fw * cols + gap * (cols - 1) + side * 2, fullH = fh * rows + gap * (rows + 1) + footer;
  const scale = Math.min(1, maxEdge / Math.max(fullW, fullH));
  const holes = film ? Array.from({ length: Math.floor(fullH / (side * 1.4)) }, (_, i) => [side * .22, fullW - side * .78].map((x) => ({ x: x * scale, y: (side * .3 + i * side * 1.4) * scale, w: side * .56 * scale, h: side * .75 * scale }))).flat() : [];
  return { width: Math.max(1, Math.round(fullW * scale)), height: Math.max(1, Math.round(fullH * scale)), holes, cells: Array.from({ length: expected }, (_, i) => ({ x: (side + (i % cols) * (fw + gap)) * scale, y: (gap + Math.floor(i / cols) * (fh + gap)) * scale, w: fw * scale, h: fh * scale })) };
}
export function drawCompositionPaper(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof compositionLayout>, options: Partial<CompositionOptions>) {
  const paper = compositionPaper(options);
  ctx.fillStyle = paper.color; ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = options.paper === 'black' ? '#fff' : '#000';
  layout.holes.forEach((r) => ctx.fillRect(r.x, r.y, r.w, r.h));
  const caption = Array.from((options.caption ?? '').replace(/\s+/g, ' ').trim()).slice(0, 32).join('');
  if (options.frame === 'memory' && caption) {
    const bottom = Math.max(...layout.cells.map((r) => r.y + r.h));
    const footer = layout.height - bottom;
    ctx.save();
    ctx.fillStyle = paper.ink;
    ctx.font = `500 ${Math.max(1, Math.min(footer * .32, layout.width * .065))}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(caption, layout.width / 2, bottom + footer * .55, layout.width * .86);
    ctx.restore();
  }
}
export function composeFrames(frames: HTMLCanvasElement[], mode: Exclude<CaptureMode, 'normal'>, options: Partial<CompositionOptions>): HTMLCanvasElement {
  const expected = mode === 'booth' ? 4 : mode === 'instant' ? 1 : 2;
  if (frames.length !== expected) throw new Error(`${expected}장의 사진이 필요합니다`);
  const fw = Math.min(...frames.map((c) => c.width)), fh = Math.min(...frames.map((c) => c.height));
  const layout = compositionLayout(fw, fh, mode, options);
  const c = document.createElement('canvas'); c.width = layout.width; c.height = layout.height;
  const ctx = c.getContext('2d')!;
  if (mode === 'double') {
    ctx.drawImage(frames[0], 0, 0, c.width, c.height);
    const a = ctx.getImageData(0, 0, c.width, c.height);
    ctx.drawImage(frames[1], 0, 0, c.width, c.height);
    const b = ctx.getImageData(0, 0, c.width, c.height);
    const t = Math.max(0, Math.min(1, options.mix ?? .5));
    for (let i = 0; i < a.data.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        const av = a.data[i + k], bv = b.data[i + k];
        const blend = options.blend === 'lighten' ? Math.max(av, bv) : options.blend === 'multiply' ? av * bv / 255 : bv;
        a.data[i + k] = (1 - t) * av + t * blend;
      }
      a.data[i + 3] = 255;
    }
    ctx.putImageData(a, 0, 0);
  } else {
    drawCompositionPaper(ctx, layout, options);
    frames.forEach((f, i) => { const r = layout.cells[i]; ctx.drawImage(f, r.x, r.y, r.w, r.h); });
  }
  return c;
}

export async function drawCompositionDate(canvas: HTMLCanvasElement, frames: HTMLCanvasElement[], mode: Exclude<CaptureMode, 'normal'>, options: Partial<CompositionOptions>, date: DateStampOptions): Promise<void> {
  if (!date.on) return;
  if (options.frame !== 'memory' || !options.caption?.trim()) {
    await drawDateStamp(canvas, date); return;
  }
  // A caption owns the paper footer; place the single date inside the last photo.
  const layout = compositionLayout(Math.min(...frames.map((f) => f.width)), Math.min(...frames.map((f) => f.height)), mode, options);
  const r = layout.cells.at(-1)!;
  const stamp = document.createElement('canvas'); stamp.width = Math.max(1, Math.round(r.w)); stamp.height = Math.max(1, Math.round(r.h));
  await drawDateStamp(stamp, date);
  canvas.getContext('2d')!.drawImage(stamp, r.x, r.y, r.w, r.h);
}
