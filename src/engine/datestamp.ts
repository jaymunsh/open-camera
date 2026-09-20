// Classic digicam date stamp: a thin italic serif rasterized tiny then
// upscaled — reproduces the soft, slightly-bled amber stamp of early CCD
// cameras. Rendering small and scaling up is what makes it look like the
// camera's low-res overlay rather than crisp typeset text.

export interface StampSpec {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

const FONT = '40px "DSEG7", Futura, sans-serif';

// ensure the bundled DSEG7 face is loaded before any canvas draws it —
// iOS Safari rasterizes freshly-loaded webfonts as fallback on the first
// canvas draw, so we also instantiate the face in the DOM and wait a frame
export const stampFontReady: Promise<unknown> = (async () => {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(FONT);
    const el = document.createElement('span');
    el.style.cssText = `position:fixed;left:-9999px;top:0;visibility:hidden;font:${FONT}`;
    el.textContent = "0123456789'-:.";
    document.body.appendChild(el);
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  } catch {
    /* fall back silently */
  }
})();

// `dot` keeps the old scale contract: logical height = 7 * dot.
// Render DSEG7 (the classic LED digicam face, italic cut) large so the
// segments rasterize cleanly, then downscale — soft edges like the real
// low-res overlay. The font's apostrophe sits at midline so it is drawn
// raised to cap height; padding covers italic overhang.
export function renderStampSoft(
  text: string,
  dot: number,
  vertical = false,
): StampSpec {
  const h = 7 * dot;
  const fs = 40;
  const ls = 2;
  const pad = 14;

  const small = document.createElement('canvas');
  const probe = small.getContext('2d')!;
  probe.font = FONT;
  const xs: number[] = [];
  let x = pad;
  for (const ch of text) {
    xs.push(x);
    x += probe.measureText(ch).width + ls;
  }
  small.width = Math.ceil(x + pad);
  small.height = 56;
  const c = small.getContext('2d')!;
  c.font = FONT;
  c.textBaseline = 'middle';
  const my = small.height / 2 + 2;

  const pass = (color: string, ox = 0, oy = 0) => {
    c.fillStyle = color;
    let i = 0;
    for (const ch of text) {
      // the font's own apostrophe sits at midline — raise it to cap height
      const raise = ch === "'" || ch === '’' ? -fs * 0.32 : 0;
      c.fillText(ch, xs[i] + ox, my + oy + raise);
      i++;
    }
  };
  // dark outline first — the real stamp is legible on bright backgrounds
  for (const [dx, dy] of [
    [-1.6, 0],
    [1.6, 0],
    [0, -1.6],
    [0, 1.6],
  ]) {
    pass('rgba(30, 10, 0, 0.8)', dx, dy);
  }
  pass('rgba(255, 150, 55, 0.98)');

  const out = document.createElement('canvas');
  const k = (h * 2) / small.height;
  out.width = Math.max(1, Math.round(small.width * k));
  out.height = Math.max(1, Math.round(small.height * k));
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  o.filter = `blur(${Math.max(0.3, h * 0.012)}px)`;
  o.drawImage(small, 0, 0, out.width, out.height);

  if (vertical) {
    // landscape-orientation stamp on the left edge; text runs top-to-bottom
    const r = document.createElement('canvas');
    r.width = out.height;
    r.height = out.width;
    const rc = r.getContext('2d')!;
    rc.translate(r.width, 0);
    rc.rotate(Math.PI / 2);
    rc.drawImage(out, 0, 0);
    return { canvas: r, w: r.width / 2, h: r.height / 2 };
  }
  return { canvas: out, w: out.width / 2, h: out.height / 2 };
}
