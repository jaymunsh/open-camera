import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const cube = 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n';

async function editGray(page: Page) {
  await page.goto('/');
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgb(64,64,64)';
    ctx.fillRect(0, 0, 64, 64);
    return c.toDataURL().split(',')[1];
  });
  await page.locator('input[type=file]').nth(0).setInputFiles({
    name: 'gray.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64'),
  });
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible();
}

async function setAdjustment(page: Page, name: string, value: number) {
  await page.getByRole('button', { name: '조절', exact: true }).click();
  await page.locator('.adj-chip').filter({ hasText: name }).click();
  await page.locator('.adj-slider input').evaluate((input, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect(page.locator('.adj-slider input')).toHaveValue(String(value));
}

async function exportPixel(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const download = await downloading;
  const bytes = await readFile((await download.path())!);
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    return Array.from(ctx.getImageData(32, 32, 1, 1).data).slice(0, 3);
  }, Array.from(bytes));
}

async function bake(page: Page, number = 1) {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: 'LUT 만들기', exact: true }).click();
  await expect(page.locator('.filter-name')).toHaveText(`CUSTOM ${number}`);
  await expect(page.locator('.filter-name')).not.toHaveClass(/pending/);
}

test('baking exposure preserves the saved image instead of applying exposure twice', async ({ page }) => {
  await editGray(page);
  await setAdjustment(page, '노출', 1);
  const before = await exportPixel(page);
  expect(before[0]).toBeGreaterThanOrEqual(125);
  expect(before[0]).toBeLessThanOrEqual(131);
  await bake(page);
  const after = await exportPixel(page);
  after.forEach((v, i) => expect(Math.abs(v - before[i])).toBeLessThanOrEqual(8));
  await page.getByRole('button', { name: '조절', exact: true }).click();
  await page.locator('.adj-chip').filter({ hasText: '노출' }).click();
  await expect(page.locator('.adj-slider input')).toHaveValue('0');
});

test('baking resets LUT strength but preserves unbaked spatial adjustments', async ({ page }) => {
  await editGray(page);
  await page.locator('.strip-item').filter({ hasText: /^WARM$/ }).click();
  await expect(page.locator('.filter-name')).not.toHaveClass(/pending/);
  await setAdjustment(page, '강도', 0.4);
  await setAdjustment(page, '명료함', 0.3);
  await setAdjustment(page, '블룸', 0.2);
  await bake(page);
  await page.getByRole('button', { name: '조절', exact: true }).click();
  for (const [name, value] of [['강도', '1'], ['명료함', '0.3'], ['블룸', '0.2']]) {
    await page.locator('.adj-chip').filter({ hasText: name }).click();
    await expect(page.locator('.adj-slider input')).toHaveValue(value);
  }
});

test('repeated bakes use the newly selected filter rather than a previous bake texture', async ({ page }) => {
  await editGray(page);
  await page.locator('.strip-item').filter({ hasText: /^SEPIA$/ }).click();
  await bake(page);
  await page.locator('.strip-item').filter({ hasText: /^MONO$/ }).click();
  await expect(page.locator('.filter-name')).toHaveText('MONO');
  const before = await exportPixel(page);
  await bake(page, 2);
  const after = await exportPixel(page);
  after.forEach((v, i) => expect(Math.abs(v - before[i])).toBeLessThanOrEqual(8));
});

test('bake completion preserves adjustments changed while its image encoding is pending', async ({ page }) => {
  await editGray(page);
  await setAdjustment(page, '노출', 1);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      (window as any).finishBaking = () => original.call(this, callback, type, quality);
    };
  });
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('button', { name: 'LUT 만들기', exact: true }).click();
  await page.waitForFunction(() => typeof (window as any).finishBaking === 'function');
  await setAdjustment(page, '노출', 0.2);
  await page.evaluate(() => (window as any).finishBaking());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('oc-custom') ?? '[]').length === 1);
  await expect(page.locator('.toast')).toContainText('저장');
  await expect(page.locator('.adj-slider input')).toHaveValue('0.2');
  await expect(page.locator('.filter-name')).toHaveText('ORIGINAL');
});

