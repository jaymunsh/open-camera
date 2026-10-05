import { expect, test } from '@playwright/test';

test('memory paper colors and caption change only the frame, with legacy geometry preserved', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const path = '/src/capture/composite.ts';
    const { composeFrames } = await import(/* @vite-ignore */ path);
    const frame = document.createElement('canvas'); frame.width = frame.height = 100;
    const ctx = frame.getContext('2d')!; ctx.fillStyle = '#008000'; ctx.fillRect(0, 0, 100, 100);
    return ['cream', 'blush', 'black'].map((paper) => {
      const options = { layout: 'grid', frame: 'memory', paper };
      const base = composeFrames([frame, frame, frame, frame], 'booth', options);
      const caption = composeFrames([frame, frame, frame, frame], 'booth', { ...options, caption: '우리의 하루' });
      const a = base.getContext('2d')!, b = caption.getContext('2d')!;
      const before = a.getImageData(0, 212, 212, 28).data, after = b.getImageData(0, 212, 212, 28).data;
      let ink = 0; for (let i = 0; i < before.length; i += 4) if (before[i] !== after[i] || before[i + 1] !== after[i + 1]) ink++;
      const plain = composeFrames([frame, frame, frame, frame], 'booth', { ...options, frame: 'plain', caption: '우리의 하루' });
      const plainBase = composeFrames([frame, frame, frame, frame], 'booth', { ...options, frame: 'plain' });
      return { size: [caption.width, caption.height], paper: Array.from(b.getImageData(0, 0, 1, 1).data),
        photo: Array.from(b.getImageData(54, 54, 1, 1).data), ink, plainUnchanged: plain.toDataURL() === plainBase.toDataURL() };
    });
  });
  expect(results.map((r) => r.paper)).toEqual([[245, 237, 220, 255], [246, 226, 225, 255], [0, 0, 0, 255]]);
  for (const r of results) { expect(r.size).toEqual([212, 240]); expect(r.photo).toEqual([0, 128, 0, 255]); expect(r.ink).toBeGreaterThan(10); expect(r.plainUnchanged).toBe(true); }
});

test('Studio previews the actual frame and keeps customization through capture, save and reprocessing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await dialog.getByRole('button', { name: '메모리 2×2', exact: true }).click();
  const preview = dialog.getByRole('img', { name: '스튜디오 프레임 미리보기', exact: true });
  await expect(preview).toBeVisible();
  await dialog.getByRole('button', { name: '1:1', exact: true }).click();
  await dialog.getByRole('button', { name: '수동', exact: true }).click();
  await dialog.locator('summary').filter({ hasText: '프레임 꾸미기' }).click();
  await dialog.getByRole('button', { name: '크림', exact: true }).click();
  await dialog.getByLabel('프레임 문구', { exact: true }).fill('우리의 하루');
  await expect.poll(() => preview.evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(0, 0, 1, 1).data))).toEqual([245, 237, 220, 255]);
  const size = await preview.evaluate((c: HTMLCanvasElement) => [c.width, c.height]); expect(size[0] / size[1]).toBeCloseTo(212 / 240, 2);
  await dialog.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await dialog.getByLabel('원본도 보관').check();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: '촬영', exact: true }).click(); if (i < 3) await expect(page.locator('.capture-cell.complete')).toHaveCount(i + 1); }
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const photos = await page.locator('.capture-retakes canvas').evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()));
  await page.getByText('배치 · 여백', { exact: true }).click();
  await page.getByRole('button', { name: '연분홍', exact: true }).click(); await page.getByLabel('프레임 문구', { exact: true }).fill('다시 만난 날');
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  expect(await page.locator('.capture-retakes canvas').evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()))).toEqual(photos);
  await expect.poll(() => page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(0, 0, 1, 1).data))).toEqual([246, 226, 225, 255]);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
  await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); const r = (await listCaptures())[0]; return { options: r?.composition, originals: r?.originals.length }; })).toMatchObject({ options: { paper: 'blush', caption: '다시 만난 날', frame: 'memory' }, originals: 4 });
  await page.reload(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click();
  await page.getByRole('button', { name: '다시 현상', exact: true }).click(); await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  const reDownload = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await reDownload;
  await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); return (await listCaptures()).map((r: { composition: unknown }) => r.composition); })).toEqual([
    expect.objectContaining({ paper: 'blush', caption: '다시 만난 날', frame: 'memory' }), expect.objectContaining({ paper: 'blush', caption: '다시 만난 날', frame: 'memory' }),
  ]);
});

for (const seconds of [5, 10] as const) test(`automatic booth honors a ${seconds}-second cadence and locks it after the first shot`, async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('button', { name: '기본 2×2', exact: true }).click();
  await page.getByRole('button', { name: `${seconds}초`, exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  for (let i = 0; i < seconds - 2; i++) await page.clock.fastForward(1000);
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  for (let i = 0; i < 2; i++) await page.clock.fastForward(1000);
  await expect(page.locator('.capture-cell.complete')).toHaveCount(2);
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await expect(page.getByRole('button', { name: '10초', exact: true })).toBeDisabled();
  await page.clock.fastForward(11000); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(2); await page.getByRole('button', { name: '계속 촬영', exact: true }).click();
  for (let i = 0; i < seconds; i++) await page.clock.fastForward(1000);
  await expect(page.locator('.capture-cell.complete')).toHaveCount(3);
});

test('ten-second cadence and sample fallback are selectable without changing ordinary capture', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  await expect(page.getByText('예시 사진 · 촬영 결과는 선택한 필터에 따라 달라져요.', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole('img', { name: '스튜디오 프레임 미리보기', exact: true }).evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(300);
  await page.getByRole('button', { name: '메모리 스트립', exact: true }).click(); await page.getByRole('button', { name: '10초', exact: true }).click();
  await expect(page.getByRole('button', { name: '10초', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('dialog', { name: '스튜디오', exact: true }).getByRole('button', { name: '수동', exact: true }).click(); await expect(page.getByRole('button', { name: '10초', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await page.getByRole('button', { name: '일반', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await expect(page.locator('.capture-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '비율', exact: true })).toHaveText('3:4');
});
