import { expect, test } from '@playwright/test';

test('master cache retains only two references without damaging evicted images', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/samples.ts';
    const { loadSample } = await import(path);
    const first = await loadSample('portrait', 'master');
    await loadSample('food', 'master'); await loadSample('night', 'master');
    const again = await loadSample('portrait', 'master');
    return { evicted: first !== again, retained: first.naturalWidth >= 1024 };
  });
  expect(result).toEqual({ evicted: true, retained: true });
});

test('seven neutral concepts expose stable IDs and labels and load independent reference photographs', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/samples.ts';
    const m = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    const dimensions = [];
    for (const sample of m.SAMPLES) {
      const image = await m.loadSample(sample.id);
      dimensions.push([image.naturalWidth, image.naturalHeight]);
    }
    return { ids: m.SAMPLES.map((s: any) => s.id), labels: m.SAMPLES.map((s: any) => s.label), defaultId: m.DEFAULT_SAMPLE_ID, dimensions };
  });
  expect(result).not.toBeNull();
  expect(result!.ids).toEqual(['portrait', 'food', 'landscape', 'cafe', 'street', 'night', 'interior']);
  expect(result!.labels).toEqual(['인물', '음식', '풍경', '카페', '거리', '야간', '실내']);
  expect(result!.defaultId).toBe('portrait');
  expect(result!.dimensions).toEqual(Array.from({ length: 7 }, () => [512, 512]));
});

test('failed sample load can retry without replacing the requested image', async ({ page }) => {
  let failed = false;
  await page.route('**/samples/concepts/food.webp*', async route => {
    if (!failed) { failed = true; await route.fulfill({ status: 404, body: 'missing' }); }
    else await route.continue();
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/samples.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    let rejected = false;
    try { await m.loadSample('food'); } catch { rejected = true; }
    const image = await m.loadSample('food');
    const other = await m.loadSample('landscape');
    return { rejected, retryWidth: image.naturalWidth, food: image.src.includes('/food.webp'), distinct: image !== other };
  });
  expect(result).toEqual({ rejected: true, retryWidth: 512, food: true, distinct: true });
});

test('sample preferences validate values and survive denied storage without writing photos', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/samples.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null); if (!m) return null;
    m.writeSamplePreference('night'); const chosen = m.readSamplePreference();
    localStorage.setItem('oc-preview-sample', 'corrupt'); const fallback = m.readSamplePreference();
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('denied', 'SecurityError'); };
    let blocked;
    try { m.writeSamplePreference('food'); blocked = m.readSamplePreference(); }
    finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set; }
    return { chosen, fallback, blocked };
  });
  expect(result).toEqual({ chosen: 'night', fallback: 'portrait', blocked: 'portrait' });
});
