import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const quality = { version: 1, model: 'film-v2', origin: 'manual', grain: .4, size: .38, color: .08, shadows: .45, glow: .1, glowRadius: .35, seed: .5 };
async function studio(page: Page) {
  await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '스튜디오', exact: true });
  await dialog.getByRole('tab', { name: '효과', exact: true }).click(); return dialog;
}
async function overview(page: Page) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.locator('.menu').getByRole('button', { name: '전체 설정 보기', exact: true }).click();
  return page.getByRole('dialog', { name: '현재 설정', exact: true });
}

test('collapsed texture summary names active grain', async ({ page }) => {
  await page.addInitScript(q => localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: q })), quality);
  await page.goto('/'); const dialog = await overview(page);
  await expect(dialog.locator('summary').filter({ hasText: /^질감/ })).toContainText('입자 40%');
});
test('selected texture labels meet text contrast', async ({ page }) => {
  await page.addInitScript(q => localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: q })), quality);
  await page.goto('/'); const s = await studio(page);
  await s.locator('summary').filter({ hasText: /^필름 질감/ }).click();
  const contrast = await s.getByRole('button', { name: '새 필름 처리', exact: true }).evaluate(el => {
    const style = getComputedStyle(el);
    const luminance = (color: string) => { const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
    const a = luminance(style.color), b = luminance(style.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }); expect(contrast).toBeGreaterThanOrEqual(4.5);
});

for (const action of ['변경 취소', '효과 해제'] as const) test(`pending texture source is discarded after ${action}`, async ({ page }) => {
  let release!: () => void, requested!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), request = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/samples/masters/portrait.png?*', async route => { requested(); await gate; await route.continue(); });
  await page.goto('/'); const s = await studio(page); await s.locator('summary').filter({ hasText: /^필름 질감/ }).click();
  await s.getByRole('button', { name: '새 필름 처리', exact: true }).click(); await s.getByRole('button', { name: '질감 비교', exact: true }).click(); await request;
  await s.getByRole('button', { name: action, exact: true }).click();
  const response = page.waitForResponse(r => r.url().includes('/samples/masters/portrait.png')); release(); await response;
  // Wait for the pending consumer itself, rather than only the network request.
  await expect(s.getByRole('status').filter({ hasText: '비교 사진 준비' })).toHaveCount(0);
  if (action === '변경 취소') await expect(s).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '질감 비교', exact: true })).toHaveCount(0);
});

test('half-frame locks variation and strength inputs without locking ordinary color selection', async ({ page }) => {
  await page.addInitScript(q => localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: q })), quality);
  await page.goto('/'); let s = await studio(page);
  await s.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await s.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  s = await studio(page); await expect(s.getByRole('button', { name: '전체 룩', exact: true })).toBeDisabled();
  await s.locator('summary').filter({ hasText: /^빈티지 패턴/ }).click();
  await expect(s.getByRole('button', { name: '패턴 고정', exact: true })).toBeDisabled();
  const before = await page.evaluate(() => localStorage.getItem('oc-film-variation'));
  await s.getByRole('button', { name: '패턴 고정', exact: true }).evaluate((el: HTMLButtonElement) => { el.disabled = false; el.click(); });
  expect(await page.evaluate(() => localStorage.getItem('oc-film-variation'))).toBe(before);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'WARM', exact: true }).click(); await expect(page.locator('.filter-name')).toHaveText('WARM');
});

