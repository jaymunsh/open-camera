import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Catches restoring only ref/state names when the entry LUT is already selected again.
test('cancel after reselecting the entry film restores its exact exported light-leak pixels', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles('public/samples/concepts/food.webp');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  const open = async () => {
    await page.getByRole('button', { name: '스튜디오', exact: true }).click();
    const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    await studio.getByRole('tab', { name: '효과', exact: true }).click();
    return studio;
  };
  let studio = await open();
  await studio.getByRole('button', { name: '바랜 컬러필름', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  const save = async () => {
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    return readFile((await (await pending).path())!);
  };
  const before = await save();
  studio = await open();
  await studio.getByRole('button', { name: '거친 흑백', exact: true }).click();
  await studio.getByRole('button', { name: '바랜 컬러필름', exact: true }).click();
  await studio.getByRole('button', { name: '변경 취소', exact: true }).click();
  expect((await save()).equals(before)).toBe(true);
});
