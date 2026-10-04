import type { LensMode } from '../capture/types';
import type { FxSpec } from './types';

export interface RenderLook { lens: LensMode; lensAmount: number; gentle: boolean }
export const DEFAULT_LOOK: RenderLook = { lens: 'none', lensAmount: .5, gentle: false };
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
