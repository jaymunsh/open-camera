import { FilmQualityError, SIGNATURE_FILM_IDS, validateFilmQuality, type FilmQualitySettings } from './filmQuality';

export interface SignatureFilmDefinition {
  id: string; version: 1; label: string; sourcePresetId: string;
  quality: Readonly<Omit<FilmQualitySettings, 'origin' | 'profile' | 'seed'>>;
}
// Color data is reused from credited films. These are texture/look candidates,
// not new color LUTs or measured reproductions of a manufacturer's film.
const entries: readonly (readonly [string, string, readonly number[]])[] = [
  ['인물 · SOFT NEG', 'film-fuji160c', [.12, .12, .03, .35, .03, .20]],
  ['카페 · WARM PRINT', 'film-instant690', [.16, .22, .06, .40, .08, .30]],
  ['풍경 · CLEAR CHROME', 'film-elite200', [.06, .08, .02, .20, 0, .20]],
  ['거리 · DEEP SNAP', 'film-superia400', [.28, .45, .04, .55, .03, .25]],
  ['야간 · NIGHT GLOW', 'film-ultra100', [.32, .50, .18, .75, .28, .70]],
  ['흑백 · SILVER ROUGH', 'film-neopan1600', [.40, .80, 0, .55, .02, .20]],
];
export const SIGNATURE_FILMS: readonly SignatureFilmDefinition[] = Object.freeze(entries.map(([label, sourcePresetId, values], i) => {
  const [grain, size, color, shadows, glow, glowRadius] = values;
  return Object.freeze({ id: SIGNATURE_FILM_IDS[i], version: 1 as const, label, sourcePresetId,
    quality: Object.freeze({ version: 1 as const, model: 'film-v2' as const, grain, size, color, shadows, glow, glowRadius }) });
}));
export function signatureFilm(id: string): SignatureFilmDefinition | undefined {
  return SIGNATURE_FILMS.find(film => film.id === id);
}
export function createSignatureQuality(id: string, seed: number): FilmQualitySettings {
  const film = signatureFilm(id);
  if (!film) throw new FilmQualityError('지원하지 않는 대표 룩이에요.');
  return validateFilmQuality({ ...film.quality, origin: 'profile', profile: { id: film.id, version: film.version }, seed })!;
}
