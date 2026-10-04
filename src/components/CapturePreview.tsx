import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { compositionLayout, drawCompositionPaper } from '../capture/composite';
import type { CapturedFrame, CompositionOptions } from '../capture/types';

export type PreviewDraw = ((source: HTMLCanvasElement) => void) | null;
export function CapturePreview({ mode, frames, options, nextIndex, countdown, gridOn, ratio, sourceRect, rect, viewSize, drawRef, progressRef }: {
  mode: 'half' | 'booth'; frames: CapturedFrame[]; options: CompositionOptions; nextIndex: number;
  countdown: number | null; gridOn: boolean;
  ratio: { w: number; h: number }; rect: { left: number; top: number; w: number; h: number };
  sourceRect: { left: number; top: number; w: number; h: number };
  viewSize: { w: number; h: number }; drawRef: MutableRefObject<PreviewDraw>;
  progressRef: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const layout = compositionLayout(frames[0]?.canvas.width ?? ratio.w * 1000, frames[0]?.canvas.height ?? ratio.h * 1000, mode, options, Math.min(2048, Math.max(rect.w, rect.h) * Math.min(devicePixelRatio || 1, 2)));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = layout.width; canvas.height = layout.height;
    const ctx = canvas.getContext('2d')!;
    let last = -Infinity;
    const draw = (source: HTMLCanvasElement | null) => {
      const now = performance.now();
      if (now - last < 1000 / 30) return;
      last = now;
      drawCompositionPaper(ctx, layout, options);
      const sx = (source?.width ?? 0) / viewSize.w, sy = (source?.height ?? 0) / viewSize.h;
      layout.cells.forEach((r, i) => {
        if (i === nextIndex && source) ctx.drawImage(source, sourceRect.left * sx, sourceRect.top * sy, sourceRect.w * sx, sourceRect.h * sy, r.x, r.y, r.w, r.h);
        else if (i !== nextIndex && frames[i]) ctx.drawImage(frames[i].canvas, r.x, r.y, r.w, r.h);
        else { ctx.fillStyle = '#232323'; ctx.fillRect(r.x, r.y, r.w, r.h); }
      });
    };
    // Frozen cuts remain visible while the camera restarts after review.
    draw(null);
    drawRef.current = draw;
    return () => { if (drawRef.current === draw) drawRef.current = null; };
  }, [mode, frames, options, nextIndex, sourceRect, viewSize, drawRef, layout.width, layout.height]);
  useLayoutEffect(() => {
    const hud = progressRef.current?.getBoundingClientRect();
    if (!hud || !frameRef.current) return;
    const labels = [...frameRef.current.querySelectorAll<HTMLElement>('.cell-label')];
    labels.forEach((label) => { label.style.top = ''; });
    const boxes = labels.map((label) => ({ label, tag: label.getBoundingClientRect(), cell: label.parentElement!.getBoundingClientRect() }));
    // Keep each row aligned below the real action bar, not a guessed HUD size.
    const blockedRows = boxes.filter(({ tag }) => tag.left < hud.right && tag.right > hud.left && tag.top < hud.bottom && tag.bottom > hud.top).map(({ cell }) => cell.top);
    boxes.forEach(({ label, tag, cell }) => {
      if (!blockedRows.some((top) => Math.abs(top - cell.top) < 1)) return;
      const top = hud.bottom - cell.top + 8;
      if (top + tag.height <= cell.height - 4) label.style.top = `${top}px`;
    });
  }, [mode, frames, nextIndex, countdown, rect, progressRef]);
  return <div className="capture-preview" role="img" aria-label={`${mode === 'half' ? '하프프레임' : '네 컷'} 분할 촬영 화면 · ${nextIndex + 1}번째 촬영`}>
    <div ref={frameRef} className="capture-frame" style={{ left: rect.left, top: rect.top, width: rect.w, height: rect.h }}>
      <canvas ref={ref} />
      {layout.cells.map((r, i) => {
        const current = i === nextIndex, complete = !current && !!frames[i];
        const w = rect.w * r.w / layout.width, h = rect.h * r.h / layout.height;
        const small = w < 90 || h < 55;
        const countSize = Math.min(64, w * .35, h * .6);
        return <div key={i} aria-hidden="true" className={`capture-cell ${current ? 'current' : complete ? 'complete' : 'pending'}${small ? ' small' : ''}`} style={{ left: `${r.x / layout.width * 100}%`, top: `${r.y / layout.height * 100}%`, width: `${r.w / layout.width * 100}%`, height: `${r.h / layout.height * 100}%` }}>
          <span className="cell-label">{i + 1}<span className="cell-state"> · {current ? '현재 컷' : complete ? '완료' : '대기'}</span></span>
          {current && gridOn && <div className="grid-overlay"><i className="v1" /><i className="v2" /><i className="h1" /><i className="h2" /></div>}
          {current && countdown !== null && <span className="cell-countdown" style={{ width: countSize, height: countSize, fontSize: countSize * .6 }}>{countdown}</span>}
        </div>;
      })}
    </div>
  </div>;
}
