import { FilmQualityError, validateFilmQuality, type FilmQualitySettings } from '../engine/filmQuality';

const KEY = 'oc-film-quality-v1';
export function readFilmQuality(): { settings: FilmQualitySettings | undefined; warning: string | null; writable: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { settings: undefined, warning: null, writable: true };
    const envelope: unknown = JSON.parse(raw);
    if (!envelope || typeof envelope !== 'object' || (envelope as { version?: unknown }).version !== 1) throw new FilmQualityError();
    return { settings: validateFilmQuality((envelope as { settings?: unknown }).settings), warning: null, writable: true };
  } catch {
    return { settings: undefined, warning: '필름 질감 설정을 읽지 못했어요. 저장된 데이터는 보존하고 이번 실행에서만 사용할 수 있어요.', writable: false };
  }
}
export function writeFilmQuality(settings: FilmQualitySettings | undefined): void {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, settings: validateFilmQuality(settings) }));
}
