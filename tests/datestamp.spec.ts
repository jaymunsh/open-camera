import { expect, test } from '@playwright/test';

for (const style of ['red', 'amber']) test(`${style} YY MM DD uses equal visible gaps even when month starts with a narrow 1`, async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async (style) => {
    const path = '/src/engine/datestamp.ts';
    const { stampFontReady, renderStampRed, renderStampSoft } = await import(/* @vite-ignore */ path);
    await stampFontReady;
    return ["'26 10 05", "'26 11 15", "'26 01 11"].map((text) => {
      const s = style === 'red' ? renderStampRed(text, 70, 1000, 1000) : renderStampSoft(text, 10);
      const ctx = s.canvas.getContext('2d')!, { width, height } = s.canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      const runs: { start: number; end: number }[] = [];
      let inRun = false;
      for (let x = 0; x < width; x++) {
        let ink = false;
        for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 150) { ink = true; break; }
        if (ink && !inRun) runs.push({ start: x, end: x });
        if (ink) runs.at(-1)!.end = x;
        inRun = ink;
      }
      return { text, runs: runs.length, gaps: runs.length === 7 ? [runs[3].start - runs[2].end, runs[5].start - runs[4].end] : [] };
    });
  }, style);
  for (const row of results) {
    expect(row.runs, row.text).toBe(7);
    expect(Math.abs(row.gaps[0] - row.gaps[1]), row.text).toBeLessThanOrEqual(3);
    expect(Math.min(...row.gaps), row.text).toBeGreaterThan(10);
  }
});

// A regression to the system monospace red face must break this pixel comparison.
test('red and amber dates share the same angular seven-segment numerals', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/datestamp.ts';
    const { stampFontReady, renderStampRed, renderStampSoft } = await import(/* @vite-ignore */ path);
    await stampFontReady;
    const red = renderStampRed('2015 02 27', 42, 1000, 1000);
    const amber = renderStampSoft('2015 02 27', 6);
    const mask = (stamp: typeof red) => {
      const c = document.createElement('canvas'); c.width = 800; c.height = 120;
      c.getContext('2d')!.drawImage(stamp.canvas, 0, 0, 800, 120);
      return c.getContext('2d')!.getImageData(0, 0, 800, 120).data;
    };
    const a = mask(red), b = mask(amber);
    let intersection = 0, union = 0;
    for (let i = 3; i < a.length; i += 4) {
      const x = a[i] > 140, y = b[i] > 140;
      if (x && y) intersection++;
      if (x || y) union++;
    }
    return intersection / union;
  });
  expect(result).toBeGreaterThan(.8);
});

// Returning to the saturated orange and heavy dark outline must break this test.
test('amber ink is pale warm amber rather than saturated orange', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/datestamp.ts';
    const { stampFontReady, renderStampSoft } = await import(/* @vite-ignore */ path);
    await stampFontReady;
    const s = renderStampSoft('2026 10 05', 10);
    const data = s.canvas.getContext('2d')!.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    let count = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 160) {
      count++; r += data[i]; g += data[i + 1]; b += data[i + 2];
    }
    return { count, greenRatio: g / r, blueRatio: b / r };
  });
  expect(result.count).toBeGreaterThan(100);
  expect(result.greenRatio).toBeGreaterThan(.68);
  expect(result.blueRatio).toBeGreaterThan(.4);
});

test('date rotations and narrow-frame sizing retain readable nonempty ink', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/engine/datestamp.ts';
    const { stampFontReady, renderStampRed, renderStampSoft } = await import(/* @vite-ignore */ path);
    await stampFontReady;
    const a = renderStampSoft("'26 10 05", 3), b = renderStampSoft("'26 10 05", 3, true);
    const red = [false, true].map((vertical) => renderStampRed('2026-10-05 14:42', 50, 60, 120, vertical));
    return {
      rotated: a.w === b.h && a.h === b.w,
      fits: red.every((s) => s.w <= 60 && s.h <= 120),
      ink: red.every((s) => s.canvas.getContext('2d')!.getImageData(0, 0, s.canvas.width, s.canvas.height).data.some((v, i) => i % 4 === 3 && v > 100)),
    };
  });
  expect(result).toEqual({ rotated: true, fits: true, ink: true });
});
