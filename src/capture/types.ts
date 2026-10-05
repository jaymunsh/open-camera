import type { BeautyParams } from '../components/BeautyPanel';
import type { DateFmt, DateSize } from '../engine/pipeline';
import type { FilmPattern, FilterParams, FxSpec } from '../engine/types';
import type { VariationSettings } from '../engine/variation';

export type CaptureMode = 'normal' | 'half' | 'booth' | 'double' | 'instant';
export type BoothMethod = 'auto' | 'manual';
export type BoothInterval = 3 | 5 | 10;
export type BlendMode = 'average' | 'lighten' | 'multiply';
export type LensMode = 'none' | 'star' | 'prism';
export type StampStyle = 'amber' | 'red';
export interface CameraSettings {
  lutId: string;
  intensity: number;
  params: FilterParams;
  beauty: BeautyParams;
  ratioIdx: number;
  grainOff: boolean;
  variation?: VariationSettings;
  strengthMode: 'color' | 'whole';
  gentle: boolean;
  lens: LensMode;
  lensAmount: number;
  date: { mode: 'auto' | 'on' | 'off'; fmt: DateFmt; size: DateSize; orient: 'auto' | 'p' | 'l'; style: StampStyle };
}
export interface CompositionOptions {
  blend: BlendMode;
  mix: number;
  layout: 'grid' | 'strip' | 'row';
  paper: 'white' | 'black' | 'cream' | 'blush';
  frame?: 'plain' | 'memory' | 'film';
  caption?: string;
  instantFormat?: 'square' | 'portrait';
}
export const DEFAULT_COMPOSITION: CompositionOptions = { blend: 'average', mix: .5, layout: 'grid', paper: 'white' };
export interface CaptureRecord {
  id: string;
  createdAt: number;
  shotAt?: number;
  blob: Blob;
  name: string;
  width: number;
  height: number;
  mode: CaptureMode;
  originals: Blob[];
  settings?: CameraSettings;
  frameSettings?: CameraSettings[];
  framePatterns?: (FilmPattern | null)[];
  composition?: CompositionOptions;
  persisted?: boolean;
}
export interface CapturedFrame {
  canvas: HTMLCanvasElement;
  original: HTMLCanvasElement | null;
  settings: CameraSettings;
  createdAt: number;
  fx: FxSpec | null;
  pattern?: FilmPattern | null;
}
