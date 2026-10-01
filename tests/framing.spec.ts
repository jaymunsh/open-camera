import { expect, test } from '@playwright/test';

for (const layout of [
  { width: 390, height: 780, top: 62, bottom: 34 },
  { width: 390, height: 830, top: 62, bottom: 34 },
  { width: 390, height: 844, top: 62, bottom: 34 },
  { width: 390, height: 900, top: 62, bottom: 34 },
  { width: 844, height: 390, top: 0, bottom: 21 },
  { width: 1440, height: 900, top: 0, bottom: 0 },
]) {
  test(`all camera ratios and overlays stay centered (${layout.width}x${layout.height})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.addInitScript(() => {
      localStorage.setItem('oc-grid', '1');
      localStorage.setItem('oc-datemode', 'on');
      localStorage.setItem('oc-dateorient', 'p');
      // Observe actual GPU viewports, including any intermediate effect passes.
      const viewport = WebGL2RenderingContext.prototype.viewport;
      WebGL2RenderingContext.prototype.viewport = function (x, y, w, h) {
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.matches('.viewer > canvas')) {
          this.canvas.dataset.viewport = JSON.stringify({ x, y, w, h });
        }
        return viewport.call(this, x, y, w, h);
      };
    });
    await page.goto('/');
    await page.locator('.app').evaluate((app, insets) => {
      (app as HTMLElement).style.setProperty('--safe-area-top', `${insets.top}px`);
      (app as HTMLElement).style.paddingBottom = `${insets.bottom}px`;
    }, layout);
    await page.waitForFunction(() => document.querySelector('video')?.readyState === 4);
    const ratio = page.getByRole('button', { name: '비율', exact: true });
    for (const label of ['3:4', '9:16', '1:1', '4:5']) {
      await expect(ratio).toHaveText(label);
      await expect.poll(async () => page.locator('.viewer').evaluate(viewer => {
        const box = viewer.getBoundingClientRect();
        const grid = viewer.querySelector('.grid-overlay')!.getBoundingClientRect();
        const canvas = viewer.querySelector('canvas')!;
        const vp = JSON.parse(canvas.dataset.viewport ?? 'null');
        if (!vp) return null;
        const scale = box.height / canvas.height;
        return {
          above: grid.top - box.top,
          below: box.bottom - grid.bottom,
          left: grid.left - box.left,
          right: box.right - grid.right,
          gpuAbove: (canvas.height - vp.y - vp.h) * scale,
          gpuBelow: vp.y * scale,
        };
      }).then(gaps => {
        if (!gaps) return false;
        return Math.abs(gaps.left - gaps.right) < 1
          && Math.abs(gaps.above - gaps.below) < 1
          && Math.abs(gaps.gpuAbove - gaps.above) < 1
          && Math.abs(gaps.gpuBelow - gaps.below) < 1;
      }), { message: `${label} GPU viewport and grid must be centered together` }).toBe(true);
      // The stamp keeps its existing inset from the photo, not from the viewer.
      await expect.poll(() => page.locator('.viewer').evaluate(viewer => {
        const grid = viewer.querySelector('.grid-overlay')!.getBoundingClientRect();
        const stamp = viewer.querySelector('.date-stamp')!.getBoundingClientRect();
        return Math.abs(grid.bottom - stamp.bottom - grid.height * 0.032);
      }), { message: `${label} date stamp must follow the centered photo` }).toBeLessThan(1);
      if (label === '1:1') await page.screenshot({ path: testInfo.outputPath('square-centered.png') });
      if (label !== '4:5') await ratio.click();
    }
  });
}
