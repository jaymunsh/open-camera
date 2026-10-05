import { DEFAULT_VARIATION, nextPattern, validatePattern, validateVariation, type VariationSettings } from '../engine/variation';
import type { FilmPattern } from '../engine/types';
import type { CaptureRecord } from './types';

const KEY = 'oc-film-variation';
export function readVariation(): { settings: VariationSettings; warning: string | null; writable: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    return { settings: validateVariation(raw === null ? undefined : JSON.parse(raw)), warning: null, writable: true };
  } catch {
    return { settings: { ...DEFAULT_VARIATION }, warning: '빈티지 설정을 읽지 못했어요. 저장된 데이터는 보존하고 이번 실행에서만 사용할 수 있어요.', writable: false };
  }
}
export function writeVariation(settings: VariationSettings): void {
  localStorage.setItem(KEY, JSON.stringify(validateVariation(settings)));
}

export function validateFramePatterns(record: CaptureRecord): (FilmPattern | null)[] | undefined {
  if (record.framePatterns === undefined) return undefined;
  const count = record.mode === 'booth' ? 4 : record.mode === 'half' || record.mode === 'double' ? 2 : 1;
  if (!Array.isArray(record.framePatterns) || record.framePatterns.length !== count || (record.originals.length > 0 && record.originals.length !== count)) throw new Error('촬영 패턴 정보가 올바르지 않아 다시 현상할 수 없어요. 완성 사진은 그대로 보관됩니다.');
  try { return record.framePatterns.map(p => p === null ? null : validatePattern(p)); }
  catch { throw new Error('지원하지 않는 촬영 패턴이에요. 완성 사진은 그대로 보관됩니다.'); }
}
export function makeFramePatterns(input: VariationSettings, count: number, previous?: readonly (FilmPattern | null)[]): (FilmPattern | null)[] {
  const settings = validateVariation(input);
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('컷 수가 올바르지 않습니다');
  const patterns: (FilmPattern | null)[] = [];
  for (let i = 0; i < count; i++) {
    if (settings.mode === 'off') { patterns.push(null); continue; }
    if (settings.mode === 'fixed') { patterns.push({ version: 1, seed: settings.fixedSeed }); continue; }
    let pattern = nextPattern(previous?.[i] ?? patterns.at(-1));
    // A broken random source must not duplicate frames or loop forever.
    while (patterns.some(p => p?.seed === pattern.seed) || previous?.[i]?.seed === pattern.seed) pattern = { version: 1, seed: ((Math.floor(pattern.seed * 4294967296) + 1) >>> 0) / 4294967296 };
    patterns.push(pattern);
  }
  return patterns;
}
