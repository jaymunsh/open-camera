export interface FilterParams {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  sharpen: number;
  fade: number;
  vignette: number;
  grain: number;
}

export const DEFAULT_PARAMS: FilterParams = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  sharpen: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
};

export interface LutData {
  size: number;
  data: Uint8Array;
}

export interface FxSpec {
  grain?: number;
  leak?: number;
  halation?: number;
  soft?: number;
  aberr?: number;
  dust?: number;
  date?: boolean;
  seed?: number;
}

export interface ParamDef {
  key: keyof FilterParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const PARAM_DEFS: ParamDef[] = [
  { key: 'exposure', label: '노출', min: -1.5, max: 1.5, step: 0.01 },
  { key: 'contrast', label: '대비', min: -0.6, max: 0.6, step: 0.01 },
  { key: 'saturation', label: '채도', min: -1, max: 1, step: 0.01 },
  { key: 'temperature', label: '색온도', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: '틴트', min: -1, max: 1, step: 0.01 },
  { key: 'highlights', label: '하이라이트', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: '쉐도우', min: -1, max: 1, step: 0.01 },
  { key: 'sharpen', label: '선명도', min: 0, max: 1, step: 0.01 },
  { key: 'fade', label: '페이드', min: 0, max: 1, step: 0.01 },
  { key: 'vignette', label: '비네트', min: 0, max: 1, step: 0.01 },
  { key: 'grain', label: '그레인', min: -1, max: 1, step: 0.01 },
];
