import { drawDateStamp, renderFilteredCanvas } from '../engine/pipeline';
import type { FilmPattern, FxSpec, LutData } from '../engine/types';
import { DEFAULT_VARIATION, resolveVariation, validateVariation } from '../engine/variation';
import { validateFramePatterns } from './variation';
import { canvasBlob, composeFrames, drawCompositionDate } from './composite';
import type { CameraSettings, CaptureRecord } from './types';
import { assertFilmQualityForPreset, resolveFilmQuality } from '../engine/filmQuality';

export interface ReprocessVariationOptions { patterns: readonly (FilmPattern | null)[] }
export async function renderReprocessed(record: CaptureRecord, settings: CameraSettings, lut: LutData | null, fx: FxSpec | null, stamp = true, signal?: AbortSignal, variation?: ReprocessVariationOptions): Promise<HTMLCanvasElement> {
  const quality = assertFilmQualityForPreset(settings.lutId, settings.filmQuality);
  if (record.settings) assertFilmQualityForPreset(record.settings.lutId, record.settings.filmQuality);
  for (const frame of record.frameSettings ?? []) assertFilmQualityForPreset(frame.lutId, frame.filmQuality);
  const patterns = validateFramePatterns(variation ? { ...record, framePatterns: [...variation.patterns] } : record);
  const preferences = validateVariation(settings.variation);
  const frames: HTMLCanvasElement[] = [];
  for (const [index, original] of record.originals.entries()) {
    signal?.throwIfAborted();
    const bitmap = await createImageBitmap(original);
    try {
      signal?.throwIfAborted();
      const pattern = patterns?.[index] ?? null;
      const framePreferences = validateVariation(record.frameSettings?.[index]?.variation ?? preferences);
      const resolved = resolveVariation(settings.params, fx, pattern ? framePreferences : DEFAULT_VARIATION, pattern, settings.grainOff);
      const filmQuality = resolveFilmQuality(quality ? { ...quality, seed: record.frameSettings?.[index]?.filmQuality?.seed ?? quality.seed } : undefined,
        { params: resolved.params, fx: resolved.fx, intensity: settings.intensity, strengthMode: settings.strengthMode, grainOff: settings.grainOff, pattern });
      frames.push(await renderFilteredCanvas(bitmap, resolved.params, `preset-${settings.lutId}`, lut, settings.lutId === 'none' ? 0 : settings.intensity, false, null, resolved.fx, null, undefined, null, [], { on: false, fmt: settings.date.fmt, size: settings.date.size, orient: settings.date.orient }, { lens: settings.lens, lensAmount: settings.lensAmount, gentle: settings.gentle && !filmQuality, filmQuality }));
    }
    finally { bitmap.close(); }
  }
  signal?.throwIfAborted();
  const result = record.mode === 'normal' ? frames[0] : composeFrames(frames, record.mode, record.composition ?? {});
  if (!result) throw new Error('보관한 원본이 없습니다');
  if (stamp) {
    const date = { ...settings.date, on: settings.date.mode === 'on' || (settings.date.mode === 'auto' && !!fx?.date), timestamp: record.shotAt ?? record.createdAt };
    if (record.mode === 'normal') await drawDateStamp(result, date);
    else await drawCompositionDate(result, frames, record.mode, record.composition ?? {}, date);
  }
  return result;
}
export async function exportReprocessed(record: CaptureRecord, settings: CameraSettings, lut: LutData | null, fx: FxSpec | null, variation?: ReprocessVariationOptions): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
  const canvas = await renderReprocessed(record, settings, lut, fx, true, undefined, variation);
  return { canvas, blob: await canvasBlob(canvas) };
}
