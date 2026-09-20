export interface FilterParams {
  exposure: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  sharpen: number;
  clarity: number;
  fade: number;
  vignette: number;
  bloom: number;
  grain: number;
}

export const DEFAULT_PARAMS: FilterParams = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  sharpen: 0,
  clarity: 0,
  fade: 0,
  vignette: 0,
  bloom: 0,
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
  pix?: number;
  cnoise?: number;
  band?: number;
  flash?: number;
  dsharp?: number;
  dclip?: number;
  vsmear?: number;
  jpeg?: number;
  lens?: number;
  defect?: number;
  redeye?: number;
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
  { key: 'vibrance', label: '자연채도', min: -1, max: 1, step: 0.01 },
  { key: 'temperature', label: '색온도', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: '틴트', min: -1, max: 1, step: 0.01 },
  { key: 'highlights', label: '하이라이트', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: '쉐도우', min: -1, max: 1, step: 0.01 },
  { key: 'whites', label: '화이트', min: -1, max: 1, step: 0.01 },
  { key: 'blacks', label: '블랙', min: -1, max: 1, step: 0.01 },
  { key: 'sharpen', label: '선명도', min: 0, max: 1, step: 0.01 },
  { key: 'clarity', label: '명료함', min: -1, max: 1, step: 0.01 },
  { key: 'fade', label: '페이드', min: 0, max: 1, step: 0.01 },
  { key: 'vignette', label: '비네트', min: 0, max: 1, step: 0.01 },
  { key: 'bloom', label: '블룸', min: 0, max: 1, step: 0.01 },
  { key: 'grain', label: '그레인', min: -1, max: 1, step: 0.01 },
];
