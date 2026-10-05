function insertOnce(source: string, anchor: string, addition: string): string {
  if (source.split(anchor).length !== 2) throw new Error('필름 처리 셰이더의 연결 지점을 확인할 수 없어요.');
  return source.replace(anchor, addition + '\n' + anchor);
}
export function createFilmFragmentShader(legacySource: string): string {
  let source = insertOnce(legacySource, 'uniform sampler2D u_grainTex;', `
uniform sampler2D u_filmTex;
uniform vec4 u_filmGrain; // amount, size, color, shadow weighting
uniform vec2 u_filmGlow;  // amount, radius
`);
  source = insertOnce(source, 'void main() {', `
float filmLightMask(vec2 p) {
  return smoothstep(.72, .97, luma(textureLod(u_src, clamp(p, 0.0, 1.0), 0.0).rgb));
}
`);
  return insertOnce(source, '  if (u_creativeLensAmount > 0.001 && u_creativeLens > 0.5) {', `
  if (u_filmGrain.x > .001) {
    float unit = 1.5 + 6.5 * u_filmGrain.y;
    // The photo has already been cropped/mirrored by the source sampling above.
    // Anchor texture to final photo coordinates so retained originals replay.
    vec2 photo = vec2(v_uv.x, 1.0-v_uv.y);
    vec2 gp = photo * vec2(u_aspect, 1.0) * (1080.0 / (unit * 256.0));
    // Band-limit tiny grains to a stable display footprint. This same floor
    // applies to live and export instead of changing frequency with output px.
    float lod = max(0.0, log2(1080.0 / (512.0 * unit)));
    vec4 n = textureLod(u_filmTex, gp, lod) - .5;
    vec3 noise = mix(vec3(n.a), n.rgb, u_filmGrain.z);
    float weight = (1.0-u_filmGrain.w) + u_filmGrain.w * (.25+.75*(1.0-clamp(luma(c),0.0,1.0)));
    c += noise * u_filmGrain.x * weight * .4;
  }
  if (u_filmGlow.x > .001) {
    float radius = (2.0 + 22.0*u_filmGlow.y) / 1080.0;
    vec2 d = vec2(radius/u_aspect, radius) * u_uvScale;
    float mask = filmLightMask(uv);
    float blurMask = mask * 4.0;
    blurMask += 2.0*(filmLightMask(uv+vec2(d.x,0.0))+filmLightMask(uv-vec2(d.x,0.0))+filmLightMask(uv+vec2(0.0,d.y))+filmLightMask(uv-vec2(0.0,d.y)));
    blurMask += filmLightMask(uv+d)+filmLightMask(uv-d)+filmLightMask(uv+vec2(d.x,-d.y))+filmLightMask(uv+vec2(-d.x,d.y));
    float halo = max(blurMask/16.0-mask,0.0);
    c += halo * u_filmGlow.x * .18 * vec3(1.0,.65,.35);
  }
`);
}
