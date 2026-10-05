import { test, expect } from '@playwright/test';

test('same-ID thumbnails invalidate on quality values, seed and profile identity', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/components/thumbs.ts'; const { renderPresetThumbs } = await import(path);
    const qualityPath = '/src/engine/filmQuality.ts'; const { DEFAULT_FILM_QUALITY } = await import(qualityPath);
    const src = document.createElement('canvas'); src.width = src.height = 128; const ctx = src.getContext('2d')!; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 128, 128);
    const out = document.createElement('canvas'); out.width = out.height = 128; document.body.append(out);
    const refs = new Map([[out, 'none']]);
    const render = async (quality: any) => { await renderPresetThumbs(refs, [{ id: 'none', filmQuality: quality }], src, () => false, { source: src, srcKey: 'quality-fixture' }); return out.toDataURL(); };
    const quality = { ...DEFAULT_FILM_QUALITY, model: 'film-v2', grain: .2, glow: 0 };
    const a = await render(quality), b = await render({ ...quality, grain: .7 }), c = await render({ ...quality, seed: .25 }), restored = await render(quality);
    const profile = { ...quality, origin: 'profile', profile: { id: 'signature-portrait-v1', version: 1 } };
    const p1 = await render(profile); ctx.fillStyle = '#404040'; ctx.fillRect(0, 0, 128, 128);
    const p2 = await render({ ...profile, profile: { id: 'signature-cafe-v1', version: 1 } });
    return { changed: a !== b, seedChanged: a !== c, restored: a === restored, profileChanged: p1 !== p2 };
  });
  expect(result).toEqual({ changed: true, seedChanged: true, restored: true, profileChanged: true });
});
