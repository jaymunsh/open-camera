import { expect, test } from '@playwright/test';

for (const height of [844, 900]) {
  test(`4:5 camera and grid stay centered without changing other ratios (${height}px)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    await page.addInitScript(() => {
      localStorage.setItem('oc-grid', '1');
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
    await page.locator('.app').evaluate(app => {
      (app as HTMLElement).style.setProperty('--safe-area-top', '62px');
      (app as HTMLElement).style.paddingBottom = '34px';
    });
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
        const centered = label !== '3:4';
        return Math.abs(gaps.left - gaps.right) < 1
          && (centered ? Math.abs(gaps.above - gaps.below) < 1 : Math.abs(gaps.below) < 1)
          && Math.abs(gaps.gpuAbove - gaps.above) < 1
          && Math.abs(gaps.gpuBelow - gaps.below) < 1;
      })).toBe(true);
      if (label !== '4:5') await ratio.click();
    }
  });
}
