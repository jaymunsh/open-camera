import { expect, test } from '@playwright/test';

test('frozen scene is independent, bounded and cropped/mirrored exactly once', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/source.ts'; const mod = await import(path).catch(() => null); if (!mod) return null;
    const input = document.createElement('canvas'); input.width = 2048; input.height = 1024;
    const ctx = input.getContext('2d')!; ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 1024, 1024); ctx.fillStyle = 'blue'; ctx.fillRect(1024, 0, 1024, 1024);
    const frozen = mod.freezePreviewSource({ source: input, kind: 'scene', label: '현재 장면', ratio: { w: 1, h: 1 }, mirror: true });
    ctx.fillStyle = 'green'; ctx.fillRect(0, 0, 2048, 1024);
    const fresh = mod.freezePreviewSource({ source: input, kind: 'scene', label: '새 장면', ratio: null, mirror: false });
    const pixel = [...frozen.canvas.getContext('2d')!.getImageData(20, 20, 1, 1).data];
    const dims = [frozen.canvas.width, frozen.canvas.height, fresh.canvas.width, fresh.canvas.height];
    const distinct = fresh.key !== frozen.key; frozen.release(); frozen.release(); fresh.release();
    return { pixel, dims, distinct, inputWidth: input.width };
  });
  expect(result).toEqual({ pixel: [0, 0, 255, 255], dims: [1024, 1024, 1024, 512], distinct: true, inputWidth: 2048 });
});

test('capture comparison rejects missing originals and invalid cuts, never uses result blob', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/source.ts'; const mod = await import(path).catch(() => null); if (!mod) return null;
    const c = document.createElement('canvas'); c.width = 40; c.height = 60; c.getContext('2d')!.fillRect(0, 0, 40, 60);
    const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!)));
    const record = { id: 'private', blob, originals: [] };
    const rejects = [];
    for (const [originals, index] of [[[], 0], [[blob], -1], [[blob], 1], [[blob], .5]] as [Blob[], number][]) {
      rejects.push(await mod.capturePreviewSource({ ...record, originals }, index).then(() => false, () => true));
    }
    const source = await mod.capturePreviewSource({ ...record, originals: [blob] }, 0);
    const dims = [source.canvas.width, source.canvas.height]; source.release();
    return { rejects, dims };
  });
  expect(result).toEqual({ rejects: [true, true, true, true], dims: [40, 60] });
});
