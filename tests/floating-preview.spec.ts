import { expect, test, type Page } from '@playwright/test';

async function choose(page: Page, mode: '네 컷' | '하프프레임', method = '수동') {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '촬영 모드 · 효과', exact: true }).click();
  await page.getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: '1:1', exact: true }).click();
  if (mode === '네 컷') await page.getByRole('dialog').getByRole('button', { name: method, exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '격자 켜기', exact: true }).click();
}

// Catches fading the whole popup (including controls) or leaving an opaque panel.
for (const mode of ['하프프레임', '네 컷'] as const) {
  test(`${mode} preview lets the scene through without fading controls or saved photos`, async ({ page }) => {
    await choose(page, mode);
    const popup = page.locator('.capture-preview');
    const alpha = await popup.evaluate(el => {
      const channels = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
      return channels[3] ?? 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(.6); expect(alpha).toBeLessThanOrEqual(.7);
    const photo = page.locator('.capture-frame canvas');
    const opacity = Number(await photo.evaluate(el => getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThanOrEqual(.85); expect(opacity).toBeLessThan(1);
    await expect(popup).toHaveCSS('opacity', '1');
    await expect(page.getByRole('button', { name: '합성 미리보기 확대', exact: true })).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: '합성 미리보기 접기', exact: true }).click();
    await expect(page.getByRole('button', { name: '합성 미리보기 펼치기', exact: true })).toHaveCSS('opacity', '1');
    for (let n = 1; n <= (mode === '하프프레임' ? 2 : 4); n++) await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    const result = page.locator('.capture-result');
    await expect(result).toHaveCSS('opacity', '1');
    expect(await result.evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(c.width / 4, c.height / 4, 1, 1).data[3])).toBe(255);
  });
}

// Catches a full-screen composition still covering the main single-shot camera.
for (const [width, height] of [[390, 844], [320, 740], [667, 320], [1440, 900]]) {
  test(`single-shot framing stays centered while popup fits above the shutter at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await choose(page, '네 컷');
    const enlarge = page.getByRole('button', { name: '합성 미리보기 확대', exact: true });
    await expect(enlarge).toBeVisible();
    const viewer = (await page.locator('.viewer').boundingBox())!;
    const grid = (await page.locator('.viewer > .grid-overlay').boundingBox())!;
    const expectedEdge = Math.min(viewer.width, viewer.height);
    expect(grid.width).toBeCloseTo(expectedEdge, 0); expect(grid.height).toBeCloseTo(expectedEdge, 0);
    expect(Math.abs(grid.x + grid.width / 2 - viewer.x - viewer.width / 2)).toBeLessThan(1);
    expect(Math.abs(grid.y + grid.height / 2 - viewer.y - viewer.height / 2)).toBeLessThan(1);
    const small = (await page.locator('.capture-preview').boundingBox())!;
    expect(small.width).toBeLessThan(width * .6);
    await enlarge.click();
    const large = (await page.locator('.capture-preview').boundingBox())!;
    expect(large.width).toBeGreaterThan(small.width);
    const header = (await page.locator('header').boundingBox())!, dock = (await page.locator('.dock').boundingBox())!;
    expect(large.x).toBeGreaterThanOrEqual(0); expect(large.x + large.width).toBeLessThanOrEqual(width);
    expect(large.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(large.y + large.height).toBeLessThanOrEqual(dock.y);
    expect(await page.locator('.viewer > .grid-overlay').boundingBox()).toEqual(grid);
    await page.getByRole('button', { name: '합성 미리보기 축소', exact: true }).click();
    expect((await page.locator('.capture-preview').boundingBox())!.width).toBeCloseTo(small.width, 0);
  });
}

// Catches hiding the preview canceling capture, dropping frozen cuts, or changing export size.
test('folding and resizing the half preview keeps both shots and the original export shape', async ({ page }) => {
  await choose(page, '하프프레임');
  const fold = page.getByRole('button', { name: '합성 미리보기 접기', exact: true });
  await expect(fold).toBeVisible();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await fold.click();
  const unfold = page.getByRole('button', { name: '합성 미리보기 펼치기', exact: true });
  await expect(unfold).toContainText('2/2'); await expect(unfold).toBeFocused();
  await expect(page.locator('.capture-frame')).toBeHidden();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await unfold.click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await page.getByRole('button', { name: '합성 미리보기 확대', exact: true }).click();
  await expect(page.getByRole('button', { name: '합성 미리보기 축소', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(unfold).toBeFocused();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[0] / size[1]).toBe(2);
  await expect(page.locator('.capture-retakes canvas')).toHaveCount(2);
  const second = await page.locator('.capture-retakes canvas').nth(1).evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.getByRole('button', { name: '1번째 다시 찍기', exact: true }).click();
  await expect(unfold).toBeVisible(); await expect(unfold).toContainText('1/2');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  expect(await page.locator('.capture-retakes canvas').nth(1).evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(second);
});

// Catches popup pointer events leaking to the main camera's press-and-hold handler.
test('popup gestures do not activate camera comparison while main-camera gestures still work', async ({ page }) => {
  await choose(page, '하프프레임');
  await expect(page.getByRole('button', { name: '합성 미리보기 확대', exact: true })).toBeVisible();
  const press = async (selector: string, type: string) => page.locator(selector).dispatchEvent(type, { pointerId: 42, pointerType: 'touch', clientX: 100, clientY: 100, bubbles: true });
  await press('.capture-frame canvas', 'pointerdown'); await page.waitForTimeout(500);
  await expect(page.locator('.compare-tag')).toHaveCount(0); await press('.capture-frame canvas', 'pointerup');
  await press('.viewer > canvas', 'pointerdown'); await expect(page.locator('.compare-tag')).toBeVisible();
  for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
    await page.locator('.capture-frame canvas').dispatchEvent(type, { pointerId: 43, pointerType: 'touch', clientX: 100, clientY: 100, bubbles: true });
    await expect(page.locator('.compare-tag')).toBeVisible();
  }
  // A tracked main-camera pointer must still clean up when released over the popup.
  await press('.capture-frame canvas', 'pointerup'); await expect(page.locator('.compare-tag')).toHaveCount(0);
});

// Catches preview controls pausing the independent automatic sequence or hiding its countdown.
test('automatic capture continues while preview is folded and countdown stays on the main camera', async ({ page }) => {
  await choose(page, '네 컷', '자동');
  const fold = page.getByRole('button', { name: '합성 미리보기 접기', exact: true });
  await expect(fold).toBeVisible();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await fold.click();
  await expect(page.locator('.capture-countdown')).toBeVisible();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(2, { timeout: 6000 });
  await expect(page.getByRole('button', { name: '합성 미리보기 펼치기', exact: true })).toContainText('3/4');
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(page.locator('.capture-countdown')).toHaveCount(0);
  await page.getByRole('button', { name: '합성 미리보기 펼치기', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '계속 촬영', exact: true })).toBeVisible();
});
