import { expect, test, type Page } from '@playwright/test';

async function menu(page: Page, name: string) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

test('recent captures survive reload and evict oldest bundles atomically', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/capture/store.ts';
    const m: any = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    for (let i = 0; i < 11; i++) {
      await m.saveCapture({ id: String(i), createdAt: i, blob: new Blob(['photo']), name: 'photo.jpg', width: 8, height: 8, mode: 'normal', originals: [] });
    }
    await m.deleteCapture('5');
    return (await m.listCaptures()).map((r: any) => r.id);
  });
  expect(result).toEqual(['10', '9', '8', '7', '6', '4', '3', '2', '1']);
  await page.reload();
  const ids = await page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const m: any = await import(/* @vite-ignore */ path);
    return (await m.listCaptures()).map((r: any) => r.id);
  });
  expect(ids).toEqual(result);
});

test('oversized original bundle rejects without losing existing capture', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const m: any = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    const record = { id: 'keep', createdAt: 1, blob: new Blob(['photo']), name: 'photo.jpg', width: 8, height: 8, mode: 'normal', originals: [] };
    await m.saveCapture(record);
    let rejected = false;
    try { await m.saveCapture({ ...record, id: 'too-big', originals: [new Blob([new Uint8Array(50 * 1024 * 1024)])] }); } catch { rejected = true; }
    return { rejected, ids: (await m.listCaptures()).map((r: any) => r.id) };
  });
  expect(result).toEqual({ rejected: true, ids: ['keep'] });
});

test('compositing preserves input pixels and uses literal blend formulas', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/capture/composite.ts'; const m: any = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    const make = (color: string) => { const c = document.createElement('canvas'); c.width = 30; c.height = 40; const x = c.getContext('2d')!; x.fillStyle = color; x.fillRect(0, 0, 30, 40); return c; };
    const a = make('rgb(200,100,50)'), b = make('rgb(100,200,150)');
    const pixel = (c: HTMLCanvasElement, x = 10) => Array.from(c.getContext('2d')!.getImageData(x, 10, 1, 1).data).slice(0, 3);
    const half = m.composeFrames([a, b], 'half', {});
    return { size: [half.width, half.height], left: pixel(half), right: pixel(half, 40), original: pixel(a), average: pixel(m.composeFrames([a, b], 'double', { blend: 'average', mix: .5 })), lighten: pixel(m.composeFrames([a, b], 'double', { blend: 'lighten', mix: 1 })), multiply: pixel(m.composeFrames([a, b], 'double', { blend: 'multiply', mix: 1 })) };
  });
  expect(result).toEqual({ size: [60, 40], left: [200, 100, 50], right: [100, 200, 150], original: [200, 100, 50], average: [150, 150, 100], lighten: [200, 200, 150], multiply: [78, 78, 29] });
});

test('red stamp fits narrow frames and only has red-colored ink', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/datestamp.ts'; const m: any = await import(/* @vite-ignore */ path);
    if (!m.renderStampRed) return null;
    const s = m.renderStampRed('2026-10-04', 50, 60, 120, false);
    const data = s.canvas.getContext('2d').getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    let ink = 0, wrong = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) { ink++; if (data[i] <= data[i + 1] || data[i] <= data[i + 2]) wrong++; }
    return { fits: s.w <= 60 && s.h <= 120, ink: ink > 0, wrong };
  });
  expect(result).toEqual({ fits: true, ink: true, wrong: 0 });
});

test('whole-look strength scales only effect amounts and gentle never changes input', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/look.ts'; const m: any = await import(/* @vite-ignore */ path).catch(() => null);
    if (!m) return null;
    const fx = { grain: .5, leak: .8, seed: .7, date: true };
    return { zero: m.deriveFx(fx, 0, 'whole', false), legacy: m.deriveFx(fx, 0, 'color', false), gentle: m.deriveFx(fx, 1, 'color', true), input: fx };
  });
  expect(result).toEqual({ zero: { grain: 0, leak: 0, seed: .7, date: true }, legacy: { grain: .5, leak: .8, seed: .7, date: true }, gentle: { grain: .25, leak: .2, seed: .7, date: true }, input: { grain: .5, leak: .8, seed: .7, date: true } });
});

test('normal capture retains history even when sharing is canceled', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: () => true }); Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('Cancel', 'AbortError'); } }); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await menu(page, '최근 촬영');
  await expect(page.locator('.history-photo')).toHaveCount(1);
  await page.reload(); await menu(page, '최근 촬영');
  await expect(page.locator('.history-photo')).toHaveCount(1);
});

