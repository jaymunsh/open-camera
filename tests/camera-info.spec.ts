import { expect, test, type Page } from '@playwright/test';

// A physical zoom device is unavailable in CI. Keep the real camera stream and
// emulate only its optional capability/settings boundary, not App or useCamera.
async function cameraZoom(page: Page, range: { min: number; max: number; step: number } | null, ignoreOne = false, rearCount: number | null = null) {
  await page.addInitScript(({ range, ignoreOne, rearCount }) => {
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const caps = MediaStreamTrack.prototype.getCapabilities;
    const settings = MediaStreamTrack.prototype.getSettings;
    const apply = MediaStreamTrack.prototype.applyConstraints;
    const values = new WeakMap<MediaStreamTrack, { facing: string; zoom: number }>();
    if (rearCount !== null) navigator.mediaDevices.enumerateDevices = async () =>
      Array.from({ length: rearCount + 1 }, (_, i) => ({
        kind: 'videoinput' as const, deviceId: `camera-${i}`, groupId: 'test-cameras',
        label: i === rearCount ? 'Front Camera' : `Back Camera ${i + 1}`,
        toJSON() { return {}; },
      }));
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getMedia(constraints);
      const video = constraints?.video as MediaTrackConstraints;
      const facing = typeof video?.facingMode === 'object' ? video.facingMode.ideal as string : 'environment';
      for (const track of stream.getVideoTracks()) values.set(track, { facing, zoom: 1 });
      return stream;
    };
    MediaStreamTrack.prototype.getCapabilities = function () {
      const actual = caps.call(this);
      return range ? { ...actual, zoom: range } : actual;
    };
    MediaStreamTrack.prototype.getSettings = function () {
      const value = values.get(this);
      return { ...settings.call(this), facingMode: value?.facing, ...(range ? { zoom: value?.zoom } : {}) };
    };
    MediaStreamTrack.prototype.applyConstraints = async function (constraints) {
      const zoom = (constraints?.advanced?.[0] as { zoom?: number } | undefined)?.zoom;
      if (range && typeof zoom === 'number') {
        const value = values.get(this)!;
        if (!(ignoreOne && zoom === 1)) value.zoom = Math.min(range.max, Math.max(range.min, zoom));
        return;
      }
      return apply.call(this, constraints);
    };
  }, { range, ignoreOne, rearCount });
}

async function front(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '카메라 전환', exact: true }).click();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await cameraFrame(page, 'user');
}

// An absent control during startup is not evidence of an unsupported preset.
// Wait for frames from the new track, not the previous camera's ready state.
async function cameraFrame(page: Page, facing: string) {
  await page.waitForFunction((facing) => {
    const video = document.querySelector('video');
    const stream = video?.srcObject as MediaStream | null;
    return video && video.currentTime > .1 && stream?.getVideoTracks()[0]?.getSettings().facingMode === facing;
  }, facing);
}

async function inspect(page: Page) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.locator('.camera-info summary').click();
  return page.locator('.camera-info');
}

// Catches rear lens-count guesses leaking into the selfie presets. Returning
// to the back camera must preserve its existing narrow/wide-screen shortcuts.
for (const [width, rearTele] of [[390, '3'], [430, '5']] as const) {
  test(`front camera drops rear tele presets at ${width}px without changing back-camera controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 932 });
    await cameraZoom(page, { min: 1, max: 5, step: .1 }, false, 3);
    await front(page);
    await expect(page.locator('.zoombar')).toHaveCount(0);
    await expect(await inspect(page)).toContainText('웹 줌: 1–5');
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page.getByRole('button', { name: '카메라 전환', exact: true }).click();
    await expect(page.locator('.zoombar button')).toHaveText(['1', rearTele]);
    await page.getByRole('button', { name: '카메라 전환', exact: true }).click();
    await cameraFrame(page, 'user');
    await expect(page.locator('.zoombar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  });
}

// Catches confusing the minimum zoom with the requested 0.5 preset, and proves
// the real App applies 0.5 then reads the actual settings of the active track.
for (const min of [.4, .5]) {
  test(`front camera offers working half zoom when its reported range starts at ${min}`, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await cameraZoom(page, { min, max: 5, step: .1 }, false, 3);
    await front(page);
    await expect(page.locator('.zoombar button')).toHaveText(['.5', '1']);
    const half = page.locator('.zoombar button').filter({ hasText: /^\.5$/ });
    await half.click();
    await expect(half).toHaveClass('on');
    await expect(await inspect(page)).toContainText('현재 값 0.5');
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page.locator('.zoombar button').filter({ hasText: /^1$/ }).click();
    await expect(page.locator('.zoombar button').filter({ hasText: /^1$/ })).toHaveClass('on');
    await expect(await inspect(page)).toContainText('현재 값 1');
  });
}

test('front camera does not invent half zoom when its reported minimum is above 0.5', async ({ page }) => {
  await cameraZoom(page, { min: .8, max: 5, step: .1 }, false, 3);
  await front(page);
  await expect(page.locator('.zoombar')).toHaveCount(0);
  await expect(await inspect(page)).toContainText('웹 줌: 0.8–5');
});

test('front camera without web zoom exposes an honest local report without a fake half-zoom button', async ({ page }) => {
  await cameraZoom(page, null); await front(page);
  await expect(page.locator('.zoombar')).toHaveCount(0);
  const info = await inspect(page);
  await expect(info).toContainText('전면');
  await expect(info).toContainText('범위 미제공');
  await expect(info).toContainText('현재 값 미제공');
  await expect(info).toContainText('기본 카메라');
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
});

test('zoom controls reflect actual readback when a browser silently ignores an optional request', async ({ page }) => {
  await cameraZoom(page, { min: .5, max: 1, step: .1 }, true); await front(page);
  const half = page.locator('.zoombar button').filter({ hasText: /^\.5$/ });
  await half.click(); await expect(half).toHaveClass('on');
  await page.locator('.zoombar button').filter({ hasText: /^1$/ }).click();
  await expect(half).toHaveClass('on');
  const info = await inspect(page);
  await expect(info).toContainText('0.5–1');
  await expect(info).toContainText('현재 값 0.5');
  await expect(info).toContainText('전면');
  // Reopening must sample the new active camera, not reuse the selfie report.
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: '카메라 전환', exact: true }).click();
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await expect(await inspect(page)).toContainText('후면');
  await expect(page.locator('.camera-info')).toContainText('현재 값 1');
});

test('fixed zoom range stays distinguishable from an unavailable range and fits a short menu', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await cameraZoom(page, { min: 1, max: 1, step: 0 }); await front(page);
  await expect(page.locator('.zoombar')).toHaveCount(0);
  const info = await inspect(page);
  await expect(info).toContainText('1–1');
  await expect(info).toContainText('현재 값 1');
  await info.locator('p').last().scrollIntoViewIfNeeded();
  const menu = (await page.locator('.menu').boundingBox())!;
  expect(menu.y + menu.height).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(667);
});

// Catches publishing the track after play(), even though loadeddata already
// made the camera ready and a user can open its information panel.
test('camera report is available when video loads before the play promise resolves', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let release: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releaseCameraPlay: () => release() });
    HTMLMediaElement.prototype.play = function () { return play.call(this).then(() => pending); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  try { await expect(await inspect(page)).toContainText('웹 줌:'); }
  finally { await page.evaluate(() => (window as unknown as { releaseCameraPlay: () => void }).releaseCameraPlay()); }
});
