import { test, expect } from '@playwright/test';

test('film variation storage validates recipes and preserves corrupt or denied storage', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { readVariation, writeVariation } = await load('/src/capture/variation.ts');
    const { DEFAULT_VARIATION } = await load('/src/engine/variation.ts');
    const { validateSettings } = await load('/src/capture/recipes.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const settings = { lutId: 'original', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' } };
    const fixed = { ...DEFAULT_VARIATION, mode: 'fixed', fixedSeed: .25 };
    const legacy = validateSettings(settings), restored = validateSettings({ ...settings, variation: fixed });
    let rejected = 0;
    for (const variation of [{ ...fixed, version: 2 }, { ...fixed, grain: 2 }, { ...fixed, fixedSeed: 1 }, { ...fixed, mode: 'bad' }]) {
      try { validateSettings({ ...settings, variation }); } catch { rejected++; }
    }
    localStorage.setItem('oc-custom', 'untouched'); localStorage.setItem('oc-recipes', 'also untouched');
    localStorage.setItem('oc-film-variation', '{broken'); const corrupt = readVariation();
    const corruptText = localStorage.getItem('oc-film-variation');
    writeVariation(fixed); const valid = readVariation();
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === 'oc-film-variation') throw new DOMException('denied', 'SecurityError'); return get.call(this, key); };
    const denied = readVariation(); Storage.prototype.getItem = get;
    Storage.prototype.setItem = function(key, value) { if (key === 'oc-film-variation') throw new DOMException('full', 'QuotaExceededError'); set.call(this, key, value); };
    let quota = false; try { writeVariation(DEFAULT_VARIATION); } catch { quota = true; } Storage.prototype.setItem = set;
    return { legacy: legacy.variation, restored: restored.variation, fixed, rejected, corrupt, corruptText, valid, denied, quota, custom: localStorage.getItem('oc-custom'), recipes: localStorage.getItem('oc-recipes') };
  });
  expect(result.legacy.mode).toBe('off'); expect(result.restored).toEqual(result.fixed); expect(result.rejected).toBe(4);
  expect(result.corrupt.settings.mode).toBe('off'); expect(result.corrupt.writable).toBe(false); expect(result.corruptText).toBe('{broken');
  expect(result.valid.settings).toEqual(result.fixed); expect(result.denied.writable).toBe(false); expect(result.quota).toBe(true);
  expect(result.custom).toBe('untouched'); expect(result.recipes).toBe('also untouched');
});

test('film variation storage hook consumes only a matching successful new-mode shot', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { const path = '/tests/fixtures/FilmVariationHarness.tsx'; const { mountVariationHarness } = await import(/* @vite-ignore */ path); const host = document.createElement('div'); host.id = 'variation-harness'; document.body.append(host); mountVariationHarness(host); });
  const state = async () => JSON.parse(await page.locator('#variation-state').textContent() || '{}');
  await page.getByRole('button', { name: 'h-new', exact: true }).click(); const first = await state();
  await page.getByRole('button', { name: 'h-tune', exact: true }).click(); expect((await state()).pattern).toEqual(first.pattern);
  await page.getByRole('button', { name: 'h-wrong', exact: true }).click(); expect((await state()).pattern).toEqual(first.pattern);
  await page.getByRole('button', { name: 'h-commit', exact: true }).click(); expect((await state()).pattern).not.toEqual(first.pattern);
  await page.getByRole('button', { name: 'h-freeze', exact: true }).click(); const frozen = await state();
  await page.getByRole('button', { name: 'h-commit', exact: true }).click(); expect((await state()).pattern).toEqual(frozen.pattern);
  expect(frozen.settings.fixedSeed).toBe(frozen.pattern.seed);
  await page.getByRole('button', { name: 'h-apply-new', exact: true }).click(); expect((await state()).pattern).not.toEqual(frozen.pattern);
  await page.getByRole('button', { name: 'h-reroll', exact: true }).click(); const rolled = await state(); expect(rolled.pattern).not.toEqual(frozen.pattern);
  await page.getByRole('button', { name: 'h-restore', exact: true }).click(); expect((await state()).pattern.seed).toBe(.25);
});