test('color-only application preserves rendered texture, legacy FX and automatic date through capture and restore', async ({ page }) => {
  await page.addInitScript(q => {
    localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: q })); localStorage.setItem('oc-keep-original', '1');
    Object.defineProperty(navigator, 'canShare', { value: () => true }); Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('cancel', 'AbortError'); } });
  }, quality);
  await page.goto('/?film-quality-preview=1'); await page.locator('.strip-item').filter({ hasText: /^구형 디지캠$/ }).click();
  const s = await studio(page); await s.getByRole('button', { name: '전체 룩', exact: true }).click(); await page.keyboard.press('Escape');
  const before = await overview(page); await before.locator('summary').filter({ hasText: /^질감/ }).click();
  const grain = await before.locator('dt').filter({ hasText: /^유효 필름 입자$/ }).locator('..').locator('dd').textContent();
  await expect(before).toContainText('날짜 켜짐'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '필터 전체 보기', exact: true }).click(); await page.getByRole('button', { name: '색감 비교', exact: true }).click();
  const compare = page.getByRole('dialog', { name: '색감 비교', exact: true }); await compare.getByLabel('B 필터', { exact: true }).selectOption('signature-portrait-v1'); await compare.getByLabel('B 강도', { exact: true }).fill('0.25');
  await expect(compare.getByRole('button', { name: 'B 적용', exact: true })).toBeEnabled(); await compare.getByRole('button', { name: 'B 적용', exact: true }).click(); await page.keyboard.press('Escape');
  const after = await overview(page); await after.locator('summary').filter({ hasText: /^질감/ }).click();
  await expect(after.locator('dt').filter({ hasText: /^유효 필름 입자$/ }).locator('..').locator('dd')).toHaveText(grain!);
  await expect(after.locator('dt').filter({ hasText: /^유효 광원 번짐$/ }).locator('..').locator('dd')).toHaveText('10%'); await expect(after).toContainText('날짜 켜짐');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(path); return (await listCaptures())[0]?.settings?.nonColorSource; })).toEqual({ version: 1, presetId: 'vintage-ccd', intensity: 1 });
  const effectiveFx = await page.evaluate(async () => { const store = '/src/capture/store.ts', look = '/src/engine/look.ts'; const { listCaptures } = await import(store), { presetEffects } = await import(look); return presetEffects((await listCaptures())[0].settings, .5); });
  expect(effectiveFx).toMatchObject({ grain: .1, pix: .32, jpeg: .18, degrade: .85, date: true });
  await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled(); const restored = await overview(page); await expect(restored).toContainText('날짜 켜짐');
});

test('half-frame keeps effective new texture when color strength changes and locks manual grain', async ({ page }) => {
  await page.addInitScript(q => localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: q })), quality);
  await page.goto('/'); await page.getByRole('button', { name: 'WARM', exact: true }).click(); const s = await studio(page);
  await s.getByRole('button', { name: '전체 룩', exact: true }).click(); await s.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await s.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await page.getByRole('button', { name: '조절', exact: true }).click(); await page.locator('.adj-chip').filter({ hasText: /^강도$/ }).click(); await page.locator('.adj-slider input').fill('0.2');
  const o = await overview(page); await o.locator('summary').filter({ hasText: /^질감/ }).click();
  await expect(o.locator('dt').filter({ hasText: /^유효 필름 입자$/ }).locator('..').locator('dd')).toHaveText('40%');
  await expect(o.locator('dt').filter({ hasText: /^유효 광원 번짐$/ }).locator('..').locator('dd')).toHaveText('10%');
  await page.keyboard.press('Escape'); await page.locator('.adj-chip').filter({ hasText: /^그레인$/ }).click(); await expect(page.locator('.adj-slider input')).toBeDisabled();
});

test('an import finishing after the first cut adds the asset but does not apply it', async ({ page }) => {
  await page.goto('/?film-quality-preview=1'); await page.locator('.strip-item').filter({ hasText: '인물 · SOFT NEG' }).click(); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  const s = await studio(page); await s.getByRole('tab', { name: '촬영 모드', exact: true }).click(); await s.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.keyboard.press('Escape');
  await page.evaluate(() => { const read = File.prototype.arrayBuffer; File.prototype.arrayBuffer = function () { const file = this; return new Promise<ArrayBuffer>(resolve => { (window as any).finishLutRead = async () => resolve(await read.call(file)); }); }; });
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'delayed.cube', mimeType: 'text/plain', buffer: Buffer.from('LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n') });
  await page.waitForFunction(() => typeof (window as any).finishLutRead === 'function'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  const before = await page.evaluate(() => localStorage.getItem('oc-film-quality-v1')); await page.evaluate(() => (window as any).finishLutRead());
  await expect(page.locator('.toast')).toHaveText('LUT 추가됨 · 촬영 설정 유지'); await expect(page.locator('.filter-name')).toHaveText('인물 · SOFT NEG');
  expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBe(before); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await expect(page.getByRole('button', { name: '커스텀 LUT 관리 (1)', exact: true })).toBeVisible();
});

