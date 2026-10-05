import { test, expect } from '@playwright/test';

// Catches time-dependent grain, stale program locations and duplicate legacy grain.
test('new grain is seeded, achromatic on demand and lazy without changing legacy pixels', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { FilterPipeline } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { filmPixelHash, readFilmPixels, fixedLegacyRandom } = await load('/tests/fixtures/filmQualityRender.ts');
    const c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const restore = fixedLegacyRandom(); let p; try { p = new FilterPipeline(c); } finally { restore(); }
    const gl = c.getContext('webgl2')!; let programs = 0, uploads = 0;
    const create = gl.createProgram.bind(gl), upload = gl.texImage2D.bind(gl);
    gl.createProgram = () => { programs++; return create(); };
    (gl as any).texImage2D = (...args: any[]) => { uploads++; (upload as any)(...args); };
    const source = document.createElement('canvas'); source.width = 320; source.height = 240; source.getContext('2d')!.fillStyle = '#808080'; source.getContext('2d')!.fillRect(0, 0, 320, 240);
    p.setSource(source); p.render(DEFAULT_PARAMS, 0); const legacy = await filmPixelHash(c), legacyPrograms = programs;
    const q = { model: 'film-v2', grain: .6, size: .38, color: 0, shadows: .45, glow: 0, glowRadius: .35, seed: .25 };
    const look = { lens: 'none', lensAmount: 0, gentle: false, filmQuality: q };
    p.render(DEFAULT_PARAMS, 0, { look, time: 0 }); const first = await filmPixelHash(c), firstUploads = uploads;
    const gray = readFilmPixels(c); let grayDelta = 0; for (let i = 0; i < gray.length; i += 4) grayDelta = Math.max(grayDelta, Math.abs(gray[i] - gray[i+1]), Math.abs(gray[i] - gray[i+2]));
    p.render(DEFAULT_PARAMS, 0, { look, time: 100 }); const later = await filmPixelHash(c), repeatUploads = uploads;
    p.render(DEFAULT_PARAMS, 0, { look: { ...look, filmQuality: { ...q, seed: .75 } } }); const other = await filmPixelHash(c);
    p.render(DEFAULT_PARAMS, 0, { look: { ...look, filmQuality: { ...q, color: 1 } } }); const color = readFilmPixels(c); let colorDelta = 0; for (let i = 0; i < color.length; i += 4) colorDelta = Math.max(colorDelta, Math.abs(color[i] - color[i+1]));
    p.render({ ...DEFAULT_PARAMS, grain: .8 }, 0, { look: { ...look, filmQuality: { ...q, grain: 0 } } }); const zero = await filmPixelHash(c);
    p.render(DEFAULT_PARAMS, 0); const returned = await filmPixelHash(c);
    return { legacy, first, later, other, zero, returned, grayDelta, colorDelta, legacyPrograms, programs, firstUploads, repeatUploads, error: gl.getError() };
  });
  expect(r.first).not.toBe(r.legacy); expect(r.later).toBe(r.first); expect(r.other).not.toBe(r.first);
  expect(r.grayDelta).toBe(0); expect(r.colorDelta).toBeGreaterThan(0);
  expect(r.zero).toBe(r.legacy); expect(r.returned).toBe(r.legacy); expect(r.legacyPrograms).toBe(0); expect(r.programs).toBe(1);
  expect(r.repeatUploads).toBe(r.firstUploads); expect(r.error).toBe(0);
});

