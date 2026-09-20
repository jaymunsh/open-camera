export const VERT_SHADER = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 v_uv;
void main() {
  vec2 p = P[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const FRAG_SHADER = `#version 300 es
precision highp float;
precision mediump sampler3D;

uniform sampler2D u_src;
uniform sampler2D u_grainTex;
uniform sampler3D u_lut;
uniform float u_lutN;
uniform float u_lutAmount;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_fade;
uniform float u_vignette;
uniform float u_grain;
uniform float u_sharpen;
uniform vec2 u_texel;
uniform vec2 u_uvScale;
uniform float u_mirror;
uniform float u_aspect;
uniform float u_time;
uniform float u_leakAmt;
uniform float u_leakSeed;
uniform float u_halation;
uniform float u_soft;
uniform float u_aberr;
uniform float u_dust;
uniform float u_pix;
uniform float u_cnoise;
uniform float u_band;
uniform float u_flash;
uniform float u_dsharp;
uniform float u_dclip;
uniform float u_vsmear;
uniform float u_jpeg;
uniform float u_lens;
uniform float u_defect;
uniform float u_redeye;
uniform vec4 u_eyes[6];
uniform sampler2D u_beautyMask;
uniform float u_beauty;
uniform float u_tone;
uniform float u_undereye;
uniform float u_spot;
uniform vec2 u_spotRad;
uniform float u_face;
uniform float u_blush;
uniform float u_lip;
uniform float u_eyeclear;
uniform float u_vibrance;
uniform float u_clarity;
uniform float u_whites;
uniform float u_blacks;
uniform float u_bloom;
uniform sampler2D u_warp;

in vec2 v_uv;
out vec4 frag;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = 0.5 + (v_uv - 0.5) * u_uvScale;
  uv.y = 1.0 - uv.y;
  uv.x = mix(uv.x, 1.0 - uv.x, u_mirror);

  // face warp (eye enlarge / slim): RG displacement map, 0.5 = neutral
  {
    vec2 w = texture(u_warp, uv).rg * 2.0 - 1.0;
    uv += w * 0.05;
  }

  // cheap zoom lens: barrel distortion — cheap optics stretch the frame
  // outward toward the corners
  if (u_lens > 0.001) {
    vec2 dc = uv - 0.5;
    dc.x *= u_texel.y / u_texel.x;
    uv = 0.5 + (uv - 0.5) * (1.0 + u_lens * 0.14 * dot(dc, dc));
  }

  vec3 c;
  float caAmt = u_aberr + u_lens * 0.45;
  if (caAmt > 0.0001) {
    vec2 ca = (uv - 0.5) * caAmt * 0.012;
    c.r = texture(u_src, uv + ca).r;
    c.g = texture(u_src, uv).g;
    c.b = texture(u_src, uv - ca).b;
  } else {
    c = texture(u_src, uv).rgb;
  }

  // cheap lens corner softness: only the center is truly sharp — edges melt
  // into a low mip the way compact zooms smear the corners
  if (u_lens > 0.001) {
    vec2 dc = v_uv - 0.5;
    dc.x *= u_aspect;
    float rs = smoothstep(0.3, 0.75, length(dc));
    c = mix(c, textureLod(u_src, uv, 1.8).rgb, rs * u_lens * 0.7);
  }

  // digicam low-res: 4:2:0 chroma subsampling — chroma bleeds from a low mip
  // while luma keeps most of its detail (only partially smeared, like
  // in-sensor NR). This color-bleed is the real CCD signature, not blur
  if (u_pix > 0.001) {
    vec3 lo = textureLod(u_src, uv, 2.6).rgb;
    float yMix = mix(0.72, 0.3, u_pix);
    vec3 sm = vec3(luma(c) * yMix + luma(lo) * (1.0 - yMix)) + (lo - luma(lo));
    c = mix(c, sm, u_pix);
  }

  // digicam in-camera sharpening: unsharp vs mip1 — crunchy edge halos
  if (u_dsharp > 0.001) {
    vec3 b = textureLod(u_src, uv, 1.3).rgb;
    c += (c - b) * u_dsharp * 0.8;
    c = clamp(c, 0.0, 1.0);
  }

  // CCD vertical smear: bright sources streak vertically down the column
  if (u_vsmear > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      float o = float(i) * u_texel.y * 55.0;
      acc += texture(u_src, uv + vec2(0.0, o)).rgb;
      acc += texture(u_src, uv - vec2(0.0, o)).rgb;
    }
    vec3 smr = acc * 0.125;
    float hi = smoothstep(0.7, 0.95, luma(smr));
    c += smr * hi * u_vsmear * 0.45;
  }

  // CCD defects: horizontal blooming (charge spills sideways off highlights)
  // + stuck hot pixels — fixed position, purple-white dots
  if (u_defect > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      float o = float(i) * u_texel.x * 42.0;
      acc += texture(u_src, uv + vec2(o, 0.0)).rgb;
      acc += texture(u_src, uv - vec2(o, 0.0)).rgb;
    }
    vec3 smr = acc * 0.125;
    float hi = smoothstep(0.68, 0.95, luma(smr));
    c += smr * hi * u_defect * 0.4;
    float hp = hash(floor(uv * vec2(1531.0, 997.0)) + floor(u_leakSeed * 71.0));
    c += step(0.99968, hp) * vec3(0.85, 0.7, 1.0) * u_defect;
  }

  bool beautyAny = u_beauty > 0.001 || u_tone > 0.001 || u_undereye > 0.001 || u_spot > 0.001
    || u_face > 0.001 || u_blush > 0.001 || u_lip > 0.001 || u_eyeclear > 0.001;
  if (beautyAny) {
    vec4 mc = texture(u_beautyMask, uv);
    // skin-tone gate: keeps the mask off hair/background/non-skin pixels
    float sk = smoothstep(0.005, 0.05, c.r - c.b) * smoothstep(-0.04, 0.02, c.r - c.g);
    float m = mc.r * (0.35 + 0.65 * sk);
    float ue = mc.g;
    // channel encoding: R=face skin (brows/lips pre-cut), G=under-eye,
    // B = cheeks ≈0.5 / eyes ≈1, A bands: 1=bg/rim, ≈0.8=face core, ≈0.45=lips.
    float eyeM = smoothstep(0.8, 0.95, mc.b);
    float lipM = smoothstep(0.38, 0.52, 1.0 - mc.a) * (1.0 - smoothstep(0.62, 0.78, 1.0 - mc.a));
    float coreM = smoothstep(0.7, 0.78, mc.a) * (1.0 - smoothstep(0.88, 0.96, mc.a));
    float blushM = clamp(mc.b * 1.8, 0.0, 1.0) * (1.0 - eyeM)
                 * smoothstep(0.08, 0.35, mc.r); // stay on-skin
    float feat = clamp(eyeM + lipM, 0.0, 1.0);
    m *= 1.0 - feat; // keep smoothing/healing off eyes & lips
    vec3 res = c;
    if ((u_beauty > 0.001 || u_tone > 0.001 || u_undereye > 0.001 || u_spot > 0.001) &&
        (m > 0.001 || ue > 0.001)) {
      vec3 ctr = c;
      vec3 acc = ctr;
      float wsum = 1.0;
      // two outer rings (r≈12 / 26 texels): small AND large blemishes both
      // read as outliers vs at least one ring; luma range = edge detector
      vec3 oacc = vec3(0.0);
      vec3 oacc2 = vec3(0.0);
      float ymin1 = 1e9;
      float ymax1 = -1e9;
      float ymin2 = 1e9;
      float ymax2 = -1e9;
      const vec2 D[16] = vec2[16](
        vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
        vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
        vec2(1.0, 0.5), vec2(-1.0, 0.5), vec2(1.0, -0.5), vec2(-1.0, -0.5),
        vec2(0.5, 1.0), vec2(-0.5, 1.0), vec2(0.5, -1.0), vec2(-0.5, -1.0));
      const vec2 D2[8] = vec2[8](
        vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
        vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707));
      for (int i = 0; i < 16; i++) {
        vec3 sm0 = texture(u_src, uv + D[i] * u_texel * 6.0).rgb;
        float d = distance(sm0, ctr);
        float w = exp(-d * d * 12.0);
        acc += sm0 * w;
        wsum += w;
      }
      for (int i = 0; i < 8; i++) {
        vec3 o = texture(u_src, uv + D2[i] * u_texel * u_spotRad.x).rgb;
        oacc += o;
        float yo = dot(o, vec3(0.2126, 0.7152, 0.0722));
        ymin1 = min(ymin1, yo);
        ymax1 = max(ymax1, yo);
      }
      for (int i = 0; i < 8; i++) {
        vec3 o = texture(u_src, uv + D2[i] * u_texel * u_spotRad.y).rgb;
        oacc2 += o;
        float yo = dot(o, vec3(0.2126, 0.7152, 0.0722));
        ymin2 = min(ymin2, yo);
        ymax2 = max(ymax2, yo);
      }
      vec3 low = acc / wsum;
      vec3 detail = c - low;
      // blemish detection: pixel is an outlier vs a ring in luma OR chroma
      // (red/brown spots have small luma delta but clear color delta).
      // coherence check: near an edge the ring spans both sides → large luma
      // range → suppress detection so edges/moles-on-edges are preserved.
      // extreme color distance = edge (hair/clothing), not blemish — exempt.
      float yc = dot(ctr, vec3(0.2126, 0.7152, 0.0722));
      float ext1 = max(yc - ymax1, ymin1 - yc);
      float ext2 = max(yc - ymax2, ymin2 - yc);
      float chrD1 = distance(ctr, oacc * 0.125);
      float chrD2 = distance(ctr, oacc2 * 0.125);
      float s1 = max(
        smoothstep(0.010, 0.05, ext1),
        smoothstep(0.04, 0.11, chrD1) * (1.0 - smoothstep(0.28, 0.45, chrD1)) * 0.85
      ) * (1.0 - smoothstep(0.10, 0.26, ymax1 - ymin1));
      float s2 = max(
        smoothstep(0.010, 0.05, ext2),
        smoothstep(0.04, 0.11, chrD2) * (1.0 - smoothstep(0.28, 0.45, chrD2)) * 0.85
      ) * (1.0 - smoothstep(0.10, 0.26, ymax2 - ymin2));
      float spot = max(s1, s2);
      if (u_beauty > 0.001) {
        // split detail into luma (skin texture — keep) and chroma (blemish color — suppress)
        float dl = dot(detail, vec3(0.2126, 0.7152, 0.0722));
        vec3 dch = detail - vec3(dl);
        vec3 sm = low + vec3(dl * (1.0 - 0.5 * u_beauty)) + dch * (1.0 - 0.65 * u_beauty);
        sm *= 1.0 + 0.04 * u_beauty;
        sm = sm / (1.0 + sm * 0.08 * u_beauty);
        res = mix(res, sm, m * min(1.0, u_beauty * 1.15));
      }
      // dedicated blemish removal (잡티): heal with the mean of whichever
      // ring fired — for large blemishes the near ring is contaminated, so
      // the detecting ring's mean is the safe surrounding-skin color.
      // raw face mask (mc.r), not the skin-tone gate — blemishes are
      // non-skin-colored by definition and must not be gated out.
      // 피부 keeps a light version via the 0.35 base.
      float spotK = max(u_spot, u_beauty * 0.35);
      if (spotK > 0.001) {
        vec3 heal = s2 > s1 ? oacc2 * 0.125 : oacc * 0.125;
        res = mix(res, heal, spot * mc.r * (1.0 - feat) * min(1.0, spotK));
      }
      if (u_tone > 0.001) {
        vec3 t = res * vec3(0.992, 1.002, 1.012) + vec3(0.012, 0.008, 0.02);
        res = mix(res, t, m * u_tone * 0.7);
      }
      if (u_undereye > 0.001) {
        vec3 u = low * 1.1 + vec3(0.006);
        res = mix(res, u, ue * min(1.0, u_undereye) * 0.6);
      }
    }
    // face-wide & makeup effects — no neighborhood taps needed.
    // face brighten: gamma lift — raises mids more than highlights and keeps
    // the original shading (screen-blend flattens into a paper mask).
    // contracted core mask (A≈0.8) keeps the hairline rim out; skin-tone
    // gate softens stray warm hair inside the core.
    if (u_face > 0.001) {
      // graduated lift: full strength in the contracted core, ~45% in the
      // oval rim (softens the boundary into a gradient instead of an edge),
      // and a saturation-ceiling skin gate so dark warm hair is excluded
      // even inside the oval.
      float mx2 = max(c.r, max(c.g, c.b));
      float sat = (mx2 - min(c.r, min(c.g, c.b))) / (mx2 + 1e-3);
      float skS = sk * smoothstep(0.55, 0.35, sat);
      float fa = mc.r * (0.15 + 0.85 * skS) * (0.45 + 0.55 * coreM) + feat;
      fa = clamp(fa, 0.0, 1.0);
      float ly0 = dot(res, vec3(0.2126, 0.7152, 0.0722));
      float ex = u_face * fa * 0.32 * (1.0 - smoothstep(0.55, 0.9, ly0) * 0.5);
      vec3 lifted = pow(clamp(res, 0.0, 1.0), vec3(1.0 - ex));
      // gamma lift desaturates a touch — put some chroma back so skin
      // stays lively instead of chalky
      lifted = mix(vec3(dot(lifted, vec3(0.2126, 0.7152, 0.0722))), lifted, 1.0 + ex * 0.6);
      res = clamp(lifted, 0.0, 1.0);
    }
    // blush: luminance-preserving pink — original shading stays, hue shifts
    if (u_blush > 0.001) {
      float ly = dot(res, vec3(0.2126, 0.7152, 0.0722));
      vec3 pink = vec3(0.96, 0.52, 0.6) * (ly * 1.3 + 0.1);
      res = mix(res, pink, blushM * u_blush * 0.5);
    }
    // lip tint: same trick, deeper tone + slight highlight boost (gloss)
    if (u_lip > 0.001) {
      float ly = dot(res, vec3(0.2126, 0.7152, 0.0722));
      vec3 lipC = vec3(0.84, 0.26, 0.33) * (ly * 1.45 + 0.12) + vec3(0.05, 0.0, 0.01);
      res = mix(res, lipC, lipM * u_lip * 0.72);
    }
    // eye clarity: brighten + local contrast + iris saturation pop + cool lift
    if (u_eyeclear > 0.001) {
      vec3 ec = clamp((res - 0.44) * 1.24 + 0.47 + vec3(0.0, 0.005, 0.02), 0.0, 1.0);
      ec = mix(vec3(dot(ec, vec3(0.2126, 0.7152, 0.0722))), ec, 1.0 + u_eyeclear * 0.2);
      res = mix(res, clamp(ec, 0.0, 1.0), eyeM * u_eyeclear * 0.75);
    }
    c = res;
  }

  // digicam direct flash: hot center falling off to dark edges — the flat,
  // slightly clipped "on-camera flash" look, applied before grading
  if (u_flash > 0.001) {
    float fd = distance(v_uv, vec2(0.5, 0.44));
    float lift = smoothstep(0.8, 0.12, fd);
    float fall = smoothstep(0.42, 0.95, fd);
    c *= 1.0 + u_flash * lift * 0.55;
    c *= 1.0 - u_flash * fall * 0.42;
    c += vec3(-0.012, 0.03, 0.014) * lift * u_flash; // cool-white flash cast
    float fl2 = luma(c);
    c = mix(vec3(fl2), c, 1.0 - u_flash * 0.12);
    c = (c - 0.5) * (1.0 + u_flash * 0.1) + 0.5;
    c = clamp(c, 0.0, 1.0);
  }

  // flash red-eye: pupils bounce the strobe back red. u_eyes carries
  // normalized landmark coords (mask space) — invert the uv chain back to
  // screen space so dots sit on the rendered pupils
  if (u_redeye > 0.001) {
    float asp = u_texel.y / u_texel.x;
    for (int i = 0; i < 6; i++) {
      vec4 e = u_eyes[i];
      if (e.w < 0.5) continue;
      vec2 es = e.xy;
      es.x = mix(es.x, 1.0 - es.x, u_mirror);
      es.y = 1.0 - es.y;
      vec2 eu = 0.5 + (es - 0.5) / u_uvScale;
      vec2 d = v_uv - eu;
      d.x *= u_aspect;
      float r = e.z * asp;
      float dd = length(d);
      float m = 1.0 - smoothstep(r * 0.5, r, dd);
      vec3 re = vec3(0.5, 0.02, 0.01)
              + vec3(0.5, 0.22, 0.08) * (1.0 - smoothstep(0.0, r * 0.45, dd));
      c = mix(c, re, m * u_redeye);
    }
  }

  if (u_sharpen > 0.001) {
    vec3 n = texture(u_src, uv + vec2(0.0, u_texel.y)).rgb
           + texture(u_src, uv - vec2(0.0, u_texel.y)).rgb
           + texture(u_src, uv + vec2(u_texel.x, 0.0)).rgb
           + texture(u_src, uv - vec2(u_texel.x, 0.0)).rgb;
    c += (c - n * 0.25) * u_sharpen;
  }

  c *= exp2(u_exposure);

  c.r += u_temperature * 0.10;
  c.b -= u_temperature * 0.10;
  c.g += u_tint * 0.06;
  c = clamp(c, 0.0, 1.0);

  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;

  float l = luma(c);
  c = mix(vec3(l), c, 1.0 + u_saturation);
  c = clamp(c, 0.0, 1.0);

  // vibrance: saturates low-saturation pixels only (positive), flat desat (negative)
  if (abs(u_vibrance) > 0.001) {
    vec3 vg = vec3(luma(c));
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float cs = clamp((mx - mn) / (mx + 1e-3), 0.0, 1.0);
    float w = u_vibrance > 0.0 ? u_vibrance * (1.0 - cs) : u_vibrance;
    c = mix(vg, c, 1.0 + w);
    c = clamp(c, 0.0, 1.0);
  }

  l = luma(c);
  c += u_shadows * (1.0 - smoothstep(0.0, 0.55, l)) * 0.35;
  c += u_highlights * smoothstep(0.45, 1.0, l) * 0.35;
  c += vec3(u_whites * 0.18 * smoothstep(0.55, 1.0, l));
  c += vec3(u_blacks * 0.12 * (1.0 - smoothstep(0.0, 0.5, l)));
  c = clamp(c, 0.0, 1.0);

  // clarity: mid-frequency local contrast, midtone-weighted
  if (abs(u_clarity) > 0.001) {
    vec3 bl = (texture(u_src, uv + vec2(u_texel.x * 5.0, 0.0)).rgb
             + texture(u_src, uv - vec2(u_texel.x * 5.0, 0.0)).rgb
             + texture(u_src, uv + vec2(0.0, u_texel.y * 5.0)).rgb
             + texture(u_src, uv - vec2(0.0, u_texel.y * 5.0)).rgb) * 0.25;
    float mid = 1.0 - abs(dot(bl, vec3(0.2126, 0.7152, 0.0722)) - 0.5) * 2.0;
    c += (c - bl) * u_clarity * mid * 0.8;
    c = clamp(c, 0.0, 1.0);
  }

  c = mix(c, vec3(0.07) + c * 0.93, u_fade);
  c = clamp(c, 0.0, 1.0);

  if (u_lutAmount > 0.001) {
    vec3 lc = texture(u_lut, c * ((u_lutN - 1.0) / u_lutN) + 0.5 / u_lutN).rgb;
    c = mix(c, lc, u_lutAmount);
  }

  if (u_soft > 0.001) {
    vec3 blur = textureLod(u_src, uv, 3.0).rgb;
    c = mix(c, blur, u_soft * 0.4);
  }

  if (u_halation > 0.001) {
    vec3 blur = textureLod(u_src, uv, 4.0).rgb;
    float hi = smoothstep(0.55, 0.95, luma(blur));
    c += blur * hi * u_halation * 0.45;
    c += vec3(1.0, 0.30, 0.06) * hi * u_halation * 0.22;
  }

  if (u_bloom > 0.001) {
    vec3 g = textureLod(u_src, uv, 4.0).rgb;
    c += max(g - 0.55, vec3(0.0)) * u_bloom * 0.9;
  }

  if (u_leakAmt > 0.001) {
    vec2 p1 = vec2(0.15 + 0.7 * fract(sin(u_leakSeed * 12.3) * 431.7),
                   0.15 + 0.7 * fract(sin(u_leakSeed * 91.7) * 283.3));
    vec2 p2 = vec2(0.2 + 0.6 * fract(sin(u_leakSeed * 45.7) * 911.1),
                   0.2 + 0.6 * fract(sin(u_leakSeed * 67.9) * 537.7));
    float l1 = smoothstep(0.5, 0.0, distance(v_uv, p1));
    float l2 = smoothstep(0.35, 0.0, distance(v_uv, p2));
    vec3 leak = vec3(1.0, 0.38, 0.10) * l1 + vec3(1.0, 0.55, 0.18) * l2 * 0.6;
    c = 1.0 - (1.0 - c) * (1.0 - leak * u_leakAmt);
  }

  if (u_vignette > 0.001) {
    vec2 d = v_uv - 0.5;
    d.x *= u_aspect;
    c *= 1.0 - u_vignette * smoothstep(0.4, 0.85, length(d));
  }

  if (u_dust > 0.001) {
    float d1 = hash(floor(v_uv * 640.0) + floor(u_leakSeed * 10.0));
    c += step(0.9992, d1) * u_dust * 0.7;
    float sx = hash(vec2(floor(v_uv.x * 240.0), floor(u_leakSeed * 100.0)));
    float sy = hash(vec2(floor(v_uv.y * 8.0), sx * 100.0));
    c += step(0.9975, sx) * u_dust * 0.45 * smoothstep(0.3, 0.9, sy);
  }

  // digicam chroma noise: low-frequency colored blotches, three decorrelated
  // grain-texture reads — CCD sensor noise is chroma-heavy, not luma speckle
  if (u_cnoise > 0.001) {
    vec2 guv2 = v_uv * vec2(u_aspect, 1.0) * 1.35;
    vec3 cn = vec3(
      texture(u_grainTex, guv2 + vec2(0.0, fract(u_time * 0.37))).r,
      texture(u_grainTex, guv2 + vec2(0.31, fract(u_time * 0.29))).g,
      texture(u_grainTex, guv2 * 1.6 + vec2(0.67, fract(u_time * 0.43))).r
    ) - 0.5;
    float cw = max(0.2, 1.1 - luma(c));
    c += cn * u_cnoise * 0.3 * cw;
  }

  // digicam tone crush: posterize toward fewer levels — cheap-sensor JPEG banding
  if (u_band > 0.001) {
    float lv = mix(72.0, 15.0, u_band);
    vec3 q = floor(c * lv + 0.5) / lv;
    c = mix(c, q, u_band * 0.8);
  }

  // digicam digital shoulder: highlights push up and clip hard to flat white —
  // no filmic rolloff, sensors just saturate
  if (u_dclip > 0.001) {
    c = mix(c, clamp(c * (1.0 + u_dclip * 0.35), 0.0, 1.0), u_dclip);
  }

  // low-quality JPEG: 8x8 macroblocks — chroma collapses to the block
  // average, each block's DC level jitters, and mosquito noise rings the
  // block edges. Cell size scales with resolution so it reads the same
  // at any source size (≈compressing a ~900px tall file)
  if (u_jpeg > 0.001) {
    float hpx = 1.0 / u_texel.y;
    vec2 csz = u_texel * 8.0 * max(1.0, hpx / 900.0);
    vec2 cell = floor(uv / csz);
    vec2 cuv = (cell + 0.5) * csz;
    float lod = log2(csz.y / u_texel.y);
    vec3 cc = textureLod(u_src, cuv, lod).rgb;
    float cy = luma(c);
    vec3 jq = vec3(cy) + (cc - vec3(luma(cc)));
    jq += (hash(cell) - 0.5) * 0.05;
    vec2 fr = abs(fract(uv / csz) - 0.5);
    float edge = smoothstep(0.42, 0.5, max(fr.x, fr.y));
    jq += (hash(cell + 19.0) - 0.5) * edge * 0.1;
    c = mix(c, jq, u_jpeg * 0.85);
  }

  if (u_grain > 0.001) {
    vec2 gp = v_uv / max(u_texel * 768.0, vec2(1e-4));
    vec2 guv = v_uv * vec2(u_aspect, 1.0);
    vec2 o1 = vec2(fract(u_time * 0.731), fract(u_time * 0.379));
    vec2 o2 = vec2(fract(u_time * 1.113), fract(u_time * 0.877));
    float g1 = texture(u_grainTex, gp * 0.5 + o1).r - 0.5;
    float g2 = texture(u_grainTex, gp + o2).g - 0.5;
    float clump = 0.55 + 1.0 * vnoise(guv * 9.0 + 3.7);
    float w = max(0.15, 1.15 - luma(c));
    float n = g1 * 1.1 + g2 * 0.9;
    c += n * clump * w * u_grain * 0.55;
  }

  frag = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
