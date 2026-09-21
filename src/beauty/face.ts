import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

let landmarkerP: Promise<FaceLandmarker> | null = null;

export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks('/wasm');
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task' },
        runningMode: 'VIDEO',
        numFaces: 3,
        outputFaceBlendshapes: true,
      });
    })();
  }
  return landmarkerP;
}

// Face oval contour + exclusion regions (MediaPipe canonical index sets)
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const LEFT_EYE = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
];
const RIGHT_EYE = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
];
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];
const LEFT_BROW = [276, 283, 282, 295, 285, 336, 296, 334, 293, 300];
const RIGHT_BROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];

// forehead top arc — stays fixed (head shape preserved)
const TOP_ARC = new Set([10, 338, 297, 332, 284, 251, 389]);
// fixed interior anchors: nose bridge/tip, lip center, brows
const ANCHORS = [6, 168, 197, 4, 1, 13, 14, ...LEFT_BROW, ...RIGHT_BROW];
const NOSE_WINGS = [129, 358];
const CHIN = 152;
const CHEEKS = [205, 425];
// landmarks scaled toward the face centroid for the head-size (소두) warp
const HEAD_SCALE_PTS = [
  ...FACE_OVAL,
  ...LEFT_EYE,
  ...RIGHT_EYE,
  ...LIPS,
  ...LEFT_BROW,
  ...RIGHT_BROW,
  4, 6, 168, 197, 1,
];

let maskCanvas: HTMLCanvasElement | null = null;
let maskCtx: CanvasRenderingContext2D | null = null;

function tracePoly(ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], idx: number[], w: number, h: number) {
  ctx.beginPath();
  for (let i = 0; i < idx.length; i++) {
    const p = lm[idx[i]];
    if (i === 0) ctx.moveTo(p.x * w, p.y * h);
    else ctx.lineTo(p.x * w, p.y * h);
  }
  ctx.closePath();
}

export interface FaceTrack {
  lm: NormalizedLandmark[];
  blink: number;
}

interface Track {
  lm: NormalizedLandmark[];
  dx: Float32Array;
  cx: number;
  cy: number;
  blink: number;
  miss: number;
}

let tracks: Track[] = [];
let lastT = 0;
const MAX_MISS = 5;
const MATCH_D = 0.12;
const MIN_CUTOFF = 0.6;
const BETA = 0.9;
const D_CUTOFF = 1.2;

export function resetLandmarkSmoothing() {
  tracks = [];
  lastT = 0;
}

const alpha = (cut: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cut) / dt);

function centroidOf(lm: NormalizedLandmark[]) {
  let x = 0;
  let y = 0;
  for (const p of lm) {
    x += p.x;
    y += p.y;
  }
  return { x: x / lm.length, y: y / lm.length };
}

let curFaces: FaceTrack[] = [];
export function getSmoothedFaces(): FaceTrack[] {
  return curFaces;
}

export function blinkOf(bs: { categories: { categoryName: string; score: number }[] } | undefined): number {
  if (!bs) return 0;
  let m = 0;
  for (const c of bs.categories) {
    if (c.categoryName === 'eyeBlinkLeft' || c.categoryName === 'eyeBlinkRight') m = Math.max(m, c.score);
  }
  return m;
}

