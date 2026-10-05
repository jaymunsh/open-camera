import { expect, test, type Page } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5186' });

async function activate(page: Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Offscreen LUTs are intentionally lazy: select the filter whose cache we test.
  await page.locator('.strip-item').filter({ hasText: /^AMATORKA$/ }).click();
  await expect(page.locator('.filter-name')).toHaveText('AMATORKA');
  await expect(page.locator('.filter-name')).not.toHaveClass(/pending/);
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('oc-luts');
    return (await cache.keys()).some(r => r.url.includes('lookup_amatorka.png'));
  })).toBe(true);
}

test('production service worker caches the versioned request separately from a legacy URL', async ({ page }) => {
  await activate(page);
  const result = await page.evaluate(async () => {
    const cache = await caches.open('oc-luts');
    const current = (await cache.keys()).find(r => r.url.includes('lookup_amatorka.png'))!;
    await cache.delete(current);
    await cache.put('/luts/lookup_amatorka.png', new Response('old asset', {
      headers: { 'Content-Type': 'image/png' },
    }));
    const response = await fetch(current.url);
    return {
      version: new URL(current.url).searchParams.get('v'),
      signature: Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 8)),
    };
  });
  expect(result.version).toMatch(/^[a-f0-9]{16}$/);
  expect(result.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test('installed production shell can reload, apply a cached filter and export a photo offline', async ({ page, context }) => {
  await activate(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles('public/samples/sample1.png');
  await page.locator('.strip-item').filter({ hasText: /^AMATORKA$/ }).click();
  await expect(page.locator('.filter-name')).toHaveText('AMATORKA');
  await expect(page.locator('.filter-name')).not.toHaveClass(/pending/);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  await expect(page.locator('.overlay-msg')).toHaveCount(0);
});