test('half-frame requires two shots and can retake second without losing first', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '하프프레임', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('2/2');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '촬영 확인' })).toBeVisible();
  await page.getByRole('button', { name: '2번째 다시 찍기', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('2/2');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
});

test('retained original can be reprocessed without replacing saved shot', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByLabel('원본도 보관').check();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await menu(page, '최근 촬영'); await page.locator('.history-photo').first().click();
  await page.getByRole('button', { name: '다시 현상', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible();
  const second = page.waitForEvent('download'); await page.getByRole('button', { name: '저장', exact: true }).click(); await second;
  await menu(page, '최근 촬영'); await expect(page.locator('.history-photo')).toHaveCount(2);
});

test('recipe restores settings after reload and remains separate from LUTs', async ({ page }) => {
  await page.goto('/'); await page.locator('.strip-item').filter({ hasText: /^WARM$/ }).click();
  await menu(page, '카메라 레시피'); await page.getByLabel('레시피 이름').fill('여행');
  await page.getByRole('button', { name: '현재 설정 저장', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await page.reload();
  await expect(page.locator('.filter-name')).toHaveText('ORIGINAL');
  await menu(page, '카메라 레시피'); await page.getByRole('button', { name: '여행 적용', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText('WARM');
  expect(await page.evaluate(() => localStorage.getItem('oc-custom'))).toBeNull();
});

test('four-shot booth finishes once and supports a single-frame retake', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '네 컷', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '촬영 확인' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '세로 스트립', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const size = await page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[1]).toBeGreaterThan(size[0] * 4); expect(Math.max(...size)).toBeLessThanOrEqual(2048);
  await page.getByRole('button', { name: '3번째 다시 찍기', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('3/4');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '촬영 확인' })).toBeVisible();
});

test('booth pauses when hidden and does not catch up shots on return', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '네 컷', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('2/4');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.capture-progress')).toContainText('2/4');
  await expect(page.getByRole('button', { name: '계속 촬영', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('1/4');
});

test('double exposure locks ratio and exports a switchable blend', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '다중노출', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.exposure-guide')).toBeVisible();
  await expect(page.getByRole('button', { name: '비율', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await page.getByRole('button', { name: '곱하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
  await menu(page, '최근 촬영'); await expect(page.locator('.history-photo')).toHaveCount(1);
});

test('an aborted capture write preserves existing bundles', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/capture/store.ts'; const m: any = await import(/* @vite-ignore */ path);
    const record = { id: 'keep', createdAt: 1, blob: new Blob(['photo']), name: 'photo.jpg', width: 8, height: 8, mode: 'normal', originals: [] };
    await m.saveCapture(record);
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { const r = put.apply(this, args); if (this.name === 'captures') this.transaction.abort(); return r; };
    let rejected = false;
    try { await m.saveCapture({ ...record, id: 'new' }); } catch { rejected = true; }
    IDBObjectStore.prototype.put = put;
    return { rejected, ids: (await m.listCaptures()).map((r: any) => r.id) };
  });
  expect(result).toEqual({ rejected: true, ids: ['keep'] });
});

test('missing LUT recipe never partially changes current settings', async ({ page }) => {
  await page.goto('/'); await page.locator('.strip-item').filter({ hasText: /^WARM$/ }).click();
  await menu(page, '카메라 레시피'); await page.getByLabel('레시피 이름').fill('누락'); await page.getByRole('button', { name: '현재 설정 저장', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.evaluate(() => { const rows = JSON.parse(localStorage.getItem('oc-recipes')!); rows[0].settings.lutId = 'missing-custom'; rows[0].settings.params.exposure = 1; localStorage.setItem('oc-recipes', JSON.stringify(rows)); });
  await menu(page, '카메라 레시피'); await page.getByRole('button', { name: '누락 적용', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('LUT가 없습니다');
  await expect(page.locator('.filter-name')).toHaveText('WARM');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '조절', exact: true }).click(); await page.locator('.adj-chip').filter({ hasText: '노출' }).click();
  await expect(page.locator('.adj-slider input')).toHaveValue('0');
});

test('lens shaders respond to highlights but preserve dark input and prism center', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/pipeline.ts'; const m: any = await import(/* @vite-ignore */ path);
    const typePath = '/src/engine/types.ts'; const t: any = await import(/* @vite-ignore */ typePath);
    const source = document.createElement('canvas'); source.width = source.height = 256;
    const ctx = source.getContext('2d')!; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
    const render = async (lens: string) => m.renderFilteredCanvas(source, t.DEFAULT_PARAMS, null, null, 0, false, null, null, null, undefined, null, [], undefined, { lens, lensAmount: 1, gentle: false });
    const sample = (c: HTMLCanvasElement, x: number, y: number) => Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data).slice(0, 3);
    const dark = sample(await render('star'), 134, 134);
    ctx.fillStyle = '#fff'; ctx.fillRect(127, 127, 3, 3);
    const star = sample(await render('star'), 134, 134), plain = sample(await render('none'), 134, 134);
    const gradient = ctx.createLinearGradient(0, 0, 256, 0); gradient.addColorStop(0, '#f00'); gradient.addColorStop(1, '#00f'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
    const base = await render('none'), prism = await render('prism');
    return { dark, star, plain, center: sample(prism, 128, 128), originalCenter: sample(base, 128, 128), edge: sample(prism, 5, 128), originalEdge: sample(base, 5, 128) };
  });
  expect(result.dark).toEqual([0, 0, 0]); expect(result.star[0]).toBeGreaterThan(result.plain[0]);
  expect(result.center).toEqual(result.originalCenter); expect(result.edge).not.toEqual(result.originalEdge);
});

test('opening history pauses booth without discarding its first photo', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '네 컷', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-progress')).toContainText('2/4');
  await menu(page, '최근 촬영'); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.capture-progress')).toContainText('2/4');
  await expect(page.getByRole('button', { name: '계속 촬영', exact: true })).toBeVisible();
});

test('composition encoding failure is visible inside review and permits cancel', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-progress')).toContainText('2/2');
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function (callback) { callback(null); }; });
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '촬영 확인' }).getByRole('alert')).toContainText('실패');
  await expect(page.getByRole('dialog', { name: '촬영 확인' }).getByRole('button', { name: '닫기', exact: true })).toBeEnabled();
});

