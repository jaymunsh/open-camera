import { expect, test } from '@playwright/test';

test('thumbnail LRU bounds owned canvases and preserves recently used items', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/thumbnailCache.ts'; const mod = await import(path).catch(() => null); if (!mod) return null;
    const cache = new mod.ThumbnailCache(); const canvases = [];
    for (let i = 0; i < 256; i++) { const c = document.createElement('canvas'); c.width = 128; canvases.push(c); cache.set(String(i), c); }
    cache.get('0'); cache.set('256', document.createElement('canvas'));
    const bounded = cache.size; const recent = !!cache.get('0'); const released = canvases[1].width === 0; cache.clear();
    return { bounded, recent, released, cleared: cache.size };
  });
  expect(result).toEqual({ bounded: 256, recent: true, released: true, cleared: 0 });
});

test('thumbnails restore sample A, separate strengths and recover after failed LUT without stale output', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/components/thumbs.ts'; const { renderPresetThumbs } = await import(path);
    const c = document.createElement('canvas'); c.width = c.height = 128; document.body.append(c); const refs = new Map([[c, 'mono']]);
    const render = (sampleId: string, amount = 1) => renderPresetThumbs(refs, [{ id: 'mono', amount }], null, () => false, { sampleId });
    await render('food'); const food = c.toDataURL(); await render('portrait'); const portrait = c.toDataURL(); await render('food'); const restored = c.toDataURL();
    await render('food', 0); const zero = c.toDataURL(); let errors = 0;
    await renderPresetThumbs(new Map([[c, 'missing-custom']]), [{ id: 'missing-custom', custom: true }], null, () => false, { sampleId: 'food', onError: () => errors++ });
    await render('food'); const recovered = c.toDataURL();
    await renderPresetThumbs(refs, [{ id: 'mono' }], null, () => true, { sampleId: 'night' });
    return { different: food !== portrait, restored: food === restored, strength: zero !== food, errors, recovered: recovered === food, cancelled: c.toDataURL() === food };
  });
  expect(result).toEqual({ different: true, restored: true, strength: true, errors: 1, recovered: true, cancelled: true });
});
