import { expect, test, type Page } from '@playwright/test';

async function settings(page: Page) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '촬영 모드 · 효과', exact: true }).click();
}

async function choose(page: Page, mode: string, ratio: string) {
  await settings(page);
  await page.getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: ratio, exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
}

test('recent thumbnail opens history beside Filter without shifting the shutter', async ({ page }) => {
  await page.goto('/');
  const thumbnail = page.getByRole('button', { name: '최근 촬영 열기', exact: true });
  await expect(thumbnail).toHaveCount(0);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await expect(thumbnail.locator('img')).toBeVisible();
  const filter = (await page.getByRole('button', { name: '필터', exact: true }).boundingBox())!;
  const thumb = (await thumbnail.boundingBox())!;
  const shutter = (await page.getByRole('button', { name: '촬영', exact: true }).boundingBox())!;
  expect(thumb.x).toBeGreaterThan(filter.x + filter.width - 1);
  expect(thumb.x + thumb.width).toBeLessThan(shutter.x + 1);
  expect(Math.abs(shutter.x + shutter.width / 2 - 195)).toBeLessThan(1);
  await thumbnail.click(); await expect(page.getByRole('dialog', { name: '최근 촬영' })).toBeVisible();
  await expect(page.locator('.history-photo')).toHaveCount(1);
});

for (const [ratio, outputAspect] of [['1:1', 2], ['3:4', 1.5], ['4:5', 1.6]] as const) {
  test(`half-frame exports chosen ${ratio} cells and locks ratio after the first shot`, async ({ page }) => {
    await page.goto('/'); await choose(page, '하프프레임', ratio);
    await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText(ratio);
    await expect(page.getByRole('button', { name: '비율', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.locator('.capture-progress')).toContainText('2/2');
    await expect(page.getByRole('button', { name: '비율', exact: true })).toBeDisabled();
    await settings(page); await expect(page.getByRole('button', { name: ratio, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
    expect(size[0] / size[1]).toBeCloseTo(outputAspect, 2);
  });
}

test('booth keeps selected square cells through retake and unlocks after cancel', async ({ page }) => {
  await page.goto('/'); await choose(page, '네 컷', '1:1');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled({ timeout: 20000 });
  const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[0]).toBe(size[1]);
  await page.evaluate(() => { Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 0 }); });
  await page.getByRole('button', { name: '3번째 다시 찍기', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('1:1');
  await expect(page.getByRole('button', { name: '비율', exact: true })).toBeDisabled();
  await expect(page.locator('.capture-mini')).toHaveAccessibleName(/3번째 촬영/);
  await expect.poll(() => page.locator('.capture-mini canvas').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(Math.floor(c.width / 4), Math.floor(c.height / 4), 1, 1).data).slice(0, 3).some((v) => v > 0)), { timeout: 1500 }).toBe(true);
  await page.screenshot({ path: 'test-results/capture-ui-booth-retake.png' });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toBeEnabled();
});

test('opening settings before the first booth shot does not pause the automatic sequence', async ({ page }) => {
  await page.goto('/'); await choose(page, '네 컷', '1:1');
  await settings(page); await page.getByRole('button', { name: '4:5', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('2/4');
  await expect(page.locator('.capture-progress')).toContainText('초', { timeout: 1500 });
});

for (const [width, height] of [[390, 844], [1440, 900], [320, 740], [844, 390], [667, 320]] as const) {
  test(`composite preview and recent thumbnail fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('http://127.0.0.1:5186/');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
    await choose(page, '하프프레임', '1:1'); await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.locator('.capture-mini')).toHaveAccessibleName(/2번째 촬영/);
    const viewer = (await page.locator('.viewer').boundingBox())!, mini = (await page.locator('.capture-mini').boundingBox())!;
    expect(mini.x).toBeGreaterThanOrEqual(viewer.x); expect(mini.y).toBeGreaterThanOrEqual(viewer.y);
    expect(mini.x + mini.width).toBeLessThanOrEqual(viewer.x + viewer.width);
    expect(mini.y + mini.height).toBeLessThanOrEqual(viewer.y + viewer.height);
    const shutter = (await page.getByRole('button', { name: '촬영', exact: true }).boundingBox())!;
    expect(Math.abs(shutter.x + shutter.width / 2 - width / 2)).toBeLessThan(1);
    const thumb = (await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).boundingBox())!;
    expect(thumb.x + thumb.width).toBeLessThan(shutter.x + 1);
    await expect(page.locator('.flash')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: `test-results/capture-ui-${width}x${height}.png` });
  });
}

test('live half preview advances the active cell while its captured cell stays frozen', async ({ page }) => {
  await page.goto('/'); await choose(page, '하프프레임', '1:1');
  const mini = page.locator('.capture-mini'); const canvas = mini.locator('canvas');
  await expect(mini).toHaveAccessibleName(/1번째 촬영/);
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(mini).toHaveAccessibleName(/2번째 촬영/);
  const pixels = () => canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!; const half = Math.floor(c.width / 2);
    return [0, half].map((x) => Array.from(ctx.getImageData(x + 4, 18, half - 8, c.height - 22).data).join(','));
  });
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);
  await page.waitForTimeout(200); const before = await pixels();
  await expect.poll(async () => (await pixels())[1]).not.toBe(before[1]);
  expect((await pixels())[0]).toBe(before[0]);
});

test('composite ratio choice leaves the normal camera ratio unchanged', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '비율', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('9:16');
  await choose(page, '하프프레임', '4:5');
  await settings(page); await page.getByRole('button', { name: '일반', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('9:16');
});

test('lens comparison shows the same photo with and without edge refraction', async ({ page }) => {
  await page.goto('/');
  const encoded = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!; for (let x = 0; x < 256; x += 8) { ctx.fillStyle = ['#f00', '#0f0', '#00f'][Math.floor(x / 8) % 3]; ctx.fillRect(x, 0, 8, 256); } return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'stripes.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await settings(page); await page.getByRole('button', { name: '가장자리 굴절', exact: true }).click();
  const base = page.getByLabel('렌즈 없음 비교', { exact: true }); const effect = page.getByLabel('가장자리 굴절 비교', { exact: true });
  await expect.poll(() => effect.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);
  const sample = (locator: typeof base, x: number) => locator.evaluate((c: HTMLCanvasElement, xpos) => Array.from(c.getContext('2d')!.getImageData(xpos, Math.floor(c.height / 2), 1, 1).data), x);
  await expect.poll(() => sample(effect, 5)).not.toEqual(await sample(base, 5));
  const center = await base.evaluate((c: HTMLCanvasElement) => Math.floor(c.width / 2));
  expect(await sample(effect, center)).toEqual(await sample(base, center));
  await expect(page.getByRole('button', { name: '빛줄기', exact: true })).toBeVisible();
  await page.locator('.lens-comparison').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/capture-ui-lens-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/capture-ui-lens-desktop.png' });
});
