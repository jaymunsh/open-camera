import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const evidence = '.impeccable/review';
for (const [name, width, height] of [['mobile', 430, 932], ['landscape', 844, 390], ['desktop', 1440, 900]] as const) {
  test(`film variation visuals ${name} controls stay readable without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    await page.getByRole('button', { name: '스튜디오', exact: true }).click(); const studio = page.getByRole('dialog', { name: '스튜디오', exact: true });
    await studio.getByRole('tab', { name: '효과', exact: true }).click(); await studio.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
    const controls = studio.getByRole('group', { name: '빈티지 우연성', exact: true });
    await controls.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await controls.getByRole('button', { name: '매 컷 새롭게', exact: true }).focus();
    await mkdir(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/variation-${name}.png` });
    const result = await studio.evaluate(el => { const body = el.querySelector('.studio-body')!; const input = el.querySelector('[aria-label="추가 입자"]')!; const style = getComputedStyle(input.closest('label')!); return { overflow: body.scrollWidth > body.clientWidth + 1, size: Number.parseFloat(style.fontSize), line: style.lineHeight, value: (input as HTMLInputElement).value }; });
    expect(result.overflow).toBe(false); expect(result.size).toBeGreaterThanOrEqual(13); expect(result.value).toBe('0.2');
    if (name === 'landscape') {
      await controls.getByLabel('추가 먼지', { exact: true }).evaluate(el => el.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${evidence}/variation-landscape-ranges.png` });
      await controls.getByRole('button', { name: '레시피 저장', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: `${evidence}/variation-landscape-actions.png` });
    }
    await studio.getByRole('button', { name: '닫기', exact: true }).click(); await page.screenshot({ path: `${evidence}/variation-${name}-camera.png` });
  });
}
test('film variation visuals compare real sample exports and fixed pattern stability', async ({ page }) => {
  await page.goto('/');
  const outputs = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { renderFilteredCanvas } = await load('/src/engine/pipeline.ts'); const { DEFAULT_PARAMS } = await load('/src/engine/types.ts');
    const { resolveVariation, DEFAULT_VARIATION } = await load('/src/engine/variation.ts');
    const image = new Image(); image.src = '/samples/sample1.png'; await image.decode();
    const source = document.createElement('canvas'); source.width = 600; source.height = Math.round(image.height / image.width * 600); source.getContext('2d')!.drawImage(image, 0, 0, source.width, source.height);
    const results = [];
    for (const seed of [null, .25, .75, .25]) {
      const s = { ...DEFAULT_VARIATION, mode: seed === null ? 'off' : 'fixed', grain: 1, leak: 1, dust: 1, color: 1 };
      const resolved = resolveVariation(DEFAULT_PARAMS, null, s, seed === null ? null : { version: 1, seed });
      results.push((await renderFilteredCanvas(source, resolved.params, null, null, 0, false, null, resolved.fx)).toDataURL('image/png'));
    }
    return results;
  });
  expect(outputs[1]).toBe(outputs[3]); expect(new Set(outputs.slice(0, 3)).size).toBe(3);
  await mkdir(evidence, { recursive: true });
  for (const [index, name] of ['off', 'seed-025', 'seed-075'].entries()) await writeFile(`${evidence}/variation-sample-${name}.png`, Buffer.from(outputs[index].split(',')[1], 'base64'));
});