test('invalid cube is rejected without registering it or showing success', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').nth(2).setInputFiles({
    name: 'broken.cube', mimeType: 'text/plain', buffer: Buffer.from('not a LUT'),
  });
  await expect(page.locator('.overlay-msg')).toContainText('지원하지 않는');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oc-custom') ?? '[]'))).toEqual([]);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('blocked IndexedDB does not register a missing custom LUT', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', {
    get() { throw new DOMException('storage blocked', 'SecurityError'); },
  }));
  await page.goto('/');
  await page.locator('input[type=file]').nth(2).setInputFiles({
    name: 'identity.cube', mimeType: 'text/plain', buffer: Buffer.from(cube),
  });
  await expect(page.locator('.overlay-msg')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oc-custom') ?? '[]'))).toEqual([]);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('an aborted IndexedDB write rejects instead of reporting successful storage', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { idbPut, idbGet } = await import('/src/utils/lutStore.ts');
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args as Parameters<typeof original>);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
    let rejected = false;
    try { await idbPut('aborted-write', new ArrayBuffer(1)); } catch { rejected = true; }
    IDBDatabase.prototype.transaction = original;
    return { rejected, stored: await idbGet('aborted-write') };
  });
  expect(result).toEqual({ rejected: true, stored: null });
});

test('custom LUT bytes survive reload after success and metadata failure rolls back registration', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (text) => {
    const { addCustomLut, listCustomLuts, loadCustomLut } = await import('/src/engine/lut.ts');
    const entry = await addCustomLut('valid', new TextEncoder().encode(text).buffer, 'cube');
    const loaded = await loadCustomLut(entry.id);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'oc-custom') throw new DOMException('quota full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    let rejected = false;
    try { await addCustomLut('not-saved', new TextEncoder().encode(text).buffer, 'cube'); }
    catch { rejected = true; }
    Storage.prototype.setItem = original;
    return { rejected, names: listCustomLuts().map((v: { name: string }) => v.name), size: loaded.size };
  }, cube);
  expect(result).toEqual({ rejected: true, names: ['valid'], size: 2 });
  await page.reload();
  const reload = await page.evaluate(async () => {
    const { listCustomLuts, loadCustomLut } = await import('/src/engine/lut.ts');
    return (await loadCustomLut(listCustomLuts()[0].id)).size;
  });
  expect(reload).toBe(2);
});

test('an aborted custom LUT deletion preserves its entry and data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (text) => {
    const { addCustomLut, removeCustomLut, listCustomLuts } = await import('/src/engine/lut.ts');
    const { idbGet } = await import('/src/utils/lutStore.ts');
    const entry = await addCustomLut('keep', new TextEncoder().encode(text).buffer, 'cube');
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args as Parameters<typeof original>);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
    let rejected = false;
    try { await removeCustomLut(entry.id); } catch { rejected = true; }
    IDBDatabase.prototype.transaction = original;
    return { rejected, names: listCustomLuts().map((e: { name: string }) => e.name), bytes: !!(await idbGet(`custom-${entry.id}`)) };
  }, cube);
  expect(result).toEqual({ rejected: true, names: ['keep'], bytes: true });
});

test('metadata failure during deletion restores the original LUT data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (text) => {
    const { addCustomLut, removeCustomLut, listCustomLuts } = await import('/src/engine/lut.ts');
    const { idbGet } = await import('/src/utils/lutStore.ts');
    const entry = await addCustomLut('keep', new TextEncoder().encode(text).buffer, 'cube');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'oc-custom') throw new DOMException('storage blocked', 'SecurityError');
      return original.call(this, key, value);
    };
    let rejected = false;
    try { await removeCustomLut(entry.id); } catch { rejected = true; }
    Storage.prototype.setItem = original;
    return { rejected, names: listCustomLuts().map((e: { name: string }) => e.name), bytes: !!(await idbGet(`custom-${entry.id}`)) };
  }, cube);
  expect(result).toEqual({ rejected: true, names: ['keep'], bytes: true });
});

test('failed LUT fetch can recover without reloading the app', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadPresetLut } = await import('/src/engine/lut.ts?network-retry-test');
    const { idbDel } = await import('/src/utils/lutStore.ts');
    const keys = await new Promise<string[]>((resolve) => {
      const r = indexedDB.open('oc-store', 1);
      r.onsuccess = () => { const db = r.result; const q = db.transaction('lut-files').objectStore('lut-files').getAllKeys();
        q.onsuccess = () => { resolve(q.result.map(String)); db.close(); }; };
    });
    for (const k of keys.filter(k => k.includes('amatorka'))) await idbDel(k);
    const original = window.fetch;
    window.fetch = (...args) => String(args[0]).includes('lookup_amatorka')
      ? Promise.reject(new TypeError('synthetic offline')) : original(...args);
    let firstFailed = false;
    try { await loadPresetLut('amatorka'); } catch { firstFailed = true; }
    window.fetch = original;
    let size = 0;
    try { size = (await loadPresetLut('amatorka')).size; } catch { /* assertion below */ }
    return { firstFailed, size };
  });
  expect(result).toEqual({ firstFailed: true, size: 64 });
});

