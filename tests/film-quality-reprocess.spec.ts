import { test, expect } from '@playwright/test';

// Catches missing quality in reprocess and using the last seed for every cut.
test('reprocessing uses current texture with retained per-frame seeds and rejects corrupt metadata', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { DEFAULT_FILM_QUALITY, FilmQualityError, resolveFilmQuality } = await load('/src/engine/filmQuality.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const { renderReprocessed } = await load('/src/capture/reprocess.ts'); const { renderFilteredCanvas } = await load('/src/engine/pipeline.ts');
    const { composeFrames } = await load('/src/capture/composite.ts'); const { saveCapture, listCaptures } = await load('/src/capture/store.ts');
    const source = document.createElement('canvas'); source.width = source.height = 128; source.getContext('2d')!.fillStyle = '#808080'; source.getContext('2d')!.fillRect(0, 0, 128, 128);
    const blob = await new Promise<Blob>(resolve => source.toBlob(b => resolve(b!)));
    const q = { ...DEFAULT_FILM_QUALITY, model: 'film-v2', grain: .5, glow: 0, seed: .25 };
    const settings = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, filmQuality: q };
    const record = { id: 'quality-keep', createdAt: 1, blob, name: 'keep.png', width: 256, height: 128, mode: 'half', originals: [blob, blob], settings, frameSettings: [settings, { ...settings, filmQuality: { ...q, seed: .75 } }] };
    await saveCapture(record); const before = (await listCaptures()).length;
    const processed = await renderReprocessed(record, settings, null, null, false);
    const direct = [];
    for (const seed of [.25, .75]) {
      const quality = resolveFilmQuality({ ...q, seed }, { params: DEFAULT_PARAMS, fx: null, intensity: 1, strengthMode: 'color', grainOff: false, pattern: null });
      direct.push(await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0, false, null, null, null, undefined, null, [], undefined, { lens: 'none', lensAmount: .5, gentle: false, filmQuality: quality }));
    }
    const hash = async (c: HTMLCanvasElement) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data))).join(',');
    let rejected = 0;
    for (const bad of [{ ...record, settings: { ...settings, filmQuality: { ...q, version: 2 } } }, { ...record, frameSettings: [{ ...settings, filmQuality: { ...q, seed: 1 } }, settings] }, { ...record, settings: { ...settings, lutId: 'signature-portrait-v1', filmQuality: undefined } }]) {
      try { await renderReprocessed(bad, settings, null, null, false); } catch (e) { if (e instanceof FilmQualityError) rejected++; }
    }
    return { actual: await hash(processed), direct: await hash(composeFrames(direct, 'half', {})), distinct: await hash(direct[0]) !== await hash(direct[1]), rejected, before, after: (await listCaptures()).length };
  });
  expect(r.actual).toBe(r.direct); expect(r.distinct).toBe(true); expect(r.rejected).toBe(3); expect(r.after).toBe(r.before);
});
