import { loadCustomLut, loadPresetLut } from '../engine/lut';
import { renderFilteredCanvas } from '../engine/pipeline';
import { DEFAULT_PARAMS } from '../engine/types';
import type { PreviewSource } from './source';

export interface ComparisonChoice { id: string; label: string; custom: boolean; amount: number; version?: string }
export interface ComparisonImages { original: HTMLCanvasElement; a: HTMLCanvasElement; b: HTMLCanvasElement; release(): void }
export async function renderColorComparison(source: PreviewSource, a: ComparisonChoice, b: ComparisonChoice, signal: AbortSignal): Promise<ComparisonImages> {
  const check = () => { if (signal.aborted) throw new DOMException('비교가 취소됐어요.', 'AbortError'); };
  check();
  for (const choice of [a, b]) if (!Number.isFinite(choice.amount) || choice.amount < 0 || choice.amount > 1) throw new Error('필터 강도는 0~100%여야 해요.');
  if (!source.canvas.width || !source.canvas.height) throw new Error('비교 사진이 준비되지 않았어요.');
  const outputs: HTMLCanvasElement[] = [];
  const release = () => { for (const canvas of outputs) canvas.width = canvas.height = 0; };
  try {
    const original = await renderFilteredCanvas(source.canvas, DEFAULT_PARAMS, 'comparison-original', null, 0); outputs.push(original); check();
    for (const choice of [a, b]) {
      const lut = choice.custom ? await loadCustomLut(choice.id) : await loadPresetLut(choice.id); check();
      const canvas = await renderFilteredCanvas(source.canvas, DEFAULT_PARAMS, `comparison-${choice.custom}-${choice.id}-${choice.version ?? ''}`, lut, choice.id === 'none' ? 0 : choice.amount);
      outputs.push(canvas); check();
    }
    return { original, a: outputs[1], b: outputs[2], release };
  } catch (error) { release(); throw error; }
}