test('new noise tile has zero mean and separate deterministic channel streams', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const path = '/src/engine/filmGrain.ts'; let api;
    try { api = await import(/* @vite-ignore */ path); } catch { return { available: false }; }
    const a = api.filmGrainTile(.25), b = api.filmGrainTile(.25), other = api.filmGrainTile(.75);
    const means = [0, 1, 2, 3].map(channel => { let total = 0; for (let i = channel; i < a.length; i += 4) total += a[i]; return total / (a.length / 4); });
    let rejected = 0; for (const [seed, size] of [[1, 256], [NaN, 256], [.25, 0], [.25, 2048]]) try { api.filmGrainTile(seed, size); } catch { rejected++; }
    return { available: true, same: a.every((n: number, i: number) => n === b[i]), other: a.some((n: number, i: number) => n !== other[i]), independent: a.some((n: number, i: number) => i % 4 === 0 && n !== a[i+1]), means, rejected };
  });
  expect(r.available).toBe(true); if (!r.available) return;
  expect(r.same).toBe(true); expect(r.other).toBe(true); expect(r.independent).toBe(true);
  for (const mean of r.means) expect(Math.abs(mean - 127.5)).toBeLessThanOrEqual(1.5);
  expect(r.rejected).toBe(4);
});

test('new film texture restores exactly after GPU context loss', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { FilterPipeline } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { filmFixture, filmPixelHash } = await load('/tests/fixtures/filmQualityRender.ts');
    const c = document.createElement('canvas'); c.width = 320; c.height = 240; document.body.append(c);
    const p = new FilterPipeline(c), gl = c.getContext('webgl2')!, ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return null;
    const source = filmFixture('light'); const look = { lens: 'none', lensAmount: 0, gentle: false, filmQuality: { model: 'film-v2', grain: .5, size: .38, color: .2, shadows: .45, glow: .6, glowRadius: .7, seed: .25 } };
    const render = async () => { p.setSource(source); p.setLUT(null, null); p.render(DEFAULT_PARAMS, 0, { look }); return filmPixelHash(c); };
    p.setSource(source); p.render(DEFAULT_PARAMS, 0); const legacy = await filmPixelHash(c);
    const before = await render();
    const lost = new Promise<void>(resolve => c.addEventListener('webglcontextlost', () => resolve(), { once: true })); ext.loseContext(); await lost;
    const restored = new Promise<void>(resolve => c.addEventListener('webglcontextrestored', () => resolve(), { once: true })); await new Promise(resolve => setTimeout(resolve, 100)); ext.restoreContext(); await restored;
    const after = await render(); c.remove(); return { legacy, before, after, error: gl.getError() };
  });
  expect(r).not.toBeNull(); expect(r!.before).not.toBe(r!.legacy); expect(r!.before).toBe(r!.after); expect(r!.error).toBe(0);
});

// Catches a second mirror being applied to grain on an already-mirrored original.
test('mirrored capture and rendering its retained original produce the same film texture', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { renderFilteredCanvas } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { snapshotFrame } = await load('/src/capture/composite.ts'); const { filmFixture } = await load('/tests/fixtures/filmQualityRender.ts');
    // A uniform opaque photo isolates texture from the preserved legacy warp
    // texture's 8-bit neutral rounding at sharp source edges.
    const source = filmFixture('checker', 300, 240);
    const x = source.getContext('2d')!; x.fillStyle = '#808080'; x.fillRect(0, 0, source.width, source.height);
    const original = snapshotFrame(source, null, true);
    const look = { lens: 'none', lensAmount: 0, gentle: false, filmQuality: { model: 'film-v2', grain: .6, size: .38, color: .2, shadows: .45, glow: .2, glowRadius: .7, seed: .25 } };
    const capture = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0, true, null, null, null, undefined, null, [], undefined, look);
    const restored = await renderFilteredCanvas(original, DEFAULT_PARAMS, null, null, 0, false, null, null, null, undefined, null, [], undefined, look);
    const hash = async (c: HTMLCanvasElement) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data))).join(',');
    const a = capture.getContext('2d')!.getImageData(0, 0, capture.width, capture.height).data;
    const b = restored.getContext('2d')!.getImageData(0, 0, restored.width, restored.height).data;
    let maxDelta = 0, changed = 0; for (let i = 0; i < a.length; i++) { maxDelta = Math.max(maxDelta, Math.abs(a[i] - b[i])); if (a[i] !== b[i]) changed++; }
    return { capture: await hash(capture), restored: await hash(restored), maxDelta, changed };
  });
  expect(r.restored, JSON.stringify(r)).toBe(r.capture);
});
