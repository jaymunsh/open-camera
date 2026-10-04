import { DEFAULT_BEAUTY } from '../components/BeautyPanel';
import { PARAM_DEFS } from '../engine/types';
import type { CameraSettings } from './types';

export interface Recipe { version: 1; id: string; name: string; settings: CameraSettings }
const KEY = 'oc-recipes';
function enumValue(value: unknown, values: readonly unknown[]) { if (!values.includes(value)) throw new Error('지원하지 않는 레시피 설정입니다'); }
export function validateSettings(input: unknown): CameraSettings {
  if (!input || typeof input !== 'object') throw new Error('레시피 설정이 올바르지 않습니다');
  const s = input as CameraSettings;
  if (typeof s.lutId !== 'string' || !s.lutId || s.lutId.length > 128 || !Number.isFinite(s.intensity) || s.intensity < 0 || s.intensity > 1) throw new Error('레시피 필터 설정이 올바르지 않습니다');
  for (const d of PARAM_DEFS) if (!Number.isFinite(s.params?.[d.key]) || s.params[d.key] < d.min || s.params[d.key] > d.max) throw new Error('레시피 보정값이 올바르지 않습니다');
  for (const key of Object.keys(DEFAULT_BEAUTY) as (keyof typeof DEFAULT_BEAUTY)[]) if (!Number.isFinite(s.beauty?.[key]) || s.beauty[key] < 0 || s.beauty[key] > (key === 'spotRange' ? 2 : 1)) throw new Error('레시피 미용값이 올바르지 않습니다');
  enumValue(s.ratioIdx, [0, 1, 2, 3]); enumValue(s.grainOff, [true, false]); enumValue(s.gentle, [true, false]);
  enumValue(s.strengthMode, ['color', 'whole']); enumValue(s.lens, ['none', 'star', 'prism']);
  if (!Number.isFinite(s.lensAmount) || s.lensAmount < 0 || s.lensAmount > 1) throw new Error('렌즈 강도가 올바르지 않습니다');
  enumValue(s.date?.mode, ['auto', 'on', 'off']); enumValue(s.date?.fmt, ['yy', 'iso', 'ddmmyy', 'ddmmyyyy', 'mmddyyyy']);
  enumValue(s.date?.size, ['sm', 'md', 'lg']); enumValue(s.date?.orient, ['auto', 'p', 'l']); enumValue(s.date?.style, ['amber', 'red']);
  return structuredClone(s);
}
export function readRecipes(): Recipe[] {
  const json = localStorage.getItem(KEY);
  if (!json) return [];
  const rows: unknown = JSON.parse(json);
  if (!Array.isArray(rows) || rows.length > 20) throw new Error('저장된 레시피를 읽을 수 없습니다');
  return rows.map((value) => {
    const r = value as Recipe;
    if (r.version !== 1 || typeof r.id !== 'string' || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 40) throw new Error('지원하지 않는 레시피입니다');
    return { ...r, settings: validateSettings(r.settings) };
  });
}
export function writeRecipes(recipes: Recipe[]): void {
  if (recipes.length > 20) throw new Error('레시피는 최대 20개까지 보관할 수 있습니다');
  for (const r of recipes) { validateSettings(r.settings); if (!r.name.trim() || r.name.length > 40) throw new Error('레시피 이름은 1~40자로 입력해주세요'); }
  localStorage.setItem(KEY, JSON.stringify(recipes));
}
