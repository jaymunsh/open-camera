import { expect, test } from '@playwright/test';

const films = [
  ['film-fuji160c', 'FUJI 160C'], ['film-superia400', 'SUPERIA 400'], ['film-ultra100', 'ULTRA COLOR 100'],
  ['film-elite200', 'ELITE CHROME 200'], ['film-instant690', 'INSTANT 690'], ['film-neopan1600', 'NEOPAN 1600'],
] as const;

// Catches missing files, identity/duplicate LUT substitutions, and wrong Hald layouts.
test('six new film LUTs load real distinct color data and render distinct results from the same photo', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async (films) => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { loadPresetLut } = await load('/src/engine/lut.ts'); const { renderFilteredCanvas } = await load('/src/engine/pipeline.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const bitmap = await createImageBitmap(await (await fetch('/samples/concepts/portrait.webp')).blob());
    const original = await renderFilteredCanvas(bitmap, DEFAULT_PARAMS, 'test-original', null, 0);
    try { return await Promise.all(films.map(async ([id]) => {
      try {
        const lut = await loadPresetLut(id);
        const canvas = await renderFilteredCanvas(bitmap, DEFAULT_PARAMS, `test-${id}`, lut, 1);
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let color = 0; for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i+1], pixels[i+2]) - Math.min(pixels[i], pixels[i+1], pixels[i+2]) > 1) color++;
        return { id, size: lut.size, signature: canvas.toDataURL(), original: canvas.toDataURL() === original.toDataURL(), color };
      } catch (e) { return { id, error: (e as Error).message }; }
    })); } finally { bitmap.close(); }
  }, films);
  for (const result of results) { expect(result).not.toHaveProperty('error'); expect(result).toMatchObject({ size: 64, original: false }); }
  expect(new Set(results.map((r) => 'signature' in r && r.signature)).size).toBe(6);
  expect(results[5]).toMatchObject({ color: 0 });
  for (const result of results.slice(0, 5)) expect('color' in result && result.color).toBeGreaterThan(0);
});

test('film collection is selectable, credited and applies through comparison without changing vintage pattern settings', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.locator('.sheet-tabs').getByRole('button', { name: '필름 컬렉션', exact: true }).click();
  await expect(page.getByRole('link', { name: 'LUT 출처·라이선스', exact: true })).toHaveAttribute('href', '/luts/film/CREDITS.md');
  await page.locator('.sheet-item').filter({ hasText: 'FUJI 160C' }).click();
  await expect(page.locator('.filter-name')).toHaveText('FUJI 160C');
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '색감 비교', exact: true });
  await expect(dialog.getByLabel('A 필터')).toHaveValue('film-fuji160c');
  await dialog.getByLabel('B 필터').selectOption('film-instant690'); await dialog.getByLabel('B 강도').fill('0.7');
  await expect(dialog.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'B 적용', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('INSTANT 690');
});

test('keyboard navigation continues from the collection credits to its first film instead of jumping to the dialog start', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.locator('.sheet-tabs').getByRole('button', { name: '필름 컬렉션', exact: true }).click();
  await page.getByRole('link', { name: 'LUT 출처·라이선스', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.sheet-item').filter({ hasText: 'FUJI 160C' })).toBeFocused();
});
