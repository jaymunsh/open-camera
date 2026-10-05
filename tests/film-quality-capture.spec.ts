import { test, expect } from '@playwright/test';

for (const [label, mode, count] of [['일반', 'normal', 1], ['즉석사진', 'instant', 1], ['하프프레임', 'half', 2], ['다중노출', 'double', 2], ['네 컷', 'booth', 4]] as const) {
  // Catches a missing snapshot on any independent capture/save path.
  test(`film quality retains an off-pattern seed in ${mode} captures`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('oc-film-quality-v1', JSON.stringify({ version: 1, settings: { version: 1, model: 'film-v2', origin: 'manual', grain: .3, size: .38, color: .08, shadows: .45, glow: .06, glowRadius: .35, seed: .25 } }));
      localStorage.setItem('oc-keep-original', '1');
      Object.defineProperty(navigator, 'canShare', { value: () => true });
      Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('Cancel', 'AbortError'); } });
    });
    await page.goto('/');
    if (mode !== 'normal') {
      await page.getByRole('button', { name: '스튜디오', exact: true }).click(); await page.getByRole('tab', { name: '촬영 모드', exact: true }).click();
      await page.getByRole('button', { name: label, exact: true }).click();
      if (mode === 'booth') await page.getByRole('dialog', { name: '스튜디오', exact: true }).getByRole('button', { name: '수동', exact: true }).click();
      await page.getByRole('button', { name: '닫기', exact: true }).click();
    }
    for (let i = 0; i < count; i++) { await page.getByRole('button', { name: '촬영', exact: true }).click(); if (i < count - 1) await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled(); }
    if (mode !== 'normal') await page.getByRole('button', { name: '공유 / 저장', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => {
      const path = '/src/capture/store.ts'; const { listCaptures } = await import(/* @vite-ignore */ path);
      const r = (await listCaptures())[0];
      return { mode: r?.mode, seed: r?.settings?.filmQuality?.seed, model: r?.settings?.filmQuality?.model, originals: r?.originals.length, frames: r?.frameSettings?.map((s: any) => s.filmQuality?.seed) };
    })).toEqual({ mode, seed: .25, model: 'film-v2', originals: count, frames: mode === 'normal' ? undefined : Array(count).fill(.25) });
  });
}
