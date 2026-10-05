import { expect, test } from '@playwright/test';

test('comparison opens one modal, previews two independent choices and applies explicitly', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '색감 비교', exact: true }); await expect(dialog).toBeVisible();
  await expect(page.locator('[role="dialog"][aria-modal="true"]:visible')).toHaveCount(1);
  await expect(dialog.getByLabel('A 강도')).toHaveValue('1'); await expect(dialog.getByLabel('B 강도')).toHaveValue('1');
  await dialog.getByLabel('B 필터').selectOption('warm'); await dialog.getByLabel('B 강도').fill('0.6');
  await expect(dialog.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '2×', exact: true }).click();
  await expect(dialog.locator('.comparison-photo canvas').first()).toHaveCSS('transform', 'matrix(2, 0, 0, 2, 0, 0)');
  await dialog.getByRole('button', { name: 'B 적용', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.locator('.sheet-item.sel span')).toHaveText('WARM');
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  await page.getByLabel('A 필터').selectOption('mono'); await page.keyboard.press('Escape');
  await expect(page.locator('.sheet-item.sel span')).toHaveText('WARM');
  await expect(page.getByRole('button', { name: '색감 비교', exact: true })).toBeFocused();
});

test('apply preserves grain switch, fixed variation and the original storage preference', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oc-keep-original', '1');
    localStorage.setItem('oc-film-variation', JSON.stringify({ version: 1, mode: 'fixed', grain: .2, leak: .15, dust: .1, color: .15, fixedSeed: .25 }));
  });
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await page.getByRole('tab', { name: '효과', exact: true }).click(); await page.getByRole('button', { name: '부드러운 즉석필름', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('.grain-chip').click(); await expect(page.locator('.grain-chip')).toHaveClass(/off/);
  const before = await page.evaluate(() => localStorage.getItem('oc-film-variation'));
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  await page.getByLabel('B 필터').selectOption('studio-faded'); await page.getByLabel('B 강도').fill('0.6');
  await page.getByRole('button', { name: 'B 적용', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.grain-chip')).toHaveClass(/off/);
  expect(await page.evaluate(() => localStorage.getItem('oc-film-variation'))).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('oc-keep-original'))).toBe('1');
});

test('history comparison requires originals and returns to the same selected photo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-keep-original', '1'));
  await page.goto('/'); const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const compare = page.getByRole('dialog', { name: '색감 비교', exact: true }); await expect(compare).toBeVisible();
  await expect(compare).toContainText('촬영 원본 · 1번째 컷'); await expect(page.locator('[role="dialog"][aria-modal="true"]:visible')).toHaveCount(1);
  await compare.getByRole('button', { name: '닫기', exact: true }).click(); await expect(page.locator('.history-large')).toBeVisible();
  await expect(page.getByRole('button', { name: '색감 비교', exact: true })).toBeFocused();
});
