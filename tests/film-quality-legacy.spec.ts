import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const baseline = JSON.parse(readFileSync(new URL('./fixtures/legacy-film-pixels.json', import.meta.url), 'utf8'));

// Catches any change to legacy source, uniforms, seeded textures or color LUTs.
test('legacy film pixels match the pre-change GPU baseline', async ({ page }) => {
  await page.goto('/');
  const hashes = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { FilterPipeline } = await load('/src/engine/pipeline.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { PRESETS, loadPresetLut } = await load('/src/engine/lut.ts');
    const { filmFixture, filmPixelHash, fixedLegacyRandom } = await load('/tests/fixtures/filmQualityRender.ts');
    const restore = fixedLegacyRandom(), canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    let pipe; try { pipe = new FilterPipeline(canvas); } finally { restore(); }
    const hashes: Record<string, string> = {};
    for (const kind of ['gradient', 'checker', 'light']) {
      pipe.setSource(filmFixture(kind));
      for (const id of ['none', 'film-fuji160c', 'vintage-disposable', 'studio-mono']) {
        pipe.setLUT(id, id === 'none' ? null : await loadPresetLut(id));
        pipe.render({ ...DEFAULT_PARAMS, exposure: .1, contrast: .05 }, id === 'none' ? 0 : 1, { time: 0, fx: { ...PRESETS.find((p: { id: string }) => p.id === id).fx, pattern: { version: 1, seed: .25 } } });
        hashes[`${kind}/${id}`] = await filmPixelHash(canvas);
      }
    }
    return hashes;
  });
  expect(hashes).toEqual(baseline.hashes);
});
