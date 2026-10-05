import { expect, test } from '@playwright/test';

const films = [
  { id: 'provided-muted-chrome', label: 'MUTED CHROME', file: '/luts/provided/muted-chrome.cube', raw: 'a45c734a27371dc5c0b4f9b95fff00fb98cc7db12daa9ab6b9e5788bedbbdb4c', data: 'e8dc720a94993e673acc9a80b6470f98c05658980dff33fe6110cc9eddc3c65e' },
  { id: 'provided-deep-negative', label: 'DEEP NEGATIVE', file: '/luts/provided/deep-negative.cube', raw: 'c85aa8ef7dabb7dab92496494edf54bf89ec535408526417383dcc76256420ef', data: '687b041206485b37c3ac24f669d40ca3f39c1618a3a32332c5dcb6b7543998a1' },
] as const;

// Missing registration, swapped files, changed values or wrong cube parsing must fail.
for (const film of films) test(`${film.label} loads the exact provided cube and RGB data`, async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (film) => {
    const hash = async (data: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
    const path = '/src/engine/lut.ts'; const { loadPresetLut } = await import(/* @vite-ignore */ path);
    try {
      const lut = await loadPresetLut(film.id), response = await fetch(film.file);
      return { size: lut.size, raw: await hash(await response.arrayBuffer()), data: await hash(lut.data.buffer) };
    } catch (e) { return { error: (e as Error).message }; }
  }, film);
  expect(result).toEqual({ size: 33, raw: film.raw, data: film.data });
});

// A working loader alone does not prove visible selection, comparison and capture wiring.
test('provided films apply through comparison and a captured original retains the selected film', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-keep-original', '1'));
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.locator('.sheet-tabs').getByRole('button', { name: '추가 필름', exact: true }).click();
  await page.locator('.sheet-item').filter({ hasText: 'MUTED CHROME' }).click();
  await expect(page.locator('.filter-name')).toHaveText('MUTED CHROME');
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const comparison = page.getByRole('dialog', { name: '색감 비교', exact: true });
  await expect(comparison.getByLabel('A 필터')).toHaveValue('provided-muted-chrome');
  await comparison.getByLabel('B 필터').selectOption('provided-deep-negative');
  await comparison.getByLabel('B 강도').fill('0.7');
  await expect(comparison.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
  await comparison.getByRole('button', { name: 'B 적용', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('DEEP NEGATIVE');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.jpg$/);
  await expect.poll(async () => page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const records = await (await import(/* @vite-ignore */ path)).listCaptures();
    return records.map((record: any) => ({ lutId: record.settings.lutId, intensity: record.settings.intensity, originals: record.originals.length }));
  })).toEqual([{ lutId: 'provided-deep-negative', intensity: 0.7, originals: 1 }]);
});
