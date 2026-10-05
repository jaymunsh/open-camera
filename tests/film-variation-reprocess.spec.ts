import { test, expect } from '@playwright/test';
test('film variation reprocess restores frame-indexed patterns, null slots, and rejects bad metadata without erasing history', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { renderReprocessed } = await load('/src/capture/reprocess.ts');
    const { validateFramePatterns, makeFramePatterns } = await load('/src/capture/variation.ts');
    const { DEFAULT_VARIATION } = await load('/src/engine/variation.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const { listCaptures, saveCapture } = await load('/src/capture/store.ts');
    const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d')!.fillStyle = '#80906a'; c.getContext('2d')!.fillRect(0, 0, 96, 96);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    const settings = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, variation: { ...DEFAULT_VARIATION, mode: 'new', grain: 1, leak: 1, dust: 1, color: 1 } };
    const patterns = [{ version: 1, seed: .25 }, { version: 1, seed: .75 }];
    const record = { id: 'keep', createdAt: 1, blob, name: 'test.jpg', width: 192, height: 96, mode: 'half', originals: [blob, blob], settings, framePatterns: patterns };
    const image = async (record: any, options?: any) => (await renderReprocessed(record, settings, null, null, false, undefined, options)).toDataURL();
    const first = await image(record), repeat = await image(record), swapped = await image({ ...record, framePatterns: [...patterns].reverse() });
    const nullSlots = await image({ ...record, framePatterns: [null, null] });
    const legacy = await image({ ...record, framePatterns: undefined });
    let rejected = 0;
    for (const bad of [[patterns[0]], [{ version: 2, seed: .25 }, null], [null, { version: 1, seed: 1 }]]) { try { validateFramePatterns({ ...record, framePatterns: bad }); } catch { rejected++; } }
    await saveCapture({ ...record, framePatterns: [{ version: 2, seed: .25 }, null] });
    const abort = new AbortController(); abort.abort(); let aborted = false;
    try { await renderReprocessed(record, settings, null, null, false, abort.signal); } catch (e) { aborted = (e as Error).name === 'AbortError'; }
    return { equal: first === repeat, distinct: first !== swapped, nullLegacy: nullSlots === legacy, rejected, stored: (await listCaptures()).length, aborted, fixed: makeFramePatterns({ ...settings.variation, mode: 'fixed', fixedSeed: .25 }, 4), newSeeds: makeFramePatterns(settings.variation, 4).map((p: any) => p.seed), override: await image(record, { patterns: [null, null] }) === legacy };
  });
  expect(r.equal).toBe(true); expect(r.distinct).toBe(true); expect(r.nullLegacy).toBe(true); expect(r.override).toBe(true);
  expect(r.rejected).toBe(3); expect(r.stored).toBe(1); expect(r.aborted).toBe(true);
  expect(r.fixed).toEqual(Array(4).fill({ version: 1, seed: .25 })); expect(new Set(r.newSeeds).size).toBe(4);
});
