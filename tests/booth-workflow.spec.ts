import { expect, test, type Page } from '@playwright/test';

async function booth(page: Page, method: '자동' | '수동') {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '촬영 모드 · 효과', exact: true }).click();
  await page.getByRole('button', { name: '네 컷', exact: true }).click();
  await page.getByRole('button', { name: '1:1', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const choice = page.getByRole('button', { name: method, exact: true });
  await expect(choice).toBeVisible(); await choice.click();
}

async function completeManual(page: Page) {
  await booth(page, '수동');
  for (let n = 1; n <= 4; n++) {
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    if (n < 4) await expect(page.locator('.capture-cell.complete')).toHaveCount(n);
  }
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
}

// Catches an unconditional automatic timer or an unlocked mid-sequence switch.
test('manual booth waits for every shutter press and locks its method during the sequence', async ({ page }) => {
  await booth(page, '수동');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '자동', exact: true })).toBeDisabled();
  await page.waitForTimeout(3500);
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await expect(page.locator('.cell-countdown')).toHaveCount(0);
  for (let n = 2; n <= 4; n++) {
    await page.getByRole('button', { name: '촬영', exact: true }).click();
    if (n < 4) await expect(page.locator('.capture-cell.complete')).toHaveCount(n);
  }
  await expect(page.getByRole('dialog', { name: '촬영 확인' })).toBeVisible();
});

// Catches a timer left alive on pause, or resume failing to restart it.
test('automatic booth can pause on screen and resume to exactly four cuts', async ({ page }) => {
  await booth(page, '자동');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.cell-countdown')).toBeVisible();
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await page.waitForTimeout(3500);
  await expect(page.locator('.capture-cell.complete')).toHaveCount(1);
  await expect(page.locator('.cell-countdown')).toHaveCount(0);
  await page.getByRole('button', { name: '계속 촬영', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '촬영 확인' })).toBeVisible({ timeout: 16000 });
  await expect(page.locator('.capture-retakes button')).toHaveCount(4);
});

test('automatic controls do not cover cut labels in short landscape while running or paused', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 }); await booth(page, '자동');
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.locator('.cell-countdown')).toBeVisible();
  const clearLabels = async () => {
    const covered = await page.evaluate(() => {
      const hud = document.querySelector('.capture-progress')!.getBoundingClientRect();
      return [...document.querySelectorAll('.cell-label')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < hud.right && r.right > hud.left && r.top < hud.bottom && r.bottom > hud.top;
      }).length;
    });
    expect(covered).toBe(0);
  };
  await clearLabels(); await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await clearLabels(); await expect(page.getByRole('button', { name: '계속 촬영', exact: true })).toBeVisible();
});

// Catches missing real thumbnails or retake replacing other frozen cuts.
test('result thumbnails retake only the chosen cut and keep manual capture manual', async ({ page }) => {
  await completeManual(page);
  const pixels = () => page.locator('.capture-result').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    return [0, 1].map((column) => Array.from(ctx.getImageData(Math.floor(c.width * (.08 + column * .5)), Math.floor(c.height * .08), Math.floor(c.width * .3), Math.floor(c.height * .3)).data).join(','));
  });
  const before = await pixels();
  const retake = page.getByRole('button', { name: '2번째 다시 찍기', exact: true });
  await expect.poll(() => retake.locator('canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data[1])).toBeGreaterThan(0);
  await retake.click();
  await expect(page.locator('.capture-cell.current')).toContainText('2');
  await expect(page.locator('.capture-cell.complete')).toHaveCount(3);
  await page.getByRole('button', { name: '촬영', exact: true }).click();
  await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
  const after = await pixels();
  expect(after[0]).toBe(before[0]); expect(after[1]).not.toBe(before[1]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유 / 저장', exact: true }).click(); await download;
  await expect(page.getByRole('button', { name: '수동', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '자동', exact: true })).toBeEnabled();
});

test('keyboard focus stays in review when sharing disables the focused save button', async ({ page }) => {
  await completeManual(page);
  // Only the external share sheet is deferred; capture, review, and focus handling stay real.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => new Promise(() => {}) });
  });
  const save = page.getByRole('button', { name: '공유 / 저장', exact: true });
  await save.click(); await expect(save).toBeDisabled();
  for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await expect(page.locator('.capture-layout summary')).toBeFocused();
  }
});

for (const close of ['button', 'escape', 'backdrop']) {
  // Catches accidental dismiss discarding the result before confirmation.
  test(`result survives declining ${close} dismissal and discards only on confirmation`, async ({ page }) => {
    await completeManual(page);
    const result = page.locator('.capture-result');
    const before = await result.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const dismiss = async () => {
      if (close === 'button') await page.getByRole('button', { name: '닫기', exact: true }).click();
      else if (close === 'escape') await page.keyboard.press('Escape');
      else await page.locator('.camera-dialog-back').click({ position: { x: 2, y: 2 } });
    };
    const confirmation = page.waitForEvent('dialog', { timeout: 5000 });
    const action = dismiss(); const dialog = await confirmation;
    expect(dialog.type()).toBe('confirm'); await dialog.dismiss(); await action;
    await expect(result).toBeVisible();
    expect(await result.evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(before);
    page.once('dialog', (dialog) => dialog.accept()); await dismiss();
    await expect(page.getByRole('dialog', { name: '촬영 확인' })).toHaveCount(0);
    await expect(page.locator('.capture-cell.complete')).toHaveCount(0);
  });
}

for (const [width, height] of [[320, 740], [844, 390], [1440, 900]]) {
  // Catches a save action scrolling off-screen or a narrow-screen overflow.
  test(`save stays visible while reviewing strip layout at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await completeManual(page);
    const options = page.getByText('배치 · 여백', { exact: true });
    await expect(options).toBeVisible(); await options.click();
    await page.getByRole('button', { name: '세로 스트립', exact: true }).click();
    await expect(page.getByRole('button', { name: '공유 / 저장', exact: true })).toBeEnabled();
    const body = page.locator('.capture-review-body');
    for (const bottom of [false, true]) {
      await body.evaluate((el, bottom) => { el.scrollTop = bottom ? el.scrollHeight : 0; }, bottom);
      const save = (await page.getByRole('button', { name: '공유 / 저장', exact: true }).boundingBox())!;
      expect(save.y).toBeGreaterThanOrEqual(0); expect(save.y + save.height).toBeLessThanOrEqual(height);
      expect(save.x).toBeGreaterThanOrEqual(0); expect(save.x + save.width).toBeLessThanOrEqual(width);
      const atCenter = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent, { x: save.x + save.width / 2, y: save.y + save.height / 2 });
      expect(atCenter).toBe('공유 / 저장');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
