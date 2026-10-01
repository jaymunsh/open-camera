import { expect, test } from '@playwright/test';

// These check the workaround's layout contract, not iOS's system blur.
// Removing the pinned opaque header or its reserved space must fail them.
for (const layout of [
  { name: 'phone', width: 390, height: 844, top: 0, side: 0 },
  { name: 'phone safe area', width: 390, height: 844, top: 62, side: 0 },
  { name: 'landscape safe area', width: 844, height: 390, top: 0, side: 59 },
  { name: 'desktop', width: 1440, height: 900, top: 0, side: 0 },
]) {
  test(`opaque header covers the top edge without overlapping the viewer: ${layout.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.goto('/');
    // Chromium does not emulate the iPhone's OS-provided safe-area insets.
    await page.locator('.app').evaluate((app, insets) => {
      const style = (app as HTMLElement).style;
      style.setProperty('--safe-area-top', `${insets.top}px`);
      style.setProperty('--safe-area-left', `${insets.side}px`);
      style.setProperty('--safe-area-right', `${insets.side}px`);
    }, layout);

    const header = page.locator('header');
    await expect(header).toHaveCSS('position', 'fixed');
    await expect(header).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(header).toHaveCSS('backdrop-filter', 'none');
    const box = (await header.boundingBox())!;
    expect(box.y).toBe(0);
    expect(box.x).toBe(0);
    expect(box.width).toBe(layout.width);
    expect(box.height).toBe(layout.top + 54);
    expect((await page.locator('.viewer').boundingBox())!.y).toBe(box.height);
    const ratio = (await page.getByRole('button', { name: '비율', exact: true }).boundingBox())!;
    expect(ratio.y).toBe(layout.top + 8);
    const menu = (await page.getByRole('button', { name: '메뉴', exact: true }).boundingBox())!;
    expect(menu.x + menu.width).toBeLessThanOrEqual(layout.width - Math.max(14, layout.side));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(layout.width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(layout.height);
    await page.screenshot({ path: testInfo.outputPath('header.png') });

    await page.getByRole('button', { name: '비율', exact: true }).click();
    await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('9:16');
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page.getByRole('button', { name: '라이선스', exact: true }).click();
    await expect(page.locator('.sheet-back')).toBeVisible();
    // A modal backdrop must remain above the newly fixed header.
    expect(await page.getByRole('button', { name: '메뉴', exact: true }).evaluate(button => {
      const r = button.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.sheet-back');
    })).toBe(true);
  });
}

test('header space follows safe-area changes and edit mode without covering the viewer', async ({ page }) => {
  await page.goto('/');
  await page.locator('.app').evaluate(app => (app as HTMLElement).style.setProperty('--safe-area-top', '62px'));
  await expect(page.locator('header')).toHaveCSS('height', '116px');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.app').evaluate(app => (app as HTMLElement).style.setProperty('--safe-area-top', '0px'));
  await expect(page.locator('header')).toHaveCSS('height', '54px');

  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('input[type=file]').nth(0).setInputFiles({
    name: 'edit.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64'),
  });
  await expect(page.getByRole('button', { name: '카메라', exact: true })).toBeVisible();
  await expect(page.locator('header')).toHaveCSS('height', '54px');
  expect((await page.locator('.viewer').boundingBox())!.y).toBe(54);
  await page.getByRole('button', { name: '카메라', exact: true }).click();
  await expect(page.locator('header')).toHaveCSS('height', '54px');
  expect((await page.locator('.viewer').boundingBox())!.y).toBe(54);
});

test('the full camera menu scrolls to its last action in short landscape viewports', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await page.addInitScript(() => {
    const capabilities = MediaStreamTrack.prototype.getCapabilities;
    // Keep the real video stream; only emulate the optional torch capability.
    MediaStreamTrack.prototype.getCapabilities = function () {
      return { ...capabilities.call(this), torch: true };
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video?.readyState === 4;
  });
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await expect(page.getByRole('button', { name: '플래시 켜기', exact: true })).toBeVisible();
  const menuBox = (await page.locator('.menu').boundingBox())!;
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: '라이선스', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '라이선스', exact: true }).click();
  await expect(page.locator('.sheet-back')).toBeVisible();
});
