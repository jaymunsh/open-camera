import { loadCustomLut, loadPresetLut } from '../engine/lut';
import { FilterPipeline } from '../engine/pipeline';
import { DEFAULT_PARAMS, type FxSpec } from '../engine/types';
import { ASSET_VERSION } from '../utils/assets';
import { loadSample, SAMPLES, type SampleId } from '../preview/samples';
import { ThumbnailCache } from '../preview/thumbnailCache';

let thumbCanvas: HTMLCanvasElement | null = null;
let thumbPipe: FilterPipeline | null = null;
let legacySample: Promise<HTMLImageElement> | null = null;
const cache = new ThumbnailCache();
let queue: Promise<void> = Promise.resolve();
export interface ThumbItem { id: string; custom?: boolean; fx?: FxSpec; version?: string; amount?: number }
export interface ThumbnailOptions { srcKey?: string; preferSrc?: boolean; sampleId?: SampleId; source?: TexImageSource | null; sourceVersion?: string; onError?: (id: string, message: string) => void }
const stableFx = (fx?: FxSpec) => fx ? Object.keys(fx).sort().map((key) => [key, fx[key as keyof FxSpec]]) : null;
function sourceKey(opts: ThumbnailOptions): string {
  return JSON.stringify([opts.srcKey ?? 'smp', opts.sampleId ?? null, opts.sourceVersion ?? (opts.sampleId ? SAMPLES.find((s) => s.id === opts.sampleId)?.version : ASSET_VERSION)]);
}
function key(item: ThumbItem, opts: ThumbnailOptions): string {
  return JSON.stringify([sourceKey(opts), item.id, !!item.custom, item.version ?? ASSET_VERSION, item.id === 'none' ? 0 : item.amount ?? 1, stableFx(item.fx)]);
}
export function getSampleImage(sampleId?: SampleId): Promise<HTMLImageElement> {
  if (sampleId) return loadSample(sampleId);
  if (!legacySample) {
    legacySample = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('sample load failed')); image.src = '/samples/sample1.png';
    });
    void legacySample.catch(() => { legacySample = null; });
  }
  return legacySample;
}
const lastKeys = new WeakMap<HTMLCanvasElement, string>();
export function applyThumb(el: HTMLCanvasElement, _id: string, _srcKey = 'smp') {
  const previous = lastKeys.get(el); const canvas = previous ? cache.get(previous) : undefined;
  if (canvas) el.getContext('2d')?.drawImage(canvas, 0, 0, el.width, el.height);
}
export async function renderPresetThumbs(refs: Map<HTMLCanvasElement, string>, items: ThumbItem[], fallback: TexImageSource | null, cancelled: () => boolean, opts: ThumbnailOptions = {}) {
  const work = async () => {
    if (cancelled()) return;
    let source = opts.source ?? (opts.preferSrc ? fallback : null);
    try { source ??= await getSampleImage(opts.sampleId); }
    catch (error) { opts.onError?.('source', error instanceof Error ? error.message : '샘플을 불러오지 못했어요.'); return; }
    if (cancelled() || !source) return;
    if (!thumbCanvas) { thumbCanvas = document.createElement('canvas'); thumbCanvas.width = thumbCanvas.height = 128; thumbPipe = new FilterPipeline(thumbCanvas); }
    const pipe = thumbPipe!, canvas = thumbCanvas;
    pipe.setSource(source);
    for (const item of items) {
      if (cancelled()) return;
      const cacheKey = key(item, opts); let thumb = cache.get(cacheKey);
      if (!thumb) {
        try {
          const lut = item.custom ? await loadCustomLut(item.id) : await loadPresetLut(item.id);
          if (cancelled()) return;
          pipe.setFx(item.fx ? { ...item.fx, seed: .37 } : null); pipe.setLUT(JSON.stringify([item.id, item.version ?? ASSET_VERSION, !!item.custom]), lut);
          pipe.render(DEFAULT_PARAMS, item.id === 'none' ? 0 : item.amount ?? 1, { fit: 'cover' });
          thumb = document.createElement('canvas'); thumb.width = thumb.height = 128; thumb.getContext('2d')!.drawImage(canvas, 0, 0); cache.set(cacheKey, thumb);
        } catch (error) {
          opts.onError?.(item.id, error instanceof Error ? error.message : '필터를 불러오지 못했어요.');
          for (const [el, id] of refs) if (id === item.id) { el.dataset.thumbError = 'true'; el.setAttribute('aria-label', '필터 미리보기 로딩 실패'); }
          continue;
        }
      }
      if (cancelled()) return;
      for (const [el, id] of refs) if (id === item.id && el.isConnected) {
        el.getContext('2d')!.drawImage(thumb, 0, 0, el.width, el.height); lastKeys.set(el, cacheKey); delete el.dataset.thumbError; el.removeAttribute('aria-label');
      }
    }
    pipe.setFx(null);
  };
  const current = queue.catch(() => {}).then(work); queue = current.catch(() => {}); await current;
}
export function observePresetThumbs(refs: Map<HTMLCanvasElement, string>, items: ThumbItem[], source: TexImageSource | null, opts: ThumbnailOptions, root: HTMLElement | null): () => void {
  let cancelled = false;
  const visible = new Set<HTMLCanvasElement>();
  const request = () => {
    const active = new Map([...refs].filter(([el]) => visible.has(el)));
    const ids = new Set(active.values());
    void renderPresetThumbs(active, items.filter((item) => ids.has(item.id)), source, () => cancelled, opts).catch((error) => opts.onError?.('renderer', String(error)));
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) { const canvas = entry.target as HTMLCanvasElement; if (entry.isIntersecting) visible.add(canvas); else visible.delete(canvas); }
    request();
  }, { root, rootMargin: '80px' });
  for (const el of refs.keys()) { el.getContext('2d')?.clearRect(0, 0, el.width, el.height); if (el.isConnected) observer.observe(el); }
  return () => { cancelled = true; observer.disconnect(); };
}
