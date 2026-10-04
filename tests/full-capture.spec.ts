import { expect, test, type Page } from '@playwright/test';

async function choose(page: Page, mode: string, ratio: string) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '촬영 모드 · 효과', exact: true }).click();
  await page.getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: ratio, exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
}

// Hand-derived output aspects: two square cells = 2:1; two 4:5 cells = 8:5;
// a square 2x2 booth = 1:1; a 3:4 booth with 4% paper gaps ≈ .761:1.
for (const c of [
  { mode: '하프프레임', ratio: '1:1', width: 390, height: 844, aspect: 2, cells: 2 },
  { mode: '네 컷', ratio: '3:4', width: 390, height: 844, aspect: .761, cells: 4 },
  { mode: '네 컷', ratio: '1:1', width: 320, height: 740, aspect: 1, cells: 4 },
  { mode: '하프프레임', ratio: '4:5', width: 844, height: 390, aspect: 1.6, cells: 2 },
  { mode: '하프프레임', ratio: '1:1', width: 1440, height: 900, aspect: 2, cells: 2 },
]) {
  test(`${c.mode} is a centered full composition rather than a tiny thumbnail at ${c.width}x${c.height}`, async ({ page }) => {
    await page.setViewportSize({ width: c.width, height: c.height });
    await page.goto('http://127.0.0.1:5186/'); await choose(page, c.mode, c.ratio);
    const viewer = (await page.locator('.viewer').boundingBox())!;
    const composition = page.locator('.viewer [role=img] canvas');
    const box = (await composition.boundingBox())!;
    const expectedWidth = Math.min(viewer.width, viewer.height * c.aspect);
    const expectedHeight = expectedWidth / c.aspect;
    expect(Math.abs(box.width - expectedWidth)).toBeLessThan(2);
    expect(Math.abs(box.height - expectedHeight)).toBeLessThan(2);
    expect(Math.abs(box.x + box.width / 2 - (viewer.x + viewer.width / 2))).toBeLessThan(1);
    expect(Math.abs(box.y + box.height / 2 - (viewer.y + viewer.height / 2))).toBeLessThan(1);
    await expect(page.locator('.capture-cell')).toHaveCount(c.cells);
    await expect(page.locator('.capture-cell.current')).toContainText('현재 컷');
    await expect(page.locator('.capture-cell.pending')).toHaveCount(c.cells - 1);
    await expect.poll(() => composition.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const live = ctx.getImageData(Math.floor(canvas.width / 4), Math.floor(canvas.height / (canvas.width / canvas.height > 1.4 ? 2 : 4)), 1, 1).data;
      return live[1] > live[0] && live[1] > live[2];
    })).toBe(true);
    await expect.poll(() => page.locator('.strip-item.sel canvas').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data).slice(0, 3).some((v) => v > 0))).toBe(true);
    await expect.poll(() => page.locator('.shutter-logo').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `test-results/full-capture-${c.cells}-${c.width}x${c.height}.png` });
  });
}

test('booth shows completed, live and waiting cells with countdown inside the live cell', async ({ page }) => {
  await page.goto('/'); await choose(page, '네 컷', '1:1');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  const current = page.locator('.capture-cell.current');
  await expect(current).toContainText('2 · 현재 컷');
  await expect(page.locator('.capture-cell.pending')).toHaveCount(2);
  await expect(current.locator('.cell-countdown')).toBeVisible();
  const cell = (await current.boundingBox())!, number = (await current.locator('.cell-countdown').boundingBox())!;
  expect(number.width).toBeGreaterThanOrEqual(44);
  expect(number.x).toBeGreaterThanOrEqual(cell.x); expect(number.y).toBeGreaterThanOrEqual(cell.y);
  expect(number.x + number.width).toBeLessThanOrEqual(cell.x + cell.width);
  expect(number.y + number.height).toBeLessThanOrEqual(cell.y + cell.height);
  await expect(page.locator('.flash')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'test-results/full-capture-booth-countdown.png' });
});

test('cut labels stay readable without being covered by progress actions', async ({ page }) => {
  const assertLabelsClear = async () => {
    const hidden = await page.evaluate(() => {
      const hud = document.querySelector('.capture-progress')!.getBoundingClientRect();
      return [...document.querySelectorAll('.cell-label')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < hud.right && r.right > hud.left && r.top < hud.bottom && r.bottom > hud.top;
      }).length;
    });
    expect(hidden).toBe(0);
  };
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  await choose(page, '하프프레임', '1:1'); await assertLabelsClear();
  await page.setViewportSize({ width: 390, height: 844 }); await choose(page, '네 컷', '3:4');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1); await assertLabelsClear();
});
