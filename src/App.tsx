import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pkg from '../package.json';
import { useCamera } from './camera/useCamera';
import { AdjustPanel } from './components/AdjustPanel';
import { BeautyPanel, DEFAULT_BEAUTY, type BeautyParams } from './components/BeautyPanel';
import { FilterSheet } from './components/FilterSheet';
import { FilterStrip } from './components/FilterStrip';
import { InstallHint } from './components/InstallHint';
import { CustomLutsModal } from './components/CustomLutsModal';
import { addCustomLut, listCustomLuts, loadCustomLut, loadPresetLut, PRESETS, removeCustomLut, renameCustomLut, type CustomEntry } from './engine/lut';
import {
  DATE_FORMATS,
  DATE_SIZES,
  dateLabel,
  exportFiltered,
  renderFilteredCanvas,
  exportSize,
  FilterPipeline,
  srcSize,
  type DateFmt,
  type DateSize,
} from './engine/pipeline';
import { DEFAULT_PARAMS, type FilterParams, type FxSpec, type LutData } from './engine/types';
import { loadImageFile, timestampName } from './utils/image';
import {
  blinkOf,
  buildWarpPairs,
  drawFaceMask,
  drawWarpField,
  eyePoints,
  getLandmarker,
  getSmoothedFaces,
  resetLandmarkSmoothing,
  smoothAndTrack,
} from './beauty/face';
import { saveImage } from './utils/share';
import { renderStampRed, renderStampSoft, stampFontReady } from './engine/datestamp';
import { deriveFx, type RenderLook } from './engine/look';
import { useCreativeCapture } from './capture/useCreativeCapture';
import { canvasBlob, composeFrames, snapshotFrame } from './capture/composite';
import type { CameraSettings, CapturedFrame, CaptureRecord, StampStyle } from './capture/types';
import { validateSettings } from './capture/recipes';
import { renderReprocessed, exportReprocessed } from './capture/reprocess';
import { CreativeSettings, DEFAULT_CREATIVE } from './components/CreativeSettings';
import { RecipeSheet } from './components/RecipeSheet';
import { PhotoHistory } from './components/PhotoHistory';
import { CaptureWorkspace } from './components/CaptureWorkspace';

type Mode = 'camera' | 'edit';
type Panel = 'filters' | 'adjust' | 'beauty';
type EditSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

