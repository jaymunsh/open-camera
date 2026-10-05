import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('texture comparison owns deterministic bounded outputs and rejects invalid or released sources', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/preview/filmTextureCompare.ts'; const mod = await import(path).catch(() => null); if (!mod) return { available: false };
    const sp = '/src/preview/source.ts', qp = '/src/engine/filmQuality.ts', pp = '/src/engine/types.ts', bp = '/src/components/BeautyPanel.tsx';
    const { freezePreviewSource } = await import(sp); const { DEFAULT_FILM_QUALITY } = await import(qp); const { DEFAULT_PARAMS } = await import(pp); const { DEFAULT_BEAUTY } = await import(bp);
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1536; const ctx = c.getContext('2d')!; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, c.width, c.height);
    const source = freezePreviewSource({ source: c, kind: 'scene', label: 'fixture', ratio: null, mirror: true }); const original = source.canvas.toDataURL();
    const settings = { lutId: 'none', intensity: 1, params: DEFAULT_PARAMS, beauty: DEFAULT_BEAUTY, ratioIdx: 0, grainOff: false, strengthMode: 'color', gentle: false, lens: 'prism', lensAmount: 1, date: { mode: 'on', fmt: 'yy', size: 'sm', orient: 'auto', style: 'red' }, filmQuality: { ...DEFAULT_FILM_QUALITY, model: 'film-v2', grain: 0, glow: 0 } };
    const render = (s = settings, signal = new AbortController().signal) => mod.renderFilmTextureComparison(source, s, null, signal);
    const zero = await render(); const same = zero.before.toDataURL() === zero.after.toDataURL(); const sizes = [zero.before.width, zero.before.height]; zero.release(); zero.release();
    settings.filmQuality.grain = .5; const [a, b] = await Promise.all([render(), render()]); const deterministic = a.after.toDataURL() === b.after.toDataURL(); const distinct = a.before.toDataURL() !== a.after.toDataURL(); a.release(); b.release();
    const abort = new AbortController(); abort.abort(); const rejected = await render(settings, abort.signal).then(() => false, () => true);
    const later = new AbortController(); const queued = render(settings, later.signal); later.abort(); const cancelledQueued = await queued.then(() => false, () => true);
    const missing = await render({ ...settings, lutId: 'mono' }).then(() => false, () => true);
    const unchanged = original === source.canvas.toDataURL(); source.release(); const released = await render().then(() => false, () => true);
    return { available: true, same, sizes, deterministic, distinct, rejected, cancelledQueued, missing, unchanged, released, freed: [a.before.width, a.after.width, b.before.width, b.after.width] };
  });
  expect(result).toEqual({ available: true, same: true, sizes: [1024, 768], deterministic: true, distinct: true, rejected: true, cancelledQueued: true, missing: true, unchanged: true, released: true, freed: [0, 0, 0, 0] });
});

test('texture comparison closes without applying and preserves camera settings', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.locator('summary').filter({ hasText: /^필름 질감/ }).click();
  await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'));
  await studio.getByRole('button', { name: '질감 비교', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '질감 비교', exact: true }); await expect(dialog.getByRole('img', { name: '질감 적용', exact: true })).toBeVisible();
  await expect(dialog).toContainText('뷰티·렌즈·날짜·추가 우연성은 제외'); await expect(dialog.getByRole('button', { name: /^(적용|A 적용|B 적용)$/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: '질감 전', exact: true }).click(); await expect(dialog.getByRole('img', { name: '질감 전', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); expect(await page.evaluate(() => localStorage.getItem('oc-film-quality-v1'))).toBe(before);
  await expect(studio.getByRole('button', { name: '질감 비교', exact: true })).toBeFocused();
});

test('closing Studio during source loading refuses the old texture result', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void; const request = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/samples/masters/portrait.png?*', async route => { requested(); await gate; await route.continue(); });
  await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
  const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.locator('summary').filter({ hasText: /^필름 질감/ }).click();
  await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click(); await studio.getByRole('button', { name: '질감 비교', exact: true }).click(); await request;
  await expect(studio.getByRole('status').filter({ hasText: '비교 사진 준비' })).toBeVisible(); await page.keyboard.press('Escape'); release();
  await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('dialog', { name: '스튜디오', exact: true }).getByRole('tab', { name: '효과', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '질감 비교', exact: true })).toHaveCount(0);
});

for (const [name, width, height] of [['small', 320, 568], ['mobile', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 800]] as const) {
  test(`texture comparison has a useful photo and protected close action at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/'); await page.getByRole('button', { name: '스튜디오', exact: true }).click();
    const studio = page.getByRole('dialog', { name: '스튜디오', exact: true }); await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.locator('summary').filter({ hasText: /^필름 질감/ }).click();
    await studio.getByRole('button', { name: '새 필름 처리', exact: true }).click(); await studio.getByRole('button', { name: '질감 비교', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '질감 비교', exact: true }); await expect(dialog.getByRole('img', { name: '질감 적용', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const visible = await dialog.evaluate(el => { const photo = el.querySelector('.comparison-photo')!.getBoundingClientRect(), body = el.querySelector('.comparison-body')!.getBoundingClientRect(); return Math.min(photo.bottom, body.bottom) - Math.max(photo.top, body.top); });
    expect(visible).toBeGreaterThanOrEqual(120);
    expect(await dialog.evaluate(el => { const photo = el.querySelector('.comparison-photo')!.getBoundingClientRect(), canvas = el.querySelector('.comparison-photo canvas')!.getBoundingClientRect(); return canvas.height <= photo.height + 1; })).toBe(true);
    await page.screenshot({ path: `.superpowers/sdd/2026-10-05-signature-film-quality/texture-${name}.png` });
  });
}
