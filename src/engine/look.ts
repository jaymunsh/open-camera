import type { CameraSettings, LensMode } from '../capture/types';
import { PRESETS } from './lut';
import type { FxSpec } from './types';
import type { ResolvedFilmQuality } from './filmQuality';

export interface RenderLook { lens: LensMode; lensAmount: number; gentle: boolean; filmQuality?: ResolvedFilmQuality | null }
export const DEFAULT_LOOK: RenderLook = { lens: 'none', lensAmount: .5, gentle: false };
export function nonColorSource(settings: Pick<CameraSettings, 'lutId' | 'intensity' | 'nonColorSource'>): NonNullable<CameraSettings['nonColorSource']> {
  return settings.nonColorSource ?? { version: 1, presetId: PRESETS.some(p => p.id === settings.lutId) ? settings.lutId : 'none', intensity: settings.intensity };
}
export function presetEffects(settings: CameraSettings, seed: number): FxSpec | null {
  const source = nonColorSource(settings), preset = PRESETS.find(p => p.id === source.presetId);
  const gentle = settings.gentle && settings.filmQuality?.model !== 'film-v2' && preset?.group !== '디지캠';
  return deriveFx(preset?.fx ? { ...preset.fx, grain: settings.grainOff ? 0 : preset.fx.grain, seed } : null, source.intensity, settings.strengthMode, gentle);
}
export function deriveFx(fx: FxSpec | null, strength: number, mode: 'color' | 'whole', gentle: boolean): FxSpec | null {
  if (!fx) return null;
  const result = { ...fx };
  for (const key of Object.keys(result) as (keyof FxSpec)[]) {
    if (key === 'seed' || key === 'date') continue;
    const value = result[key];
    if (typeof value !== 'number') continue;
    const softness = gentle ? key === 'grain' || key === 'halation' || key === 'soft' ? .5 : key === 'leak' ? .25 : 1 : 1;
    (result as Record<string, unknown>)[key] = value * softness * (mode === 'whole' ? strength : 1);
  }
  return result;
}
