import { test, expect } from '@playwright/test';

// Catches fake/new color substitutions, missing profile snapshots and mutable definitions.
test('signature candidates reuse credited color data with independent versioned texture snapshots', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    let api; try { api = await load('/src/engine/signatureFilms.ts'); } catch { return { available: false }; }
    const { PRESETS, loadPresetLut, loadSignatureCandidate, SIGNATURE_CANDIDATE_PRESETS } = await load('/src/engine/lut.ts');
    const { DEFAULT_PARAMS } = await load('/src/engine/types.ts'); const { renderFilteredCanvas } = await load('/src/engine/pipeline.ts');
    const source = document.createElement('canvas'); source.width = source.height = 64; source.getContext('2d')!.fillStyle = '#917a60'; source.getContext('2d')!.fillRect(0, 0, 64, 64);
    const original = await renderFilteredCanvas(source, DEFAULT_PARAMS, null, null, 0);
    const rows = [];
    for (const film of api.SIGNATURE_FILMS) {
      const a = await loadSignatureCandidate(film.id), b = await loadPresetLut(film.sourcePresetId);
      const hash = async (data: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer))).join(',');
      const zero = await renderFilteredCanvas(source, DEFAULT_PARAMS, film.id, a, 0);
      const quality = api.createSignatureQuality(film.id, .25); quality.grain = 1;
      rows.push({ id: film.id, source: film.sourcePresetId, same: await hash(a.data) === await hash(b.data), zero: zero.toDataURL() === original.toDataURL(), fresh: api.createSignatureQuality(film.id, .25), leaked: PRESETS.some((p: { id: string }) => p.id === film.id) });
    }
    let rejected = 0;
    for (const [id, seed] of [['bad', .25], ['signature-portrait-v1', 1], ['signature-cafe-v1', NaN]]) { try { api.createSignatureQuality(id, seed); } catch { rejected++; } }
    let unknown = false; try { await loadSignatureCandidate('bad'); } catch { unknown = true; }
    return { available: true, rows, rejected, unknown, candidateCount: SIGNATURE_CANDIDATE_PRESETS.length };
  });
  expect(r.available).toBe(true); if (!r.available) return;
  expect(r.candidateCount).toBe(6); expect(new Set(r.rows.map((row: any) => row.id)).size).toBe(6);
  expect(r.rows.every((row: any) => row.same && row.zero && !row.leaked)).toBe(true);
  expect(r.rows[0].fresh).toMatchObject({ model: 'film-v2', origin: 'profile', profile: { id: 'signature-portrait-v1', version: 1 }, grain: .12, seed: .25 });
  expect(r.rows[5].fresh.color).toBe(0); expect(r.rejected).toBe(3); expect(r.unknown).toBe(true);
});
