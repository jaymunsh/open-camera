import { test, expect, type Page } from '@playwright/test';

async function seedHistory(page: Page, mode: 'half' | 'booth', mixed = false) {
  await page.goto('/');
  await page.evaluate(async ({ mode, mixed }) => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx'); const { DEFAULT_VARIATION } = await load('/src/engine/variation.ts');
    const { saveCapture } = await load('/src/capture/store.ts'); const { writeRecipes } = await load('/src/capture/recipes.ts');
    const c = document.createElement('canvas'); c.width = c.height = 96; const ctx = c.getContext('2d')!; ctx.fillStyle = '#80906a'; ctx.fillRect(0, 0, 96, 96); ctx.fillStyle = '#a87855'; ctx.fillRect(16, 16, 48, 48);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    const base = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, variation: DEFAULT_VARIATION };
    const active = { ...base, variation: { ...DEFAULT_VARIATION, mode: 'new', grain: .8, leak: .7, dust: .6, color: .9 } };
    const count = mode === 'half' ? 2 : 4;
    await saveCapture({ id: 'fixture', createdAt: 1, blob, name: 'fixture.jpg', width: 192, height: 96, mode, originals: Array(count).fill(blob), settings: mixed ? base : active, frameSettings: Array.from({ length: count }, (_, i) => mixed && i === count - 1 ? base : active), framePatterns: Array.from({ length: count }, (_, i) => mixed && i === count - 1 ? null : { version: 1, seed: (i + 1) / 8 }) });
    writeRecipes(['new', 'fixed'].map((mode, i) => ({ version: 1, id: mode, name: mode, settings: { ...active, variation: { ...active.variation, mode, fixedSeed: .75, grain: i ? .9 : .4 } } })));
    localStorage.setItem('oc-keep-original', '1');
  }, { mode, mixed });
  await page.reload(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
}

test('film variation review Original-only effect exposes original comparison', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '원본보기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.locator('summary').filter({ hasText: '빈티지 패턴' }).click(); await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '원본보기', exact: true })).toBeVisible();
});

