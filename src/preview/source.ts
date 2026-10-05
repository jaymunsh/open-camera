import { snapshotFrame } from '../capture/composite';
import type { CaptureRecord } from '../capture/types';
import { srcSize } from '../engine/pipeline';
import { loadSample, SAMPLES, type SampleId } from './samples';

export interface PreviewSource {
  key: string;
  label: string;
  kind: 'sample' | 'scene' | 'import' | 'capture';
  canvas: HTMLCanvasElement;
  release(): void;
}
let sequence = 0;
function owned(canvas: HTMLCanvasElement, label: string, kind: PreviewSource['kind']): PreviewSource {
  let released = false;
  return { key: `preview-${++sequence}`, label, kind, canvas, release() {
    if (!released) { released = true; canvas.width = canvas.height = 0; }
  } };
}
export function freezePreviewSource(input: { source: TexImageSource; label: string; kind: 'scene' | 'import'; ratio: { w: number; h: number } | null; mirror: boolean }): PreviewSource {
  const size = srcSize(input.source);
  if (!size.w || !size.h) throw new Error('사진이 준비되지 않았어요. 다시 시도해주세요.');
  return owned(snapshotFrame(input.source, input.ratio, input.mirror, 1024), input.label, input.kind);
}
export async function samplePreviewSource(id: SampleId): Promise<PreviewSource> {
  const image = await loadSample(id, 'master');
  return owned(snapshotFrame(image, null, false, 1024), SAMPLES.find((s) => s.id === id)!.label, 'sample');
}
export async function capturePreviewSource(record: CaptureRecord, index: number): Promise<PreviewSource> {
  if (!Number.isInteger(index) || index < 0 || !record.originals[index]) throw new Error('보관한 원본이 없어요. 원본 보관을 켜고 촬영해주세요.');
  const bitmap = await createImageBitmap(record.originals[index]);
  try { return owned(snapshotFrame(bitmap, null, false, 1024), `촬영 원본 · ${index + 1}번째 컷`, 'capture'); }
  finally { bitmap.close(); }
}
export function clonePreviewSource(source: PreviewSource): PreviewSource {
  if (!source.canvas.width || !source.canvas.height) throw new Error('비교 사진이 해제됐어요. 다시 선택해주세요.');
  return owned(snapshotFrame(source.canvas, null, false, 1024), source.label, source.kind);
}
