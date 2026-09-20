import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { renderStampSoft, stampFontReady } from './engine/datestamp';

type Mode = 'camera' | 'edit';
type Panel = 'filters' | 'adjust' | 'beauty';
type EditSource = ImageBitmap | HTMLImageElement;

function StampText({
  text,
  height,
  vertical = false,
}: {
  text: string;
  height: number;
  vertical?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void stampFontReady.then(() => {
      const cv = ref.current;
      if (!cv || !live) return;
      const s = renderStampSoft(text, Math.max(2, Math.round(height / 7)), vertical);
      cv.width = s.canvas.width;
      cv.height = s.canvas.height;
      cv.style.width = `${s.w}px`;
      cv.style.height = `${s.h}px`;
      cv.getContext('2d')!.drawImage(s.canvas, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [text, height, vertical]);
  return <canvas ref={ref} className="stamp-canvas" />;
}

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
  const [licOpen, setLicOpen] = useState(false);
  const [lutModalOpen, setLutModalOpen] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const ratio = RATIOS[ratioIdx];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pipeRef = useRef<FilterPipeline | null>(null);
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
  } = useCamera();

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
  const canCompare = beautyOn || paramsDirty || lutId !== 'none';
  const faceNeed = beautyOn || !!(PRESETS.find((p) => p.id === lutId)?.fx?.redeye ?? 0);
  useEffect(() => {
    if (!faceNeed) {
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
  }, [faceNeed, mode, editSrc, videoRef]);

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
      .catch((e) => setGlError((e as Error).message));
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
  }, [lutId]);

  useEffect(() => {
    if (!lutReady) return;
    const lut = lutId === 'none' ? null : (loadedLuts[lutId] ?? null);
    const preset = lutId === 'none' ? null : PRESETS.find((p) => p.id === lutId);
    setApplied({
      key: `preset-${lutId}`,
      lut,
      amount: lutId === 'none' ? 0 : lutIntensity,
      fx: preset?.fx ? { ...preset.fx, seed: fxSeedRef.current } : null,
    });
  }, [lutId, lutReady, loadedLuts, lutIntensity]);

  const showDate = dateMode === 'on' || (dateMode === 'auto' && !!applied.fx?.date);

  const paramsRef = useRef(params);
  paramsRef.current = params;
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
        pipeRef.current = new FilterPipeline(canvasRef.current!);
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
    if (mode !== 'camera') return;
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
          mirror: facingRef.current === 'user',
          time: t * 0.001,
          ratio: ratioRef.current,
          fx: compareRef.current ? null : l.fx,
          eyes: !compareRef.current && (l.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : undefined,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, ready, getPipe, videoRef]);

  useEffect(() => {
    if (mode !== 'edit' || !editSrc) return;
    const p = getPipe();
    if (!p) return;
    applyBeauty(p, compare);
    p.setSource(editSrc);
    p.setLUT(applied.key, applied.lut);
    p.render(compare ? DEFAULT_PARAMS : params, compare ? 0 : applied.amount, {
      fit: 'contain',
      fx: compare ? null : applied.fx,
      eyes: !compare && (applied.fx?.redeye ?? 0) > 0.001 ? eyePoints(getSmoothedFaces()) : undefined,
    });
  }, [mode, editSrc, params, applied, compare, getPipe, sizeTick, beauty, beautyTick]);

  const getSource = useCallback((): TexImageSource | null => {
    if (mode === 'camera') {
      const v = videoRef.current;
      return v && v.readyState >= 2 ? v : null;
    }
    return editSrc;
  }, [mode, editSrc, videoRef]);

  const openImage = useCallback(async (f: File) => {
    try {
      const src = await loadImageFile(f);
      setEditSrc(src);
      setEditToken((t) => t + 1);
      setMode('edit');
    } catch {
      setGlError('이미지를 불러올 수 없습니다');
    }
  }, []);

  const capture = useCallback(async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || busy) return;
    setBusy(true);
    setFlash((f) => f + 1);
    try {
      const blob = await exportFiltered(
        v,
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
        { on: showDate, fmt: dateFmt, size: dateSize, orient: dateOrient },
      );
      const r = await saveImage(blob, timestampName());
      if (r === 'shared' || r === 'downloaded') showToast('저장됨');
    } finally {
      setBusy(false);
    }
  }, [busy, facing, params, applied, videoRef, ratio, showToast, beauty, showDate, dateFmt, dateSize, dateOrient]);

  const shoot = useCallback(() => {
    if (busy || count !== null) return;
    if (timerSec > 0) {
      let n = timerSec;
      setCount(n);
      countIv.current = window.setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(countIv.current);
          setCount(null);
          capture();
        } else setCount(n);
      }, 1000);
    } else {
      capture();
    }
  }, [busy, count, timerSec, capture]);

  const cancelCountdown = useCallback(() => {
    clearInterval(countIv.current);
    setCount(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editSrc || busy) return;
    setBusy(true);
    try {
      const blob = await exportFiltered(
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
        { on: showDate, fmt: dateFmt, size: dateSize, orient: dateOrient },
      );
      const r = await saveImage(blob, timestampName());
      if (r === 'shared' || r === 'downloaded') showToast('저장됨');
    } finally {
      setBusy(false);
    }
  }, [busy, editSrc, params, applied, showToast, beauty, showDate, dateFmt, dateSize, dateOrient]);

  const importLut = useCallback(async (f: File) => {
    try {
      const buf = await f.arrayBuffer();
      const ext = /\.cube$/i.test(f.name) ? 'cube' : 'png';
      const entry = await addCustomLut(
        f.name.replace(/\.(cube|png|jpg|jpeg)$/i, ''),
        buf,
        ext,
      );
      setCustoms(listCustomLuts());
      setLutId(entry.id);
      setPanel('filters');
      showToast('LUT 적용됨');
    } catch (e) {
      setGlError((e as Error).message);
    }
  }, [showToast]);

  const bakeCustomLut = useCallback(async () => {
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

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = S;
      const pipe = new FilterPipeline(canvas);
      pipe.setSource(hald);
      pipe.setLUT('bake', lutId === 'none' ? null : (loadedLuts[lutId] ?? null));
      pipe.render({ ...params, sharpen: 0, vignette: 0, grain: 0 }, lutId === 'none' ? 0 : lutIntensity);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('LUT 생성 실패');
      const entry = await addCustomLut(`CUSTOM ${customs.length + 1}`, await blob.arrayBuffer(), 'png');
      setCustoms(listCustomLuts());
      setLutId(entry.id);
      setPanel('filters');
      showToast('커스텀 LUT로 저장됨');
    } catch (e) {
      setGlError((e as Error).message);
    }
  }, [lutId, loadedLuts, params, lutIntensity, customs.length, showToast]);

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

  return (
    <div className="app">
      <header>
        <span className={`filter-name${pendingLut ? ' pending' : ''}`}>
          {customs.find((c) => c.id === lutId)?.name ?? PRESETS.find((p) => p.id === lutId)?.label}
        </span>
        <div className="header-btns">
          {mode === 'camera' && (
            <>
              <button
                className="icon-btn ratio-btn"
                onClick={() => setRatioIdx((i) => (i + 1) % RATIOS.length)}
                aria-label="비율"
              >
                {ratio.label}
              </button>
              <button className="icon-btn" onClick={flip} aria-label="카메라 전환">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M21 21v-5h-5" />
                </svg>
              </button>
            </>
          )}
          {mode === 'edit' && <button onClick={() => setMode('camera')}>카메라</button>}
          <div className="menu-wrap">
            <button
              className="icon-btn"
              onClick={() => setMenuOpen((o) => !o)}
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
        {compare && <div className="compare-tag">원본</div>}
        {!compare && showDate && imgRect && (
          <div
            className="date-stamp"
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
              text={dateLabel(new Date(), dateFmt)}
              height={Math.max(11, imgRect.h * dateScale)}
              vertical={stampVert}
            />
          </div>
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
          expandTop={
            viewSize.h
              ? (Math.min(viewSize.h, (viewSize.w * 4) / 3) - viewSize.h) / 2 - 10
              : undefined
          }
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

      <div className="dock">
        <button
          className={`dock-btn${panel === 'filters' ? ' on' : ''}`}
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
            disabled={!ready || busy}
            onClick={shoot}
            aria-label="촬영"
          >
            <img className="shutter-logo" src="/logo.png" alt="" />
          </button>
        ) : (
          <button className="save" disabled={busy} onClick={saveEdit}>
            저장
          </button>
        )}
        <div className="dock-group">
          <button
            className={`dock-btn${panel === 'beauty' ? ' on' : ''}`}
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
        accept=".cube,.png,.jpg,.jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importLut(f);
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
            </div>
          </div>
        </div>
      )}

      {lutModalOpen && (
        <CustomLutsModal
          customs={customs}
          onRename={(id, name) => {
            renameCustomLut(id, name);
            setCustoms(listCustomLuts());
          }}
          onDelete={async (id) => {
            await removeCustomLut(id);
            setCustoms(listCustomLuts());
            if (lutId === id) setLutId('none');
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
