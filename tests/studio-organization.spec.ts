import { expect, test } from '@playwright/test';

test('Studio decoration disclosure summarizes preserved color and caption while booth timing stays visible', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await page.getByRole('button', { name: '메모리 2×2', exact: true }).click();
  const decoration = page.locator('details').filter({ has: page.getByText('프레임 꾸미기', { exact: true }) });
  await expect(decoration).toHaveCount(1); await expect(decoration).not.toHaveAttribute('open');
  await expect(page.getByRole('dialog', { name: '스튜디오', exact: true }).getByRole('button', { name: '수동', exact: true })).toBeVisible();
  await decoration.locator('summary').click(); await page.getByRole('button', { name: '크림', exact: true }).click(); await page.getByLabel('프레임 문구').fill('하루');
  await decoration.locator('summary').click(); await expect(decoration.locator('summary')).toContainText('크림 · 문구 있음');
  await decoration.locator('summary').click(); await expect(page.getByLabel('프레임 문구')).toHaveValue('하루');
});

test('enabled lens and film variation start expanded and folding does not reset their values', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-film-variation', JSON.stringify({ version: 1, mode: 'fixed', grain: .7, leak: .15, dust: .1, color: .15, fixedSeed: .25 })));
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '효과', exact: true }).click();
  const variation = page.locator('details').filter({ has: page.getByText('빈티지 패턴', { exact: true }) });
  await expect(variation).toHaveAttribute('open', ''); const before = await page.evaluate(() => localStorage.getItem('oc-film-variation'));
  await variation.locator('summary').click(); await expect(variation.locator('summary')).toContainText('고정 패턴');
  expect(await page.evaluate(() => localStorage.getItem('oc-film-variation'))).toBe(before);
  const lens = page.locator('details').filter({ has: page.getByText('렌즈 효과', { exact: true }).first() });
  await lens.locator('summary').click(); await page.getByRole('button', { name: '빛줄기', exact: true }).click(); await page.getByLabel('렌즈 강도').fill('0.7');
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '효과', exact: true }).click();
  await expect(page.getByLabel('렌즈 강도')).toBeVisible(); await expect(page.getByLabel('렌즈 강도')).toHaveValue('0.7');
});
