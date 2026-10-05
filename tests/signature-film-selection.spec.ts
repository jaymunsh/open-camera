import { test, expect } from '@playwright/test';

test('catalog gates unverified looks while loaders restore explicitly known signatures', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.strip-item').filter({ hasText: '인물 · SOFT NEG' })).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const path = '/src/engine/lut.ts'; const api = await import(path);
    if (!api.availablePresets) return { available: false };
    const normal = api.availablePresets(false), preview = api.availablePresets(true);
    const a = await api.loadPresetLut('signature-portrait-v1'), b = await api.loadPresetLut('film-fuji160c');
    let rejected = false; try { await api.loadPresetLut('signature-unknown-v1'); } catch { rejected = true; }
    return { available: true, extra: preview.length - normal.length, prefix: normal.every((p: any, i: number) => p.id === preview[i].id), group: preview.at(-1).group, same: a === b, rejected };
  });
  expect(result).toEqual({ available: true, extra: 6, prefix: true, group: '대표 룩 · 시험중', same: true, rejected: true });
});

test('preview selection captures a profile snapshot and restores outside the preview catalog', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('oc-keep-original', '1'); Object.defineProperty(navigator, 'canShare', { value: () => true }); Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('cancel', 'AbortError'); } }); });
  await page.goto('/?film-quality-preview=1');
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '대표 룩 · 시험중', exact: true }).click();
  await expect(page.locator('.sheet-group-note').filter({ hasText: '실제 사진 품질은 아직 미검증' })).toBeVisible(); await page.keyboard.press('Escape');
  const film = page.locator('.strip-item').filter({ hasText: '인물 · SOFT NEG' }); await expect(film).toHaveCount(1); await film.click();
  await expect(page.locator('.filter-name')).toHaveText('인물 · SOFT NEG');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled(); await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(path); const r = (await listCaptures())[0]; return { id: r?.settings?.lutId, quality: r?.settings?.filmQuality?.profile?.id, originals: r?.originals.length, jpeg: r?.blob.type }; })).toEqual({ id: 'signature-portrait-v1', quality: 'signature-portrait-v1', originals: 1, jpeg: 'image/jpeg' });
  await page.goto('/'); await expect(page.locator('.filter-name')).toHaveText('인물 · SOFT NEG'); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await expect(page.locator('.strip-item').filter({ hasText: '카페 · WARM PRINT' })).toHaveCount(0);
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const restoredComparison = page.getByRole('dialog', { name: '색감 비교', exact: true }); await expect(restoredComparison.getByLabel('A 필터', { exact: true })).toHaveValue('signature-portrait-v1'); await expect(restoredComparison.getByRole('button', { name: 'A 적용', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled(); await expect(page.locator('.filter-name')).toHaveText('인물 · SOFT NEG');
});

test('color-only candidate comparison preserves manual texture and creates an explicit legacy snapshot when absent', async ({ page }) => {
  await page.goto('/?film-quality-preview=1'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '색감 비교', exact: true }); await dialog.getByLabel('B 필터', { exact: true }).selectOption('signature-portrait-v1'); await expect(dialog.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'B 적용', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-quality-v1')!).settings)).toMatchObject({ model: 'legacy', origin: 'manual' });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.locator('summary').filter({ hasText: /^필름 질감/ }).click(); await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click(); await page.keyboard.press('Escape');
  const before = await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'));
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '색감 비교', exact: true }).click(); dialog = page.getByRole('dialog', { name: '색감 비교', exact: true });
  await dialog.getByLabel('B 필터', { exact: true }).selectOption('signature-night-v1'); await expect(dialog.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'B 적용', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBe(before);
});