export function smoothAndTrack(
  faces: NormalizedLandmark[][],
  blinks: number[],
  tMs: number,
): FaceTrack[] {
  const dt = Math.min(0.5, Math.max(0.04, (tMs - lastT) / 1000 || 0.2));
  lastT = tMs;
  const used = new Set<number>();
  const out: FaceTrack[] = [];

  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    if (!f || !f.length) continue;
    const c = centroidOf(f);
    let best = -1;
    let bd = MATCH_D;
    for (let ti = 0; ti < tracks.length; ti++) {
      if (used.has(ti)) continue;
      const d = Math.hypot(c.x - tracks[ti].cx, c.y - tracks[ti].cy);
      if (d < bd) {
        bd = d;
        best = ti;
      }
    }
    if (best < 0) {
      tracks.push({
        lm: f.map((p) => ({ ...p })),
        dx: new Float32Array(f.length * 2),
        cx: c.x,
        cy: c.y,
        blink: 0,
        miss: 0,
      });
      best = tracks.length - 1;
    }
    used.add(best);
    const tr = tracks[best];
    tr.miss = 0;
    tr.cx = c.x;
    tr.cy = c.y;
    tr.blink = blinks[fi] ?? 0;
    if (tr.lm.length !== f.length) tr.lm = f.map((p) => ({ ...p }));
    else {
      const adx = alpha(D_CUTOFF, dt);
      for (let i = 0; i < f.length; i++) {
        const o = tr.lm[i];
        const r = f[i];
        tr.dx[i * 2] = adx * ((r.x - o.x) / dt) + (1 - adx) * tr.dx[i * 2];
        tr.dx[i * 2 + 1] = adx * ((r.y - o.y) / dt) + (1 - adx) * tr.dx[i * 2 + 1];
        o.x += alpha(MIN_CUTOFF + BETA * Math.abs(tr.dx[i * 2]), dt) * (r.x - o.x);
        o.y += alpha(MIN_CUTOFF + BETA * Math.abs(tr.dx[i * 2 + 1]), dt) * (r.y - o.y);
        o.z += alpha(MIN_CUTOFF, dt) * (r.z - o.z);
      }
    }
    out.push({ lm: tr.lm, blink: tr.blink });
  }

  for (let ti = tracks.length - 1; ti >= 0; ti--) {
    if (!used.has(ti)) {
      tracks[ti].miss++;
      if (tracks[ti].miss <= MAX_MISS) out.push({ lm: tracks[ti].lm, blink: tracks[ti].blink });
      else tracks.splice(ti, 1);
    }
  }
  curFaces = out;
  return out;
}

export function drawFaceMask(
  faces: NormalizedLandmark[][],
  srcW: number,
  srcH: number,
): HTMLCanvasElement | null {
  const W = 256;
  const H = Math.max(8, Math.round((256 * srcH) / srcW));
  if (!maskCanvas) {
    maskCanvas = document.createElement('canvas');
    maskCtx = maskCanvas.getContext('2d')!;
  }
  if (maskCanvas.width !== W || maskCanvas.height !== H) {
    maskCanvas.width = W;
    maskCanvas.height = H;
  }
  const ctx = maskCtx!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const slm of faces) {
    if (!slm || !slm.length) continue;
    // expand the oval ~8% outward so edges/forehead are fully covered
    let cx = 0;
    let cy = 0;
    for (const i of FACE_OVAL) {
      cx += slm[i].x;
      cy += slm[i].y;
    }
    cx /= FACE_OVAL.length;
    cy /= FACE_OVAL.length;
    const oval = FACE_OVAL.map((i) => ({
      ...slm[i],
      x: cx + (slm[i].x - cx) * 1.08,
      y: cy + (slm[i].y - cy) * 1.08,
    }));

    ctx.save();
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = '#f00';
    tracePoly(ctx, oval, oval.map((_, i) => i), W, H);
    ctx.fill();
    ctx.restore();

    // under-eye regions → G channel (additive so R stays intact)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = '#0f0';
    for (const ring of [LEFT_EYE, RIGHT_EYE]) {
      let ex = 0;
      let ey = 0;
      let ew = 0;
      for (const i of ring) {
        ex += slm[i].x;
        ey += slm[i].y;
      }
      ex /= ring.length;
      ey /= ring.length;
      for (const i of ring) ew = Math.max(ew, Math.abs(slm[i].x - ex));
      ctx.beginPath();
      ctx.ellipse(ex * W, (ey + ew * 0.9) * H, ew * 1.15 * W, ew * 0.62 * H, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // cut brows & lips out of the skin channel — 'multiply' zeroes R only,
    // G/B pass through; feature exclusion for eyes/lips is done in-shader
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = '#0ff';
    for (const region of [LIPS, LEFT_BROW, RIGHT_BROW]) {
      tracePoly(ctx, slm, region, W, H);
      ctx.fill();
    }
    ctx.restore();

    // halo-free face-brighten zone → A≈0.8: an oval contracted 12% toward
    // the centroid so the hairline rim is excluded. destination-out scales
    // alpha; must run BEFORE the lip cut (multiplicative: lip in core → 0.44)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    const core = FACE_OVAL.map((i) => ({
      ...slm[i],
      x: cx + (slm[i].x - cx) * 0.85,
      y: cy + (slm[i].y - cy) * 0.85,
    }));
    tracePoly(ctx, core, core.map((_, i) => i), W, H);
    ctx.fill();
    ctx.restore();

    // makeup/detail channels — additive 'lighter' fills on the opaque canvas:
    // cheeks → B≈0.5, eyes → B≈1. Lips go to the alpha channel below.
    const ed = Math.abs(slm[263].x - slm[33].x); // outer eye-corner distance
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = 'rgba(0,0,128,1)'; // blush → B≈0.5
    for (const ci of CHEEKS) {
      const p = slm[ci];
      // pull the blob toward the face centroid so it stays on-skin for
      // profile/turned faces too, with a slight downward bias
      const bx = p.x + (cx - p.x) * 0.22;
      const by = p.y + (cy - p.y) * 0.1 + ed * 0.08;
      ctx.beginPath();
      ctx.ellipse(bx * W, by * H, ed * 0.42 * W, ed * 0.3 * H, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // keep blush out of the eyes/brows — multiply '#ff0' zeroes B only
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = '#ff0';
    for (const region of [LEFT_EYE, RIGHT_EYE, LEFT_BROW, RIGHT_BROW]) {
      tracePoly(ctx, slm, region, W, H);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = '#00f'; // eyes → B=1
    for (const ring of [LEFT_EYE, RIGHT_EYE]) {
      tracePoly(ctx, slm, ring, W, H);
      ctx.fill();
    }
    ctx.restore();

    // lips → alpha ≈0.55. destination-out scales premult alpha (color is
    // preserved in unpremultiplied terms), giving a clean mid-range A band
    // that the shader can isolate — face/background stay A=1.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    tracePoly(ctx, slm, LIPS, W, H);
    ctx.fill();
    ctx.restore();
  }
  return maskCanvas;
}

// pupil positions for the red-eye fx — prefer iris landmarks (468/473) when
// the model provides them, else fall back to eye-contour centroids.
// r is in source-width fractions so the shader can aspect-correct it.
export function eyePoints(faces: FaceTrack[]): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (const f of faces.slice(0, 3)) {
    const lm = f.lm;
    const ed = Math.abs(lm[263].x - lm[33].x); // outer eye-corner distance
    const iris = lm.length > 473;
    for (const [ii, ring] of [
      [473, LEFT_EYE],
      [468, RIGHT_EYE],
    ] as const) {
      let x = 0;
      let y = 0;
      if (iris) {
        x = lm[ii].x;
        y = lm[ii].y;
      } else {
        for (const i of ring) {
          x += lm[i].x;
          y += lm[i].y;
        }
        x /= ring.length;
        y /= ring.length;
      }
      out.push({ x, y, r: ed * 0.17 });
    }
  }
  return out;
}

