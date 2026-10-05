import { useRef, useState } from 'react';
import type { FilmPattern } from '../engine/types';
import { DEFAULT_VARIATION, nextPattern, validatePattern, validateVariation, type VariationSettings } from '../engine/variation';
import { readVariation, writeVariation } from './variation';

interface State { settings: VariationSettings; pattern: FilmPattern | null; warning: string | null; writable: boolean }
export interface FilmVariationController extends State {
  update(settings: VariationSettings): void;
  apply(settings: VariationSettings, pattern?: FilmPattern | null): void;
  reroll(): void;
  freeze(): void;
  commitShot(pattern: FilmPattern | null): void;
  resetStored(): void;
}
function startPattern(s: VariationSettings, previous?: FilmPattern | null): FilmPattern | null {
  return s.mode === 'off' ? null : s.mode === 'fixed' ? { version: 1, seed: s.fixedSeed } : nextPattern(previous);
}
export function useFilmVariation(): FilmVariationController {
  const [state, setState] = useState<State>(() => { const stored = readVariation(); return { ...stored, pattern: startPattern(stored.settings) }; });
  const current = useRef(state);
  const publish = (next: State, persist = true) => {
    if (persist && next.writable) {
      try { writeVariation(next.settings); next = { ...next, warning: null }; }
      catch { next = { ...next, warning: '빈티지 설정을 저장하지 못했어요. 촬영은 가능하지만 다음 실행에는 유지되지 않을 수 있어요.' }; }
    }
    current.current = next; setState(next);
  };
  const update = (input: VariationSettings) => {
    const s = validateVariation(input), old = current.current;
    const pattern = s.mode === 'off' ? null : s.mode === 'fixed' ? { version: 1 as const, seed: s.fixedSeed } : old.pattern ?? nextPattern();
    publish({ ...old, settings: s, pattern });
  };
  const apply = (input: VariationSettings, restored?: FilmPattern | null) => {
    const settings = validateVariation(input), old = current.current;
    const pattern = restored === undefined ? startPattern(settings, old.pattern) : restored === null ? null : validatePattern(restored);
    publish({ ...old, settings, pattern });
  };
  const reroll = () => {
    const old = current.current, pattern = nextPattern(old.pattern);
    const settings = { ...old.settings, mode: old.settings.mode === 'off' ? 'new' as const : old.settings.mode, ...(old.settings.mode === 'fixed' ? { fixedSeed: pattern.seed } : {}) };
    publish({ ...old, settings, pattern });
  };
  const freeze = () => { const old = current.current, pattern = old.pattern ?? nextPattern(); publish({ ...old, settings: { ...old.settings, mode: 'fixed', fixedSeed: pattern.seed }, pattern }); };
  const commitShot = (pattern: FilmPattern | null) => {
    const old = current.current;
    if (old.settings.mode === 'new' && pattern && old.pattern?.seed === pattern.seed && old.pattern.version === pattern.version) publish({ ...old, pattern: nextPattern(pattern) }, false);
  };
  const resetStored = () => publish({ settings: { ...DEFAULT_VARIATION }, pattern: null, warning: null, writable: true });
  return { ...state, update, apply, reroll, freeze, commitShot, resetStored };
}
