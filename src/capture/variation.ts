import { DEFAULT_VARIATION, validateVariation, type VariationSettings } from '../engine/variation';

const KEY = 'oc-film-variation';
export function readVariation(): { settings: VariationSettings; warning: string | null; writable: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    return { settings: validateVariation(raw === null ? undefined : JSON.parse(raw)), warning: null, writable: true };
  } catch {
    return { settings: { ...DEFAULT_VARIATION }, warning: '빈티지 설정을 읽지 못했어요. 저장된 데이터는 보존하고 이번 실행에서만 사용할 수 있어요.', writable: false };
  }
}
export function writeVariation(settings: VariationSettings): void {
  localStorage.setItem(KEY, JSON.stringify(validateVariation(settings)));
}
