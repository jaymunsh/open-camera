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

  vec3 c;
  if (u_aberr > 0.0001) {
    vec2 ca = (uv - 0.5) * u_aberr * 0.012;
    c.r = texture(u_src, uv + ca).r;
    c.g = texture(u_src, uv).g;
    c.b = texture(u_src, uv - ca).b;
  } else {
    c = texture(u_src, uv).rgb;
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

  l = luma(c);
  c += u_shadows * (1.0 - smoothstep(0.0, 0.55, l)) * 0.35;
  c += u_highlights * smoothstep(0.45, 1.0, l) * 0.35;
  c = clamp(c, 0.0, 1.0);

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