function StampText({
  text,
  height,
  vertical = false,
  style = 'amber',
  maxW = Infinity,
  maxH = Infinity,
}: {
  text: string;
  height: number;
  vertical?: boolean;
  style?: StampStyle;
  maxW?: number;
  maxH?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void stampFontReady.then(() => {
      const cv = ref.current;
      if (!cv || !live) return;
      const s = style === 'red' ? renderStampRed(text, height * .6, maxW, maxH, vertical) : renderStampSoft(text, Math.max(2, Math.round(height / 7)), vertical);
      cv.width = s.canvas.width;
      cv.height = s.canvas.height;
      cv.style.width = `${s.w}px`;
      cv.style.height = `${s.h}px`;
      cv.getContext('2d')!.drawImage(s.canvas, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [text, height, vertical, style, maxW, maxH]);
  return <canvas ref={ref} className="stamp-canvas" />;
}

const APP_VERSION = pkg.version;
const REPO_URL = 'https://github.com/jaymunsh/open-camera';

const RATIOS = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
  { label: '9:16', w: 9, h: 16 },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('camera');
  const [panel, setPanel] = useState<Panel>('filters');
  const [params, setParams] = useState<FilterParams>(DEFAULT_PARAMS);
  const [beauty, setBeauty] = useState<BeautyParams>(DEFAULT_BEAUTY);
  const [lutId, setLutId] = useState('none');
  const [lutIntensity, setLutIntensity] = useState(1);
  const [customs, setCustoms] = useState<CustomEntry[]>(() => listCustomLuts());
  const [editSrc, setEditSrc] = useState<EditSource | null>(null);
  const [editToken, setEditToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [sizeTick, setSizeTick] = useState(0);
  const [ratioIdx, setRatioIdx] = useState(2);
  const [gridOn, setGridOn] = useState(() => localStorage.getItem('oc-grid') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dateMode, setDateMode] = useState<'auto' | 'on' | 'off'>(() => {
    const v = localStorage.getItem('oc-datemode');
    return v === 'on' || v === 'off' ? v : 'auto';
  });
  const [dateFmt, setDateFmt] = useState<DateFmt>(
    () => (localStorage.getItem('oc-datefmt') as DateFmt) || 'yy',
  );
  const [dateSize, setDateSize] = useState<DateSize>(() => {
    const v = localStorage.getItem('oc-datesize');
    return v === 'sm' || v === 'lg' ? v : 'md';
  });
  const [dateOrient, setDateOrient] = useState<'auto' | 'p' | 'l'>(() => {
    const v = localStorage.getItem('oc-dateorient');
    return v === 'p' || v === 'l' ? v : 'auto';
  });
  const [dateSheet, setDateSheet] = useState(false);
  const [grainOff, setGrainOff] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [lutModalOpen, setLutModalOpen] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [creativeOpen, setCreativeOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [creativeOptions, setCreativeOptions] = useState(DEFAULT_CREATIVE);
  const [keepOriginal, setKeepOriginal] = useState(() => localStorage.getItem('oc-keep-original') === '1');
  const [dateStyle, setDateStyle] = useState<StampStyle>(() => localStorage.getItem('oc-datestyle') === 'red' ? 'red' : 'amber');
  const [reprocessRecord, setReprocessRecord] = useState<CaptureRecord | null>(null);
  const captureFrameRef = useRef<(() => Promise<CapturedFrame>) | null>(null);
  const creative = useCreativeCapture(() => captureFrameRef.current!(), setGlError);
  const ratio = creative.mode === 'half' || creative.mode === 'booth' ? RATIOS[2] : creative.mode === 'double' && creative.frames.length ? RATIOS[creative.frames[0].settings.ratioIdx] : RATIOS[ratioIdx];
  const cameraActive = mode === 'camera' && !creative.review && !creative.historyOpen;
  const generalSettings: CameraSettings = { lutId, intensity: lutIntensity, params: { ...params }, beauty: { ...beauty }, ratioIdx, grainOff, ...creativeOptions, date: { mode: dateMode, fmt: dateFmt, size: dateSize, orient: dateOrient, style: dateStyle } };
  const gentleAvailable = PRESETS.find((p) => p.id === lutId)?.group !== '디지캠' && !!PRESETS.find((p) => p.id === lutId)?.fx;
  const look: RenderLook = { lens: creativeOptions.lens, lensAmount: creativeOptions.lensAmount, gentle: creativeOptions.gentle && gentleAvailable };
  const lookRef = useRef(look); lookRef.current = look;
  const recipeApplying = useRef(false);
  useEffect(() => { try { localStorage.setItem('oc-datestyle', dateStyle); localStorage.setItem('oc-keep-original', keepOriginal ? '1' : '0'); } catch { /* defaults remain usable when storage is blocked */ } }, [dateStyle, keepOriginal]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pipeRef = useRef<FilterPipeline | null>(null);
  const bakeRef = useRef<{ canvas: HTMLCanvasElement; pipe: FilterPipeline } | null>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const hqRef = useRef<HTMLInputElement>(null);
  const cubeRef = useRef<HTMLInputElement>(null);

  const {
    videoRef,
    facing,
    ready,
    error: camError,
    flip,
    onLoaded,
    zoomCaps,
    zoom,
    setZoom,
    backCams,
    torchOk,
    torchOn,
    setTorch,
  } = useCamera(cameraActive);

  const zoomOptions = useMemo(() => {
    if (!zoomCaps) return [] as number[];
    const { min, max } = zoomCaps;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const list: number[] = [];
    const uw = min < 1;
    if (uw) list.push(r1(min));
    list.push(1);
    const hasTele =
      backCams == null ? max >= 5 : backCams >= 3 || (backCams === 2 && !uw);
    if (hasTele) {
      const tele = window.innerWidth >= 400 ? 5 : 3;
      if (tele > 1 && tele <= max) list.push(tele);
    }
    return list;
  }, [zoomCaps, backCams]);

  const zoomValRef = useRef(zoom);
  zoomValRef.current = zoom;
  const ptsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; zoom: number } | null>(null);
  const holdRef = useRef<{ timer: number; active: boolean; prev: boolean; x: number; y: number } | null>(null);

  const endHold = () => {
    const h = holdRef.current;
    if (!h) return;
    clearTimeout(h.timer);
    holdRef.current = null;
    if (h.active) setCompareBoth(h.prev);
  };

  const pinchHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      ptsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptsRef.current.size === 1) {
        // press-and-hold shows the unfiltered original until release
        holdRef.current = {
          x: e.clientX,
          y: e.clientY,
          active: false,
          prev: compareRef.current,
          timer: window.setTimeout(() => {
            const h = holdRef.current;
            if (h) {
              h.active = true;
              setCompareBoth(true);
            }
          }, 380),
        };
      } else {
        endHold();
      }
      if (ptsRef.current.size === 2) {
        const [a, b] = [...ptsRef.current.values()];
        pinchRef.current = {
          d: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: zoomValRef.current,
        };
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!ptsRef.current.has(e.pointerId)) return;
      ptsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const h = holdRef.current;
      if (h && !h.active && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) endHold();
      if (ptsRef.current.size === 2 && pinchRef.current && pinchRef.current.d > 0) {
        const [a, b] = [...ptsRef.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        setZoom(pinchRef.current.zoom * (d / pinchRef.current.d));
      }
    },
    onPointerEnd: (e: React.PointerEvent) => {
      ptsRef.current.delete(e.pointerId);
      pinchRef.current = null;
      endHold();
    },
  };

  const [loadedLuts, setLoadedLuts] = useState<Record<string, LutData>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const compareRef = useRef(false);
  const [flash, setFlash] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const beautyMask = useRef<HTMLCanvasElement | null>(null);
  const warpMap = useRef<HTMLCanvasElement | null>(null);
  const warpPairs = useRef<Float32Array | null>(null);
  const warpDirty = useRef(true);
  const maskDirty = useRef(true);
  const warpLive = useRef(false);
  const warpGpuFail = useRef(false);
  const lastMaskKey = useRef('');
  const [beautyTick, setBeautyTick] = useState(0);
  const lastSrcSize = useRef<{ w: number; h: number } | null>(null);
  const busyDetect = useRef(false);
  const [timerSec, setTimerSec] = useState(() => Number(localStorage.getItem('oc-timer')) || 0);
  const [count, setCount] = useState<number | null>(null);
  const countIv = useRef(0);

  const beautyOn = Object.entries(beauty).some(([k, v]) => k !== 'spotRange' && v > 0.001);
  const paramsDirty = (Object.keys(DEFAULT_PARAMS) as (keyof FilterParams)[]).some(
    (k) => params[k] !== DEFAULT_PARAMS[k],
  );
  const canCompare = beautyOn || paramsDirty || lutId !== 'none' || creativeOptions.lens !== 'none';
  const faceNeed = beautyOn || !!(PRESETS.find((p) => p.id === lutId)?.fx?.redeye ?? 0);
  useEffect(() => {
    if (!faceNeed || (mode === 'camera' && !cameraActive)) {
      beautyMask.current = null;
      warpPairs.current = null;
      maskDirty.current = true;
      warpDirty.current = true;
      return;
    }
    let cancelled = false;
    let editDone = false;
    resetLandmarkSmoothing();
    const detect = async () => {
      if (busyDetect.current || cancelled || (mode === 'edit' && editDone)) return;
      busyDetect.current = true;
      try {
        const lm = await getLandmarker();
        if (cancelled) return;
        if (mode === 'camera') {
          const v = videoRef.current;
          if (v && v.readyState >= 2) {
            const res = lm.detectForVideo(v, performance.now());
            const faces = smoothAndTrack(
              res.faceLandmarks ?? [],
              (res.faceBlendshapes ?? []).map(blinkOf),
              performance.now(),
            );
            beautyMask.current = drawFaceMask(
              faces.map((f) => f.lm),
              v.videoWidth,
              v.videoHeight,
            );
            lastSrcSize.current = { w: v.videoWidth, h: v.videoHeight };
            warpPairs.current = buildWarpPairs(faces, {
              eye: beautyRef.current.eye,
              slim: beautyRef.current.slim,
              nose: beautyRef.current.nose,
              head: beautyRef.current.head,
            });
            maskDirty.current = true;
            warpDirty.current = true;
          }
        } else if (mode === 'edit' && editSrc) {
          await lm.setOptions({ runningMode: 'IMAGE' });
          const res = lm.detect(editSrc as HTMLImageElement);
          await lm.setOptions({ runningMode: 'VIDEO' });
          const faces = smoothAndTrack(
            res.faceLandmarks ?? [],
            (res.faceBlendshapes ?? []).map(blinkOf),
            performance.now(),
          );
          const { w, h } = srcSize(editSrc);
          beautyMask.current = drawFaceMask(faces.map((f) => f.lm), w, h);
          lastSrcSize.current = { w, h };
          warpPairs.current = buildWarpPairs(faces, {
            eye: beautyRef.current.eye,
            slim: beautyRef.current.slim,
            nose: beautyRef.current.nose,
            head: beautyRef.current.head,
          });
          maskDirty.current = true;
          warpDirty.current = true;
          editDone = true;
          setBeautyTick((t) => t + 1);
        }
      } catch {
        /* detection unavailable — keep previous mask */
      } finally {
        busyDetect.current = false;
      }
    };
    void detect();
    const iv = window.setInterval(detect, mode === 'camera' ? 240 : 900);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [faceNeed, mode, editSrc, videoRef, cameraActive]);

  // warm up the face model when the beauty tab opens (first detect feels instant)
  useEffect(() => {
    if (panel === 'beauty') void getLandmarker().catch(() => {});
  }, [panel]);

  // regenerate the warp map immediately when warp sliders move (no new detection needed)
  useEffect(() => {
    const faces = getSmoothedFaces();
    const sz = lastSrcSize.current;
    if (!faces.length || !sz || (!beautyOn && !warpPairs.current)) return;
    warpPairs.current = buildWarpPairs(faces, {
      eye: beauty.eye,
      slim: beauty.slim,
      nose: beauty.nose,
      head: beauty.head,
    });
    warpDirty.current = true;
    setBeautyTick((t) => t + 1);
  }, [beauty.eye, beauty.slim, beauty.nose, beauty.head, beautyOn]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const setCompareBoth = useCallback((v: boolean) => {
    compareRef.current = v;
    setCompare(v);
    if (!v) {
      maskDirty.current = true;
      warpDirty.current = true;
    }
  }, []);

  useEffect(() => {
    if (lutId === 'none' || loadedLuts[lutId]) return;
    let ok = true;
    const isCustom = customs.some((c) => c.id === lutId);
    const load = isCustom ? loadCustomLut(lutId) : loadPresetLut(lutId);
    load
      .then((l) => ok && setLoadedLuts((m) => ({ ...m, [lutId]: l })))
      .catch((e) => {
        if (!ok) return;
        setGlError((e as Error).message);
        // Return to an honest, usable state; selecting the filter again retries.
        setLutId('none');
      });
    return () => {
      ok = false;
    };
  }, [lutId, loadedLuts, customs]);

  const lutReady = lutId === 'none' ? true : !!loadedLuts[lutId];
  const pendingLut = !lutReady;

  const [applied, setApplied] = useState<{
    key: string;
    lut: LutData | null;
    amount: number;
    fx: FxSpec | null;
  }>({
    key: 'preset-none',
    lut: null,
    amount: 0,
    fx: null,
  });

  const fxSeedRef = useRef(0.5);
  useEffect(() => {
    fxSeedRef.current = Math.random();
    if (!recipeApplying.current) setGrainOff(false);
    recipeApplying.current = false;
  }, [lutId]);

  useEffect(() => {
    if (!lutReady) return;
    const lut = lutId === 'none' ? null : (loadedLuts[lutId] ?? null);
    const preset = lutId === 'none' ? null : PRESETS.find((p) => p.id === lutId);
    setApplied({
      key: `preset-${lutId}`,
      lut,
      amount: lutId === 'none' ? 0 : lutIntensity,
      fx: deriveFx(preset?.fx
        ? { ...preset.fx, grain: grainOff ? 0 : preset.fx.grain, seed: fxSeedRef.current }
        : null, lutIntensity, creativeOptions.strengthMode, look.gentle),
    });
  }, [lutId, lutReady, loadedLuts, lutIntensity, grainOff, creativeOptions.strengthMode, look.gentle]);

  const showDate = dateMode === 'on' || (dateMode === 'auto' && !!applied.fx?.date);
  const renderReady = lutReady && applied.key === `preset-${lutId}` && applied.lut === (lutId === 'none' ? null : loadedLuts[lutId]) && applied.amount === (lutId === 'none' ? 0 : lutIntensity);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const editSettingsRef = useRef({ params, lutId, lutIntensity });
  editSettingsRef.current = { params, lutId, lutIntensity };
  const beautyRef = useRef(beauty);
  beautyRef.current = beauty;
  const lutRef = useRef(applied);
  lutRef.current = applied;
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const getPipe = useCallback(() => {
    if (!pipeRef.current) {
      try {
        pipeRef.current = new FilterPipeline(canvasRef.current!, { preserve: false });
        pipeRef.current.onRestore = () => {
          maskDirty.current = true;
          warpDirty.current = true;
          warpGpuFail.current = false;
          warpLive.current = false;
          lastMaskKey.current = '';
        };
      } catch (e) {
        setGlError((e as Error).message);
        return null;
      }
    }
    return pipeRef.current;
  }, []);

  useEffect(() => {
    const el = viewerRef.current!;
    const cv = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      setViewSize({ w: r.width, h: r.height });
      setSizeTick((t) => t + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyBeauty = (p: FilterPipeline, cmp: boolean) => {
    const b = beautyRef.current;
    const key = `${b.skin},${b.tone},${b.undereye},${b.spot},${b.spotRange},${b.face},${b.blush},${b.lip},${b.eyeclear},${cmp}`;
    if (maskDirty.current || key !== lastMaskKey.current) {
      maskDirty.current = false;
      lastMaskKey.current = key;
      p.setBeautyMask(
        cmp ? null : beautyMask.current,
        cmp
          ? { skin: 0, tone: 0, undereye: 0, spot: 0, spotRange: 1, face: 0, blush: 0, lip: 0, eyeclear: 0 }
          : {
              skin: b.skin,
              tone: b.tone,
              undereye: b.undereye,
              spot: b.spot,
              spotRange: b.spotRange,
              face: b.face,
              blush: b.blush,
              lip: b.lip,
              eyeclear: b.eyeclear,
            },
      );
    }
    const pairs = warpPairs.current;
    if (cmp || !pairs || !pairs.length) {
      if (warpLive.current) {
        warpLive.current = false;
        p.setWarpMap(null);
      }
    } else if (warpDirty.current || !warpLive.current) {
      warpDirty.current = false;
      const sz = lastSrcSize.current;
      if (sz) {
        let ok = false;
        if (!warpGpuFail.current) ok = p.renderWarpField(pairs, sz.w, sz.h);
        if (!ok) {
          warpGpuFail.current = true;
          warpMap.current = drawWarpField(getSmoothedFaces(), sz.w, sz.h, {
            eye: b.eye,
            slim: b.slim,
            nose: b.nose,
            head: b.head,
          });
          p.setWarpMap(warpMap.current);
        }
        warpLive.current = true;
      }
    }
  };

  useEffect(() => {
    if (mode !== 'camera' || !cameraActive) return;
    let raf = 0;
    const tick = (t: number) => {
      const v = videoRef.current;
      const p = getPipe();
      if (p && v && v.readyState >= 2) {
        applyBeauty(p, compareRef.current);
        p.setSource(v);
        const l = lutRef.current;
        p.setLUT(l.key, l.lut);
        p.render(
          compareRef.current ? DEFAULT_PARAMS : paramsRef.current,
          compareRef.current ? 0 : l.amount,
          {
          fit: 'contain',
          valign: 'center',
          mirror: facingRef.current === 'user',
          time: t * 0.001,
          ratio: ratioRef.current,
          fx: compareRef.current ? null : l.fx,
          look: compareRef.current ? undefined : lookRef.current,
          eyes: !compareRef.current && (l.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : undefined,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, ready, getPipe, videoRef, cameraActive]);

  useEffect(() => {
    if (mode !== 'edit' || !editSrc) return;
    const p = getPipe();
    if (!p) return;
    if (!compare && !renderReady) return;
    if (reprocessRecord && reprocessRecord.mode !== 'normal' && !compare) {
      let live = true;
      const abort = new AbortController();
      void renderReprocessed(reprocessRecord, { ...generalSettings, gentle: look.gentle }, applied.lut, applied.fx, false, abort.signal).then((source) => {
        if (!live) return;
        p.setBeautyMask(null, DEFAULT_BEAUTY); p.setWarpMap(null); maskDirty.current = true; warpDirty.current = true;
        p.setSource(source); p.setLUT(null, null); p.render(DEFAULT_PARAMS, 0, { fit: 'contain', fx: null });
      }).catch((e) => { if (live) setGlError((e as Error).message); });
      return () => { live = false; abort.abort(); };
    }
    applyBeauty(p, compare);
    p.setSource(editSrc);
    p.setLUT(applied.key, applied.lut);
    p.render(compare ? DEFAULT_PARAMS : params, compare ? 0 : applied.amount, {
      fit: 'contain',
      fx: compare ? null : applied.fx,
      look: compare ? undefined : look,
      eyes: !compare && (applied.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : undefined,
    });
  }, [mode, editSrc, params, applied, compare, getPipe, sizeTick, beauty, beautyTick, creativeOptions, look.gentle, reprocessRecord, renderReady]);

  const getSource = useCallback((): TexImageSource | null => {
    if (mode === 'camera') {
      const v = videoRef.current;
      return v && v.readyState >= 2 ? v : null;
    }
    return editSrc;
  }, [mode, editSrc, videoRef]);

  const confirmEditEntry = useCallback(() => !creative.frames.length || window.confirm('진행 중인 촬영을 버리고 사진 편집을 시작할까요?'), [creative.frames.length]);
  const openImage = useCallback(async (f: File) => {
    try {
      if (!confirmEditEntry()) return;
      const src = await loadImageFile(f);
      creative.cancel();
      setReprocessRecord(null);
      setEditSrc(src);
      setEditToken((t) => t + 1);
      setMode('edit');
    } catch {
      setGlError('이미지를 불러올 수 없습니다');
    }
  }, [confirmEditEntry, creative.cancel]);

  const applyCameraSettings = async (value: CameraSettings) => {
    const s = validateSettings(value);
    if (s.lutId !== 'none' && !PRESETS.some((p) => p.id === s.lutId) && !customs.some((c) => c.id === s.lutId)) throw new Error('이 레시피의 사용자 LUT가 없습니다. LUT를 다시 가져와주세요.');
    if (s.lutId !== 'none' && !loadedLuts[s.lutId]) {
      const loaded = await (customs.some((c) => c.id === s.lutId) ? loadCustomLut(s.lutId) : loadPresetLut(s.lutId));
      setLoadedLuts((rows) => ({ ...rows, [s.lutId]: loaded }));
    }
    recipeApplying.current = s.lutId !== lutId;
    setLutId(s.lutId); setLutIntensity(s.intensity); setParams(s.params); setBeauty(s.beauty); setGrainOff(s.grainOff); setRatioIdx(s.ratioIdx);
    setCreativeOptions({ strengthMode: s.strengthMode, gentle: s.gentle, lens: s.lens, lensAmount: s.lensAmount });
    setDateMode(s.date.mode); setDateFmt(s.date.fmt); setDateSize(s.date.size); setDateOrient(s.date.orient); setDateStyle(s.date.style);
  };

  const reprocessPhoto = async (record: CaptureRecord) => {
    if (!confirmEditEntry()) return;
    if (!record.originals.length) throw new Error('이 사진에는 보관한 원본이 없습니다');
    const sources: HTMLCanvasElement[] = [];
    for (const blob of record.originals) {
      const bitmap = await createImageBitmap(blob);
      try { sources.push(snapshotFrame(bitmap, null, false, record.mode === 'normal' ? 4096 : 2048)); }
      finally { bitmap.close(); }
    }
    const source = record.mode === 'normal' ? sources[0] : composeFrames(sources, record.mode, record.composition ?? {});
    if (record.settings) {
      try { await applyCameraSettings({ ...record.settings, beauty: { ...DEFAULT_BEAUTY } }); }
      catch { setLutId('none'); setParams(DEFAULT_PARAMS); setBeauty(DEFAULT_BEAUTY); setCreativeOptions(DEFAULT_CREATIVE); showToast('촬영 필터가 없어 원본에서 시작합니다'); }
    }
    creative.cancel();
    setReprocessRecord(record); setEditSrc(source); setEditToken((t) => t + 1); setMode('edit'); setPanel('filters'); creative.setHistoryOpen(false);
  };

  captureFrameRef.current = async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !lutReady) throw new Error('카메라와 필터가 준비된 후 촬영해주세요');
    setFlash((f) => f + 1);
    const s = structuredClone(creative.mode === 'booth' && creative.frames.length ? creative.frames[0].settings : generalSettings);
    const activeGentle = s.gentle && PRESETS.find((p) => p.id === s.lutId)?.group !== '디지캠';
    const fx = creative.mode === 'booth' && creative.frames.length ? creative.frames[0].fx : deriveFx(PRESETS.find((p) => p.id === s.lutId)?.fx ? { ...PRESETS.find((p) => p.id === s.lutId)!.fx, grain: s.grainOff ? 0 : PRESETS.find((p) => p.id === s.lutId)!.fx?.grain, seed: fxSeedRef.current } : null, s.intensity, s.strengthMode, activeGentle);
    const frozen = snapshotFrame(v, null, false, 2048);
    const createdAt = Date.now();
    const original = keepOriginal ? snapshotFrame(frozen, ratio, facing === 'user', 2048) : null;
    const rendered = await renderFilteredCanvas(frozen, s.params, `preset-${s.lutId}`, s.lutId === 'none' ? null : loadedLuts[s.lutId], s.lutId === 'none' ? 0 : s.intensity, facing === 'user', ratio, fx, beautyMask.current, s.beauty,
      warpGpuFail.current && lastSrcSize.current ? drawWarpField(getSmoothedFaces(), lastSrcSize.current.w, lastSrcSize.current.h, { eye: s.beauty.eye, slim: s.beauty.slim, nose: s.beauty.nose, head: s.beauty.head }) : warpPairs.current,
      (fx?.redeye ?? 0) > .001 ? eyePoints(getSmoothedFaces()) : [], { on: false, fmt: s.date.fmt, size: s.date.size, orient: s.date.orient }, { lens: s.lens, lensAmount: s.lensAmount, gentle: activeGentle });
    return { canvas: rendered, original, settings: s, createdAt, fx };
  };

  const actionLock = useRef(false);

  const capture = useCallback(async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || busy || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setFlash((f) => f + 1);
    try {
      const createdAt = Date.now();
      const settings = structuredClone(generalSettings);
      const frozen = keepOriginal ? snapshotFrame(v, null, false) : v;
      const original = keepOriginal ? snapshotFrame(frozen, ratio, facing === 'user') : null;
      const size = srcSize(frozen);
      const output = exportSize(size.w, size.h, ratio);
      const blob = await exportFiltered(
        frozen,
        params,
        applied.key,
        applied.lut,
        applied.amount,
        facing === 'user',
        ratio,
        applied.fx,
        beautyMask.current,
        beauty,
        warpGpuFail.current && lastSrcSize.current
          ? drawWarpField(getSmoothedFaces(), lastSrcSize.current.w, lastSrcSize.current.h, {
              eye: beauty.eye,
              slim: beauty.slim,
              nose: beauty.nose,
              head: beauty.head,
            })
          : warpPairs.current,
        (applied.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : [],
        { on: showDate, fmt: dateFmt, size: dateSize, orient: dateOrient, style: dateStyle },
        look,
      );
      const name = timestampName();
      void creative.remember({ id: crypto.randomUUID(), createdAt, blob, name, width: output.w, height: output.h, mode: 'normal', originals: [], settings }, original ? Promise.all([canvasBlob(original)]) : undefined);
      const r = await saveImage(blob, name);
      if (r === 'shared' || r === 'downloaded') showToast('저장됨');
    } catch (e) {
      setGlError(e instanceof Error ? e.message : '이미지 저장에 실패했습니다');
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }, [busy, facing, params, applied, videoRef, ratio, showToast, beauty, showDate, dateFmt, dateSize, dateOrient, dateStyle, creativeOptions, keepOriginal, creative.remember, grainOff, ratioIdx]);

  const shutterAction = useRef<() => void>(() => {});
  shutterAction.current = () => { if (creative.mode === 'normal') void capture(); else void creative.shoot(); };

  const shoot = useCallback(() => {
    if (busy || creative.working || count !== null || creative.countdown !== null) return;
    if (timerSec > 0) {
      let n = timerSec;
      setCount(n);
      countIv.current = window.setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(countIv.current);
          setCount(null);
          shutterAction.current();
        } else setCount(n);
      }, 1000);
    } else {
      shutterAction.current();
    }
  }, [busy, count, timerSec, creative.working, creative.countdown]);

  const cancelCountdown = useCallback(() => {
    clearInterval(countIv.current);
    setCount(null);
  }, []);

  useEffect(() => { const hide = () => { if (document.hidden) cancelCountdown(); }; document.addEventListener('visibilitychange', hide); return () => { document.removeEventListener('visibilitychange', hide); cancelCountdown(); }; }, [cancelCountdown]);

  const saveEdit = useCallback(async () => {
    if (!editSrc || busy || !renderReady) return;
    setBusy(true);
    try {
      const compositeResult = reprocessRecord && reprocessRecord.mode !== 'normal' ? await exportReprocessed(reprocessRecord, { ...generalSettings, gentle: look.gentle }, applied.lut, applied.fx) : null;
      const blob = compositeResult?.blob ?? await exportFiltered(
        editSrc,
        params,
        applied.key,
        applied.lut,
        applied.amount,
        false,
        null,
        applied.fx,
        beautyMask.current,
        beauty,
        warpGpuFail.current && lastSrcSize.current
          ? drawWarpField(getSmoothedFaces(), lastSrcSize.current.w, lastSrcSize.current.h, {
              eye: beauty.eye,
              slim: beauty.slim,
              nose: beauty.nose,
              head: beauty.head,
            })
          : warpPairs.current,
        (applied.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : [],
        { on: showDate, fmt: dateFmt, size: dateSize, orient: dateOrient, style: dateStyle, timestamp: reprocessRecord ? reprocessRecord.shotAt ?? reprocessRecord.createdAt : undefined },
        look,
      );
      const name = timestampName();
      if (reprocessRecord) { const size = srcSize(compositeResult?.canvas ?? editSrc); void creative.remember({ id: crypto.randomUUID(), createdAt: Date.now(), shotAt: reprocessRecord.shotAt ?? reprocessRecord.createdAt, blob, name, width: size.w, height: size.h, mode: reprocessRecord.mode, originals: keepOriginal ? [...reprocessRecord.originals] : [], settings: structuredClone(generalSettings), composition: reprocessRecord.composition }); }
      const r = await saveImage(blob, name);
      if (r === 'shared' || r === 'downloaded') showToast('저장됨');
    } catch (e) {
      setGlError(e instanceof Error ? e.message : '이미지 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }, [busy, editSrc, params, applied, showToast, beauty, showDate, dateFmt, dateSize, dateOrient, dateStyle, creativeOptions, reprocessRecord, creative.remember, keepOriginal, renderReady]);

  const importLut = useCallback(
    async (files: File[]) => {
      let last: CustomEntry | null = null;
      let ok = 0;
      for (const f of files) {
        try {
          if (!/\.(cube|png|jpe?g)$/i.test(f.name))
            throw new Error('지원하지 않는 형식입니다 (.cube / .png)');
          const buf = await f.arrayBuffer();
          const ext = /\.cube$/i.test(f.name) ? 'cube' : 'png';
          last = await addCustomLut(
            f.name.replace(/\.(cube|png|jpg|jpeg)$/i, ''),
            buf,
            ext,
          );
          ok++;
        } catch (e) {
          setGlError(`${f.name}: ${(e as Error).message}`);
        }
      }
      if (!ok) return;
      setCustoms(listCustomLuts());
      if (last) {
        setLutId(last.id);
        setPanel('filters');
      }
      showToast(ok > 1 ? `LUT ${ok}개 추가됨` : 'LUT 적용됨');
    },
    [showToast],
  );

  const bakeCustomLut = useCallback(async () => {
    if (busy) return;
    if (lutId !== 'none' && !loadedLuts[lutId]) {
      setGlError('필터 로딩이 완료된 후 LUT를 만들어주세요');
      return;
    }
    setBusy(true);
    try {
      const N = 64;
      const S = 512;
      const hald = document.createElement('canvas');
      hald.width = hald.height = S;
      const hctx = hald.getContext('2d')!;
      const img = hctx.createImageData(S, S);
      for (let p = 0; p < S * S; p++) {
        const r = p % N;
        const g = Math.floor(p / N) % N;
        const b = Math.floor(p / (N * N));
        img.data[p * 4] = Math.round((r / (N - 1)) * 255);
        img.data[p * 4 + 1] = Math.round((g / (N - 1)) * 255);
        img.data[p * 4 + 2] = Math.round((b / (N - 1)) * 255);
        img.data[p * 4 + 3] = 255;
      }
      hctx.putImageData(img, 0, 0);

      // Reuse one context across bakes rather than accumulating WebGL contexts.
      if (!bakeRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = S;
        bakeRef.current = { canvas, pipe: new FilterPipeline(canvas) };
      }
      const { canvas, pipe } = bakeRef.current;
      pipe.setSource(hald);
      pipe.setLUT(`bake-${lutId}`, lutId === 'none' ? null : (loadedLuts[lutId] ?? null));
      pipe.render(
        { ...params, sharpen: 0, clarity: 0, bloom: 0, vignette: 0, grain: 0 },
        lutId === 'none' ? 0 : lutIntensity,
      );
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('LUT 생성 실패');
      const entry = await addCustomLut(`CUSTOM ${customs.length + 1}`, await blob.arrayBuffer(), 'png');
      const lut = await loadCustomLut(entry.id);
      setLoadedLuts((m) => ({ ...m, [entry.id]: lut }));
      setCustoms(listCustomLuts());
      const latest = editSettingsRef.current;
      if (latest.params !== params || latest.lutId !== lutId || latest.lutIntensity !== lutIntensity) {
        showToast('커스텀 LUT로 저장됨 · 변경된 설정 유지');
        return;
      }
      // Only baked color controls reset; spatial effects remain live controls.
      setParams((p) => ({
        ...DEFAULT_PARAMS,
        sharpen: p.sharpen, clarity: p.clarity, bloom: p.bloom,
        vignette: p.vignette, grain: p.grain,
      }));
      setLutIntensity(1);
      setApplied({ key: `preset-${entry.id}`, lut, amount: 1, fx: null });
      setLutId(entry.id);
      setPanel('filters');
      showToast('커스텀 LUT로 저장됨');
    } catch (e) {
      setGlError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, lutId, loadedLuts, params, lutIntensity, customs.length, showToast]);

  useEffect(() => {
    localStorage.setItem('oc-grid', gridOn ? '1' : '0');
  }, [gridOn]);

  useEffect(() => {
    localStorage.setItem('oc-datemode', dateMode);
  }, [dateMode]);

  useEffect(() => {
    localStorage.setItem('oc-datefmt', dateFmt);
  }, [dateFmt]);

  useEffect(() => {
    localStorage.setItem('oc-datesize', dateSize);
  }, [dateSize]);

  useEffect(() => {
    localStorage.setItem('oc-dateorient', dateOrient);
  }, [dateOrient]);

  const dateScale =
    DATE_SIZES.find((s) => s.id === dateSize)?.scale ?? 0.044;

  useEffect(() => {
    localStorage.setItem('oc-timer', String(timerSec));
  }, [timerSec]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-wrap')) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const thumbKey = `${mode}-${ready}-${facing}-${editSrc ? `img${editToken}` : 'none'}`;

  const frameRect = useMemo(() => {
    if (!viewSize.w || !viewSize.h) return null;
    const ta = ratio.w / ratio.h;
    const ca = viewSize.w / viewSize.h;
    let w: number;
    let h: number;
    if (ta > ca) {
      w = viewSize.w;
      h = w / ta;
    } else {
      h = viewSize.h;
      w = h * ta;
    }
    // Match the centered GPU viewport for every camera ratio.
    return { left: (viewSize.w - w) / 2, top: (viewSize.h - h) / 2, w, h };
  }, [viewSize, ratio]);

  const imgRect = useMemo(() => {
    if (mode === 'camera') return frameRect;
    if (!editSrc || !viewSize.w || !viewSize.h) return null;
    const { w, h } = srcSize(editSrc);
    if (!w || !h) return null;
    const a = w / h;
    const ca = viewSize.w / viewSize.h;
    let vw: number;
    let vh: number;
    if (a > ca) {
      vw = viewSize.w;
      vh = vw / a;
    } else {
      vh = viewSize.h;
      vw = vh * a;
    }
    return { left: (viewSize.w - vw) / 2, top: (viewSize.h - vh) / 2, w: vw, h: vh };
  }, [mode, frameRect, editSrc, viewSize]);

  const stampVert =
    dateOrient === 'l' ||
    (dateOrient === 'auto' && !!imgRect && imgRect.w > imgRect.h);
  const guideImage = useMemo(() => creative.mode === 'double' && creative.frames[0] ? creative.frames[0].canvas.toDataURL('image/jpeg', .75) : null, [creative.mode, creative.frames]);

  return (
    <div className="app">
      <header className="app-header">
        <span className={`filter-name${pendingLut ? ' pending' : ''}`}>
          {customs.find((c) => c.id === lutId)?.name ?? PRESETS.find((p) => p.id === lutId)?.label}
        </span>
        <div className="header-btns">
          {mode === 'camera' && (
            <>
              <button
                className="icon-btn ratio-btn"
                disabled={creative.mode === 'half' || creative.mode === 'booth' || (creative.mode === 'double' && creative.frames.length > 0)}
                onClick={() => setRatioIdx((i) => (i + 1) % RATIOS.length)}
                aria-label="비율"
              >
                {ratio.label}
              </button>
              <button className="icon-btn" disabled={creative.locked || busy || creative.working} onClick={flip} aria-label="카메라 전환">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M21 21v-5h-5" />
                </svg>
              </button>
            </>
          )}
          {mode === 'edit' && <button disabled={busy} onClick={() => { setReprocessRecord(null); setMode('camera'); }}>카메라</button>}
          <div className="menu-wrap">
            <button
              className="icon-btn"
              onClick={() => { if (!menuOpen) { cancelCountdown(); creative.pause(); } setMenuOpen((o) => !o); }}
              aria-label="메뉴"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <div className="menu">
                <button disabled={busy || creative.working} onClick={() => { cancelCountdown(); creative.pause(); setMenuOpen(false); creative.setHistoryOpen(true); }}>최근 촬영</button>
                <button disabled={busy || creative.working} onClick={() => { cancelCountdown(); creative.pause(); setMenuOpen(false); setCreativeOpen(true); }}>촬영 모드 · 효과</button>
                <button disabled={busy || creative.working || creative.locked || pendingLut} onClick={() => { setMenuOpen(false); setRecipeOpen(true); }}>카메라 레시피</button>
                {mode === 'camera' && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      hqRef.current?.click();
                    }}
                  >
                    고화질 촬영
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openRef.current?.click();
                  }}
                >
                  사진 불러오기
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    cubeRef.current?.click();
                  }}
                >
                  LUT 가져오기
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLutModalOpen(true);
                  }}
                >
                  커스텀 LUT 관리{customs.length ? ` (${customs.length})` : ''}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false);
                    void bakeCustomLut();
                  }}
                >
                  LUT 만들기
                </button>
                {mode === 'camera' && torchOk && facing === 'environment' && (
                  <button onClick={() => void setTorch(!torchOn)}>
                    플래시 {torchOn ? '끄기' : '켜기'}
                  </button>
                )}
                {mode === 'camera' && (
                  <button
                    onClick={() => {
                      setTimerSec((s) => (s === 0 ? 3 : s === 3 ? 10 : 0));
                    }}
                  >
                    타이머 설정 ({timerSec}초)
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setGridOn((g) => !g);
                  }}
                >
                  격자 {gridOn ? '끄기' : '켜기'}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setDateSheet(true);
                  }}
                >
                  날짜 스탬프 설정
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLicOpen(true);
                  }}
                >
                  라이선스
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className="viewer"
        ref={viewerRef}
        onPointerDown={pinchHandlers.onPointerDown}
        onPointerMove={pinchHandlers.onPointerMove}
        onPointerUp={pinchHandlers.onPointerEnd}
        onPointerCancel={pinchHandlers.onPointerEnd}
        onPointerLeave={pinchHandlers.onPointerEnd}
      >
        <canvas ref={canvasRef} />
        <video ref={videoRef} playsInline muted autoPlay onLoadedData={onLoaded} />
        {mode === 'camera' && guideImage && frameRect && !creative.review && <img className="exposure-guide" src={guideImage} alt="첫 촬영 구도 안내" style={{ left: frameRect.left, top: frameRect.top, width: frameRect.w, height: frameRect.h }} />}
        {mode === 'camera' && creative.mode !== 'normal' && <div className="capture-progress" role="status" onPointerDown={(e) => e.stopPropagation()}>
          <span>{creative.mode === 'half' ? '하프프레임' : creative.mode === 'booth' ? '네 컷' : '다중노출'} · {Math.min(creative.nextIndex + 1, creative.target)}/{creative.target}{creative.countdown !== null ? ` · ${creative.countdown}초` : ''}</span>
          {creative.mode === 'booth' && creative.paused && creative.frames.length < 4 && creative.retakeIndex === null && <button onClick={creative.resume}>계속 촬영</button>}
          {creative.frames.length > 0 && <button disabled={creative.working} onClick={() => { cancelCountdown(); creative.cancel(); }}>취소</button>}
        </div>}
        {compare && <div className="compare-tag">원본</div>}
        {!compare && showDate && imgRect && (
          <div
            className={`date-stamp${dateStyle === 'red' ? ' date-red' : ''}`}
            style={
              stampVert
                ? {
                    left: imgRect.left + imgRect.w * 0.04,
                    bottom:
                      viewSize.h - imgRect.top - imgRect.h + imgRect.h * 0.032,
                  }
                : {
                    right:
                      viewSize.w - imgRect.left - imgRect.w + imgRect.w * 0.04,
                    bottom:
                      viewSize.h - imgRect.top - imgRect.h + imgRect.h * 0.032,
                  }
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setDateSheet(true)}
          >
            <StampText
              text={dateLabel(reprocessRecord ? new Date(reprocessRecord.shotAt ?? reprocessRecord.createdAt) : new Date(), dateFmt)}
              height={dateStyle === 'red' ? imgRect.h * dateScale : Math.max(11, imgRect.h * dateScale)}
              vertical={stampVert}
              style={dateStyle}
              maxW={imgRect.w * .92}
              maxH={imgRect.h * .936}
            />
          </div>
        )}
        {!compare &&
          imgRect &&
          (PRESETS.find((p) => p.id === lutId)?.fx?.grain ?? 0) > 0 && (
            <button
              className={`grain-chip${grainOff ? ' off' : ''}`}
              style={{
                left: imgRect.left + imgRect.w * 0.04,
                top: imgRect.top + imgRect.h * 0.03,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setGrainOff((g) => !g)}
            >
              그레인
            </button>
          )}
        {mode === 'camera' && ready && zoomCaps && zoomOptions.length > 1 && (
          <div className="zoombar" onPointerDown={(e) => e.stopPropagation()}>
            {zoomOptions.map((z, i) => {
              const active =
                zoom >= z && (i === zoomOptions.length - 1 || zoom < zoomOptions[i + 1]);
              const fmt = (v: number) =>
                v < 1 ? `.${Math.round(v * 10)}` : v % 1 === 0 ? `${v}` : v.toFixed(1);
              return (
                <button key={z} className={active ? 'on' : ''} onClick={() => setZoom(z)}>
                  {active && Math.abs(z - zoom) >= 0.05 ? `${fmt(zoom)}×` : fmt(z)}
                </button>
              );
            })}
          </div>
        )}
        {canCompare && (
          <button
            className={`compare-btn${compare ? ' on' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              setCompareBoth(!compareRef.current);
            }}
            onPointerCancel={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            원본보기
          </button>
        )}
        {mode === 'camera' && gridOn && frameRect && (
          <div
            className="grid-overlay"
            style={{
              left: frameRect.left,
              top: frameRect.top,
              width: frameRect.w,
              height: frameRect.h,
            }}
          >
            <i className="v1" />
            <i className="v2" />
            <i className="h1" />
            <i className="h2" />
          </div>
        )}
        {mode === 'camera' && camError && <div className="overlay-msg">{camError}</div>}
        {glError && (
          <div className="overlay-msg">
            {glError}
            <button onClick={() => setGlError(null)}>닫기</button>
          </div>
        )}
      </div>

      <InstallHint />

      {reprocessRecord && <div className="reprocess-bar"><span>원본에서 다시 현상 · 미용 보정 {reprocessRecord.mode !== 'normal' ? '미지원' : '기본 꺼짐'}</span>
        {reprocessRecord.mode === 'double' && <><select aria-label="재현상 혼합 방식" value={reprocessRecord.composition?.blend ?? 'average'} onChange={(e) => setReprocessRecord({ ...reprocessRecord, composition: { ...creative.options, ...reprocessRecord.composition, blend: e.target.value as 'average' | 'lighten' | 'multiply' } })}><option value="average">평균</option><option value="lighten">밝게</option><option value="multiply">곱하기</option></select><input aria-label="재현상 겹침 비율" type="range" min={0} max={1} step={.01} value={reprocessRecord.composition?.mix ?? .5} onChange={(e) => setReprocessRecord({ ...reprocessRecord, composition: { ...creative.options, ...reprocessRecord.composition, mix: Number(e.target.value) } })} /></>}
      </div>}

      <div className="camera-controls" inert={creative.locked}>
      {panel === 'beauty' ? (
        <BeautyPanel
          beauty={beauty}
          onChange={setBeauty}
          onReset={() => setBeauty(DEFAULT_BEAUTY)}
        />
      ) : panel === 'filters' ? (
        <FilterStrip
          selected={lutId}
          onSelect={setLutId}
          getSource={getSource}
          onExpand={() => setSheetOpen(true)}
          deps={[thumbKey, customs]}
          customs={customs}
          srcKey={mode === 'edit' && editSrc ? `e${editToken}` : 'smp'}
          preferSrc={mode === 'edit'}
          intensity={lutIntensity}
          onIntensity={setLutIntensity}
        />
      ) : (
        <AdjustPanel
          params={params}
          onChange={setParams}
          intensity={lutIntensity}
          onIntensity={setLutIntensity}
          onReset={() => {
            setParams(DEFAULT_PARAMS);
            setLutIntensity(1);
          }}
          lutEnabled={lutId !== 'none'}
        />
      )}
      </div>

      <div className="dock">
        <button
          className={`dock-btn${panel === 'filters' ? ' on' : ''}`}
          disabled={creative.locked}
          onClick={() => setPanel('filters')}
          aria-label="필터"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4.2" />
            <circle cx="8" cy="15" r="4.2" />
            <circle cx="16" cy="15" r="4.2" />
          </svg>
          <span>필터</span>
        </button>
        {mode === 'camera' ? (
          <button
            className="shutter"
            disabled={!ready || busy || creative.working || creative.countdown !== null || pendingLut}
            onClick={shoot}
            aria-label="촬영"
          >
            <img className="shutter-logo" src="/logo.png" alt="" />
          </button>
        ) : (
          <button className="save" disabled={busy || !renderReady} onClick={saveEdit}>
            저장
          </button>
        )}
        <div className="dock-group">
          <button
            className={`dock-btn${panel === 'beauty' ? ' on' : ''}`}
            disabled={creative.locked || !!(reprocessRecord && reprocessRecord.mode !== 'normal')}
            onClick={() => setPanel('beauty')}
            aria-label="보정"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="4.6" />
              <path d="M5.5 19.5c1.1-3 3.6-4.6 6.5-4.6s5.4 1.6 6.5 4.6" />
              <path d="M18.5 4l.6 1.6L20.7 6l-1.6.6-.6 1.6-.6-1.6L16.3 6l1.6-.6z" fill="currentColor" stroke="none" />
            </svg>
            <span>보정</span>
          </button>
          <button
            className={`dock-btn${panel === 'adjust' ? ' on' : ''}`}
            disabled={creative.locked}
            onClick={() => setPanel('adjust')}
            aria-label="조절"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="7" cy="17" r="2.2" fill="currentColor" stroke="none" />
            </svg>
            <span>조절</span>
          </button>
        </div>
      </div>

      <input
        ref={openRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openImage(f);
          e.target.value = '';
        }}
      />
      <input
        ref={hqRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openImage(f);
          e.target.value = '';
        }}
      />
      <input
        ref={cubeRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const fs = e.target.files ? Array.from(e.target.files) : [];
          if (fs.length) void importLut(fs);
          e.target.value = '';
        }}
      />

      {sheetOpen && (
        <FilterSheet
          selected={lutId}
          onSelect={setLutId}
          getSource={getSource}
          onClose={() => setSheetOpen(false)}
          customs={customs}
          srcKey={mode === 'edit' && editSrc ? `e${editToken}` : 'smp'}
          preferSrc={mode === 'edit'}
        />
      )}

      {dateSheet && (
        <div className="sheet-back" onClick={() => setDateSheet(false)}>
          <div className="date-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ds-title">날짜 스탬프</div>
            <div className="ds-row">
              {([['amber', '주황 디지캠'], ['red', '빨간 아날로그']] as const).map(([id, label]) => <button key={id} className={dateStyle === id ? 'on' : ''} onClick={() => setDateStyle(id)}>{label}</button>)}
            </div>
            <div className="ds-row">
              {(
                [
                  ['auto', '자동'],
                  ['on', '켜기'],
                  ['off', '끄기'],
                ] as const
              ).map(([m, l]) => (
                <button
                  key={m}
                  className={dateMode === m ? 'on' : ''}
                  onClick={() => setDateMode(m)}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="ds-row">
              {(
                [
                  ['auto', '자동'],
                  ['p', '세로 촬영'],
                  ['l', '가로 촬영'],
                ] as const
              ).map(([m, l]) => (
                <button
                  key={m}
                  className={dateOrient === m ? 'on' : ''}
                  onClick={() => setDateOrient(m)}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="ds-row">
              {DATE_SIZES.map((s) => (
                <button
                  key={s.id}
                  className={dateSize === s.id ? 'on' : ''}
                  onClick={() => setDateSize(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="ds-fmts">
              {DATE_FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={dateFmt === f.id ? 'on' : ''}
                  onClick={() => setDateFmt(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {creativeOpen && <CreativeSettings mode={creative.mode} options={creativeOptions} originals={keepOriginal} locked={creative.locked} gentleAvailable={gentleAvailable} onMode={(next) => { if (mode === 'edit') { setReprocessRecord(null); setMode('camera'); } cancelCountdown(); creative.changeMode(next); }} onOptions={setCreativeOptions} onOriginals={setKeepOriginal} onClose={() => setCreativeOpen(false)} />}
      {recipeOpen && <RecipeSheet settings={generalSettings} onApply={applyCameraSettings} onClose={() => setRecipeOpen(false)} />}
      {creative.historyOpen && <PhotoHistory records={creative.records} warning={creative.warning} onClose={() => creative.setHistoryOpen(false)} onDelete={creative.remove} onReprocess={reprocessPhoto} />}
      {creative.review && <CaptureWorkspace capture={creative} />}

      {licOpen && (
        <div className="sheet-back" onClick={() => setLicOpen(false)}>
          <div className="date-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ds-title">라이선스</div>
            <div className="lic-list">
              <div className="lic-item">
                <b>DSEG7 Classic Italic</b>
                <span>
                  날짜 스탬프 폰트 — Keshikan, SIL Open Font License 1.1
                  (fonts/LICENSE-dseg.txt)
                </span>
              </div>
              <div className="lic-item">
                <b>Film emulation CLUTs</b>
                <span>
                  RawTherapee Film Simulation Collection / Natron CLUT — Pat
                  David, Pavlov Dmitry, Michael Ezra &amp; contributors, CC
                  BY-SA 4.0 (luts/film/CREDITS.md)
                </span>
              </div>
              <div className="lic-item">
                <b>Lookup textures</b>
                <span>
                  GPUImage resources — Brad Larson &amp; contributors, BSD
                  (licenses/gpuimage-bsd.txt)
                </span>
              </div>
              <div className="lic-item">
                <b>Face tracking</b>
                <span>
                  MediaPipe Tasks Vision / Face Landmarker — Google, Apache
                  2.0 (licenses/apache-2.0.txt)
                </span>
              </div>
              <div className="lic-item">
                <b>상표 고지</b>
                <span>
                  Portra, Velvia, Ilford 등 필름명은 식별 목적으로만 사용되며,
                  각 상표권자와 무관합니다.
                </span>
              </div>
              <div className="lic-item">
                <b>개인정보</b>
                <span>촬영한 사진과 얼굴 데이터는 기기 안에서만 처리됩니다.</span>
              </div>
              <div className="lic-item">
                <b>버전</b>
                <span>
                  v{APP_VERSION} —{' '}
                  <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">
                    변경 기록
                  </a>
                  {' · '}
                  <a href={REPO_URL} target="_blank" rel="noreferrer">
                    소스 코드
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {lutModalOpen && (
        <CustomLutsModal
          customs={customs}
          onRename={(id, name) => {
            try {
              renameCustomLut(id, name);
              setCustoms(listCustomLuts());
            } catch (e) {
              setGlError((e as Error).message);
            }
          }}
          onDelete={async (id) => {
            try {
              await removeCustomLut(id);
            } catch (e) {
              setGlError((e as Error).message);
            } finally {
              const list = listCustomLuts();
              setCustoms(list);
              if (lutId === id && !list.some((c) => c.id === id)) setLutId('none');
            }
          }}
          onClose={() => setLutModalOpen(false)}
        />
      )}

      {flash > 0 && <div key={flash} className="flash" />}
      {count !== null && (
        <div className="countdown" onClick={cancelCountdown}>
          {count}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
