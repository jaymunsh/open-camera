import { expect, test, type Page } from '@playwright/test';

async function openEffects(page: Page) {
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('tab', { name: '효과', exact: true }).click();
  return studio;
}
async function currentSettings(page: Page) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '카메라 레시피', exact: true }).click();
  await page.getByLabel('레시피 이름', { exact: true }).fill('검증용 현재 설정');
  await page.getByRole('button', { name: '현재 설정 저장', exact: true }).click();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('oc-recipes')!)[0].settings);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  return settings;
}
async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('oc-keep-original', '1'));
  await page.goto('/');
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const settings = { lutId: 'studio-faded', intensity: .63, params: { ...DEFAULT_PARAMS, exposure: .2 }, beauty: { ...DEFAULT_BEAUTY, skin: .2 },
      ratioIdx: 0, grainOff: true, strengthMode: 'whole', gentle: true, lens: 'star', lensAmount: .3,
      variation: { version: 1, mode: 'fixed', grain: .4, leak: .2, dust: .1, color: .3, fixedSeed: .25 },
      date: { mode: 'on', fmt: 'iso', size: 'sm', orient: 'p', style: 'red' } };
    localStorage.setItem('oc-recipes', JSON.stringify([{ version: 1, id: 'base', name: '검증 기준', settings }]));
  });
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '카메라 레시피', exact: true }).click();
  await page.getByRole('button', { name: '검증 기준 적용', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('FADED COLOR');
  return currentSettings(page);
}

// Catches cancellation that merely closes, resets defaults, or restores unrelated settings.
test('cancel restores entry effects and seeds while keeping a newly chosen template', async ({ page }) => {
  const before = await prepare(page);
  const studio = await openEffects(page);
  await expect(studio.getByRole('button', { name: '변경 취소', exact: true })).toBeVisible();
  await studio.getByRole('button', { name: '부드러운 즉석필름', exact: true }).click();
  await studio.getByRole('button', { name: '색상만', exact: true }).click();
  await studio.getByLabel('은은한 빈티지 질감', { exact: true }).uncheck();
  await studio.getByRole('button', { name: '가장자리 굴절', exact: true }).click();
  await studio.getByLabel('렌즈 강도', { exact: true }).fill('0.8');
  const patterns = studio.locator('summary').filter({ hasText: '빈티지 패턴' }).locator('..');
  if (await patterns.getAttribute('open') === null) await patterns.locator('summary').click();
  await studio.getByRole('button', { name: '다른 패턴', exact: true }).click();
  await studio.getByRole('tab', { name: '템플릿', exact: true }).click();
  await studio.getByRole('button', { name: '즉석 세로', exact: true }).click();
  await studio.getByRole('tab', { name: '효과', exact: true }).click();
  await studio.getByRole('button', { name: '변경 취소', exact: true }).click();
  await expect(studio).toHaveCount(0);
  await expect(page.locator('.filter-name')).toHaveText('FADED COLOR');
  expect(await currentSettings(page)).toEqual(before);
  const reopened = await openEffects(page);
  await reopened.getByRole('tab', { name: '템플릿', exact: true }).click();
  await expect(reopened.getByRole('button', { name: '즉석 세로', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

// Catches destructive global resets and an incomplete effect-off implementation.
test('effect off removes film lens and variation without touching adjustments beauty date or original retention', async ({ page }) => {
  const before = await prepare(page);
  const studio = await openEffects(page);
  await studio.getByRole('button', { name: '효과 해제', exact: true }).click();
  await expect(studio).toBeVisible();
  await expect(studio.getByRole('button', { name: '원본 · 필름 없음', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  const after = await currentSettings(page);
  expect(after).toMatchObject({ lutId: 'none', lens: 'none', gentle: false, variation: { mode: 'off' } });
  expect(after.params).toEqual(before.params); expect(after.beauty).toEqual(before.beauty);
  expect(after.date).toEqual(before.date); expect(after.ratioIdx).toBe(before.ratioIdx);
  const check = await openEffects(page);
  await check.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await expect(check.getByLabel('원본도 보관')).toBeChecked();
});

test('film none removes only the film and closing retains changes, while the next cancel uses the new entry state', async ({ page }) => {
  const before = await prepare(page);
  let studio = await openEffects(page);
  await studio.getByRole('button', { name: '원본 · 필름 없음', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  const cleared = await currentSettings(page);
  expect(cleared).toEqual({ ...before, lutId: 'none' });
  studio = await openEffects(page);
  await studio.getByRole('button', { name: '거친 흑백', exact: true }).click();
  await studio.getByRole('button', { name: '변경 취소', exact: true }).click();
  expect(await currentSettings(page)).toEqual(cleared);
});

test('effect actions are locked after the first booth cut without discarding it', async ({ page }) => {
  await page.goto('/'); let studio = await openEffects(page);
  await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await studio.getByRole('button', { name: '네 컷', exact: true }).click();
  await studio.getByRole('button', { name: '수동', exact: true }).click();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  studio = await openEffects(page);
  for (const name of ['변경 취소', '효과 해제', '원본 · 필름 없음']) await expect(studio.getByRole('button', { name, exact: true })).toBeDisabled();
  await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
});

// Real stored originals/patterns expose frame-indexed rollback bugs a live-only test misses.
test('cancel restores mixed per-frame patterns during reprocessing and leaves history untouched', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx');
    const { saveCapture } = await load('/src/capture/store.ts');
    const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d')!.fillStyle = '#80906a'; c.getContext('2d')!.fillRect(0, 0, 96, 96);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    const settings = { lutId: 'none', intensity: .63, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5,
      date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, variation: { version: 1, mode: 'new', grain: .2, leak: .15, dust: .1, color: .15, fixedSeed: .5 } };
    await saveCapture({ id: 'cancel-original', createdAt: 1, name: 'cancel.jpg', blob, width: 192, height: 96, mode: 'half', originals: [blob, blob], settings,
      frameSettings: [settings, { ...settings, variation: { ...settings.variation, mode: 'off' } }], framePatterns: [{ version: 1, seed: .25 }, null] });
  });
  await page.reload(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click();
  await page.locator('.history-photo').first().click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  const studio = await openEffects(page);
  await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
  await studio.getByRole('button', { name: '다른 패턴', exact: true }).click();
  await studio.getByRole('button', { name: '부드러운 즉석필름', exact: true }).click();
  await studio.getByRole('button', { name: '변경 취소', exact: true }).click();
  const saved = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await saved;
  const rows = await page.evaluate(async () => { const path = '/src/capture/store.ts'; return (await (await import(/* @vite-ignore */ path)).listCaptures()).map((r: any) => ({ id: r.id, patterns: r.framePatterns, settings: r.frameSettings })); });
  expect(rows).toHaveLength(2);
  for (const row of rows) { expect(row.patterns).toEqual([{ version: 1, seed: .25 }, null]); expect(row.settings[0].variation.mode).toBe('new'); expect(row.settings[1].variation.mode).toBe('off'); }
});
