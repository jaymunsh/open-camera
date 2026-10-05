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

type ResumeWindow = Window & { beforeResumeTrack: MediaStreamTrack; cameraStartCount: number; startsBeforeSuspend: number };
async function countCameraStarts(page: Page) {
  await page.addInitScript(() => {
    const probe = window as unknown as ResumeWindow;
    probe.cameraStartCount = 0;
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => { probe.cameraStartCount++; return getMedia(constraints); };
  });
}
async function suspendCamera(page: Page, bfcache = false) {
  await page.evaluate((bfcache) => {
    const video = document.querySelector('video')!;
    const probe = window as unknown as ResumeWindow;
    probe.beforeResumeTrack = (video.srcObject as MediaStream).getVideoTracks()[0];
    probe.startsBeforeSuspend = probe.cameraStartCount;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    if (bfcache) window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  }, bfcache);
}
async function resumeCamera(page: Page, bfcache = false) {
  await page.evaluate((bfcache) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    if (bfcache) window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, bfcache);
}

// These prove recovery behavior in the real App/hook, not iPhone optical FoV.
test('front camera starts at the widest reported native zoom instead of assuming web 1 is wide', async ({ page }) => {
  await cameraZoom(page, { min: .8, max: 5, step: .1 });
  await front(page);
  await expect(await inspect(page)).toContainText('현재 값 0.8');
  await expect(page.locator('.zoombar')).toHaveCount(0);
});

for (const bfcache of [false, true]) {
  test(`front camera reconnects after background${bfcache ? ' and BFCache' : ''} without losing selected zoom or ratio`, async ({ page }) => {
    await cameraZoom(page, { min: .5, max: 5, step: .1 });
    await countCameraStarts(page);
    await front(page);
    const selectedZoom = bfcache ? 1 : .5;
    const selectedButton = page.locator('.zoombar button').filter({ hasText: bfcache ? /^1$/ : /^\.5$/ });
    await selectedButton.click();
    // A non-default ratio must survive recovery, not just the default 3:4.
    await page.getByRole('button', { name: '비율', exact: true }).click();
    const chosenRatio = await page.locator('.ratio-btn').textContent();
    await suspendCamera(page, bfcache);
    await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as ResumeWindow).beforeResumeTrack.readyState)).toBe('ended');
    await resumeCamera(page, bfcache);
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
      return video && video.currentTime > .1 && track?.readyState === 'live' && track !== (window as unknown as ResumeWindow).beforeResumeTrack;
    });
    await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
    await expect(page.locator('.ratio-btn')).toHaveText(chosenRatio!);
    await expect(selectedButton).toHaveClass('on');
    await expect(await inspect(page)).toContainText(`현재 값 ${selectedZoom}`);
    expect(await page.evaluate(() => {
      const probe = window as unknown as ResumeWindow;
      return probe.cameraStartCount - probe.startsBeforeSuspend;
    })).toBe(1);
  });
}

test('front camera without a zoom API still replaces a suspended stream without inventing a zoom setting', async ({ page }) => {
  await cameraZoom(page, null);
  await front(page);
  await suspendCamera(page);
  expect(await page.evaluate(() => (window as unknown as ResumeWindow).beforeResumeTrack.readyState)).toBe('ended');
  await resumeCamera(page);
  await cameraFrame(page, 'user');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await expect(await inspect(page)).toContainText('현재 값 미제공');
  await expect(page.locator('.zoombar')).toHaveCount(0);
});

test('back camera keeps its existing live-stream resume behavior', async ({ page }) => {
  await cameraZoom(page, { min: .5, max: 5, step: .1 });
  await countCameraStarts(page);
  await page.goto('/');
  await cameraFrame(page, 'environment');
  await suspendCamera(page, true);
  expect(await page.evaluate(() => (window as unknown as ResumeWindow).beforeResumeTrack.readyState)).toBe('live');
  await resumeCamera(page, true);
  await cameraFrame(page, 'environment');
  expect(await page.evaluate(() => {
    const probe = window as unknown as ResumeWindow;
    return probe.cameraStartCount - probe.startsBeforeSuspend;
  })).toBe(0);
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
});

test('back camera whose first frames arrive while hidden is usable on return without restarting', async ({ page }) => {
  await cameraZoom(page, null);
  await countCameraStarts(page);
  await page.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  });
  await page.goto('/');
  await cameraFrame(page, 'environment');
  const starts = await page.evaluate(() => (window as unknown as ResumeWindow).cameraStartCount);
  await resumeCamera(page);
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as ResumeWindow).cameraStartCount)).toBe(starts);
});

test('front camera recovers from pagehide/pageshow even without visibility events', async ({ page }) => {
  await cameraZoom(page, null);
  await front(page);
  const previousTrack = await page.evaluateHandle(() => (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0]);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeDisabled();
  expect(await previousTrack.evaluate(track => track.readyState)).toBe('ended');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await cameraFrame(page, 'user');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  expect(await previousTrack.evaluate(track => track !== (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0])).toBe(true);
});

test('a delayed selfie request cannot replace the fresh stream after background recovery', async ({ page }) => {
  await cameraZoom(page, null);
  await page.addInitScript(() => {
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let holdFirstSelfie = true;
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await getMedia(constraints);
      const facing = (constraints?.video as MediaTrackConstraints)?.facingMode;
      if (typeof facing === 'object' && facing.ideal === 'user' && holdFirstSelfie) {
        holdFirstSelfie = false;
        await new Promise<void>(resolve => Object.assign(window, {
          releaseDelayedSelfie: resolve, delayedSelfieTrack: stream.getVideoTracks()[0],
        }));
      }
      return stream;
    };
  });
  await page.goto('/');
  await cameraFrame(page, 'environment');
  await page.getByRole('button', { name: '카메라 전환', exact: true }).click();
  await page.waitForFunction(() => 'releaseDelayedSelfie' in window);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeDisabled();
  await resumeCamera(page);
  await cameraFrame(page, 'user');
  const freshTrack = await page.evaluateHandle(() => (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0]);
  await page.evaluate(() => (window as unknown as { releaseDelayedSelfie: () => void }).releaseDelayedSelfie());
  await page.waitForFunction(() => (window as unknown as { delayedSelfieTrack: MediaStreamTrack }).delayedSelfieTrack.readyState === 'ended');
  expect(await freshTrack.evaluate(track => track === (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0])).toBe(true);
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
});

test('rapid return to background defers selfie recovery until visible and retains selected zoom', async ({ page }) => {
  await cameraZoom(page, { min: .5, max: 5, step: .1 });
  await countCameraStarts(page);
  await front(page);
  await page.locator('.zoombar button').filter({ hasText: /^1$/ }).click();
  await suspendCamera(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    // The nonce update is queued, but the page is hidden again before its effect runs.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Wait for React's queued effect without relying on an arbitrary sleep.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => {
    const probe = window as unknown as ResumeWindow;
    return probe.cameraStartCount - probe.startsBeforeSuspend;
  })).toBe(0);
  await resumeCamera(page);
  await cameraFrame(page, 'user');
  await expect(page.getByRole('button', { name: '촬영', exact: true })).toBeEnabled();
  await expect(page.locator('.zoombar button').filter({ hasText: /^1$/ })).toHaveClass('on');
  await expect(await inspect(page)).toContainText('현재 값 1');
});

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