test('HTTP failures are rejected before caching even if the body resembles a valid LUT', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadPresetLut } = await import('/src/engine/lut.ts?http-status-test');
    const { idbDel } = await import('/src/utils/lutStore.ts');
    const r = indexedDB.open('oc-store', 1);
    const keys = await new Promise<string[]>((resolve) => { r.onsuccess = () => {
      const q = r.result.transaction('lut-files').objectStore('lut-files').getAllKeys();
      q.onsuccess = () => { resolve(q.result.map(String)); r.result.close(); }; }; });
    for (const k of keys.filter(k => k.includes('amatorka'))) await idbDel(k);
    const original = window.fetch;
    const validBody = await original('/luts/lookup_amatorka.png').then(r => r.arrayBuffer());
    window.fetch = (...args) => String(args[0]).includes('lookup_amatorka')
      ? Promise.resolve(new Response(validBody, { status: 404 })) : original(...args);
    let rejected = false;
    try { await loadPresetLut('amatorka'); } catch { rejected = true; }
    window.fetch = original;
    return rejected;
  });
  expect(result).toBe(true);
});

for (const mode of ['edit', 'camera']) {
  test(`${mode} image export failure is visible and does not escape as an unhandled rejection`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    if (mode === 'edit') await editGray(page);
    else { await page.goto('/'); await page.waitForFunction(() => document.querySelector('video')!.readyState >= 2); }
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = callback => callback(null); });
    await page.getByRole('button', { name: mode === 'edit' ? '저장' : '촬영', exact: true }).click();
    await expect(page.locator('.overlay-msg')).toContainText('이미지 저장에 실패했습니다');
    expect(errors).toEqual([]);
    await expect(page.getByRole('button', { name: mode === 'edit' ? '저장' : '촬영', exact: true })).toBeEnabled();
  });
}

test('entering photo edit ends camera capture and returning starts a new live track', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('video')!.readyState >= 2);
  await page.evaluate(() => { (window as any).previousCameraTrack = (document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0]; });
  await page.locator('input[type=file]').nth(0).setInputFiles('public/samples/sample1.png');
  await expect.poll(() => page.evaluate(() => (window as any).previousCameraTrack.readyState)).toBe('ended');
  await page.getByRole('button', { name: '카메라', exact: true }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video')!;
    const t = (v.srcObject as MediaStream | null)?.getVideoTracks()[0];
    return v.readyState >= 2 && t?.readyState === 'live' && t !== (window as any).previousCameraTrack;
  });
});

test('bundled LUT requests use a content-versioned URL', async ({ page }) => {
  const urls: string[] = []; page.on('request', r => { if (r.url().includes('/luts/')) urls.push(r.url()); });
  await page.goto('/');
  await expect.poll(() => urls.length).toBeGreaterThan(0);
  expect(urls.every(url => /^[a-f0-9]{16}$/.test(new URL(url).searchParams.get('v') ?? ''))).toBe(true);
});

test('a regular photo is not silently accepted as a HaldCLUT image', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').nth(2).setInputFiles('public/samples/sample1.png');
  await expect(page.locator('.overlay-msg')).toContainText('LUT 이미지');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oc-custom') ?? '[]'))).toEqual([]);
});

test('face model initialization can recover after a temporary model download failure', async ({ page }) => {
  let fail = true;
  await page.route('**/models/face_landmarker.task*', route => fail ? route.abort() : route.continue());
  await page.goto('/');
  const first = await page.evaluate(async () => {
    const { getLandmarker } = await import('/src/beauty/face.ts');
    try { await getLandmarker(); return false; } catch { return true; }
  });
  expect(first).toBe(true);
  fail = false;
  const recovered = await page.evaluate(async () => {
    const { getLandmarker } = await import('/src/beauty/face.ts');
    try { return !!(await getLandmarker()); } catch { return false; }
  });
  expect(recovered).toBe(true);
});

test('face runtime and model requests all carry the same content version', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', r => { if (/\/(wasm|models)\//.test(r.url())) urls.push(r.url()); });
  await page.goto('/');
  const initialized = await page.evaluate(async () => {
    const { getLandmarker } = await import('/src/beauty/face.ts');
    try { return !!(await getLandmarker()); } catch { return false; }
  });
  expect(initialized).toBe(true);
  expect(urls.some(url => url.includes('/models/'))).toBe(true);
  expect(urls.some(url => url.includes('.wasm'))).toBe(true);
  const versions = urls.map(url => new URL(url).searchParams.get('v'));
  expect(versions.every(v => /^[a-f0-9]{16}$/.test(v ?? ''))).toBe(true);
  expect(new Set(versions).size).toBe(1);
});
