import { expect, test } from '@playwright/test';

test('opt-in capture degradation removes fine detail without changing size or input and skips at zero', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const pipelinePath = '/src/engine/pipeline.ts'; const { renderFilteredCanvas } = await import(/* @vite-ignore */ pipelinePath);
    const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
    const source = document.createElement('canvas'); source.width = 2400; source.height = 600;
    const ctx = source.getContext('2d')!;
    for (let x = 0; x < 2400; x++) { ctx.fillStyle = Math.floor(x / 2) % 2 ? '#ddd' : '#333'; ctx.fillRect(x, 0, 1, 600); }
    const before = source.toDataURL();
    const normal = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0);
    const zero = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0, false, null, { degrade: 0 });
    const low = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0, false, null, { degrade: 1 });
    const detail = (c: HTMLCanvasElement) => {
      const a = c.getContext('2d')!.getImageData(0, 300, 2400, 1).data;
      let sum = 0; for (let i = 4; i < a.length; i += 4) sum += Math.abs(a[i] - a[i - 4]);
      return sum / 2399;
    };
    return { size: [low.width, low.height], zeroSame: zero.toDataURL() === normal.toDataURL(), sourceSame: before === source.toDataURL(), normal: detail(normal), low: detail(low) };
  });
  expect(result.size).toEqual([2400, 600]);
  expect(result.zeroSame).toBe(true); expect(result.sourceSame).toBe(true);
  expect(result.normal).toBeGreaterThan(20);
  // Intentional loss of detail, not a mandated blur radius or exact codec output.
  expect(result.low).toBeLessThan(result.normal * .5);
});

test('three new vintage filters have independent color and texture profiles alongside existing filters', async ({ page }) => {
  await page.goto('/');
  const rows = await page.evaluate(async () => {
    const path = '/src/engine/lut.ts'; const { PRESETS } = await import(/* @vite-ignore */ path);
    return ['vintage-ccd', 'vintage-disposable', 'vintage-print'].map((id) => {
      const p = PRESETS.find((p: { id: string }) => p.id === id);
      if (!p) return null;
      const lut = p.build(), idx = ((16 * 33 + 16) * 33 + 16) * 3;
      const redIdx = ((8 * 33 + 8) * 33 + 24) * 3;
      return { id, group: p.group, mid: Array.from(lut.data.slice(idx, idx + 3)), color: Array.from(lut.data.slice(redIdx, redIdx + 3)), black: Array.from(lut.data.slice(0, 3)), fx: p.fx };
    });
  });
  expect(rows.every(Boolean)).toBe(true);
  expect(new Set(rows.map((p: any) => JSON.stringify([p.color, p.black]))).size).toBe(3);
  expect(rows[0].fx.degrade).toBeGreaterThan(rows[1].fx.degrade);
  expect(rows[1].fx.grain).toBeGreaterThan(rows[2].fx.grain);
  expect(rows[2].mid.every((v: number) => v > 100 && v < 180)).toBe(true);
});

test('whole-look zero skips the new loss of detail, and concurrent encodes keep separate photos', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const pipelinePath = '/src/engine/pipeline.ts'; const { renderFilteredCanvas } = await import(/* @vite-ignore */ pipelinePath);
    const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
    const lutPath = '/src/engine/lut.ts'; const { PRESETS } = await import(/* @vite-ignore */ lutPath);
    const lookPath = '/src/engine/look.ts'; const { deriveFx } = await import(/* @vite-ignore */ lookPath);
    const source = (color: string) => { const c = document.createElement('canvas'); c.width = c.height = 160; const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 160, 160); return c; };
    const red = source('#ff0000'), blue = source('#0000ff');
    const p = PRESETS.find((p: { id: string }) => p.id === 'vintage-ccd');
    const fx = deriveFx(p.fx, 0, 'whole', false);
    const zero = await renderFilteredCanvas(red, DEFAULT_PARAMS, null, null, 0, false, null, fx);
    const normal = await renderFilteredCanvas(red, DEFAULT_PARAMS, null, null, 0);
    const frames = await Promise.all([red, blue].map((c) => renderFilteredCanvas(c, DEFAULT_PARAMS, null, null, 0, false, null, { degrade: 1 })));
    return { zeroSame: zero.toDataURL() === normal.toDataURL(), pixels: frames.map((c) => Array.from(c.getContext('2d')!.getImageData(80, 80, 1, 1).data).slice(0, 3)) };
  });
  expect(result.zeroSame).toBe(true);
  expect(result.pixels[0][0]).toBeGreaterThan(240); expect(result.pixels[0][2]).toBeLessThan(10);
  expect(result.pixels[1][2]).toBeGreaterThan(240); expect(result.pixels[1][0]).toBeLessThan(10);
});

test('vintage group can be selected, captured and restored for reprocessing without replacing originals', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await page.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await page.getByLabel('원본도 보관').check();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await expect(page.locator('.sheet-tabs').getByRole('button', { name: '빈티지 질감', exact: true })).toBeVisible();
  await page.locator('.sheet-item').filter({ hasText: '구형 디지캠' }).click();
  await expect(page.locator('.filter-name')).toHaveText('구형 디지캠');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path);
    const r = (await listCaptures())[0]; return { filter: r?.settings?.lutId, originals: r?.originals.length };
  })).toEqual({ filter: 'vintage-ccd', originals: 1 });
  await page.reload();
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click();
  await page.locator('.history-photo').first().click();
  await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('구형 디지캠');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'ORIGINAL', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('ORIGINAL');
});
