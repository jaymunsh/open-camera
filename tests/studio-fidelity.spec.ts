import { expect, test } from '@playwright/test';

for (const beautyOn of [false, true]) test(`Studio crop and ${beautyOn ? 'beauty' : 'prism'} match the actual single-shot pipeline`, async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (beautyOn) => {
    const reactPath = '/node_modules/.vite/deps/react.js'; const { createElement } = (await import(/* @vite-ignore */ reactPath)).default;
    const domPath = '/node_modules/.vite/deps/react-dom_client.js'; const { createRoot } = (await import(/* @vite-ignore */ domPath)).default;
    const previewPath = '/src/components/StudioFramePreview.tsx'; const { StudioFramePreview } = await import(/* @vite-ignore */ previewPath);
    const pipelinePath = '/src/engine/pipeline.ts'; const { renderFilteredCanvas } = await import(/* @vite-ignore */ pipelinePath);
    const compositePath = '/src/capture/composite.ts'; const { composeFrames } = await import(/* @vite-ignore */ compositePath);
    const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
    const beautyPath = '/src/components/BeautyPanel.tsx'; const { DEFAULT_BEAUTY } = await import(/* @vite-ignore */ beautyPath);
    const source = document.createElement('canvas'); source.width = 256; source.height = 144;
    const ctx = source.getContext('2d')!;
    for (let i = 0; i < 256; i++) { ctx.fillStyle = i % 8 < 4 ? '#ff8040' : '#4050ff'; ctx.fillRect(i, 0, 1, 144); }
    const mask = document.createElement('canvas'); mask.width = 256; mask.height = 144; mask.getContext('2d')!.fillStyle = '#ff0000'; mask.getContext('2d')!.fillRect(0, 0, 256, 144);
    const inputs = { mirror: false, mask: beautyOn ? mask : null, beauty: { ...DEFAULT_BEAUTY, tone: beautyOn ? .7 : 0 }, warp: null, eyes: [] };
    const look = { lens: beautyOn ? 'none' : 'prism', lensAmount: 1, gentle: false };
    const ratio = { w: 3, h: 4 }, options = { blend: 'average', mix: .5, layout: 'grid', paper: 'white' };
    const frame = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0, false, ratio, null, inputs.mask, inputs.beauty, null, [], undefined, look);
    const expected = composeFrames([frame], 'instant', options);
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    root.render(createElement(StudioFramePreview, { source, frames: [], options, ratio, mode: 'instant', params: DEFAULT_PARAMS, lut: null, lutKey: null, amount: 0, fx: null, look, ready: true, inputs }));
    let actual: HTMLCanvasElement | null = null;
    for (let i = 0; i < 100; i++) { await new Promise((resolve) => setTimeout(resolve, 20)); const c = host.querySelector('canvas'); if (c && !c.hidden && c.width === 124 && c.height === 160) { actual = c; break; } }
    const a = actual?.getContext('2d')!.getImageData(0, 0, 124, 160).data;
    const b = expected.getContext('2d')!.getImageData(0, 0, 124, 160).data;
    let differentPixels = 0; if (a) for (let i = 0; i < b.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) differentPixels++;
    const result = { size: actual ? [actual.width, actual.height] : null, differentPixels };
    root.unmount(); host.remove(); return result;
  }, beautyOn);
  expect(result).toEqual({ size: [124, 160], differentPixels: 0 });
});

test('memory caption ink is preserved when date is on, and empty-caption stamps keep legacy placement', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const compositePath = '/src/capture/composite.ts'; const { composeFrames } = await import(/* @vite-ignore */ compositePath);
    const reprocessPath = '/src/capture/reprocess.ts'; const { renderReprocessed } = await import(/* @vite-ignore */ reprocessPath);
    const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
    const beautyPath = '/src/components/BeautyPanel.tsx'; const { DEFAULT_BEAUTY } = await import(/* @vite-ignore */ beautyPath);
    const pipelinePath = '/src/engine/pipeline.ts'; const { drawDateStamp } = await import(/* @vite-ignore */ pipelinePath);
    const frame = document.createElement('canvas'); frame.width = frame.height = 1000; frame.getContext('2d')!.fillStyle = '#777'; frame.getContext('2d')!.fillRect(0, 0, 1000, 1000);
    const original = await new Promise<Blob>((resolve) => frame.toBlob((b) => resolve(b!), 'image/png'));
    const composition = { blend: 'average', mix: .5, layout: 'grid', paper: 'white', frame: 'memory', caption: 'M'.repeat(32) };
    const settings = { lutId: 'none', intensity: 0, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'on', fmt: 'iso', size: 'md', orient: 'p', style: 'amber' } };
    const record = { id: 'caption', createdAt: 1780617600000, blob: original, originals: [original, original, original, original], name: 'a.jpg', width: 2048, height: 2048, mode: 'booth', composition };
    const plain = await renderReprocessed(record, settings, null, null, false);
    const stamped = await renderReprocessed(record, settings, null, null, true);
    const a = plain.getContext('2d')!.getImageData(0, Math.floor(plain.height * .9), plain.width, Math.floor(plain.height * .1)).data;
    const b = stamped.getContext('2d')!.getImageData(0, Math.floor(plain.height * .9), plain.width, Math.floor(plain.height * .1)).data;
    let changedInk = 0; for (let i = 0; i < a.length; i += 4) if (a[i] < 100 && (a[i] !== b[i] || a[i + 1] !== b[i + 1])) changedInk++;
    const legacyRecord = { ...record, composition: { ...composition, caption: '' } };
    const legacy = await renderReprocessed(legacyRecord, settings, null, null, true);
    const expected = await renderReprocessed(legacyRecord, settings, null, null, false); await drawDateStamp(expected, { ...settings.date, on: true, timestamp: record.createdAt });
    return { changedInk, legacySame: legacy.toDataURL() === expected.toDataURL(), stampChanged: plain.toDataURL() !== stamped.toDataURL() };
  });
  expect(result).toEqual({ changedInk: 0, legacySame: true, stampChanged: true });
});
