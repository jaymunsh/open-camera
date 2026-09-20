import { FRAG_SHADER, VERT_SHADER } from './shaders';
import { renderStampSoft, stampFontReady } from './datestamp';
import { DEFAULT_PARAMS, type FilterParams, type FxSpec, type LutData } from './types';

export interface RenderOpts {
  fit?: 'cover' | 'contain';
  mirror?: boolean;
  time?: number;
  ratio?: { w: number; h: number } | null;
  fx?: FxSpec | null;
  eyes?: { x: number; y: number; r: number }[];
}

const WARP_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_pts;
uniform int u_n;
uniform float u_asp;
uniform float u_maxoff;
in vec2 v_uv;
out vec4 o;
void main() {
  float dx = 0.0;
  float dy = 0.0;
  float ws = 0.0;
  for (int i = 0; i < u_n; i++) {
    vec4 pt = texelFetch(u_pts, ivec2(i, 0), 0);
    vec2 d = vec2(v_uv.x - pt.x, (v_uv.y - pt.y) * u_asp);
    float r2 = dot(d, d) + 0.0012;
    float w = 1.0 / (r2 * r2);
    dx += w * (pt.x - pt.z);
    dy += w * (pt.y - pt.w);
    ws += w;
  }
  if (ws > 0.0) {
    dx /= ws;
    dy /= ws;
  }
  o = vec4(
    clamp(dx / u_maxoff, -1.0, 1.0) * 0.5 + 0.5,
    clamp(dy / u_maxoff, -1.0, 1.0) * 0.5 + 0.5,
    0.0,
    1.0
  );
}
`;

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
  'u_pix',
  'u_cnoise',
  'u_band',
  'u_flash',
  'u_dsharp',
  'u_dclip',
  'u_vsmear',
  'u_jpeg',
  'u_lens',
  'u_defect',
  'u_redeye',
  'u_eyes',
  'u_grainTex',
  'u_beautyMask',
  'u_beauty',
  'u_tone',
  'u_undereye',
  'u_spot',
  'u_spotRad',
  'u_face',
  'u_blush',
  'u_lip',
  'u_eyeclear',
  'u_vibrance',
  'u_clarity',
  'u_whites',
  'u_blacks',
  'u_bloom',
  'u_warp',
];

const SPOT_RADII: readonly (readonly [number, number])[] = [
  [8, 16],
  [12, 26],
  [18, 40],
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
  private prog!: WebGLProgram;
  private srcTex!: WebGLTexture;
  private grainTex!: WebGLTexture;
  private beautyTex!: WebGLTexture;
  private warpTex!: WebGLTexture;
  private lutTex!: WebGLTexture;
  private locs: Record<string, WebGLUniformLocation | null> = {};
  private lutKey: string | null = null;
  private lutN = 2;
  private srcW = 0;
  private srcMip = false;
  private srcH = 0;
  private fx: FxSpec | null = null;
  private canvas: HTMLCanvasElement;
  private beautyOn = false;
  private beauty = 0;
  private tone = 0;
  private undereye = 0;
  private spot = 0;
  private spotRadX = 12;
  private spotRadY = 26;
  private face = 0;
  private blush = 0;
  private lip = 0;
  private eyeclear = 0;
  private warpProg: WebGLProgram | null = null;
  private warpFbo: WebGLFramebuffer | null = null;
  private warpPtsTex: WebGLTexture | null = null;
  private warpLocs: Record<string, WebGLUniformLocation | null> = {};
  private warpW = 0;
  private warpH = 0;
  private warpGpu = true;
  onRestore: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2를 지원하지 않는 환경입니다');
    this.gl = gl;
    this.initGL();
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      this.initGL();
      this.onRestore?.();
    });
  }

  private initGL() {
    const gl = this.gl;
    this.warpProg = null;
    this.warpFbo = null;
    this.warpPtsTex = null;
    this.warpW = 0;
    this.warpH = 0;
    this.warpGpu = true;
    this.lutKey = null;
    this.locs = {};

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SHADER));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
    this.prog = prog;
    for (const n of UNIFORMS)
      this.locs[n] = gl.getUniformLocation(prog, n) ?? gl.getUniformLocation(prog, `${n}[0]`);

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

    this.beautyTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.beautyTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    this.warpTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 0, 255]));

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

  setBeautyMask(
    mask: TexImageSource | null,
    amounts: {
      skin: number;
      tone: number;
      undereye: number;
      spot: number;
      spotRange: number;
      face: number;
      blush: number;
      lip: number;
      eyeclear: number;
    },
  ) {
    const gl = this.gl;
    this.beauty = amounts.skin;
    this.tone = amounts.tone;
    this.undereye = amounts.undereye;
    this.spot = amounts.spot;
    this.face = amounts.face;
    this.blush = amounts.blush;
    this.lip = amounts.lip;
    this.eyeclear = amounts.eyeclear;
    const rad = SPOT_RADII[Math.round(amounts.spotRange)] ?? SPOT_RADII[1];
    this.spotRadX = rad[0];
    this.spotRadY = rad[1];
    this.beautyOn =
      !!mask &&
      (amounts.skin > 0.001 ||
        amounts.tone > 0.001 ||
        amounts.undereye > 0.001 ||
        amounts.spot > 0.001 ||
        amounts.face > 0.001 ||
        amounts.blush > 0.001 ||
        amounts.lip > 0.001 ||
        amounts.eyeclear > 0.001);
    gl.bindTexture(gl.TEXTURE_2D, this.beautyTex);
    if (mask) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    }
  }

  setWarpMap(map: TexImageSource | null) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
    if (map) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
      this.warpW = Number((map as { width?: number }).width) || 0;
      this.warpH = Number((map as { height?: number }).height) || 0;
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 0, 255]));
      this.warpW = 1;
      this.warpH = 1;
    }
  }

  renderWarpField(pairs: Float32Array | null, srcW: number, srcH: number): boolean {
    if (!this.warpGpu || !srcW || !srcH) return false;
    const gl = this.gl;
    const n = pairs ? pairs.length / 4 : 0;
    const W = 64;
    const H = Math.max(8, Math.round((64 * srcH) / srcW));
    try {
      if (!this.warpProg) {
        const prog = gl.createProgram()!;
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SHADER));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, WARP_FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('warp link');
        this.warpProg = prog;
        for (const nm of ['u_pts', 'u_n', 'u_asp', 'u_maxoff'])
          this.warpLocs[nm] = gl.getUniformLocation(prog, nm);
        this.warpFbo = gl.createFramebuffer();
        this.warpPtsTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.warpPtsTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      if (this.warpW !== W || this.warpH !== H) {
        this.warpW = W;
        this.warpH = H;
        gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.warpPtsTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        Math.max(1, n),
        1,
        0,
        gl.RGBA,
        gl.FLOAT,
        n ? pairs : new Float32Array(4),
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.warpFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.warpTex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.warpProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.warpPtsTex);
      gl.uniform1i(this.warpLocs.u_pts, 0);
      gl.uniform1i(this.warpLocs.u_n, n);
      gl.uniform1f(this.warpLocs.u_asp, srcH / srcW);
      gl.uniform1f(this.warpLocs.u_maxoff, 0.05);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return true;
    } catch {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.warpGpu = false;
      return false;
    }
  }

  setSource(src: TexImageSource) {
    const { w, h } = srcSize(src);
    if (!w || !h) return false;
    this.srcW = w;
    this.srcH = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const mip =
      (this.fx?.halation ?? 0) > 0.001 ||
      (this.fx?.soft ?? 0) > 0.001 ||
      (this.fx?.pix ?? 0) > 0.001 ||
      (this.fx?.dsharp ?? 0) > 0.001 ||
      (this.fx?.lens ?? 0) > 0.001 ||
      (this.fx?.jpeg ?? 0) > 0.001;
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    this.srcMip = mip;
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
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.beautyTex);
    gl.uniform1i(this.locs.u_beautyMask, 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
    gl.uniform1i(this.locs.u_warp, 4);

    const u = this.locs;
    gl.uniform1f(u.u_lutN, this.lutN);
    gl.uniform1f(u.u_lutAmount, lutAmount);
    gl.uniform1f(u.u_exposure, params.exposure);
    gl.uniform1f(u.u_contrast, params.contrast);
    gl.uniform1f(u.u_saturation, params.saturation);
    gl.uniform1f(u.u_vibrance, params.vibrance);
    gl.uniform1f(u.u_clarity, params.clarity);
    gl.uniform1f(u.u_whites, params.whites);
    gl.uniform1f(u.u_blacks, params.blacks);
    gl.uniform1f(u.u_bloom, params.bloom);
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
    // bloom (and halation/soft fx) sample low mips via textureLod — generate
    // them lazily here so export and live paths both work regardless of the
    // mip decision made back in setSource. Also enable trilinear filtering
    // when the source is much larger than the viewport: plain LINEAR on a
    // 4K->750px downscale shimmers; the mip chain also averages sensor noise.
    const downscale = Math.max(
      (this.srcW * sx) / Math.max(1, vw),
      (this.srcH * sy) / Math.max(1, vh),
    );
    const wantMip =
      downscale > 1.3 ||
      (fx?.halation ?? 0) > 0.001 ||
      (fx?.soft ?? 0) > 0.001 ||
      (fx?.pix ?? 0) > 0.001 ||
      (fx?.dsharp ?? 0) > 0.001 ||
      (fx?.lens ?? 0) > 0.001 ||
      (fx?.jpeg ?? 0) > 0.001 ||
      params.bloom > 0.001;
    if (wantMip && !this.srcMip) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.srcMip = true;
    }
    gl.uniform1f(u.u_leakAmt, fx?.leak ?? 0);
    gl.uniform1f(u.u_leakSeed, fx?.seed ?? 0.5);
    gl.uniform1f(u.u_halation, fx?.halation ?? 0);
    gl.uniform1f(u.u_soft, fx?.soft ?? 0);
    gl.uniform1f(u.u_aberr, fx?.aberr ?? 0);
    gl.uniform1f(u.u_dust, fx?.dust ?? 0);
    gl.uniform1f(u.u_pix, fx?.pix ?? 0);
    gl.uniform1f(u.u_cnoise, fx?.cnoise ?? 0);
    gl.uniform1f(u.u_band, fx?.band ?? 0);
    gl.uniform1f(u.u_flash, fx?.flash ?? 0);
    gl.uniform1f(u.u_dsharp, fx?.dsharp ?? 0);
    gl.uniform1f(u.u_dclip, fx?.dclip ?? 0);
    gl.uniform1f(u.u_vsmear, fx?.vsmear ?? 0);
    gl.uniform1f(u.u_jpeg, fx?.jpeg ?? 0);
    gl.uniform1f(u.u_lens, fx?.lens ?? 0);
    gl.uniform1f(u.u_defect, fx?.defect ?? 0);
    gl.uniform1f(u.u_redeye, fx?.redeye ?? 0);
    const eyes = opts.eyes ?? [];
    const ev = new Float32Array(24);
    for (let i = 0; i < Math.min(6, eyes.length); i++) {
      ev[i * 4] = eyes[i].x;
      ev[i * 4 + 1] = eyes[i].y;
      ev[i * 4 + 2] = eyes[i].r;
      ev[i * 4 + 3] = 1;
    }
    gl.uniform4fv(u.u_eyes, ev);
    gl.uniform1f(u.u_grain, Math.max(0, params.grain + (fx?.grain ?? 0)));
    gl.uniform1f(u.u_beauty, this.beautyOn ? this.beauty : 0);
    gl.uniform1f(u.u_tone, this.beautyOn ? this.tone : 0);
    gl.uniform1f(u.u_undereye, this.beautyOn ? this.undereye : 0);
    gl.uniform1f(u.u_spot, this.beautyOn ? this.spot : 0);
    gl.uniform2f(u.u_spotRad, this.spotRadX, this.spotRadY);
    gl.uniform1f(u.u_face, this.beautyOn ? this.face : 0);
    gl.uniform1f(u.u_blush, this.beautyOn ? this.blush : 0);
    gl.uniform1f(u.u_lip, this.beautyOn ? this.lip : 0);
    gl.uniform1f(u.u_eyeclear, this.beautyOn ? this.eyeclear : 0);

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

export type DateFmt = 'yy' | 'iso' | 'ddmmyy' | 'ddmmyyyy' | 'mmddyyyy';

export type DateSize = 'sm' | 'md' | 'lg';

export const DATE_SIZES: { id: DateSize; label: string; scale: number }[] = [
  { id: 'sm', label: '작게', scale: 0.026 },
  { id: 'md', label: '기본', scale: 0.044 },
  { id: 'lg', label: '크게', scale: 0.068 },
];

export const DATE_FORMATS: { id: DateFmt; label: string }[] = [
  { id: 'yy', label: `'YY MM DD` },
  { id: 'iso', label: 'YYYY-MM-DD' },
  { id: 'ddmmyy', label: `DD-MM-'YY` },
  { id: 'ddmmyyyy', label: 'DD-MM-YYYY' },
  { id: 'mmddyyyy', label: 'MM-DD-YYYY' },
];

