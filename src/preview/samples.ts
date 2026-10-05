export type SampleId = 'portrait' | 'food' | 'landscape' | 'cafe' | 'street' | 'night' | 'interior';
declare const __SAMPLE_VERSIONS__: Record<SampleId, string>;
export interface SampleSpec { id: SampleId; label: string; thumbUrl: string; masterUrl: string; version: string }
export const DEFAULT_SAMPLE_ID: SampleId = 'portrait';
const labels: Record<SampleId, string> = { portrait: '인물', food: '음식', landscape: '풍경', cafe: '카페', street: '거리', night: '야간', interior: '실내' };
export const SAMPLES: readonly SampleSpec[] = Object.entries(labels).map(([key, label]) => {
  const id = key as SampleId;
  const version = __SAMPLE_VERSIONS__[id];
  return { id, label, version, thumbUrl: `/samples/concepts/${id}.webp?v=${version}`, masterUrl: `/samples/masters/${id}.png?v=${version}` };
});
const thumbs = new Map<SampleId, Promise<HTMLImageElement>>();
const masters = new Map<SampleId, Promise<HTMLImageElement>>();
export function loadSample(id: SampleId, variant: 'thumb' | 'master' = 'thumb'): Promise<HTMLImageElement> {
  const spec = SAMPLES.find((sample) => sample.id === id);
  if (!spec) return Promise.reject(new Error('알 수 없는 샘플입니다.'));
  const cache = variant === 'master' ? masters : thumbs;
  const existing = cache.get(id);
  if (existing) { cache.delete(id); cache.set(id, existing); return existing; }
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${spec.label} 샘플을 불러오지 못했어요.`));
    image.src = variant === 'master' ? spec.masterUrl : spec.thumbUrl;
  });
  cache.set(id, promise);
  void promise.catch(() => { if (cache.get(id) === promise) cache.delete(id); });
  if (variant === 'master') while (cache.size > 2) cache.delete(cache.keys().next().value!);
  return promise;
}
export function readSamplePreference(): SampleId {
  try { const id = localStorage.getItem('oc-preview-sample'); return SAMPLES.some((sample) => sample.id === id) ? id as SampleId : DEFAULT_SAMPLE_ID; }
  catch { return DEFAULT_SAMPLE_ID; }
}
export function writeSamplePreference(id: SampleId): void {
  if (!SAMPLES.some((sample) => sample.id === id)) return;
  try { localStorage.setItem('oc-preview-sample', id); } catch { /* optional preference */ }
}