export interface WarpParams {
  eye: number;
  slim: number;
  nose: number;
  head: number;
}

const MAXOFF = 0.05; // max UV displacement as fraction of width

let warpCanvas: HTMLCanvasElement | null = null;
let warpCtx: CanvasRenderingContext2D | null = null;
let warpImg: ImageData | null = null;

function centroid(lm: NormalizedLandmark[], idx: number[]) {
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

export function drawWarpField(
  faces: FaceTrack[],
  srcW: number,
  srcH: number,
  p: WarpParams,
): HTMLCanvasElement {
  const W = 64;
  const H = Math.max(8, Math.round((64 * srcH) / srcW));
  if (!warpCanvas) {
    warpCanvas = document.createElement('canvas');
    warpCtx = warpCanvas.getContext('2d')!;
  }
  if (warpCanvas.width !== W || warpCanvas.height !== H) {
    warpCanvas.width = W;
    warpCanvas.height = H;
    warpImg = null;
  }
  const ctx = warpCtx!;
  if (!warpImg) warpImg = ctx.createImageData(W, H);
  const d = warpImg.data;
  d.fill(0);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 3] = 255;
  }
  const pairs = buildWarpPairs(faces, p);
  const N = pairs.length / 4;
  if (N) {
    const asp = srcH / srcW;
    for (let y = 0; y < H; y++) {
      const ny = (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        let dx = 0;
        let dy = 0;
        let wsum = 0;
        for (let i = 0; i < N; i++) {
          const sx = pairs[i * 4];
          const sy = pairs[i * 4 + 1];
          const ddx = nx - sx;
          const ddy = (ny - sy) * asp;
          const r2 = ddx * ddx + ddy * ddy + 0.0012;
          const w = 1 / (r2 * r2);
          dx += w * (sx - pairs[i * 4 + 2]);
          dy += w * (sy - pairs[i * 4 + 3]);
          wsum += w;
        }
        dx /= wsum;
        dy /= wsum;
        const o = (y * W + x) * 4;
        d[o] = Math.round((Math.max(-1, Math.min(1, dx / MAXOFF)) * 0.5 + 0.5) * 255);
        d[o + 1] = Math.round((Math.max(-1, Math.min(1, dy / MAXOFF)) * 0.5 + 0.5) * 255);
      }
    }
  }
  ctx.putImageData(warpImg, 0, 0);
  return warpCanvas;
}

