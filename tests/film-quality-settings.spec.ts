import { test, expect } from '@playwright/test';

// Catches missing snapshot validation, metadata scaling and double-scaled FX.
test('film quality validates snapshots without migrating legacy recipes', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    let api;
    try { api = await load('/src/engine/filmQuality.ts'); } catch { return { available: false }; }
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const { validateSettings } = await load('/src/capture/recipes.ts');
    const camera = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' } };
    const fixed = { ...api.DEFAULT_FILM_QUALITY, model: 'film-v2', seed: .25 };
    let rejected = 0;
    for (const value of [{ ...fixed, version: 2 }, { ...fixed, model: 'unknown' }, { ...fixed, origin: 'profile', profile: { id: 'bad', version: 1 } }, { ...fixed, grain: NaN }, { ...fixed, glow: Infinity }, { ...fixed, size: 2 }, { ...fixed, seed: 1 }]) {
      try { validateSettings({ ...camera, filmQuality: value }); } catch (e) { if (e instanceof api.FilmQualityError) rejected++; }
    }
    let missingSignature = false;
    try { validateSettings({ ...camera, lutId: 'signature-portrait-v1' }); } catch (e) { missingSignature = e instanceof api.FilmQualityError; }
    const profile = api.validateFilmQuality({ ...fixed, origin: 'profile', profile: { id: 'signature-portrait-v1', version: 1 }, unknown: 'remove' });
    const clean = api.validateFilmQuality({ ...fixed, unknown: 'remove' });
    const legacy = validateSettings(camera);
    const roundTrip = validateSettings({ ...camera, filmQuality: fixed });
    const context = { params: { ...DEFAULT_PARAMS, grain: .1 }, fx: { grain: .2 }, intensity: .5, strengthMode: 'whole', grainOff: false, pattern: { version: 1, seed: .75 } };
    return { available: true, legacyMissing: legacy.filmQuality === undefined, roundTrip: roundTrip.filmQuality, fixed, rejected, missingSignature, clean, profile,
      whole: api.resolveFilmQuality(fixed, context), color: api.resolveFilmQuality(fixed, { ...context, strengthMode: 'color' }),
      muted: api.resolveFilmQuality(fixed, { ...context, grainOff: true }), zero: api.resolveFilmQuality(fixed, { ...context, intensity: 0, params: DEFAULT_PARAMS, fx: null }),
      absent: api.resolveFilmQuality(undefined, context), old: api.resolveFilmQuality(api.DEFAULT_FILM_QUALITY, context) };
  });
  expect(result.available).toBe(true);
  if (!result.available) return;
  expect(result.legacyMissing).toBe(true); expect(result.roundTrip).toEqual(result.fixed);
  expect(result.rejected).toBe(7); expect(result.missingSignature).toBe(true);
  expect(result.clean).not.toHaveProperty('unknown'); expect(result.profile.profile.id).toBe('signature-portrait-v1');
  expect(result.whole.grain).toBeCloseTo(.39); expect(result.whole.glow).toBe(.03);
  expect(result.color.grain).toBeCloseTo(.48); expect(result.color.glow).toBe(.06);
  expect(result.whole.size).toBe(.35); expect(result.whole.seed).toBe(.75); expect(result.whole.color).toBe(.08);
  expect(result.muted.grain).toBe(0); expect(result.zero.grain).toBe(0); expect(result.zero.glow).toBe(0);
  expect(result.absent).toBeNull(); expect(result.old).toBeNull();
});
