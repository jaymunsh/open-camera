import { loadCustomLut, loadPresetLut } from '../engine/lut';
import { FilterPipeline } from '../engine/pipeline';
import { DEFAULT_PARAMS, type FxSpec } from '../engine/types';

const CACHE_SIZE = 128;

let thumbCanvas: HTMLCanvasElement | null = null;
let thumbPipe: FilterPipeline | null = null;
let sampleImg: Promise<HTMLImageElement> | null = null;
const thumbCache = new Map<string, HTMLCanvasElement>();
let cachePromise: Promise<void> = Promise.resolve();

export interface ThumbItem {
  id: string;
  custom?: boolean;
  fx?: FxSpec;
}

function getThumbPipe() {
  if (!thumbCanvas) {
    thumbCanvas = document.createElement('canvas');
    thumbPipe = new FilterPipeline(thumbCanvas);
  }
  return { pipe: thumbPipe!, canvas: thumbCanvas };
}

export function getSampleImage(): Promise<HTMLImageElement> {
  if (!sampleImg) {
    sampleImg = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('sample load failed'));
      img.src = '/samples/sample1.png';
    });
  }
  return sampleImg;
}

async function buildThumbs(
  items: ThumbItem[],
  fallbackSrc: TexImageSource | null,
  srcKey: string,
  preferSrc: boolean,
) {
  const { pipe, canvas } = getThumbPipe();
  canvas.width = CACHE_SIZE;
  canvas.height = CACHE_SIZE;
  let src: TexImageSource | null = null;
  if (preferSrc && fallbackSrc) {
    src = fallbackSrc;
  } else {
    try {
      src = await getSampleImage();
    } catch {
      src = fallbackSrc;
    }
  }
  if (!src) return;
  for (const item of items) {
    const ck = `${srcKey}:${item.id}`;
    if (thumbCache.has(ck)) continue;
    let lut = null;
    try {
      lut = item.custom ? await loadCustomLut(item.id) : await loadPresetLut(item.id);
    } catch {
      /* keep null */
    }
    pipe.setFx(item.fx ? { ...item.fx, seed: 0.37 } : null);
    pipe.setSource(src);
    pipe.setLUT(`preset-${item.id}`, lut);
    pipe.render(DEFAULT_PARAMS, item.id === 'none' ? 0 : 1, { fit: 'cover' });
    const off = document.createElement('canvas');
    off.width = CACHE_SIZE;
    off.height = CACHE_SIZE;
    off.getContext('2d')!.drawImage(canvas, 0, 0);
    thumbCache.set(ck, off);
  }
  pipe.setFx(null);
  pipe.setLUT('identity', null);
}

export function applyThumb(el: HTMLCanvasElement, id: string, srcKey = 'smp') {
  const t = thumbCache.get(`${srcKey}:${id}`);
  if (t) el.getContext('2d')?.drawImage(t, 0, 0, el.width, el.height);
}

export async function renderPresetThumbs(
  refs: Map<HTMLCanvasElement, string>,
  items: ThumbItem[],
  fallbackSrc: TexImageSource | null,
  cancelled: () => boolean,
  opts: { srcKey?: string; preferSrc?: boolean } = {},
) {
  const srcKey = opts.srcKey ?? 'smp';
  // drop thumbnails cached for other imported photos — keep current photo + sample set
  for (const k of thumbCache.keys()) {
    const i = k.indexOf(':');
    const ksrc = k.slice(0, i);
    if (ksrc !== 'smp' && ksrc !== srcKey) thumbCache.delete(k);
  }
  const missing = items.filter((i) => !thumbCache.has(`${srcKey}:${i.id}`));
  if (missing.length) {
    cachePromise = cachePromise.then(() =>
      buildThumbs(missing, fallbackSrc, srcKey, !!opts.preferSrc),
    );
    await cachePromise;
  }
  if (cancelled()) return;
  for (const [el, id] of refs) if (el.isConnected) applyThumb(el, id, srcKey);
}
