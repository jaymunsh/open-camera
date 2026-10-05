import { PARAM_DEFS, type FilmPattern, type FilterParams, type FxSpec } from './types';

export interface VariationSettings {
  version: 1;
  mode: 'off' | 'new' | 'fixed';
  grain: number;
  leak: number;
  dust: number;
  color: number;
  fixedSeed: number;
}

export const DEFAULT_VARIATION: Readonly<VariationSettings> = Object.freeze({ version: 1, mode: 'off', grain: .2, leak: .15, dust: .1, color: .15, fixedSeed: .5 });
const SCALE = 4294967296;
const validSeed = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function validateVariation(input: unknown): VariationSettings {
  if (input === undefined) return { ...DEFAULT_VARIATION };
  if (!input || typeof input !== 'object') throw new Error('빈티지 우연성 설정이 올바르지 않습니다');
  const s = input as VariationSettings;
  if (s.version !== 1 || !['off', 'new', 'fixed'].includes(s.mode) || !validSeed(s.fixedSeed) || ![s.grain, s.leak, s.dust, s.color].every(validAmount)) throw new Error('지원하지 않는 빈티지 우연성 설정입니다');
  return { version: 1, mode: s.mode, grain: s.grain, leak: s.leak, dust: s.dust, color: s.color, fixedSeed: s.fixedSeed };
}

export function validatePattern(input: unknown): FilmPattern {
  if (!input || typeof input !== 'object') throw new Error('촬영 패턴을 읽을 수 없습니다');
  const p = input as FilmPattern;
  if (p.version !== 1 || !validSeed(p.seed)) throw new Error('지원하지 않는 촬영 패턴입니다');
  return { version: 1, seed: p.seed };
}

export function nextPattern(previous?: FilmPattern | null): FilmPattern {
  const prev = previous ? validatePattern(previous).seed : .5;
  const candidate = Math.random();
  return { version: 1, seed: validSeed(candidate) && candidate !== prev ? candidate : ((Math.floor(prev * SCALE) + 1) >>> 0) / SCALE };
}

// Version 1: keep the PRNG and stream salts stable so saved patterns replay.
function randomStream(seed: number, salt = 0): () => number {
  let state = (Math.floor(seed * SCALE) ^ salt) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / SCALE;
  };
}

export function resolveVariation(params: FilterParams, fx: FxSpec | null, settings: VariationSettings, pattern: FilmPattern | null, grainOff = false): { params: FilterParams; fx: FxSpec | null } {
  if (settings.mode === 'off') return { params, fx };
  const current = validatePattern(pattern);
  const result = { ...params };
  const random = randomStream(current.seed, 0x9E3779B9);
  for (const [key, limit] of [['exposure', .08], ['temperature', .04], ['tint', .02]] as const) {
    const d = PARAM_DEFS.find(d => d.key === key)!;
    result[key] = Math.min(d.max, Math.max(d.min, result[key] + (random() * 2 - 1) * limit * settings.color));
  }
  const clamp = (amount: number) => Math.max(0, Math.min(1, amount));
  return { params: result, fx: { ...fx, grain: grainOff ? 0 : clamp((fx?.grain ?? 0) + settings.grain * .35),
    leak: clamp((fx?.leak ?? 0) + settings.leak * .30), dust: clamp((fx?.dust ?? 0) + settings.dust * .12), seed: current.seed, pattern: current } };
}

export function patternNoise(seed: number, size = 256): Uint8Array {
  if (!validSeed(seed) || !Number.isInteger(size) || size < 1 || size > 1024) throw new Error('입자 패턴 크기나 값이 올바르지 않습니다');
  const random = randomStream(seed);
  const base = new Float64Array(size * size);
  for (let i = 0; i < base.length; i++) base[i] = random();
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += base[((y + dy + size) % size) * size + (x + dx + size) % size];
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 2] = sum / 9 * 255;
    pixels[i + 1] = base[y * size + x] * 255;
    pixels[i + 3] = 255;
  }
  return pixels;
}
