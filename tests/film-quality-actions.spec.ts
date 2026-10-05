import { test, expect } from '@playwright/test';

// Catches effect-off omissions and cancel restoring only the color filter.
test('Studio effect off and cancel preserve the entry film quality snapshot', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: { version: 1, model: 'film-v2', origin: 'manual', grain: .3, size: .38, color: .08, shadows: .45, glow: .06, glowRadius: .35, seed: .25 } })));
  await page.goto('/');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-quality-v1')!).settings);
  const initial = await stored();
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '효과', exact: true }).click();
  await page.getByRole('button', { name: '거친 흑백', exact: true }).click(); expect(await stored()).toEqual(initial);
  await page.getByRole('button', { name: '효과 해제', exact: true }).click(); expect(await stored()).toBeUndefined();
  await page.getByRole('button', { name: '변경 취소', exact: true }).click(); expect(await stored()).toEqual(initial);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '효과', exact: true }).click();
  await page.getByRole('button', { name: '원본 · 필름 없음', exact: true }).click(); expect(await stored()).toEqual(initial);
});

test('corrupt new quality refuses reprocessing without resetting the current look or deleting history', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { DEFAULT_FILM_QUALITY } = await load('/src/engine/filmQuality.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx'); const { saveCapture } = await load('/src/capture/store.ts');
    const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d')!.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    const s = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, filmQuality: { ...DEFAULT_FILM_QUALITY, model: 'film-v2', seed: .25 } };
    await saveCapture({ id: 'bad-quality', createdAt: Date.now(), blob, name: 'keep.png', width: 64, height: 64, mode: 'normal', originals: [blob], settings: { ...s, filmQuality: { ...s.filmQuality, version: 2 } }, frameSettings: [s] });
  });
  await page.reload(); await page.getByRole('button', { name: 'WARM', exact: true }).click();
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click();
  await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('필름 질감'); await expect(page.locator('.filter-name')).toHaveText('WARM');
  expect(await page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); return (await listCaptures()).map((r: any) => r.id); })).toEqual(['bad-quality']);
});
