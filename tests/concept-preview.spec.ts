import { expect, test } from '@playwright/test';

test('seven source samples share thumbnails without changing the filter or camera stream', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).cameraCalls = 0;
    navigator.mediaDevices.getUserMedia = (...args) => { (window as any).cameraCalls++; return original(...args); };
  });
  await page.goto('/'); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  const initialCalls = await page.evaluate(() => (window as any).cameraCalls);
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await page.getByRole('button', { name: '샘플 · 인물', exact: true }).click();
  const picker = page.getByRole('group', { name: '비교 사진 선택' });
  await expect(picker.locator('.sample-choice')).toHaveCount(7);
  await picker.getByRole('button', { name: '음식', exact: true }).click();
  await expect(page.getByRole('button', { name: '샘플 · 음식', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.sheet-item canvas').first().evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe('data:,');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '샘플 · 음식', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('oc-preview-sample'))).toBe('food');
  expect(await page.evaluate(() => (window as any).cameraCalls)).toBe(initialCalls);
});
