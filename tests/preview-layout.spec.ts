import { expect, test } from '@playwright/test';

for (const [name, width, height] of [['small', 320, 568], ['mobile', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 800]] as const) {
  test(`concept comparison and Studio retain reachable actions without overflow at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '샘플 · 인물', exact: true }).click();
    await expect.poll(() => page.locator('.sample-choice img').evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `.impeccable/review/concept-${name}-picker.png` });
    await expect(page.getByRole('button', { name: '색감 비교', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '색감 비교', exact: true }).click();
    const compare = page.getByRole('dialog', { name: '색감 비교', exact: true });
    await expect(compare.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
    await compare.getByLabel('A 필터').selectOption('mono'); await compare.getByLabel('B 필터').selectOption('warm');
    await expect(compare.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
    await page.screenshot({ path: `.impeccable/review/concept-${name}-comparison.png` });
    const bounds = await compare.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    for (const button of ['닫기', 'A 적용', 'B 적용']) { const box = await compare.getByRole('button', { name: button, exact: true }).boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1); }
    expect(await compare.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('.comparison-dialog'))).toBe(true); }
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    expect(await studio.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(studio.getByRole('img', { name: '스튜디오 프레임 미리보기', exact: true })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/concept-${name}-studio.png` });
    await studio.getByRole('tab', { name: '효과', exact: true }).click(); await expect(studio.locator('summary').filter({ hasText: '렌즈 효과' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/concept-${name}-effects.png` });
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '스튜디오', exact: true })).toBeFocused();
  });
}

test('preview operations preserve every camera frame and enlarged text keeps actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('oc-grid', '1'));
  await page.goto('/'); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  const ratio = page.getByRole('button', { name: '비율', exact: true });
  for (const label of ['3:4', '9:16', '1:1', '4:5']) {
    await expect(ratio).toHaveText(label);
    const before = await page.locator('.grid-overlay').boundingBox();
    await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
    await page.getByRole('button', { name: '색감 비교', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '색감 비교', exact: true });
    await expect(dialog.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled();
    await dialog.evaluate((el) => {
      const sizes = [...el.querySelectorAll<HTMLElement>('*')].map((node) => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    for (const name of ['닫기', 'A 적용', 'B 적용']) {
      const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    }
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: '닫기', exact: true }).click();
    expect(await page.locator('.grid-overlay').boundingBox()).toEqual(before);
    if (label !== '4:5') await ratio.click();
  }
});
