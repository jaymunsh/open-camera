import { expect, test } from '@playwright/test';

test.describe('film variation data', () => {
  test('existing whole-look scaling leaves pattern metadata intact', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/look.ts'; const { deriveFx } = await import(/* @vite-ignore */ path);
      return deriveFx({ grain: .8, seed: .25, pattern: { version: 1, seed: .25 } }, 0, 'whole', false);
    });
    expect(result).toEqual({ grain: 0, seed: .25, pattern: { version: 1, seed: .25 } });
  });
  test('opt-out preserves base objects and active additions never mutate the preset or manual controls', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/variation.ts';
      const m = await import(/* @vite-ignore */ path).catch(() => null);
      if (!m) return null;
      const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
      const params = { ...DEFAULT_PARAMS, grain: .1 };
      const fx = { grain: .2, leak: .1, dust: .05, seed: .8, date: true };
      const before = JSON.stringify({ params, fx });
      const settings = { ...m.DEFAULT_VARIATION, mode: 'fixed', grain: 1, leak: 1, dust: 1, color: 0 };
      const off = m.resolveVariation(params, fx, m.validateVariation(undefined), null);
      const max = m.resolveVariation(params, null, settings, { version: 1, seed: .25 });
      const added = m.resolveVariation(params, fx, settings, { version: 1, seed: .25 });
      const muted = m.resolveVariation(params, fx, settings, { version: 1, seed: .25 }, true);
      return { references: off.params === params && off.fx === fx, unchanged: before === JSON.stringify({ params, fx }),
        max: max.fx, added: added.fx, muted: muted.fx, manualGrain: muted.params.grain, offMode: m.validateVariation(undefined).mode };
    });
    expect(result).not.toBeNull();
    expect(result!.references).toBe(true); expect(result!.unchanged).toBe(true); expect(result!.offMode).toBe('off');
    expect(result!.max).toMatchObject({ grain: .35, leak: .30, dust: .12, seed: .25 });
    expect(result!.added.grain).toBeCloseTo(.55); expect(result!.added.leak).toBeCloseTo(.4); expect(result!.added.dust).toBeCloseTo(.17);
    expect(result!.added.date).toBe(true); expect(result!.muted.grain).toBe(0); expect(result!.manualGrain).toBe(.1);
  });

  test('a frozen seed reproduces bounded color offsets and half strength preserves their direction', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/variation.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null); if (!m) return null;
      const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS, PARAM_DEFS } = await import(/* @vite-ignore */ typesPath);
      const settings = { ...m.DEFAULT_VARIATION, mode: 'fixed', color: 1 };
      const resolve = (seed: number, color = 1, params = DEFAULT_PARAMS) => m.resolveVariation(params, null, { ...settings, color }, { version: 1, seed }).params;
      const first = resolve(.25), same = resolve(.25), other = resolve(.75), half = resolve(.25, .5);
      const extreme = { ...DEFAULT_PARAMS, exposure: 1.5, temperature: 1, tint: -1 };
      const clipped = resolve(.25, 1, extreme);
      return { same: JSON.stringify(first) === JSON.stringify(same), different: JSON.stringify(first) !== JSON.stringify(other),
        offsets: ['exposure', 'temperature', 'tint'].map((key) => [first[key] - DEFAULT_PARAMS[key], half[key] - DEFAULT_PARAMS[key]]),
        bounded: PARAM_DEFS.every((d: any) => clipped[d.key] >= d.min && clipped[d.key] <= d.max),
        zeroSame: JSON.stringify(resolve(.25, 0)) === JSON.stringify(DEFAULT_PARAMS) };
    });
    expect(result).not.toBeNull(); expect(result!.same).toBe(true); expect(result!.different).toBe(true); expect(result!.bounded).toBe(true); expect(result!.zeroSame).toBe(true);
    for (const [i, limit] of [.08, .04, .02].entries()) { expect(Math.abs(result!.offsets[i][0])).toBeLessThanOrEqual(limit); expect(result!.offsets[i][1]).toBeCloseTo(result!.offsets[i][0] / 2, 10); }
  });

  test('corrupt versions, seeds and strengths are rejected and fallback seed generation terminates', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/variation.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null); if (!m) return null;
      const rejects = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
      const invalid = [null, {}, { ...m.DEFAULT_VARIATION, version: 2 }, { ...m.DEFAULT_VARIATION, mode: 'unknown' }, ...[NaN, Infinity, -.1, 1.1].map(grain => ({ ...m.DEFAULT_VARIATION, grain }))];
      const patterns = [null, {}, { version: 2, seed: .25 }, ...[NaN, Infinity, -.1, 1].map(seed => ({ version: 1, seed }))];
      const random = Math.random; Math.random = () => .25;
      let next; try { next = m.nextPattern({ version: 1, seed: .25 }); } finally { Math.random = random; }
      return { invalid: invalid.map(v => rejects(() => m.validateVariation(v))), patterns: patterns.map(v => rejects(() => m.validatePattern(v))), next,
        absentPatternRejected: rejects(() => m.resolveVariation({}, null, { ...m.DEFAULT_VARIATION, mode: 'new' }, null)) };
    });
    expect(result).not.toBeNull(); expect(result!.invalid.every(Boolean)).toBe(true); expect(result!.patterns.every(Boolean)).toBe(true);
    expect(result!.next.version).toBe(1); expect(result!.next.seed).not.toBe(.25); expect(result!.next.seed).toBeGreaterThanOrEqual(0); expect(result!.next.seed).toBeLessThan(1);
    expect(result!.absentPatternRejected).toBe(true);
  });

  test('pattern noise is repeatable across calls and independent of global random state', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/variation.ts'; const m = await import(/* @vite-ignore */ path).catch(() => null); if (!m) return null;
      const a = m.patternNoise(.25), b = m.patternNoise(.25), c = m.patternNoise(.75);
      return { length: a.length, equal: a.every((v: number, i: number) => v === b[i]), different: a.some((v: number, i: number) => v !== c[i]),
        alpha: a.every((v: number, i: number) => i % 4 !== 3 || v === 255), channels: Array.from(a.slice(0, 8)) };
    });
    expect(result).not.toBeNull(); expect(result!.length).toBe(256 * 256 * 4); expect(result!.equal).toBe(true); expect(result!.different).toBe(true); expect(result!.alpha).toBe(true);
    expect(result!.channels).toEqual([149, 158, 149, 255, 161, 238, 161, 255]);
  });
});
