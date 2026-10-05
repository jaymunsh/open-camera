import { validateSettings } from '../capture/recipes';
import type { CameraSettings } from '../capture/types';
import { resolveFilmQuality } from '../engine/filmQuality';
import { renderFilteredCanvas } from '../engine/pipeline';
import type { LutData } from '../engine/types';
import { clonePreviewSource, type PreviewSource } from './source';

export interface FilmTextureImages { before: HTMLCanvasElement; after: HTMLCanvasElement; release(): void }
let queue: Promise<unknown> = Promise.resolve();

export function renderFilmTextureComparison(source: PreviewSource, settings: CameraSettings, lut: LutData | null, signal: AbortSignal): Promise<FilmTextureImages> {
  const check = () => { if (signal.aborted) throw new DOMException('질감 비교가 취소됐어요.', 'AbortError'); };
  let frozen: PreviewSource; let s: CameraSettings;
  try {
    check(); s = validateSettings(settings);
    if (s.lutId !== 'none' && !lut) throw new Error('선택한 필터가 준비되지 않았어요. 필터를 다시 불러와주세요.');
    frozen = clonePreviewSource(source);
  } catch (error) { return Promise.reject(error); }
  const work = async () => {
    const outputs: HTMLCanvasElement[] = [];
    const release = () => { for (const canvas of outputs) canvas.width = canvas.height = 0; };
    try {
      check();
      const key = `texture-${s.lutId}`, amount = s.lutId === 'none' ? 0 : s.intensity;
      const before = await renderFilteredCanvas(frozen.canvas, s.params, key, lut, amount); outputs.push(before); check();
      const quality = resolveFilmQuality(s.filmQuality, { params: s.params, fx: null, intensity: s.intensity, strengthMode: s.strengthMode, grainOff: s.grainOff, pattern: null });
      const after = await renderFilteredCanvas(frozen.canvas, s.params, key, lut, amount, false, null, null, undefined, undefined, undefined, undefined, undefined, { lens: 'none', lensAmount: 0, gentle: false, filmQuality: quality });
      outputs.push(after); check();
      return { before, after, release };
    } catch (error) { release(); throw error; }
    finally { frozen.release(); }
  };
  const result = queue.catch(() => {}).then(work); queue = result.catch(() => {}); return result;
}
