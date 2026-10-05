import { expect, test } from '@playwright/test';

test('single-shot instant frames preserve the photo with literal square and portrait paper geometry', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const path = '/src/capture/composite.ts'; const { composeFrames } = await import(/* @vite-ignore */ path);
    return [100, 133].map((height) => {
      const frame = document.createElement('canvas'); frame.width = 100; frame.height = height;
      frame.getContext('2d')!.fillStyle = '#008000'; frame.getContext('2d')!.fillRect(0, 0, 100, height);
      try {
        const c = composeFrames([frame], 'instant', { frame: 'memory', paper: 'cream', caption: '우리' });
        const ctx = c.getContext('2d')!;
        return { size: [c.width, c.height], paper: Array.from(ctx.getImageData(0, 0, 1, 1).data), photo: Array.from(ctx.getImageData(50, 50, 1, 1).data) };
      } catch { return null; }
    });
  });
  expect(results).toEqual([{ size: [114, 142], paper: [245, 237, 220, 255], photo: [0, 128, 0, 255] }, { size: [114, 175], paper: [245, 237, 220, 255], photo: [0, 128, 0, 255] }]);
});

for (const [format, ratio] of [['즉석 정사각', 114 / 142], ['즉석 세로', 114 / (100 * 4 / 3 + 42)]] as const) {
  test(`${format} takes one shot, retains its caption and original through saving and reprocessing`, async ({ page }) => {
    await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
    const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    await studio.getByRole('button', { name: format, exact: true }).click();
    await studio.getByRole('button', { name: '크림', exact: true }).click(); await studio.getByLabel('프레임 문구', { exact: true }).fill('오늘도 좋은 날');
    await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByLabel('원본도 보관').check();
    await studio.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page.locator('.capture-cell')).toHaveCount(1);
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]); expect(size[0] / size[1]).toBeCloseTo(ratio, 2);
    await page.getByLabel('프레임 문구', { exact: true }).fill('다시 만나요');
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
    await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); const r = (await listCaptures())[0]; return { mode: r?.mode, originals: r?.originals.length, composition: r?.composition }; })).toMatchObject({ mode: 'instant', originals: 1, composition: { caption: '다시 만나요', paper: 'cream', frame: 'memory' } });
    await page.reload(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click();
    await page.getByRole('button', { name: '다시 현상', exact: true }).click(); await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    const reDownload = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await reDownload;
    await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); return (await listCaptures()).map((r: { mode: string; width: number; height: number }) => ({ mode: r.mode, size: [r.width, r.height] })); })).toEqual([{ mode: 'instant', size }, { mode: 'instant', size }]);
  });
}

test('new studio films have distinct restrained color responses, without replacing legacy looks', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const path = '/src/engine/lut.ts'; const { PRESETS } = await import(/* @vite-ignore */ path);
    return ['studio-soft', 'studio-faded', 'studio-mono'].map((id) => {
      const preset = PRESETS.find((p: { id: string }) => p.id === id);
      if (!preset) return null;
      const lut = preset.build(); const sample = (r: number, g: number, b: number) => Array.from(lut.data.slice(((b * 33 + g) * 33 + r) * 3, ((b * 33 + g) * 33 + r) * 3 + 3));
      return { black: sample(0, 0, 0), white: sample(32, 32, 32), mid: sample(16, 16, 16), red: sample(24, 8, 8) };
    });
  });
  expect(results.every(Boolean)).toBe(true);
  const [soft, faded, mono] = results as { black: number[]; white: number[]; mid: number[]; red: number[] }[];
  expect(soft.mid[0]).toBeGreaterThan(soft.mid[2]); expect(soft.white[0]).toBeLessThan(255);
  expect(faded.black[0]).toBeGreaterThan(soft.black[0]);
  expect(mono.red[0]).toBe(mono.red[1]); expect(mono.red[1]).toBe(mono.red[2]);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '효과', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  const preview = studio.getByRole('img', { name: '스튜디오 프레임 미리보기', exact: true });
  await expect(preview).toBeVisible();
  await studio.getByRole('button', { name: '부드러운 즉석필름', exact: true }).click();
  await expect(studio.getByRole('button', { name: '부드러운 즉석필름', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const softImage = await preview.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await studio.getByRole('button', { name: '거친 흑백', exact: true }).click();
  await expect.poll(() => preview.evaluate((c: HTMLCanvasElement) => {
    const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let colored = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2]) colored++;
    return colored;
  })).toBe(0);
  expect(await preview.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(softImage);
  await studio.getByRole('button', { name: '부드러운 즉석필름', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click(); await expect(page.locator('.filter-name')).toHaveText('SOFT PRINT');
  await page.getByRole('button', { name: 'ORIGINAL', exact: true }).click(); await expect(page.locator('.filter-name')).toHaveText('ORIGINAL');
});
