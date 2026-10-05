import { test, expect } from '@playwright/test';

for (const [name, width, height] of [['small', 320, 568], ['mobile', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 800]] as const) {
  test(`film controls keep protected actions reachable without moving the camera at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    const viewer = page.locator('.viewer'); const before = await viewer.boundingBox();
    await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    await studio.getByRole('tab', { name: '효과', exact: true }).click(); const summary = studio.locator('summary').filter({ hasText: /^필름 질감/ });
    await expect(summary).toBeVisible(); await summary.click(); await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click();
    await studio.locator('summary').filter({ hasText: /^세부 조정/ }).click();
    await studio.locator('.studio-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(studio.getByRole('button', { name: '변경 취소', exact: true })).toBeInViewport();
    expect(await studio.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await viewer.boundingBox()).toEqual(before);
    const footer = await studio.locator('.studio-effect-actions').boundingBox(); expect(footer!.y + footer!.height).toBeLessThanOrEqual(height + 1);
    const button = studio.getByRole('button', { name: '변경 취소', exact: true }); expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '스튜디오', exact: true })).toBeFocused();
  });
}
