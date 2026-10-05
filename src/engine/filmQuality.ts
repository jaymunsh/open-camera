import type { FilmPattern, FilterParams, FxSpec } from './types';
import { validatePattern } from './variation';

export const SIGNATURE_FILM_IDS: readonly string[] = Object.freeze([
  'signature-portrait-v1', 'signature-cafe-v1', 'signature-landscape-v1',
  'signature-street-v1', 'signature-night-v1', 'signature-mono-v1',
]);
export interface FilmQualitySettings {
  version: 1;
  model: 'legacy' | 'film-v2';
  origin: 'manual' | 'profile';
  profile?: { id: string; version: 1 };
  grain: number; size: number; color: number; shadows: number;
  glow: number; glowRadius: number; seed: number;
}
export type ResolvedFilmQuality = Omit<FilmQualitySettings, 'version' | 'origin' | 'profile' | 'model'> & { model: 'film-v2' };
export const DEFAULT_FILM_QUALITY: Readonly<FilmQualitySettings> = Object.freeze({
  version: 1, model: 'legacy', origin: 'manual', grain: .18, size: .35,
  color: .08, shadows: .45, glow: .06, glowRadius: .35, seed: .5,
});
export class FilmQualityError extends Error {
  constructor(message = '필름 질감 설정을 읽을 수 없어요. 저장된 사진과 원본은 그대로 보관됩니다.') {
    super(message); this.name = 'FilmQualityError';
  }
}
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function validateFilmQuality(input: unknown): FilmQualitySettings | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object') throw new FilmQualityError();
  const s = input as FilmQualitySettings;
  if (s.version !== 1 || !['legacy', 'film-v2'].includes(s.model) || !['manual', 'profile'].includes(s.origin)
    || ![s.grain, s.size, s.color, s.shadows, s.glow, s.glowRadius].every(amount) || !amount(s.seed) || s.seed === 1
    || (s.origin === 'profile' && !s.profile)
    || (s.profile !== undefined && (!s.profile || s.profile.version !== 1 || !SIGNATURE_FILM_IDS.includes(s.profile.id)))) throw new FilmQualityError();
  return { version: 1, model: s.model, origin: s.origin, ...(s.profile ? { profile: { id: s.profile.id, version: 1 } } : {}),
    grain: s.grain, size: s.size, color: s.color, shadows: s.shadows, glow: s.glow, glowRadius: s.glowRadius, seed: s.seed };
}
export function assertFilmQualityForPreset(id: string, input: unknown): FilmQualitySettings | undefined {
  const quality = validateFilmQuality(input);
  if (SIGNATURE_FILM_IDS.includes(id) && !quality) throw new FilmQualityError('대표 룩의 질감 정보가 빠져 있어요. 완성 사진과 원본은 그대로 보관됩니다.');
  return quality;
}
export function resolveFilmQuality(input: FilmQualitySettings | undefined, context: {
  params: FilterParams; fx: FxSpec | null; intensity: number; strengthMode: 'color' | 'whole'; grainOff: boolean; pattern: FilmPattern | null;
}): ResolvedFilmQuality | null {
  const s = validateFilmQuality(input);
  if (!s || s.model === 'legacy') return null;
  const k = context.strengthMode === 'whole' ? context.intensity : 1;
  return { model: 'film-v2', grain: context.grainOff ? 0 : Math.max(0, Math.min(1, s.grain * k + context.params.grain + (context.fx?.grain ?? 0))),
    glow: s.glow * k, size: s.size, color: s.color, shadows: s.shadows, glowRadius: s.glowRadius,
    seed: context.pattern ? validatePattern(context.pattern).seed : s.seed };
}