test('film variation review mixed history restores active controls and explicit off clears all slots', async ({ page }) => {
  await seedHistory(page, 'half', true);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click();
  await expect(studio.getByRole('button', { name: '매 컷 새롭게', exact: true })).toHaveAttribute('aria-pressed', 'true'); await expect(studio.getByLabel('추가 입자', { exact: true })).toHaveValue('0.8');
  await studio.getByRole('button', { name: '꺼짐', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await download;
  const rows = await page.evaluate(async () => { const path = '/src/capture/store.ts'; return (await (await import(/* @vite-ignore */ path)).listCaptures()).map((r: any) => ({ id: r.id, patterns: r.framePatterns })); });
  expect(rows[0].patterns).toEqual([null, null]); expect(rows[1]).toEqual({ id: 'fixture', patterns: [{ version: 1, seed: .125 }, null] });
});

for (const mode of ['half', 'booth'] as const) test(`film variation review ${mode} recipes and delayed renders show the latest working pixels`, async ({ page }) => {
  await seedHistory(page, mode);
  await page.evaluate(async () => {
    const path = '/src/engine/pipeline.ts'; const { FilterPipeline } = await import(/* @vite-ignore */ path); const setSource = FilterPipeline.prototype.setSource;
    (window as any).observedComposite = null; (window as any).delayedBitmaps = 0;
    FilterPipeline.prototype.setSource = function(source: any) { if ((this as any).canvas === document.querySelector('.viewer > canvas') && source instanceof HTMLCanvasElement) (window as any).observedComposite = source.toDataURL(); return setSource.call(this, source); };
    const bitmap = window.createImageBitmap.bind(window);
    (window as any).createImageBitmap = async (...args: any[]) => { (window as any).delayedBitmaps++; await new Promise(resolve => setTimeout(resolve, 120)); return (bitmap as any)(...args); };
  });
  const applyRecipe = async (name: string) => { await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '카메라 레시피', exact: true }).click(); await page.getByRole('button', { name: `${name} 적용`, exact: true }).click(); };
  const save = async () => { const download = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await download; };
  const snapshot = () => page.evaluate(async () => { const path = '/src/capture/store.ts'; const record = (await (await import(/* @vite-ignore */ path)).listCaptures())[0]; const renderPath = '/src/capture/reprocess.ts'; const expected = (await (await import(/* @vite-ignore */ renderPath)).renderReprocessed(record, record.settings, null, null, false)).toDataURL(); return { patterns: record.framePatterns, strengths: record.frameSettings.map((s: any) => s.variation.grain), expected }; });
  await applyRecipe('new'); await save(); const fresh = await snapshot();
  expect(new Set(fresh.patterns.map((p: any) => p.seed)).size).toBe(mode === 'half' ? 2 : 4); expect(fresh.strengths).toEqual(Array(mode === 'half' ? 2 : 4).fill(.4));
  await expect.poll(() => page.evaluate(() => (window as any).observedComposite)).toBe(fresh.expected);
  await applyRecipe('fixed'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click();
  for (let i = 0; i < 3; i++) await studio.getByRole('button', { name: '다른 패턴', exact: true }).click();
  await studio.getByRole('button', { name: '이 패턴 고정', exact: true }).click(); await studio.getByLabel('추가 입자', { exact: true }).fill('0.65'); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await save(); const fixed = await snapshot(); expect(new Set(fixed.patterns.map((p: any) => p.seed)).size).toBe(1); expect(fixed.strengths).toEqual(Array(mode === 'half' ? 2 : 4).fill(.65));
  await expect.poll(() => page.evaluate(() => (window as any).observedComposite)).toBe(fixed.expected); expect(await page.evaluate(() => (window as any).delayedBitmaps)).toBeGreaterThan(4);
});

test('film variation review GPU allocation failure reports recovery and the live loop resumes after disabling', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('tab', { name: '효과', exact: true }).click();
  await studio.locator('summary').filter({ hasText: '빈티지 패턴' }).click();
  await page.evaluate(() => {
    const original = WebGL2RenderingContext.prototype.createTexture;
    WebGL2RenderingContext.prototype.createTexture = function() { if (this.canvas === document.querySelector('.viewer > canvas')) return null; return original.call(this); };
  });
  await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.overlay-msg').filter({ hasText: '빈티지 우연성을 꺼주세요' })).toBeVisible();
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.getByRole('button', { name: '꺼짐', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('.overlay-msg').getByRole('button', { name: '닫기', exact: true }).click();
  await page.evaluate(() => {
    const original = WebGL2RenderingContext.prototype.drawArrays; (window as any).liveRenders = 0;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) { if (this.canvas === document.querySelector('.viewer > canvas')) (window as any).liveRenders++; return original.apply(this, args); };
  });
  await expect.poll(() => page.evaluate(() => (window as any).liveRenders)).toBeGreaterThan(3);
});

test('film variation review mixed on-off frame settings restore active strengths without changing null slots', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p); const { renderReprocessed } = await load('/src/capture/reprocess.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx'); const { DEFAULT_VARIATION } = await load('/src/engine/variation.ts');
    const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d')!.fillStyle = '#80906a'; c.getContext('2d')!.fillRect(0, 0, 96, 96);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    const base = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, variation: DEFAULT_VARIATION };
    const active = { ...base, variation: { ...DEFAULT_VARIATION, mode: 'fixed', fixedSeed: .25, grain: .8, leak: .7, dust: .6, color: .9 } };
    const record = { id: 'mixed', createdAt: 1, blob, name: 'a.jpg', width: 192, height: 96, mode: 'half', originals: [blob, blob], settings: base, frameSettings: [active, base], framePatterns: [{ version: 1, seed: .25 }, null] };
    const render = async (record: any, settings: any) => (await renderReprocessed(record, settings, null, null, false)).toDataURL();
    const restored = await render(record, base), expected = await render({ ...record, frameSettings: undefined }, active);
    const disabled = await render({ ...record, framePatterns: [null, null] }, base);
    const canvas = await renderReprocessed(record, base, null, null, false), plain = await renderReprocessed({ ...record, framePatterns: [null, null] }, base, null, null, false);
    return { same: restored === expected, distinct: restored !== disabled, nullSame: canvas.getContext('2d')!.getImageData(110, 20, 1, 1).data.join(',') === plain.getContext('2d')!.getImageData(110, 20, 1, 1).data.join(',') };
  });
  expect(result.same).toBe(true); expect(result.distinct).toBe(true); expect(result.nullSame).toBe(true);
});

test('film variation review reprocessed saves still honor opting out of original retention', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-keep-original', '1')); await page.goto('/');
  let download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByLabel('원본도 보관', { exact: true }).uncheck(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  download = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await download;
  await expect.poll(() => page.evaluate(async () => { const p = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ p); return (await listCaptures()).map((r: any) => r.originals.length); })).toEqual([0, 1]);
});