export function dateLabel(d = new Date(), fmt: DateFmt = 'yy'): string {
  const yy = String(d.getFullYear()).slice(2);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  switch (fmt) {
    case 'iso':
      return `${yyyy}-${mm}-${dd}`;
    case 'ddmmyy':
      return `${dd}-${mm}-'${yy}`;
    case 'ddmmyyyy':
      return `${dd}-${mm}-${yyyy}`;
    case 'mmddyyyy':
      return `${mm}-${dd}-${yyyy}`;
    default:
      return `'${yy} ${mm} ${dd}`;
  }
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
  beautyMask: TexImageSource | null = null,
  beauty: {
    skin: number;
    tone: number;
    undereye: number;
    spot: number;
    spotRange: number;
    face: number;
    blush: number;
    lip: number;
    eyeclear: number;
  } = {
    skin: 0,
    tone: 0,
    undereye: 0,
    spot: 0,
    spotRange: 1,
    face: 0,
    blush: 0,
    lip: 0,
    eyeclear: 0,
  },
  warp: Float32Array | TexImageSource | null = null,
  eyes: { x: number; y: number; r: number }[] = [],
  dateStamp: {
    on: boolean;
    fmt: DateFmt;
    size: DateSize;
    orient: 'auto' | 'p' | 'l';
  } = { on: false, fmt: 'yy', size: 'md', orient: 'auto' },
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
  expPipe!.setBeautyMask(beautyMask, beauty);
  if (warp instanceof Float32Array) {
    if (!expPipe!.renderWarpField(warp, w, h)) expPipe!.setWarpMap(null);
  } else {
    expPipe!.setWarpMap(warp);
  }
  expPipe!.setSource(src);
  expPipe!.setLUT(lutKey, lut);
  expPipe!.render(params, lutAmount, { fit: 'contain', mirror, ratio, eyes });

  let target: HTMLCanvasElement = expCanvas;
  if (dateStamp.on) {
    if (!exp2d) exp2d = document.createElement('canvas');
    exp2d.width = out.w;
    exp2d.height = out.h;
    const ctx = exp2d.getContext('2d')!;
    ctx.drawImage(expCanvas, 0, 0);
    await stampFontReady;
    const stampH =
      out.h * (DATE_SIZES.find((s) => s.id === dateStamp.size)?.scale ?? 0.044);
    const vert =
      dateStamp.orient === 'l' ||
      (dateStamp.orient === 'auto' && out.w > out.h);
    const s = renderStampSoft(
      dateLabel(new Date(), dateStamp.fmt),
      Math.max(2, Math.round(stampH / 7)),
      vert,
    );
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.round(out.h * 0.006);
    ctx.drawImage(
      s.canvas,
      vert ? out.w * 0.045 : out.w - out.w * 0.045 - s.w,
      out.h - out.h * 0.035 - s.h,
      s.w,
      s.h,
    );
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
