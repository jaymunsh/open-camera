import { FRAG_SHADER, VERT_SHADER } from './shaders';
import { DEFAULT_PARAMS, type FilterParams, type FxSpec, type LutData } from './types';

export interface RenderOpts {
  fit?: 'cover' | 'contain';
  mirror?: boolean;
  time?: number;
  ratio?: { w: number; h: number } | null;
  fx?: FxSpec | null;
}

const UNIFORMS = [
  'u_src',
  'u_lut',
  'u_lutN',
  'u_lutAmount',
  'u_exposure',
  'u_contrast',
  'u_saturation',
  'u_temperature',
  'u_tint',
  'u_highlights',
  'u_shadows',
  'u_fade',
  'u_vignette',
  'u_grain',
  'u_sharpen',
  'u_texel',
  'u_uvScale',
  'u_mirror',
  'u_aspect',
  'u_time',
  'u_leakAmt',
  'u_leakSeed',
  'u_halation',
  'u_soft',
  'u_aberr',
  'u_dust',
  'u_grainTex',
];

const IDENTITY_2: LutData = {
  size: 2,
  data: new Uint8Array([
    0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0, 0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
  ]),
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
  return s;
}

function makeGrainTile(size = 256): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const base = new Float32Array(size * size);
  for (let i = 0; i < base.length; i++) base[i] = Math.random();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          s += base[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const v = s / 9;
      const i = (y * size + x) * 4;
      img.data[i] = v * 255;
      img.data[i + 1] = base[y * size + x] * 255;
      img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function srcSize(src: TexImageSource): { w: number; h: number } {
  const v = src as HTMLVideoElement;
  if (v.videoWidth) return { w: v.videoWidth, h: v.videoHeight };
  const i = src as HTMLImageElement;
  if (i.naturalWidth) return { w: i.naturalWidth, h: i.naturalHeight };
  const s = src as { width: number; height: number };
  return { w: s.width, h: s.height };
}

export class FilterPipeline {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private srcTex: WebGLTexture;
  private grainTex: WebGLTexture;
  private lutTex: WebGLTexture;
  private locs: Record<string, WebGLUniformLocation | null> = {};
  private lutKey: string | null = null;
  private lutN = 2;
  private srcW = 0;
  private srcH = 0;
  private fx: FxSpec | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2를 지원하지 않는 환경입니다');
    this.gl = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SHADER));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
    this.prog = prog;
    for (const n of UNIFORMS) this.locs[n] = gl.getUniformLocation(prog, n);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    this.srcTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.grainTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.grainTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeGrainTile());

    this.lutTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    this.uploadLut(IDENTITY_2);
  }

  private uploadLut(lut: LutData) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGB8,
      lut.size,
      lut.size,
      lut.size,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      lut.data,
    );
    this.lutN = lut.size;
  }

  setFx(fx: FxSpec | null) {
    this.fx = fx;
  }

  setSource(src: TexImageSource) {
    const { w, h } = srcSize(src);
    if (!w || !h) return false;
    this.srcW = w;
    this.srcH = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const mip = (this.fx?.halation ?? 0) > 0.001 || (this.fx?.soft ?? 0) > 0.001;
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    return true;
  }

  setLUT(key: string | null, lut: LutData | null) {
    if (key === this.lutKey) return;
    this.lutKey = key;
    this.uploadLut(lut ?? IDENTITY_2);
  }

  render(params: FilterParams = DEFAULT_PARAMS, lutAmount = 0, opts: RenderOpts = {}) {
    if (!this.srcW) return;
    const gl = this.gl;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (!cw || !ch) return;

    const fit = opts.fit ?? 'cover';
    const sa = this.srcW / this.srcH;
    const ta = opts.ratio ? opts.ratio.w / opts.ratio.h : sa;
    let bx = 0.5;
    let by = 0.5;
    if (sa > ta) bx = (0.5 * ta) / sa;
    else by = (0.5 * sa) / ta;
    const ca = cw / ch;
    let sx = 2 * bx;
    let sy = 2 * by;
    let vx = 0;
    let vy = 0;
    let vw = cw;
    let vh = ch;
    if (fit === 'cover') {
      if (ta > ca) {
        sx = 2 * bx * (ca / ta);
      } else {
        sy = 2 * by * (ta / ca);
      }
    } else {
      if (ta > ca) {
        vh = Math.round(cw / ta);
        vy = Math.round((ch - vh) / 2);
      } else {
        vw = Math.round(ch * ta);
        vx = Math.round((cw - vw) / 2);
      }
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(vx, vy, vw, vh);
    gl.useProgram(this.prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(this.locs.u_src, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.uniform1i(this.locs.u_lut, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.grainTex);
    gl.uniform1i(this.locs.u_grainTex, 2);

    const u = this.locs;
    gl.uniform1f(u.u_lutN, this.lutN);
    gl.uniform1f(u.u_lutAmount, lutAmount);
    gl.uniform1f(u.u_exposure, params.exposure);
    gl.uniform1f(u.u_contrast, params.contrast);
    gl.uniform1f(u.u_saturation, params.saturation);
    gl.uniform1f(u.u_temperature, params.temperature);
    gl.uniform1f(u.u_tint, params.tint);
    gl.uniform1f(u.u_highlights, params.highlights);
    gl.uniform1f(u.u_shadows, params.shadows);
    gl.uniform1f(u.u_fade, params.fade);
    gl.uniform1f(u.u_vignette, params.vignette);
    gl.uniform1f(u.u_sharpen, params.sharpen);
    gl.uniform2f(u.u_texel, 1 / this.srcW, 1 / this.srcH);
    gl.uniform2f(u.u_uvScale, sx, sy);
    gl.uniform1f(u.u_mirror, opts.mirror ? 1 : 0);
    gl.uniform1f(u.u_aspect, vw / vh);
    gl.uniform1f(u.u_time, opts.time ?? 0);

    if (opts.fx !== undefined) this.fx = opts.fx;
    const fx = this.fx;
    gl.uniform1f(u.u_leakAmt, fx?.leak ?? 0);
    gl.uniform1f(u.u_leakSeed, fx?.seed ?? 0.5);
    gl.uniform1f(u.u_halation, fx?.halation ?? 0);
    gl.uniform1f(u.u_soft, fx?.soft ?? 0);
    gl.uniform1f(u.u_aberr, fx?.aberr ?? 0);
    gl.uniform1f(u.u_dust, fx?.dust ?? 0);
    gl.uniform1f(u.u_grain, Math.max(0, params.grain + (fx?.grain ?? 0)));

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export function exportSize(
  w: number,
  h: number,
  ratio: { w: number; h: number } | null = null,
): { w: number; h: number } {
  const sa = w / h;
  const ta = ratio ? ratio.w / ratio.h : sa;
  let outW = w;
  let outH = h;
  if (sa > ta) outW = Math.round(h * ta);
  else outH = Math.round(w / ta);
  const scale = Math.min(1, 4096 / Math.max(outW, outH));
  return { w: Math.round(outW * scale), h: Math.round(outH * scale) };
}

let expCanvas: HTMLCanvasElement | null = null;
let expPipe: FilterPipeline | null = null;

let exp2d: HTMLCanvasElement | null = null;

export function dateLabel(d = new Date()): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `'${yy} ${mm} ${dd}`;
}

export async function exportFiltered(
  src: TexImageSource,
  params: FilterParams,
  lutKey: string | null,
  lut: LutData | null,
  lutAmount: number,
  mirror = false,
  ratio: { w: number; h: number } | null = null,
  fx: FxSpec | null = null,
): Promise<Blob> {
  if (!expCanvas) {
    expCanvas = document.createElement('canvas');
    expPipe = new FilterPipeline(expCanvas);
  }
  const { w, h } = srcSize(src);
  const out = exportSize(w, h, ratio);
  expCanvas.width = out.w;
  expCanvas.height = out.h;
  expPipe!.setFx(fx);
  expPipe!.setSource(src);
  expPipe!.setLUT(lutKey, lut);
  expPipe!.render(params, lutAmount, { fit: 'contain', mirror, ratio });

  let target: HTMLCanvasElement = expCanvas;
  if (fx?.date) {
    if (!exp2d) exp2d = document.createElement('canvas');
    exp2d.width = out.w;
    exp2d.height = out.h;
    const ctx = exp2d.getContext('2d')!;
    ctx.drawImage(expCanvas, 0, 0);
    ctx.font = `600 ${Math.round(out.h * 0.038)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 142, 42, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = Math.round(out.h * 0.006);
    ctx.fillText(dateLabel(), out.w - out.w * 0.045, out.h - out.h * 0.035);
    target = exp2d;
  }

  return new Promise((res, rej) =>
    target.toBlob(
      (b) => (b ? res(b) : rej(new Error('이미지 저장에 실패했습니다'))),
      'image/jpeg',
      0.95,
    ),
  );
}
