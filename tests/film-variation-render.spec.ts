import { expect, test } from '@playwright/test';

test.describe('film variation renderer', () => {
  test('a fixed pattern survives time changes and separate renderers while legacy grain stays untouched', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/pipeline.ts'; const { FilterPipeline } = await import(/* @vite-ignore */ path);
      const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
      const source = document.createElement('canvas'); source.width = 320; source.height = 240;
      const ctx = source.getContext('2d')!; ctx.fillStyle = '#80906a'; ctx.fillRect(0, 0, 320, 240);
      const make = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const p = new FilterPipeline(c); p.setSource(source); return { c, p, gl: c.getContext('webgl2')! }; };
      const a = make(), b = make();
      const read = async (r: typeof a) => {
        const data = new Uint8Array(320 * 240 * 4); r.gl.readPixels(0, 0, 320, 240, r.gl.RGBA, r.gl.UNSIGNED_BYTE, data);
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).join(',');
      };
      const fx = { grain: .5, leak: .3, dust: .2, cnoise: .2, seed: .25 };
      a.p.render(DEFAULT_PARAMS, 0, { time: 0, fx }); const legacy = await read(a);
      let uploads = 0; const upload = a.gl.texImage2D.bind(a.gl); (a.gl as any).texImage2D = (...args: any[]) => { uploads++; (upload as any)(...args); };
      const fixed = { ...fx, pattern: { version: 1, seed: .25 } };
      a.p.render(DEFAULT_PARAMS, 0, { time: 0, fx: fixed }); const first = await read(a), firstUploads = uploads;
      a.p.render(DEFAULT_PARAMS, 0, { time: 100, fx: fixed }); const later = await read(a), afterRepeat = uploads;
      b.p.render(DEFAULT_PARAMS, 0, { time: 0, fx: fixed }); const independent = await read(b);
      a.p.render(DEFAULT_PARAMS, 0, { fx: { ...fixed, seed: .75, pattern: { version: 1, seed: .75 } } }); const other = await read(a);
      a.p.render(DEFAULT_PARAMS, 0, { time: 0, fx }); const returned = await read(a);
      return { first, later, independent, other, legacy, returned, firstUploads, afterRepeat, error: a.gl.getError() };
    });
    expect(result.first).toBe(result.later); expect(result.independent).toBe(result.first); expect(result.other).not.toBe(result.first);
    expect(result.returned).toBe(result.legacy); expect(result.firstUploads).toBeGreaterThan(0); expect(result.afterRepeat).toBe(result.firstUploads); expect(result.error).toBe(0);
  });

  test('fixed grain is recreated with the same seed after GPU context loss', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/pipeline.ts'; const { FilterPipeline } = await import(/* @vite-ignore */ path);
      const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; document.body.append(c);
      const p = new FilterPipeline(c), gl = c.getContext('webgl2')!, ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return null;
      const source = document.createElement('canvas'); source.width = 320; source.height = 240;
      source.getContext('2d')!.fillStyle = '#80906a'; source.getContext('2d')!.fillRect(0, 0, 320, 240);
      const render = async () => {
        p.setSource(source); p.setLUT(null, null); p.render(DEFAULT_PARAMS, 0, { fx: { grain: .5, seed: .25, pattern: { version: 1, seed: .25 } } });
        const pixels = new Uint8Array(320 * 240 * 4); gl.readPixels(0, 0, 320, 240, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))).join(',');
      };
      const before = await render();
      const lost = new Promise<void>(resolve => c.addEventListener('webglcontextlost', () => resolve(), { once: true })); ext.loseContext(); await lost;
      const restored = new Promise<void>(resolve => c.addEventListener('webglcontextrestored', () => resolve(), { once: true }));
      // The extension requires loss to finish processing before requesting restoration.
      await new Promise(resolve => setTimeout(resolve, 100)); ext.restoreContext(); await restored;
      const after = await render(); c.remove();
      return { before, after, error: gl.getError() };
    });
    expect(result).not.toBeNull(); expect(result!.after).toBe(result!.before); expect(result!.error).toBe(0);
  });

  test('concurrent pattern exports keep their owned input and output pixels separate', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const path = '/src/engine/pipeline.ts'; const { renderFilteredCanvas } = await import(/* @vite-ignore */ path);
      const typesPath = '/src/engine/types.ts'; const { DEFAULT_PARAMS } = await import(/* @vite-ignore */ typesPath);
      const sources = ['#ff0000', '#0000ff'].map(color => { const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d')!; x.fillStyle = color; x.fillRect(0, 0, 160, 160); return c; });
      const before = sources.map(c => c.toDataURL());
      const out = await Promise.all(sources.map((c, i) => renderFilteredCanvas(c, DEFAULT_PARAMS, null, null, 0, false, null, { degrade: .5, grain: .1, pattern: { version: 1, seed: i ? .75 : .25 } })));
      return { sameInput: sources.every((c, i) => c.toDataURL() === before[i]), pixels: out.map(c => Array.from(c.getContext('2d')!.getImageData(80, 80, 1, 1).data)) };
    });
    expect(result.sameInput).toBe(true); expect(result.pixels[0][0]).toBeGreaterThan(200); expect(result.pixels[0][2]).toBeLessThan(30);
    expect(result.pixels[1][2]).toBeGreaterThan(200); expect(result.pixels[1][0]).toBeLessThan(30);
  });
});
