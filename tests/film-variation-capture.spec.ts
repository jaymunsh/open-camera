import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page, mode: 'off' | 'new' | 'fixed') {
  await page.addInitScript((mode) => {
    localStorage.setItem('oc-film-variation', JSON.stringify({ version: 1, mode, grain: .2, leak: .15, dust: .1, color: .15, fixedSeed: .25 }));
    localStorage.setItem('oc-keep-original', '1');
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('Cancel', 'AbortError'); } });
  }, mode);
  await page.goto('/');
}
async function records(page: Page) {
  return page.evaluate(async () => { const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path); return (await listCaptures()).map((r: any) => ({ id: r.id, mode: r.mode, patterns: r.framePatterns, settings: r.settings, frameSettings: r.frameSettings })); });
}
for (const preference of ['fixed', 'new'] as const) for (const [label, mode, count, automatic] of [['일반', 'normal', 1, false], ['즉석사진', 'instant', 1, false], ['하프프레임', 'half', 2, false], ['다중노출', 'double', 2, false], ['네 컷', 'booth', 4, false], ['네 컷', 'booth', 4, true]] as const) {
  test(`film variation capture ${preference} ${mode} ${automatic ? 'auto' : 'manual'} stores per-frame seeds`, async ({ page }) => {
    await boot(page, preference);
    if (mode !== 'normal') {
      await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '촬영 모드', exact: true }).click();
      await page.getByRole('button', { name: label, exact: true }).click();
      if (mode === 'booth' && !automatic) await page.getByRole('dialog', { name: '스튜디오', exact: true }).getByRole('button', { name: '수동', exact: true }).click();
      await page.getByRole('button', { name: '닫기', exact: true }).click();
    }
    for (let i = 0; i < (automatic ? 1 : count); i++) { await page.getByRole('button', { name: '촬영', exact: true }).click(); if (i < count - 1 && !automatic) await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled(); }
    if (mode !== 'normal') { await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled({ timeout: 25000 }); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); }
    await expect.poll(async () => (await records(page))[0]?.patterns?.length).toBe(count);
    const r = (await records(page))[0]; expect(r.settings.variation.mode).toBe(preference);
    if (preference === 'fixed') expect(r.patterns).toEqual(Array.from({ length: count }, () => ({ version: 1, seed: .25 })));
    else expect(new Set(r.patterns.map((p: any) => p.seed)).size).toBe(count);
    if (count > 1) expect(r.frameSettings.map((s: any) => s.variation.mode)).toEqual(Array(count).fill(preference));
  });
}
test('film variation lifecycle new shots advance despite canceled sharing, failed encoding does not consume', async ({ page }) => {
  await boot(page, 'new');
  await page.evaluate(async () => {
    const path = '/src/engine/pipeline.ts'; const { FilterPipeline } = await import(/* @vite-ignore */ path);
    const original = FilterPipeline.prototype.setFx;
    (window as any).shotSeeds = [];
    FilterPipeline.prototype.setFx = function(fx: any) { if (fx?.pattern) (window as any).shotSeeds.push(fx.pattern.seed); return original.call(this, fx); };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let fail = true;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) { if (fail) { fail = false; callback(null); } else toBlob.call(this, callback, ...args); };
  });
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect.poll(async () => (await records(page)).length).toBe(1);
  await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect.poll(async () => (await records(page)).length).toBe(2);
  const seeds = await page.evaluate(() => (window as any).shotSeeds);
  expect(seeds[0]).toBe(seeds[1]); expect(seeds[2]).not.toBe(seeds[1]);
  const rows = await records(page); expect(rows[0].patterns).not.toEqual(rows[1].patterns);
});
test('film variation capture new half-frame retake changes only the selected slot', async ({ page }) => {
  await boot(page, 'new'); await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '촬영 모드', exact: true }).click();
  await page.getByRole('button', { name: '하프프레임', exact: true }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: '촬영', exact: true }).click(); if (i === 0) await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled(); }
  await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await expect.poll(async () => (await records(page)).length).toBe(1); const first = (await records(page))[0];
  expect(first.patterns[0]).not.toEqual(first.patterns[1]);
  await page.getByRole('button', { name: '2번째 다시 찍기', exact: true }).click(); await page.getByRole('button', { name: '촬영', exact: true }).click(); await page.getByRole('button', { name: '공유 / 저장', exact: true }).click();
  await expect.poll(async () => (await records(page)).length).toBe(2); const last = (await records(page))[0];
  expect(last.patterns[0]).toEqual(first.patterns[0]); expect(last.patterns[1]).not.toEqual(first.patterns[1]);
});
test('film variation capture opt-out omits additional metadata', async ({ page }) => {
  await boot(page, 'off'); await page.getByRole('button', { name: '촬영', exact: true }).click(); await expect.poll(async () => (await records(page)).length).toBe(1); expect((await records(page))[0].patterns).toBeUndefined();
});