test('deleting a pending original does not resurrect its capture', async ({ page }) => {
  await page.goto('/'); await menu(page, '촬영 모드 · 효과');
  await page.getByLabel('원본도 보관').check(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob; let calls = 0;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (++calls === 2) (window as any).finishOriginal = () => new Promise<void>((resolve) => original.call(this, (blob) => { callback(blob); resolve(); }, ...args));
      else original.call(this, callback, ...args);
    };
  });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await download;
  await menu(page, '최근 촬영'); await page.locator('.history-photo').click();
  await expect(page.getByText('이번 세션에만 보관', { exact: false })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept()); await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('아직 촬영한 사진이 없습니다.')).toBeVisible();
  await page.evaluate(() => (window as any).finishOriginal());
  await page.waitForTimeout(500);
  const saved = await page.evaluate(async () => { const path = '/src/capture/store.ts'; const m: any = await import(/* @vite-ignore */ path); return (await m.listCaptures()).length; });
  expect(saved).toBe(0); await expect(page.locator('.history-photo')).toHaveCount(0);
  await page.reload(); await menu(page, '최근 촬영'); await expect(page.locator('.history-photo')).toHaveCount(0);
});

test('retrying a canceled composition share keeps one history record', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancel', 'AbortError'); } });
  });
  await menu(page, '촬영 모드 · 효과'); await page.getByRole('button', { name: '하프프레임', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-progress')).toContainText('2/2');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  const save = page.getByRole('button', { name: '공유 / 저장', exact: true });
  await expect(save).toBeEnabled(); await save.click(); await expect(save).toBeEnabled(); await save.click();
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await menu(page, '최근 촬영');
  await expect(page.locator('.history-photo')).toHaveCount(1);
});

test('corrupt recipe storage cannot be silently overwritten', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.setItem('oc-recipes', 'broken-data'));
  await menu(page, '카메라 레시피'); await page.getByLabel('레시피 이름').fill('새 레시피');
  await expect(page.getByRole('alert')).toContainText('읽');
  await expect(page.getByRole('button', { name: '현재 설정 저장', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('oc-recipes'))).toBe('broken-data');
});

test('built creative screens remain usable on mobile and desktop', async ({ page }) => {
  for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 900]] as const) {
    await page.setViewportSize({ width, height }); await page.goto('http://127.0.0.1:5186/');
    await menu(page, '촬영 모드 · 효과');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `test-results/creative-${label}-settings.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.locator('.capture-progress')).toContainText('2/2');
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    await page.screenshot({ path: `test-results/creative-${label}-review.png`, animations: 'disabled' });
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
    await menu(page, '최근 촬영'); await expect(page.locator('.history-photo').first()).toBeVisible();
    await expect.poll(() => page.locator('.history-photo img').evaluateAll((images) => images.length > 0 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `test-results/creative-${label}-history.png`, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
