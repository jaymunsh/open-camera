import { test, expect } from '@playwright/test';

// Catches destructive error recovery and incorrect optional-setting serialization.
test('film quality storage preserves corrupt and unrelated data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    let api;
    try { api = await load('/src/capture/filmQuality.ts'); } catch { return { available: false }; }
    const { DEFAULT_FILM_QUALITY } = await load('/src/engine/filmQuality.ts');
    const key = 'oc-film-quality-v1'; const fixed = { ...DEFAULT_FILM_QUALITY, model: 'film-v2', seed: .25 };
    localStorage.removeItem(key); const absent = api.readFilmQuality();
    localStorage.setItem('oc-recipes', 'untouched'); localStorage.setItem('oc-custom', 'untouched');
    localStorage.setItem(key, '{broken'); const corrupt = api.readFilmQuality(); const raw = localStorage.getItem(key);
    api.writeFilmQuality(fixed); const valid = api.readFilmQuality();
    api.writeFilmQuality(undefined); const cleared = api.readFilmQuality();
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    let denied, quota = false;
    try {
      Storage.prototype.getItem = function(k) { if (k === key) throw new DOMException('denied', 'SecurityError'); return get.call(this, k); };
      denied = api.readFilmQuality();
      Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('full', 'QuotaExceededError'); set.call(this, k, v); };
      try { api.writeFilmQuality(fixed); } catch { quota = true; }
    } finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set; }
    return { available: true, absent, corrupt, raw, valid, fixed, cleared, denied, quota, recipes: localStorage.getItem('oc-recipes'), custom: localStorage.getItem('oc-custom') };
  });
  expect(result.available).toBe(true);
  if (!result.available) return;
  expect(result.absent.settings).toBeUndefined(); expect(result.absent.writable).toBe(true);
  expect(result.corrupt.writable).toBe(false); expect(result.corrupt.warning).toBeTruthy(); expect(result.raw).toBe('{broken');
  expect(result.valid.settings).toEqual(result.fixed); expect(result.cleared.settings).toBeUndefined();
  expect(result.denied.writable).toBe(false); expect(result.quota).toBe(true);
  expect(result.recipes).toBe('untouched'); expect(result.custom).toBe('untouched');
});
