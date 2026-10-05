import { expect, test } from '@playwright/test';

test('switching sample during initial master loading releases the comparison button', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void; const request = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/samples/masters/portrait.png?*', async (route) => { requested(); await gate; await route.continue(); });
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '샘플 · 인물', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click(); await request;
  await page.getByRole('group', { name: '비교 사진 선택' }).getByRole('button', { name: '음식', exact: true }).click();
  release(); await expect(page.getByRole('button', { name: '색감 비교', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '색감 비교' })).toContainText('음식');
});

test('a pending replacement master disables application until the new source is ready', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void; const request = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/samples/masters/food.png?*', async (route) => { requested(); await gate; await route.continue(); });
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '색감 비교' }); await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeEnabled();
  await dialog.locator('summary').click(); await dialog.getByRole('button', { name: '음식', exact: true }).click(); await request;
  await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('준비');
  release(); await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeEnabled();
  await expect(dialog.locator('.comparison-source')).toContainText('음식');
});

test('failed uncached replacement master stays blocked with persistent retry', async ({ page }) => {
  let failed = false;
  await page.route('**/samples/masters/food.png?*', async (route) => { if (!failed) { failed = true; await route.abort(); } else await route.continue(); });
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '색감 비교' }); await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeEnabled();
  await dialog.locator('summary').click(); await dialog.getByRole('button', { name: '음식', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeDisabled();
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeEnabled();
  await expect(dialog.locator('.comparison-source')).toContainText('음식');
});

test('a favorite added while the sheet is open renders its newly mounted thumbnail', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  const item = page.locator('.sheet-item').filter({ has: page.getByText('ORIGINAL', { exact: true }) }).first();
  await item.dispatchEvent('pointerdown');
  await expect(item.locator('.fav-mark')).toBeVisible(); await item.dispatchEvent('pointerup');
  await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
  const canvas = page.locator('.sheet-scroll > div').filter({ has: page.locator('.sheet-group', { hasText: '즐겨찾기' }) }).locator('canvas');
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => [...node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data].some((value, i) => i % 4 === 3 && value > 0))).toBe(true);
});

test('short landscape opens with a useful comparison photo', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 }); await page.goto('/');
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '색감 비교' }); await expect(dialog.getByRole('button', { name: 'B 적용' })).toBeEnabled();
  const visiblePhoto = await dialog.evaluate((el) => {
    const photo = el.querySelector('.comparison-photo')!.getBoundingClientRect();
    const body = el.querySelector('.comparison-body')!.getBoundingClientRect();
    return Math.max(0, Math.min(photo.bottom, body.bottom) - Math.max(photo.top, body.top));
  });
  expect(visiblePhoto).toBeGreaterThanOrEqual(100);
});

test('short landscape Studio exposes a complete choice before scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 }); await page.goto('/');
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오' });
  const button = await studio.getByRole('button', { name: '즉석 정사각', exact: true }).boundingBox();
  const body = await studio.locator('.studio-body').boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(body!.y + body!.height);
});
