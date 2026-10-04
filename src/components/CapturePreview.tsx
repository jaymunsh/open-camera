import { useEffect, useRef, type MutableRefObject } from 'react';
import { compositionLayout } from '../capture/composite';
import type { CapturedFrame, CompositionOptions } from '../capture/types';

export type PreviewDraw = ((source: HTMLCanvasElement) => void) | null;
export function CapturePreview({ mode, frames, options, nextIndex, ratio, rect, viewSize, drawRef }: {
  mode: 'half' | 'booth'; frames: CapturedFrame[]; options: CompositionOptions; nextIndex: number;
  ratio: { w: number; h: number }; rect: { left: number; top: number; w: number; h: number };
  viewSize: { w: number; h: number }; drawRef: MutableRefObject<PreviewDraw>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layout = compositionLayout(frames[0]?.canvas.width ?? ratio.w * 1000, frames[0]?.canvas.height ?? ratio.h * 1000, mode, options, Math.min(140, rect.w * .36, rect.h * .28));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = layout.width; canvas.height = layout.height;
    const ctx = canvas.getContext('2d')!;
    let last = -Infinity;
    const draw = (source: HTMLCanvasElement | null) => {
      const now = performance.now();
      if (now - last < 100) return;
      last = now;
      ctx.fillStyle = options.paper === 'black' ? '#000' : '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sx = (source?.width ?? 0) / viewSize.w, sy = (source?.height ?? 0) / viewSize.h;
      layout.cells.forEach((r, i) => {
        if (i === nextIndex && source) ctx.drawImage(source, rect.left * sx, rect.top * sy, rect.w * sx, rect.h * sy, r.x, r.y, r.w, r.h);
        else if (i !== nextIndex && frames[i]) ctx.drawImage(frames[i].canvas, r.x, r.y, r.w, r.h);
        else { ctx.fillStyle = '#232323'; ctx.fillRect(r.x, r.y, r.w, r.h); }
        if (i === nextIndex) { ctx.strokeStyle = '#8a7cff'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
        if (r.w >= 20 && r.h >= 20) {
          ctx.fillStyle = '#151515'; ctx.fillRect(r.x + 2, r.y + 2, 14, 14);
          ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.fillText(String(i + 1), r.x + 6, r.y + 12);
        }
      });
    };
    // Frozen cuts remain visible while the camera restarts after review.
    draw(null);
    drawRef.current = draw;
    return () => { if (drawRef.current === draw) drawRef.current = null; };
  }, [mode, frames, options, nextIndex, rect, viewSize, drawRef, layout.width, layout.height]);
  const top = Math.max(rect.top, Math.min(Math.max(rect.top + 8, 62), rect.top + rect.h - layout.height - 12));
  return <div className="capture-mini" role="img" aria-label={`${mode === 'half' ? '하프프레임' : '네 컷'} 합성 미리보기 · ${nextIndex + 1}번째 촬영`} style={{ left: rect.left + rect.w - layout.width - 18, top, width: layout.width }}><canvas ref={ref} /></div>;
}
