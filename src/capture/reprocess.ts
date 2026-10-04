import { drawDateStamp, renderFilteredCanvas } from '../engine/pipeline';
import type { FxSpec, LutData } from '../engine/types';
import { canvasBlob, composeFrames } from './composite';
import type { CameraSettings, CaptureRecord } from './types';

export async function renderReprocessed(record: CaptureRecord, settings: CameraSettings, lut: LutData | null, fx: FxSpec | null, stamp = true): Promise<HTMLCanvasElement> {
  const frames: HTMLCanvasElement[] = [];
  for (const original of record.originals) {
    const bitmap = await createImageBitmap(original);
    try { frames.push(await renderFilteredCanvas(bitmap, settings.params, `preset-${settings.lutId}`, lut, settings.lutId === 'none' ? 0 : settings.intensity, false, null, fx, null, undefined, null, [], { on: false, fmt: settings.date.fmt, size: settings.date.size, orient: settings.date.orient }, { lens: settings.lens, lensAmount: settings.lensAmount, gentle: settings.gentle })); }
    finally { bitmap.close(); }
  }
  const result = record.mode === 'normal' ? frames[0] : composeFrames(frames, record.mode, record.composition ?? {});
  if (!result) throw new Error('보관한 원본이 없습니다');
  if (stamp) await drawDateStamp(result, { ...settings.date, on: settings.date.mode === 'on' || (settings.date.mode === 'auto' && !!fx?.date), timestamp: record.shotAt ?? record.createdAt });
  return result;
}
export async function exportReprocessed(record: CaptureRecord, settings: CameraSettings, lut: LutData | null, fx: FxSpec | null): Promise<{ canvas: HTMLCanvasElement; blob: Blob }> {
  const canvas = await renderReprocessed(record, settings, lut, fx);
  return { canvas, blob: await canvasBlob(canvas) };
}
