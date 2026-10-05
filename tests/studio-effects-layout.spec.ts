import { expect, test } from '@playwright/test';

for (const [name, width, height] of [['small', 320, 568], ['mobile', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 800]] as const) {
  test(`effect actions remain in view while settings scroll at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    await page.getByRole('button', { name: '스튜디오', exact: true }).click();
    const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    await studio.getByRole('tab', { name: '효과', exact: true }).click();
    await expect(studio.getByRole('img', { name: '스튜디오 프레임 미리보기', exact: true })).toBeVisible();
    const actions = studio.getByRole('group', { name: '스튜디오 효과 작업', exact: true });
    expect(await studio.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const before = await actions.boundingBox();
    for (const button of ['효과 해제', '변경 취소']) {
      const box = (await actions.getByRole('button', { name: button, exact: true }).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height + 1); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `.impeccable/review/effects-actions-${name}.png` });
    await studio.locator('.studio-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect(await actions.boundingBox()).toEqual(before);
    for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('.studio-dialog'))).toBe(true); }
    await studio.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
    await page.locator('.sheet-tabs').getByRole('button', { name: '필름 컬렉션', exact: true }).click();
    const group = page.locator('.sheet-group').filter({ hasText: /^필름 컬렉션$/ });
    await expect.poll(() => group.evaluate(el => Math.abs(el.getBoundingClientRect().top - el.closest('.sheet-scroll')!.getBoundingClientRect().top))).toBeLessThan(20);
    await expect.poll(() => page.locator('.sheet-item').filter({ hasText: 'FUJI 160C' }).locator('canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(64, 64, 1, 1).data[3])).toBe(255);
    await page.screenshot({ path: `.impeccable/review/film-collection-${name}.png` });
  });
}
