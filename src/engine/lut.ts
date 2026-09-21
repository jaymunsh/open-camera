import type { FxSpec, LutData } from './types';
import { idbDel, idbGet, idbPut } from '../utils/lutStore';

type V3 = [number, number, number];
type ColorFn = (r: number, g: number, b: number) => V3;

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sstep = (a: number, b: number, x: number) => {
  const t = cl((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const sat = (f: number): ColorFn => (r, g, b) => {
  const l = lum(r, g, b);
  return [l + (r - l) * f, l + (g - l) * f, l + (b - l) * f];
};
const con = (a: number): ColorFn => (r, g, b) => [
  (r - 0.5) * (1 + a) + 0.5,
  (g - 0.5) * (1 + a) + 0.5,
  (b - 0.5) * (1 + a) + 0.5,
];
const lift = (a: number): ColorFn => (r, g, b) => [r * (1 - a) + a, g * (1 - a) + a, b * (1 - a) + a];
const gain = (rr: number, gg: number, bb: number): ColorFn => (r, g, b) => [r * rr, g * gg, b * bb];
const split = (sh: V3, hi: V3, amt: number): ColorFn => (r, g, b) => {
  const l = lum(r, g, b);
  const s = (1 - sstep(0, 0.65, l)) * amt;
  const h = sstep(0.35, 1, l) * amt;
  return [r + sh[0] * s + hi[0] * h, g + sh[1] * s + hi[1] * h, b + sh[2] * s + hi[2] * h];
};
const gray = (c: number): ColorFn => (r, g, b) => {
  const x = cl((lum(r, g, b) - 0.5) * (1 + c) + 0.5);
  return [x, x, x];
};
const sepiaF: ColorFn = (r, g, b) => [
  r * 0.393 + g * 0.769 + b * 0.189,
  r * 0.349 + g * 0.686 + b * 0.168,
  r * 0.272 + g * 0.534 + b * 0.131,
];
const chain = (...fns: ColorFn[]): ColorFn => (r, g, b) => {
  let c: V3 = [r, g, b];
  for (const f of fns) c = f(c[0], c[1], c[2]);
  return c;
};

export function buildLut(fn: ColorFn, size = 33): LutData {
  const data = new Uint8Array(size * size * size * 3);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const [R, G, B] = fn(r / (size - 1), g / (size - 1), b / (size - 1));
        data[i++] = Math.round(cl(R) * 255);
        data[i++] = Math.round(cl(G) * 255);
        data[i++] = Math.round(cl(B) * 255);
      }
  return { size, data };
}

export interface Preset {
  id: string;
  label: string;
  group: string;
  build?: () => LutData;
  file?: string;
  hald?: 'linear' | 'tiled';
  fx?: FxSpec;
}

export const PRESETS: Preset[] = [
  { id: 'none', label: 'ORIGINAL', group: '기본', build: () => buildLut((r, g, b) => [r, g, b]) },
  { id: 'mono', label: 'MONO', group: '기본', build: () => buildLut(gray(0.15)) },
  { id: 'noir', label: 'NOIR', group: '기본', build: () => buildLut(gray(0.55)) },
  { id: 'sepia', label: 'SEPIA', group: '기본', build: () => buildLut(chain(sat(0.2), sepiaF)) },
  {
    id: 'fade',
    label: 'FADE',
    group: '기본',
    build: () => buildLut(chain(sat(0.75), con(-0.05), lift(0.09))),
  },
  { id: 'warm', label: 'WARM', group: '기본', build: () => buildLut(chain(gain(1.05, 1.0, 0.93), con(0.08))) },
  { id: 'cool', label: 'COOL', group: '기본', build: () => buildLut(chain(gain(0.95, 1.0, 1.06), sat(1.05))) },
  {
    id: 'cine',
    label: 'CINE',
    group: '기본',
    build: () =>
      buildLut(chain(sat(0.85), split([-0.02, 0.01, 0.05], [0.05, 0.02, -0.04], 1), con(0.12))),
  },
  { id: 'vivid', label: 'VIVID', group: '기본', build: () => buildLut(chain(sat(1.35), con(0.18))) },
  {
    id: 'bleach',
    label: 'BLEACH',
    group: '기본',
    build: () => buildLut(chain(sat(0.55), con(0.25), lift(0.05))),
  },
  {
    id: 'portra',
    label: 'SOFT FILM',
    group: '필름',
    build: () => buildLut(chain(sat(0.9), gain(1.04, 1.0, 0.95), split([0, 0.01, 0.03], [0.03, 0.01, -0.02], 0.7), lift(0.03))),
  },
  {
    id: 'gold',
    label: 'GOLDEN',
    group: '필름',
    build: () => buildLut(chain(sat(1.1), gain(1.07, 1.01, 0.9), con(0.1), lift(0.04))),
  },
  {
    id: 'ilford',
    label: 'SILVER',
    group: '필름',
    build: () => buildLut(gray(0.35)),
  },
  {
    id: 'velvia',
    label: 'SATURA',
    group: '필름',
    build: () => buildLut(chain(sat(1.45), con(0.15), gain(0.98, 1.02, 0.97))),
  },
  { id: 'amatorka', label: 'AMATORKA', group: '필름', file: '/luts/lookup_amatorka.png', hald: 'tiled' },
  { id: 'etikate', label: 'ETIKATE', group: '필름', file: '/luts/lookup_miss_etikate.png', hald: 'tiled' },
  { id: 'elegance', label: 'ELEGANCE', group: '필름', file: '/luts/lookup_soft_elegance_1.png', hald: 'tiled' },
  { id: 'elegance2', label: 'ELEGANCE 2', group: '필름', file: '/luts/lookup_soft_elegance_2.png', hald: 'tiled' },
  { id: 'classic', label: 'CLASSIC', group: '필름', file: '/luts/lookup.png', hald: 'tiled' },
  { id: 'portra160', label: 'PORTRA 160', group: '코닥', file: '/luts/film/portra160.png' },
  { id: 'portra400', label: 'PORTRA 400', group: '코닥', file: '/luts/film/portra400.png' },
  { id: 'portra800', label: 'PORTRA 800', group: '코닥', file: '/luts/film/portra800.png' },
  { id: 'k64', label: 'KODACHROME 64', group: '코닥', file: '/luts/film/k64.png' },
  { id: 'k25', label: 'KODACHROME 25', group: '코닥', file: '/luts/film/k25.png' },
  { id: 'e100vs', label: 'EKTACHROME VS', group: '코닥', file: '/luts/film/e100vs.png' },
  { id: 'fuji400h', label: 'FUJI 400H', group: '후지', file: '/luts/film/fuji400h.png' },
  { id: 'velvia50', label: 'VELVIA 50', group: '후지', file: '/luts/film/velvia50.png' },
  { id: 'provia100f', label: 'PROVIA 100F', group: '후지', file: '/luts/film/provia100f.png' },
  { id: 'astia100f', label: 'ASTIA 100F', group: '후지', file: '/luts/film/astia100f.png' },
  { id: 'superia200', label: 'SUPERIA 200', group: '후지', file: '/luts/film/superia200.png' },
  { id: 'superia800', label: 'SUPERIA 800', group: '후지', file: '/luts/film/superia800.png' },
  { id: 'reala100', label: 'REALA 100', group: '후지', file: '/luts/film/reala100.png' },
  { id: 'vista200', label: 'VISTA 200', group: '기타', file: '/luts/film/vista200.png' },
  { id: 'p669', label: 'POLAROID 669', group: '기타', file: '/luts/film/p669.png' },
  { id: 'trix400', label: 'TRI-X 400', group: '흑백', file: '/luts/film/trix400.png' },
  { id: 'hp5', label: 'HP5 PLUS', group: '흑백', file: '/luts/film/hp5.png' },
  { id: 'delta3200', label: 'DELTA 3200', group: '흑백', file: '/luts/film/delta3200.png' },
  { id: 'acros100', label: 'ACROS 100', group: '흑백', file: '/luts/film/acros100.png' },
  { id: 'tmax400', label: 'T-MAX 400', group: '흑백', file: '/luts/film/tmax400.png' },
  {
    id: 'huji98',
    label: 'HUJI 98',
    group: '빈티지',
    build: () => buildLut(chain(sat(1.12), gain(1.06, 1.0, 0.9), con(0.14), lift(0.03))),
    fx: { grain: 0.5, leak: 0.75, soft: 0.4 },
  },
  {
    id: 'instp',
    label: 'INST P',
    group: '빈티지',
    file: '/luts/film/p669.png',
    fx: { grain: 0.45, dust: 0.2, soft: 0.3 },
  },
  {
    id: 'cine800',
    label: 'CINE 800',
    group: '빈티지',
    build: () =>
      buildLut(chain(sat(0.95), split([-0.01, 0.02, 0.06], [0.04, 0.01, -0.05], 1), con(0.1))),
    fx: { halation: 0.65, grain: 0.3, soft: 0.25 },
  },
  {
    id: 'bw3200',
    label: 'B&W 3200',
    group: '빈티지',
    file: '/luts/film/delta3200.png',
    fx: { grain: 0.85, dust: 0.4, soft: 0.2 },
  },
  {
    id: 'expired',
    label: 'EXPIRED',
    group: '빈티지',
    build: () =>
      buildLut(chain(sat(1.15), gain(0.98, 1.04, 0.92), con(0.08), lift(0.08))),
    fx: { grain: 0.5, leak: 0.4, dust: 0.45, aberr: 0.6, soft: 0.4 },
  },
  {
    id: 'classicm',
    label: 'CLASSIC M',
    group: '디지캠',
    build: () => buildLut(chain(sat(0.92), gain(1.03, 1.0, 0.95), con(0.06), lift(0.05))),
    fx: { pix: 0.45, cnoise: 0.4, band: 0.25, dsharp: 0.45, dclip: 0.3, jpeg: 0.3, lens: 0.2, grain: 0.25, soft: 0.15, date: true },
  },
  {
    id: 'grx',
    label: 'GRX',
    group: '디지캠',
    build: () => buildLut(chain(sat(0.88), con(0.2), gain(0.98, 1.0, 1.02))),
    fx: { dsharp: 0.6, pix: 0.3, cnoise: 0.35, grain: 0.45, dclip: 0.35, aberr: 0.3, jpeg: 0.25, date: true },
  },
  {
    id: 'fx400',
    label: 'FX400',
    group: '디지캠',
    build: () => buildLut(chain(sat(1.25), gain(1.04, 1.0, 0.94), con(0.12))),
    fx: { flash: 0.6, pix: 0.4, cnoise: 0.5, band: 0.3, dclip: 0.5, dsharp: 0.4, jpeg: 0.4, redeye: 0.9, defect: 0.15, grain: 0.3, date: true },
  },
  {
    id: 'tof',
    label: 'TOF',
    group: '디지캠',
    build: () => buildLut(chain(sat(1.08), gain(1.05, 1.0, 0.9), lift(0.06), con(0.05))),
    fx: { flash: 0.75, cnoise: 0.35, pix: 0.35, dust: 0.25, dclip: 0.45, lens: 0.55, redeye: 0.7, jpeg: 0.35, grain: 0.45, date: true },
  },
  {
    id: 'classiq',
    label: 'CLASSIQ',
    group: '디지캠',
    build: () => buildLut(chain(sat(0.8), con(-0.04), lift(0.08), gain(0.97, 1.0, 1.04))),
    fx: { pix: 0.6, cnoise: 0.5, band: 0.4, dclip: 0.3, vsmear: 0.4, jpeg: 0.55, lens: 0.35, defect: 0.35, soft: 0.3, date: true },
  },
  {
    id: 'ops',
    label: 'OPS',
    group: '디지캠',
    build: () => buildLut(chain(sat(0.75), gain(0.98, 1.02, 0.96), con(0.1), lift(0.04))),
    fx: { pix: 0.35, cnoise: 0.4, band: 0.3, dsharp: 0.5, jpeg: 0.35, defect: 0.2, grain: 0.35, date: true },
  },
  {
    id: 'ccd2001',
    label: 'CCD 01',
    group: '디지캠',
    build: () => buildLut(chain(sat(1.05), con(0.15), gain(1.02, 1.0, 0.95))),
    fx: { pix: 0.85, cnoise: 0.7, band: 0.5, vsmear: 0.6, dclip: 0.5, aberr: 0.3, flash: 0.4, jpeg: 0.7, defect: 0.55, lens: 0.4, grain: 0.45, date: true },
  },
  {
    id: 'utsurun',
    label: 'UTSURUN',
    group: '일본풍',
    // 写ルンです disposable: warm-green cast, punchy contrast, heavy grain
    build: () =>
      buildLut(chain(sat(1.1), gain(1.01, 1.05, 0.93), con(0.16), lift(0.02), split([-0.01, 0.02, -0.01], [0.03, 0.02, -0.02], 0.8))),
    fx: { grain: 0.4, dust: 0.2, soft: 0.2, dclip: 0.25, date: true },
  },
  {
    id: 'shinsen',
    label: 'SHINSEN',
    group: '일본풍',
    // 日系小清新: high-key pastel, lifted blacks, cyan-leaning shadows
    build: () =>
      buildLut(chain(lift(0.12), con(-0.12), sat(0.85), gain(0.97, 1.0, 1.04), split([-0.01, 0.02, 0.04], [0.03, 0.02, -0.01], 0.9))),
    fx: { soft: 0.2, grain: 0.15 },
  },
  {
    id: 'toumei',
    label: 'TOUMEI',
    group: '일본풍',
    // 透明感: translucent airy skin — bright mids, gentle desat, cool shadows
    build: () =>
      buildLut(chain(sat(0.9), lift(0.08), con(-0.05), split([-0.02, 0.01, 0.05], [0.02, 0.01, -0.02], 1), gain(1.0, 1.005, 1.01))),
    fx: { soft: 0.25, grain: 0.1 },
  },
  {
    id: 'mori',
    label: 'MORI',
    group: '일본풍',
    // 森ガール milk-tea: warm beige, low contrast, washed
    build: () =>
      buildLut(chain(sat(0.75), gain(1.05, 1.0, 0.92), con(-0.08), lift(0.1), split([0.02, 0.01, -0.02], [0.04, 0.02, -0.03], 0.7))),
    fx: { grain: 0.2, soft: 0.3 },
  },
  {
    id: 'showa',
    label: 'SHOWA',
    group: '일본풍',
    // 昭和レトロ: amber warmth, faded blacks, print-paper warmth
    build: () =>
      buildLut(chain(sat(0.7), gain(1.1, 1.0, 0.85), con(0.05), lift(0.1), split([0.03, 0.0, -0.04], [0.05, 0.02, -0.05], 0.9))),
    fx: { grain: 0.45, dust: 0.3, soft: 0.35, date: true },
  },
  {
    id: 'neon',
    label: 'NEON',
    group: '일본풍',
    // 東京ナイト: teal shadows + magenta-leaning highlights + neon halation
    build: () =>
      buildLut(chain(sat(1.12), split([-0.03, 0.03, 0.05], [0.06, -0.01, 0.03], 1), con(0.15))),
    fx: { halation: 0.4, grain: 0.3, soft: 0.1 },
  },
  {
    id: 'midori',
    label: 'MIDORI',
    group: '일본풍',
    // GR 포지티브 스타일: 깊은 그린/틸 섀도, 웜 하이라이트, 크런치한 대비
    build: () =>
      buildLut(chain(sat(1.15), gain(0.96, 1.07, 0.96), con(0.16), split([-0.02, 0.03, 0.01], [0.03, 0.01, -0.02], 0.9))),
    fx: { grain: 0.15, dsharp: 0.35, dclip: 0.2 },
  },
];

const cache = new Map<string, Promise<LutData>>();

export function loadPresetLut(id: string): Promise<LutData> {
  let p = cache.get(id);
  if (!p) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return Promise.reject(new Error(`unknown preset: ${id}`));
    if (preset.build) {
      p = Promise.resolve().then(() => preset.build!());
    } else {
      const parse = async (ab: ArrayBuffer) => {
        if (preset.file!.endsWith('.cube'))
          return parseCube(new TextDecoder().decode(ab));
        const bmp = await createImageBitmap(new Blob([ab], { type: 'image/png' }));
        return parseHaldPng(bmp, preset.hald ?? 'linear');
      };
      const key = `lut-v1-${id}`;
      p = (async () => {
        const hit = await idbGet(key);
        if (hit) return parse(hit);
        const ab = await fetch(preset.file!).then((r) => r.arrayBuffer());
        idbPut(key, ab.slice(0));
        return parse(ab);
      })();
    }
    cache.set(id, p);
  }
  return p;
}

const HALD_N = 64;
const HALD_S = 512;

export function parseHaldPng(src: CanvasImageSource, layout: 'linear' | 'tiled' = 'linear'): LutData {
  const c = document.createElement('canvas');
  c.width = HALD_S;
  c.height = HALD_S;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0, HALD_S, HALD_S);
  const img = x.getImageData(0, 0, HALD_S, HALD_S).data;
  const data = new Uint8Array(HALD_N * HALD_N * HALD_N * 3);
  if (layout === 'linear') {
    for (let i = 0; i < HALD_N * HALD_N * HALD_N; i++) {
      data[i * 3] = img[i * 4];
      data[i * 3 + 1] = img[i * 4 + 1];
      data[i * 3 + 2] = img[i * 4 + 2];
    }
  } else {
    for (let ty = 0; ty < 8; ty++)
      for (let tx = 0; tx < 8; tx++) {
        const b = ty * 8 + tx;
        for (let g = 0; g < HALD_N; g++)
          for (let r = 0; r < HALD_N; r++) {
            const px = ((ty * HALD_N + g) * HALD_S + tx * HALD_N + r) * 4;
            const di = (b * HALD_N * HALD_N + g * HALD_N + r) * 3;
            data[di] = img[px];
            data[di + 1] = img[px + 1];
            data[di + 2] = img[px + 2];
          }
      }
  }
  return { size: HALD_N, data };
}

