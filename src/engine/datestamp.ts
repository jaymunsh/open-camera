// Camcorder-style dates share the bundled angular seven-segment face.
// Warm, faded ink and a small optical bleed belong to the stamp itself,
// so live preview, composition and export do not depend on CSS effects.

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

// The font's apostrophe sits at midline: raise it to cap height.
// Padding covers italic overhang and the soft colored bleed.
function renderSegmentStamp(
  text: string,
  h: number,
  style: 'amber' | 'red',
  vertical = false,
): StampSpec {
  const fs = 40;
  const ls = 2;
  const pad = 14;

  const small = document.createElement('canvas');
  const probe = small.getContext('2d')!;
  probe.font = FONT;
  const xs: number[] = [];
  let x = pad;
  let inkRight = pad;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    xs.push(x);
    if (ch === ' ' && i > 0 && text[i + 1] && text[i + 1] !== ' ') {
      // DSEG's narrow 1 sits on the right of a full-width digit cell.
      // Space date groups by visible ink, not by that invisible cell:
      // YY→10 must have the same gap as 10→05.
      x = inkRight + fs * .35 + probe.measureText(text[i + 1]).actualBoundingBoxLeft;
    } else {
      const metrics = probe.measureText(ch);
      if (ch !== ' ') inkRight = Math.max(inkRight, x + metrics.actualBoundingBoxRight);
      x += metrics.width + ls;
    }
  }
  small.width = Math.ceil(Math.max(x, inkRight) + pad);
  small.height = 56;
  const c = small.getContext('2d')!;
  c.font = FONT;
  c.textBaseline = 'middle';
  const my = small.height / 2 + 2;

  const pass = (color: string, ox = 0, oy = 0, faded = false) => {
    c.fillStyle = color;
    let i = 0;
    for (const ch of text) {
      // Fixed per-character variation, never random: no shimmer between
      // preview frames or a different pattern in the saved photograph.
      c.globalAlpha = faded ? 1 - (i % 3) * .025 : 1;
      // the font's own apostrophe sits at midline — raise it to cap height
      const raise = ch === "'" || ch === '’' ? -fs * 0.32 : 0;
      c.fillText(ch, xs[i] + ox, my + oy + raise);
      i++;
    }
    c.globalAlpha = 1;
  };
  // A faint backing keeps light scenes readable without a crisp black rim.
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    pass('rgba(55, 25, 14, 0.18)', dx, dy);
  }
  c.shadowColor = style === 'red' ? 'rgba(232, 88, 66, 0.45)' : 'rgba(232, 177, 114, 0.3)';
  c.shadowBlur = 2;
  pass(style === 'red' ? 'rgba(232, 88, 66, 0.94)' : 'rgba(232, 177, 114, 0.9)', 0, 0, true);

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

// `dot` retains the existing amber scale contract: logical height = 7 * dot.
export function renderStampSoft(text: string, dot: number, vertical = false): StampSpec {
  return renderSegmentStamp(text, 7 * dot, 'amber', vertical);
}

export function renderStampRed(text: string, height: number, maxW: number, maxH: number, vertical = false): StampSpec {
  const stamp = renderSegmentStamp(text, Math.max(1, height), 'red', vertical);
  const scale = Math.min(1, maxW / stamp.w, maxH / stamp.h);
  if (scale === 1) return stamp;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(stamp.canvas.width * scale));
  c.height = Math.max(1, Math.floor(stamp.canvas.height * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(stamp.canvas, 0, 0, c.width, c.height);
  return { canvas: c, w: c.width / 2, h: c.height / 2 };
}
