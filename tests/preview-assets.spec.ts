import { expect, test } from '@playwright/test';

test('comparison masters retain independent high resolution neutral sources', async ({ page }) => {
  await page.goto('/');
  const rows = await page.evaluate(async () => {
    const path = '/src/preview/samples.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null); if (!m) return null;
    const rows = [];
    for (const sample of m.SAMPLES) {
      const img = await m.loadSample(sample.id, 'master');
      rows.push({ width: img.naturalWidth, height: img.naturalHeight, versioned: /[?&]v=[a-f0-9]+/.test(img.src) });
    }
    return rows;
  });
  expect(rows).not.toBeNull();
  for (const row of rows!) { expect(row.width).toBeGreaterThanOrEqual(1024); expect(row.height).toBe(row.width); expect(row.versioned).toBe(true); }
});

test('production precaches the exact versioned concept URLs and keeps master downloads lazy', async ({ page }) => {
  await page.goto('http://127.0.0.1:5186/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat();
    return requests.map(r => r.url).filter(url => url.includes('/samples/'));
  });
  const concepts = cached.filter(url => url.includes('/samples/concepts/'));
  expect(concepts).toHaveLength(7);
  expect(concepts.every(url => /[?&]v=[a-f0-9]+/.test(url))).toBe(true);
  expect(cached.some(url => url.includes('/samples/masters/'))).toBe(false);
  await page.context().setOffline(true);
  const statuses = await page.evaluate(async urls => Promise.all(urls.map(async url => (await fetch(url)).status)), concepts);
  expect(statuses).toEqual(Array.from({ length: 7 }, () => 200));
});
