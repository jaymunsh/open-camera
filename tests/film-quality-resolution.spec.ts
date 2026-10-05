import { test, expect } from '@playwright/test';

// Catches grain that shrinks with output pixels instead of photograph size.
test('new grain has comparable normalized frequency and amplitude across output resolutions', async ({ page }) => {
  test.setTimeout(120_000); await page.goto('/');
  const rows = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { FilterPipeline } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const c = document.createElement('canvas'), p = new FilterPipeline(c), rows = [];
    for (const seed of [.25, .75]) for (const size of [.08, .38, .85]) {
      const signals = [];
      for (const resolution of [512, 1024, 2048]) {
        c.width = c.height = resolution;
        const source = document.createElement('canvas'); source.width = source.height = resolution;
        source.getContext('2d')!.fillStyle = '#808080'; source.getContext('2d')!.fillRect(0, 0, resolution, resolution); p.setSource(source);
        p.render(DEFAULT_PARAMS, 0, { look: { lens: 'none', lensAmount: 0, gentle: false, filmQuality: { model: 'film-v2', grain: .6, size, color: 0, shadows: .45, glow: 0, glowRadius: .35, seed } } });
        const normalized = document.createElement('canvas'); normalized.width = normalized.height = 512;
        normalized.getContext('2d')!.drawImage(c, 0, 0, 512, 512);
        const data = normalized.getContext('2d')!.getImageData(0, 0, 512, 512).data;
        signals.push(Array.from({ length: 512 * 512 }, (_, i) => data[i * 4] - 128));
      }
      const rms = (a: number[]) => Math.sqrt(a.reduce((n, v) => n + v * v, 0) / a.length);
      const base = rms(signals[0]);
      rows.push({ seed, size, base, comparisons: signals.slice(1).map(a => ({ relative: Math.abs(rms(a) - base) / Math.max(base, .00001), correlation: a.reduce((n, v, i) => n + v * signals[0][i], 0) / Math.max(.00001, a.length * rms(a) * base) })) });
    }
    return rows;
  });
  for (const row of rows) { expect(row.base).toBeGreaterThan(.5); for (const comparison of row.comparisons) { expect(comparison.relative, JSON.stringify(row)).toBeLessThanOrEqual(.25); expect(comparison.correlation, JSON.stringify(row)).toBeGreaterThanOrEqual(.85); } }
});

test('highlight glow is local, leaves gray and white centers intact and scales with the photograph', async ({ page }) => {
  await page.goto('/');
  const rows = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { FilterPipeline } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const c = document.createElement('canvas'), p = new FilterPipeline(c), rows = [];
    const look = { lens: 'none', lensAmount: 0, gentle: false, filmQuality: { model: 'film-v2', grain: 0, size: .38, color: 0, shadows: .45, glow: 1, glowRadius: .8, seed: .25 } };
    for (const resolution of [512, 1024, 2048]) {
      c.width = c.height = resolution; const source = document.createElement('canvas'); source.width = source.height = resolution;
      const x = source.getContext('2d')!; x.fillStyle = '#808080'; x.fillRect(0, 0, resolution, resolution); p.setSource(source); p.render(DEFAULT_PARAMS, 0, { look });
      const n = document.createElement('canvas'); n.width = n.height = 512; const ctx = n.getContext('2d')!; ctx.drawImage(c, 0, 0, 512, 512); const gray = Array.from(ctx.getImageData(256, 256, 1, 1).data).slice(0, 3);
      x.fillStyle = '#181818'; x.fillRect(0, 0, resolution, resolution); x.fillStyle = '#fff'; x.fillRect(resolution * .4, resolution * .4, resolution * .2, resolution * .2); p.setSource(source); p.render(DEFAULT_PARAMS, 0); ctx.drawImage(c, 0, 0, 512, 512);
      const before = ctx.getImageData(0, 256, 512, 1).data;
      p.render(DEFAULT_PARAMS, 0, { look }); ctx.drawImage(c, 0, 0, 512, 512);
      const data = ctx.getImageData(0, 256, 512, 1).data; const halo = Array.from({ length: 51 }, (_, i) => data[(154 + i) * 4] - before[(154 + i) * 4]); const peak = Math.max(...halo); const half = halo.filter(v => v >= peak / 2 && v > 0).length;
      rows.push({ gray, center: Array.from(ctx.getImageData(256, 256, 1, 1).data).slice(0, 3), far: Array.from(ctx.getImageData(30, 30, 1, 1).data).slice(0, 3), peak, half });
    }
    return rows;
  });
  for (const row of rows) { expect(row.gray).toEqual([128, 128, 128]); expect(row.center).toEqual([255, 255, 255]); expect(row.far).toEqual([24, 24, 24]); expect(row.peak).toBeGreaterThan(1); expect(Math.abs(row.half - rows[0].half)).toBeLessThanOrEqual(2); }
});