export async function loadLutFile(file: File): Promise<LutData> {
  if (/\.cube$/i.test(file.name)) return parseCube(await file.text());
  const bmp = await createImageBitmap(file);
  return parseHaldPng(bmp);
}

const CUSTOM_KEY = 'oc-custom';
const customCache = new Map<string, Promise<LutData>>();

export interface CustomEntry {
  id: string;
  name: string;
  ext: 'cube' | 'png';
}

export function listCustomLuts(): CustomEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return [];
  }
}

function saveCustomList(list: CustomEntry[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
}

export async function addCustomLut(
  name: string,
  buf: ArrayBuffer,
  ext: 'cube' | 'png',
): Promise<CustomEntry> {
  const entry: CustomEntry = { id: `c-${Date.now().toString(36)}`, name, ext };
  await idbPut(`custom-${entry.id}`, buf.slice(0));
  saveCustomList([...listCustomLuts(), entry]);
  return entry;
}

export function renameCustomLut(id: string, name: string) {
  saveCustomList(listCustomLuts().map((e) => (e.id === id ? { ...e, name } : e)));
}

export async function removeCustomLut(id: string) {
  saveCustomList(listCustomLuts().filter((e) => e.id !== id));
  customCache.delete(id);
  await idbDel(`custom-${id}`);
}

export async function loadCustomLut(id: string): Promise<LutData> {
  let p = customCache.get(id);
  if (!p) {
    const entry = listCustomLuts().find((e) => e.id === id);
    if (!entry) return Promise.reject(new Error(`unknown custom lut: ${id}`));
    p = (async () => {
      const ab = await idbGet(`custom-${id}`);
      if (!ab) throw new Error('저장된 LUT를 찾을 수 없습니다');
      if (entry.ext === 'cube') return parseCube(new TextDecoder().decode(ab));
      const bmp = await createImageBitmap(new Blob([ab], { type: 'image/png' }));
      return parseHaldPng(bmp, 'linear');
    })();
    customCache.set(id, p);
  }
  return p;
}

export function parseCube(text: string): LutData {
  let size = 0;
  const vals: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (/^[A-Z_]+/.test(line) && Number.isNaN(Number(line[0]))) continue;
    const p = line.split(/\s+/).map(Number);
    if (p.length >= 3 && p[0] >= 0 && p.every((v) => Number.isFinite(v))) vals.push(p[0], p[1], p[2]);
  }
  if (!size || vals.length !== size * size * size * 3)
    throw new Error('지원하지 않는 .cube 파일입니다');
  const data = new Uint8Array(vals.length);
  for (let i = 0; i < vals.length; i++) data[i] = Math.round(cl(vals[i]) * 255);
  return { size, data };
}
