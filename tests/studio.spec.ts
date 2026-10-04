import { expect, test } from '@playwright/test';

test('new booth frames add literal footer, horizontal and film geometry without changing legacy frames', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/capture/composite.ts';
    const { composeFrames } = await import(/* @vite-ignore */ path);
    const frames = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'].map((color) => {
      const c = document.createElement('canvas'); c.width = c.height = 100;
      const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 100, 100); return c;
    });
    const centers = [[[54, 54], [158, 54], [54, 158], [158, 158]], [[54, 54], [54, 158], [54, 262], [54, 366]],
      [[54, 54], [158, 54], [54, 158], [158, 158]], [[54, 54], [54, 158], [54, 262], [54, 366]],
      [[54, 54], [158, 54], [262, 54], [366, 54]], [[62, 54], [62, 158], [62, 262], [62, 366]]];
    return [{ layout: 'grid' }, { layout: 'strip' }, { layout: 'grid', frame: 'memory' },
      { layout: 'strip', frame: 'memory' }, { layout: 'row' }, { layout: 'strip', frame: 'film', paper: 'black' }].map((options, index) => {
      const c = composeFrames(frames, 'booth', options);
      const ctx = c.getContext('2d')!;
      return { size: [c.width, c.height], bottom: Array.from(ctx.getImageData(c.width / 2, c.height - 10, 1, 1).data),
        colors: centers[index].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data)), hole: Array.from(ctx.getImageData(6, 8, 1, 1).data) };
    });
  });
  expect(result.map((r) => r.size)).toEqual([[212, 212], [108, 420], [212, 240], [108, 448], [420, 108], [124, 420]]);
  expect(result[2].bottom).toEqual([255, 255, 255, 255]);
  expect(result[3].bottom).toEqual([255, 255, 255, 255]);
  for (const frame of result) expect(frame.colors).toEqual([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255]]);
  expect(result[5].hole).toEqual([255, 255, 255, 255]);
});

test('Studio is a primary dock entry with six templates and explicit shooting controls', async ({ page }) => {
  await page.goto('/');
  const studio = page.getByRole('button', { name: '스튜디오', exact: true });
  await expect(studio).toBeVisible(); await studio.click();
  const dialog = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: '템플릿', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('.template-choice')).toHaveCount(6);
  await dialog.getByRole('button', { name: '메모리 2×2', exact: true }).click();
  await dialog.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '네 컷', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '수동', exact: true }).click();
  await page.getByLabel('원본도 보관').check();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.capture-cell')).toHaveCount(4);
  const frame = (await page.locator('.capture-frame').boundingBox())!;
  expect(frame.width / frame.height).toBeCloseTo(2.12 / (2 * 4 / 3 + .12 + .28), 2);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    if (i < 3) await expect(page.locator('.capture-cell.complete')).toHaveCount(i + 1);
  }
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const before = await page.locator('.capture-retakes canvas').evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()));
  await page.getByText('배치 · 여백', { exact: true }).click();
  await page.getByRole('button', { name: '가로 네 컷', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[0] / size[1]).toBeCloseTo(4.2 / (4 / 3 + .08), 1);
  expect(await page.locator('.capture-retakes canvas').evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()))).toEqual(before);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
  const thumb = page.getByRole('button', { name: '최근 촬영 열기', exact: true });
  await expect(thumb.locator('img')).toBeVisible();
  expect(await thumb.evaluate((el) => !!el.closest('header'))).toBe(true);
  const t = (await thumb.boundingBox())!, r = (await page.getByRole('button', { name: '비율', exact: true }).boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(r.x);
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path);
    const records = await listCaptures(); return records[0]?.originals.length;
  })).toBe(4);
  await page.reload(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click();
  await page.locator('.history-photo').first().click();
  const originalSize = await page.locator('.history-large').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
  await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  const reDownload = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await reDownload;
  const records = await page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path);
    return (await listCaptures()).map((r: { width: number; height: number; composition: unknown }) => ({ size: [r.width, r.height], composition: r.composition }));
  });
  expect(records).toHaveLength(2);
  for (const r of records) { expect(r.size).toEqual(originalSize); expect(r.composition).toMatchObject({ layout: 'row', frame: 'plain' }); }
});

test('template diagrams use the independent booth ratio, not the ordinary camera ratio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '비율', exact: true }).click();
  await page.getByRole('button', { name: '비율', exact: true }).click();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('1:1');
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const basic = page.getByRole('button', { name: '기본 2×2', exact: true });
  await expect(basic.locator('svg')).toHaveAttribute('viewBox', '0 0 636 836');
});

test('reselecting a film frame preserves its chosen paper color', async ({ page }) => {
  await page.goto('/');
  const color = await page.evaluate(async () => {
    const path = '/src/capture/templates.ts'; const { applyTemplate, BOOTH_TEMPLATES } = await import(/* @vite-ignore */ path);
    return applyTemplate({ blend: 'average', mix: .5, layout: 'strip', frame: 'film', paper: 'white' }, BOOTH_TEMPLATES[5]).paper;
  });
  expect(color).toBe('white');
});

test('Studio pauses automatic capture and declining a mode change keeps the original cut and layout', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await page.getByRole('button', { name: '메모리 2×2', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '수동', exact: true })).toBeDisabled();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '하프프레임', exact: true }).click();
  await expect(page.getByRole('button', { name: '네 컷', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '템플릿', exact: true }).click();
  await expect(page.getByRole('button', { name: '메모리 2×2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '계속 촬영', exact: true })).toBeVisible();
});

test('Studio keyboard tabs switch panels and focus stays inside the dialog', async ({ page }) => {
  await page.goto('/'); const entry = page.getByRole('button', { name: '스튜디오', exact: true }); await entry.click();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('tab', { name: '템플릿', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: '촬영 모드', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(page.getByRole('tab', { name: '효과', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: '빛줄기', exact: true })).toBeVisible();
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(entry).toBeFocused();
});