// Landmark-driven deformation control points (Shepard / inverse-distance weights).
export function buildWarpPairs(faces: FaceTrack[], p: WarpParams): Float32Array {
  const pairs: number[] = []; // sx, sy, tx, ty
  if (!faces.length || (p.eye < 0.001 && p.slim < 0.001 && p.nose < 0.001 && p.head < 0.001)) {
    return new Float32Array(0);
  }
  for (const { lm, blink } of faces) {
    if (!lm || !lm.length) continue;
    const fcx = centroid(lm, FACE_OVAL).x;
    const fcy = centroid(lm, FACE_OVAL).y;

    const eyeK = 1 + p.eye * 0.28 * (1 - blink * 0.85);
    for (const ring of [LEFT_EYE, RIGHT_EYE]) {
      const c = centroid(lm, ring);
      for (const i of ring) {
        pairs.push(lm[i].x, lm[i].y, c.x + (lm[i].x - c.x) * eyeK, c.y + (lm[i].y - c.y) * eyeK);
      }
      pairs.push(c.x, c.y, c.x, c.y);
    }
    // slim the whole side contour (temple → cheekbone → jaw), weighted by height
    const browY = (lm[6].y + lm[168].y) / 2;
    const chinY = lm[CHIN].y;
    for (const i of FACE_OVAL) {
      if (TOP_ARC.has(i)) continue;
      const s = lm[i];
      const yN = Math.min(1, Math.max(0, (s.y - browY) / Math.max(0.01, chinY - browY)));
      const k = p.slim * 0.18 * (0.3 + 0.7 * yN);
      const lift = i === CHIN ? -p.slim * 0.012 : 0;
      pairs.push(s.x, s.y, s.x + (fcx - s.x) * k, s.y + lift);
    }
    if (p.nose > 0.001) {
      const ncx = (lm[NOSE_WINGS[0]].x + lm[NOSE_WINGS[1]].x) / 2;
      for (const i of NOSE_WINGS) {
        pairs.push(lm[i].x, lm[i].y, lm[i].x + (ncx - lm[i].x) * p.nose * 0.4, lm[i].y);
      }
    }
    // head size (소두): scale the whole face region toward its centroid —
    // contour AND interior features move together, background anchors stay
    if (p.head > 0.001) {
      const k = 1 - p.head * 0.15;
      for (const i of HEAD_SCALE_PTS) {
        pairs.push(lm[i].x, lm[i].y, fcx + (lm[i].x - fcx) * k, fcy + (lm[i].y - fcy) * k);
      }
    }
    // interior anchors pin features — to the head-scaled position when the
    // head warp is active, so features move with the face instead of fighting it
    const ak = 1 - p.head * 0.15;
    for (const i of ANCHORS) {
      pairs.push(lm[i].x, lm[i].y, fcx + (lm[i].x - fcx) * ak, fcy + (lm[i].y - fcy) * ak);
    }
    // ring of fixed anchors outside the face → background stays put
    for (const i of FACE_OVAL) {
      const ox = fcx + (lm[i].x - fcx) * 1.28;
      const oy = fcy + (lm[i].y - fcy) * 1.28;
      pairs.push(ox, oy, ox, oy);
    }
    {
      const ox = fcx;
      const oy = fcy + (lm[CHIN].y - fcy) * 1.3;
      pairs.push(ox, oy, ox, oy);
    }
  }
  return new Float32Array(pairs);
}

export const WARP_MAXOFF = MAXOFF;
