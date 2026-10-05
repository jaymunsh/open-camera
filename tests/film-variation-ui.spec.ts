import { test, expect, type Page } from '@playwright/test';
async function effects(page: Page) {
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('tab', { name: '효과', exact: true }).click();
  const details = studio.locator('summary').filter({ hasText: '빈티지 패턴' }).locator('..');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  return studio;
}
test('film variation UI exposes opt-in additive controls and saves fixed recipes without stacking dialogs', async ({ page }) => {
  await page.goto('/'); const studio = await effects(page);
  const controls = studio.getByRole('group', { name: '빈티지 우연성', exact: true });
  await expect(controls.getByRole('button', { name: '꺼짐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await controls.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
  await expect(controls.getByLabel('추가 입자', { exact: true })).toHaveValue('0.2');
  await expect(controls).toContainText('0%는 추가 효과만 끕니다.');
  await controls.getByLabel('추가 입자', { exact: true }).fill('0.7');
  await controls.getByRole('button', { name: '이 패턴 고정', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-variation')!)); expect(saved.grain).toBe(.7); expect(saved.mode).toBe('fixed');
  await controls.getByRole('button', { name: '레시피 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1); await expect(studio).toHaveCount(0);
  await page.getByLabel('레시피 이름', { exact: true }).fill('고정 필름'); await page.getByRole('button', { name: '현재 설정 저장', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '카메라 레시피', exact: true }).click();
  await page.getByRole('button', { name: '고정 필름 적용', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-variation')!))).toEqual(saved);
});
test('film variation UI corrupt reset cancel preserves data and quota failure permits shooting', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-film-variation', '{bad'));
  await page.goto('/'); const studio = await effects(page);
  const controls = studio.getByRole('group', { name: '빈티지 우연성', exact: true });
  await expect(controls.getByRole('status')).toContainText('데이터는 보존');
  page.once('dialog', d => void d.dismiss()); await studio.getByRole('button', { name: '빈티지 설정 초기화', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('oc-film-variation'))).toBe('{bad');
  page.once('dialog', d => void d.accept()); await studio.getByRole('button', { name: '빈티지 설정 초기화', exact: true }).click();
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'oc-film-variation') throw new DOMException('full', 'QuotaExceededError'); original.call(this, key, value); }; });
  await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
  await expect(controls.getByRole('status').filter({ hasText: '빈티지 설정을 저장하지 못했어요.' })).toContainText('촬영은 가능');
  await studio.getByRole('button', { name: '닫기', exact: true }).click(); const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
});
test('film variation UI explains missing originals and locks patterns during booth capture', async ({ page }) => {
  await page.goto('/'); const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click();
  await expect(page.getByText('원본을 보관하지 않은 사진은 다시 현상할 수 없어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const studio = await effects(page); await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
  await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByRole('button', { name: '네 컷', exact: true }).click();
  await studio.getByRole('button', { name: '수동', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  const locked = await effects(page); await expect(locked.getByRole('button', { name: '다른 패턴', exact: true })).toBeDisabled();
  await expect(locked.getByLabel('추가 입자', { exact: true })).toBeDisabled();
});
test('film variation races preserve reprocess patterns until explicit reroll and keep the original record', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('oc-keep-original', '1'); localStorage.setItem('oc-film-variation', JSON.stringify({ version: 1, mode: 'new', grain: .2, leak: .15, dust: .1, color: .15, fixedSeed: .25 })); });
  await page.goto('/'); const studio = await effects(page); await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByRole('button', { name: '하프프레임', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled(); await page.getByRole('button', { name: '촬영', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
  const rows = () => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); return (await listCaptures()).map((r: any) => ({ id: r.id, patterns: r.framePatterns })); });
  await expect.poll(async () => (await rows()).length).toBe(1); const original = (await rows())[0];
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').first().click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  let saved = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await saved;
  await expect.poll(async () => (await rows()).length).toBe(2); expect((await rows())[0].patterns).toEqual(original.patterns);
  const editStudio = await effects(page); await expect(editStudio).toContainText('마지막 컷');
  for (let i = 0; i < 4; i++) await editStudio.getByRole('button', { name: '다른 패턴', exact: true }).click();
  await editStudio.getByRole('button', { name: '이 패턴 고정', exact: true }).click();
  const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-variation')!).fixedSeed);
  await editStudio.getByRole('button', { name: '닫기', exact: true }).click(); saved = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await saved;
  await expect.poll(async () => (await rows()).length).toBe(3); const results = await rows();
  expect(results[0].patterns).toEqual([{ version: 1, seed: chosen }, { version: 1, seed: chosen }]); expect(results.find((r: any) => r.id === original.id)).toEqual(original);
});
