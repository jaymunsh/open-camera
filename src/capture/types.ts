import type { BeautyParams } from '../components/BeautyPanel';
import type { DateFmt, DateSize } from '../engine/pipeline';
import type { FilterParams, FxSpec } from '../engine/types';

export type CaptureMode = 'normal' | 'half' | 'booth' | 'double';
export type BoothMethod = 'auto' | 'manual';
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
  paper: 'white' | 'black';
  frame?: 'plain' | 'memory' | 'film';
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
  composition?: CompositionOptions;
  persisted?: boolean;
}
export interface CapturedFrame {
  canvas: HTMLCanvasElement;
  original: HTMLCanvasElement | null;
  settings: CameraSettings;
  createdAt: number;
  fx: FxSpec | null;
}
