import { useCallback, useRef, useState } from 'react';
import { validateFilmQuality, type FilmQualitySettings } from '../engine/filmQuality';
import { readFilmQuality, writeFilmQuality } from './filmQuality';

export function useFilmQuality() {
  const [state, setState] = useState(readFilmQuality);
  const current = useRef(state);
  const publish = useCallback((settings: FilmQualitySettings | undefined, reset = false) => {
    let next = { ...current.current, settings: validateFilmQuality(settings), ...(reset ? { writable: true, warning: null } : {}) };
    if (next.writable) {
      try { writeFilmQuality(next.settings); next = { ...next, warning: null }; }
      catch { next = { ...next, writable: false, warning: '필름 질감을 저장하지 못했어요. 이번 실행에서는 사용할 수 있지만 다음 실행에는 유지되지 않아요.' }; }
    }
    current.current = next; setState(next);
  }, []);
  const update = useCallback((s: FilmQualitySettings | undefined) => publish(s), [publish]);
  const resetStored = useCallback(() => publish(undefined, true), [publish]);
  return { ...state, update, resetStored };
}
