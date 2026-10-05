import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openTexture(page: Page) {
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click();
  const summary = studio.locator('summary').filter({ hasText: /^필름 질감/ }); await expect(summary).toBeVisible(); await summary.click(); return studio;
}

test('film texture controls are opt-in, preserve seed and expose inactive stored values honestly', async ({ page }) => {
  await page.goto('/'); const studio = await openTexture(page);
  await expect(studio.getByRole('button', { name: '기존 처리', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click();
  await studio.getByRole('button', { name: '거친', exact: true }).click(); await studio.getByLabel('입자 강도', { exact: true }).fill('0.4');
  await studio.locator('summary').filter({ hasText: /^세부 조정/ }).click();
  await studio.getByLabel('컬러 입자', { exact: true }).fill('0.2');
  const quality = () => page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-quality-v1')!).settings);
  expect(await quality()).toMatchObject({ model: 'film-v2', origin: 'manual', grain: .4, size: .85, color: .2, seed: .5 });
  await expect(studio.getByLabel('은은한 빈티지 질감', { exact: true })).toBeDisabled(); await expect(studio).toContainText('새 필름 처리에서는');
  await studio.getByRole('button', { name: '기존 처리', exact: true }).click(); expect(await quality()).toMatchObject({ model: 'legacy', grain: .4, size: .85, seed: .5 });
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '스튜디오', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.locator('.menu').getByRole('button', { name: '전체 설정 보기', exact: true }).click();
  const overview = page.getByRole('dialog', { name: '현재 설정', exact: true }); await overview.locator('summary').filter({ hasText: /^질감/ }).click();
  await expect(overview.locator('dt').filter({ hasText: /^필름 처리$/ }).locator('..').locator('dd')).toHaveText('기존 처리');
  await expect(overview.locator('dt').filter({ hasText: /^필름 입자 저장값$/ }).locator('..').locator('dd')).toContainText('40% · 현재 미사용');
  await expect(overview.locator('dt').filter({ hasText: /^유효 필름 입자$/ }).locator('..').locator('dd')).toHaveText('0%');
});

test('first cut locks every new texture writer and recipes remain inaccessible', async ({ page }) => {
  await page.goto('/'); let studio = await openTexture(page); await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click();
  await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByRole('button', { name: '하프프레임', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  const before = await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'));
  studio = await openTexture(page); const field = studio.getByRole('group', { name: '필름 처리', exact: true }); await expect(field).toHaveAttribute('disabled', '');
  for (const name of ['기존 처리', '새 필름 처리', '고운', '보통', '거친']) await expect(studio.getByRole('button', { name, exact: true })).toBeDisabled();
  await studio.locator('summary').filter({ hasText: /^세부 조정/ }).click();
  for (const name of ['입자 강도', '광원 번짐', '입자 크기', '컬러 입자', '암부 입자', '번짐 범위']) await expect(studio.getByLabel(name, { exact: true })).toBeDisabled();
  await studio.getByRole('button', { name: '거친', exact: true }).evaluate((el: HTMLButtonElement) => el.click());
  expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBe(before);
  await expect(studio.getByRole('button', { name: '효과 해제', exact: true })).toBeDisabled();
  await expect(studio.getByRole('button', { name: '변경 취소', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await expect(page.getByRole('button', { name: '카메라 레시피', exact: true })).toBeDisabled();
});

test('corrupt quality storage stays untouched while the controls remain usable for this session', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc-film-quality-v1', '{broken'));
  await page.goto('/'); const studio = await openTexture(page);
  await expect(studio).toContainText('이번 실행에서만'); await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click();
  await studio.getByLabel('입자 강도', { exact: true }).fill('0.6'); await expect(studio.getByLabel('입자 강도', { exact: true })).toHaveValue('0.6');
  expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBe('{broken');
});

test('an asynchronously loading recipe cannot bypass a newly acquired first-cut lock', async ({ page }) => {
  await page.addInitScript(() => {
    const params = { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, sharpen: 0, clarity: 0, fade: 0, vignette: 0, bloom: 0, grain: 0 };
    const beauty = { skin: 0, tone: 0, undereye: 0, spot: 0, spotRange: 1, face: 0, blush: 0, lip: 0, eyeclear: 0, eye: 0, slim: 0, nose: 0, head: 0 };
    localStorage.setItem('oc-recipes', JSON.stringify([{ version: 1, id: 'delayed', name: '지연 레시피', settings: { lutId: 'film-fuji160c', intensity: 1, params, beauty, ratioIdx: 2, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, filmQuality: { version: 1, model: 'film-v2', origin: 'manual', grain: .7, size: .38, color: 0, shadows: .45, glow: 0, glowRadius: .35, seed: .75 } } }]));
  });
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/luts/film/fuji160c.png*', async route => { const response = await route.fetch(); await hold; await route.fulfill({ response }); });
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await studio.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await studio.getByRole('button', { name: '하프프레임', exact: true }).click(); await studio.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '카메라 레시피', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: '카메라 레시피', exact: true }); await recipe.getByRole('button', { name: '지연 레시피 적용', exact: true }).click();
  await expect(recipe.getByRole('button', { name: '지연 레시피 적용', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '촬영', exact: true }).evaluate((el: HTMLButtonElement) => el.click()); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  release(); await expect(recipe.getByRole('alert')).toContainText('촬영 중에는');
  await expect(page.locator('.filter-name')).toHaveText('ORIGINAL'); expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBeNull();
});