for (const action of ['import', 'bake'] as const) test(`${action} clears stale signature identity without losing an imported asset`, async ({ page }) => {
  await page.goto('/?film-quality-preview=1'); await page.locator('.strip-item').filter({ hasText: '인물 · SOFT NEG' }).click(); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  if (action === 'import') await page.locator('input[type=file][multiple]').setInputFiles({ name: 'identity.cube', mimeType: 'text/plain', buffer: Buffer.from('LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n') });
  else { await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: 'LUT 만들기', exact: true }).click(); }
  await expect(page.locator('.filter-name')).toHaveText(action === 'import' ? 'identity' : 'CUSTOM 1');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oc-film-quality-v1')!).settings);
  if (action === 'import') expect(saved).toBeUndefined(); else expect(saved).toMatchObject({ model: 'film-v2', origin: 'manual' });
  await page.reload(); await expect(page.locator('.filter-name')).not.toHaveText('인물 · SOFT NEG');
  await page.getByRole('button', { name: '메뉴', exact: true }).click(); await expect(page.getByRole('button', { name: '커스텀 LUT 관리 (1)', exact: true })).toBeVisible();
});

test('lost GPU context rejects cached film rendering and comparison/export, then recovers', async ({ page }) => {
  await page.goto('/'); const result = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { renderFilteredCanvas, exportFiltered } = await load('/src/engine/pipeline.ts'), { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const source = document.createElement('canvas'); source.width = source.height = 64; source.getContext('2d')!.fillRect(0, 0, 64, 64);
    let gpu!: HTMLCanvasElement; const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: any[]) { if (args[0] === 'webgl2') gpu = this; return (get as any).apply(this, args); } as any;
    const look = { lens: 'none', lensAmount: 0, gentle: false, filmQuality: { ...DEFAULT_PARAMS, model: 'film-v2', grain: .4, size: .38, color: 0, shadows: .45, glow: .1, glowRadius: .35, seed: .5 } };
    const args = [source, DEFAULT_PARAMS, null, null, 0, false, null, null, undefined, undefined, undefined, undefined, undefined, look] as const;
    try {
      const before = (await renderFilteredCanvas(...args)).toDataURL(); const gl = gpu.getContext('webgl2')!, ext = gl.getExtension('WEBGL_lose_context')!;
      const lost = new Promise<void>(resolve => gpu.addEventListener('webglcontextlost', () => resolve(), { once: true })); ext.loseContext(); await lost;
      const renderRejected = await renderFilteredCanvas(...args).then(() => false, () => true), exportRejected = await exportFiltered(...args).then(() => false, () => true);
      const { renderFilmTextureComparison } = await load('/src/preview/filmTextureCompare.ts'), { freezePreviewSource } = await load('/src/preview/source.ts'), { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx'), { DEFAULT_FILM_QUALITY } = await load('/src/engine/filmQuality.ts');
      const frozen = freezePreviewSource({ source, kind: 'scene', label: 'fixture', ratio: null, mirror: false });
      const s = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, filmQuality: { ...DEFAULT_FILM_QUALITY, model: 'film-v2' } };
      const comparisonRejected = await renderFilmTextureComparison(frozen, s, null, new AbortController().signal).then(images => { images.release(); return false; }, () => true); frozen.release();
      const restored = new Promise<void>(resolve => gpu.addEventListener('webglcontextrestored', () => resolve(), { once: true })); await new Promise(resolve => setTimeout(resolve, 100)); ext.restoreContext(); await restored;
      return { renderRejected, exportRejected, comparisonRejected, recovered: (await renderFilteredCanvas(...args)).toDataURL() === before };
    } finally { HTMLCanvasElement.prototype.getContext = get; }
  }); expect(result).toEqual({ renderRejected: true, exportRejected: true, comparisonRejected: true, recovered: true });
});

test('corrupt color-only texture metadata refuses restoration without resetting the current look', async ({ page }) => {
  await page.goto('/'); await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'), { DEFAULT_BEAUTY } = await load('/src/components/BeautyPanel.tsx'), { saveCapture } = await load('/src/capture/store.ts');
    const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d')!.fillRect(0, 0, 64, 64); const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!)));
    await saveCapture({ id: 'damaged-color-only', createdAt: Date.now(), blob, name: 'keep.png', width: 64, height: 64, mode: 'normal', originals: [blob], settings: { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5, date: { mode: 'off', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, nonColorSource: { version: 2, presetId: 'vintage-ccd', intensity: 1 } } });
  });
  await page.reload(); await page.getByRole('button', { name: 'WARM', exact: true }).click(); await page.getByRole('button', { name: '최근 촬영 열기', exact: true }).click(); await page.locator('.history-photo').click(); await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('질감 보관값'); await expect(page.locator('.filter-name')).toHaveText('WARM');
  expect(await page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(path); const rows = await listCaptures(); return rows.map((r: any) => ({ id: r.id, originals: r.originals.length })); })).toEqual([{ id: 'damaged-color-only', originals: 1 }]);
});
