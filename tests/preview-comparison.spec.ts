import { expect, test } from '@playwright/test';

test('color comparison uses the same frozen pixels without textures or a second crop', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/compare.ts'; const mod = await import(path).catch(() => null); if (!mod) return null;
    const sourcePath = '/src/preview/source.ts'; const { freezePreviewSource } = await import(sourcePath);
    const c = document.createElement('canvas'); c.width = 96; c.height = 128; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#eb984a'; ctx.fillRect(0, 0, 48, 128); ctx.fillStyle = '#398db4'; ctx.fillRect(48, 0, 48, 128);
    const source = freezePreviewSource({ source: c, kind: 'scene', label: 'test', ratio: null, mirror: false }); const before = source.canvas.toDataURL();
    const choice = (id: string, amount: number) => ({ id, label: id, custom: false, amount });
    const zero = await mod.renderColorComparison(source, choice('mono', 0), choice('warm', 0), new AbortController().signal);
    const same = zero.original.toDataURL() === zero.a.toDataURL() && zero.original.toDataURL() === zero.b.toDataURL(); zero.release();
    const rendered = await mod.renderColorComparison(source, choice('mono', 1), choice('warm', 1), new AbortController().signal);
    const distinct = rendered.a.toDataURL() !== rendered.b.toDataURL(); const sizes = [rendered.a.width, rendered.a.height, rendered.b.width, rendered.b.height]; rendered.release(); rendered.release();
    return { same, distinct, sizes, unchanged: before === source.canvas.toDataURL() };
  });
  expect(result).toEqual({ same: true, distinct: true, sizes: [96, 128, 96, 128], unchanged: true });
});

test('comparison rejects missing LUT, invalid strength and aborted jobs', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/compare.ts'; const mod = await import(path).catch(() => null); if (!mod) return null;
    const sourcePath = '/src/preview/source.ts'; const { freezePreviewSource } = await import(sourcePath);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const source = freezePreviewSource({ source: c, kind: 'scene', label: 'test', ratio: null, mirror: false });
    const normal = { id: 'mono', label: 'mono', custom: false, amount: 1 }; const aborted = new AbortController(); aborted.abort();
    const rejects = [];
    for (const [choice, signal] of [[{ ...normal, id: 'missing', custom: true }, new AbortController().signal], [{ ...normal, amount: NaN }, new AbortController().signal], [{ ...normal, amount: -0.1 }, new AbortController().signal], [{ ...normal, amount: 1.1 }, new AbortController().signal], [normal, aborted.signal]]) rejects.push(await mod.renderColorComparison(source, choice, normal, signal).then(() => false, () => true));
    source.release(); return rejects;
  });
  expect(result).toEqual([true, true, true, true, true]);
});
