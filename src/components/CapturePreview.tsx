import { useEffect, useId, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { compositionLayout, drawCompositionPaper } from '../capture/composite';
import type { CapturedFrame, CompositionOptions } from '../capture/types';

export type PreviewDraw = ((source: HTMLCanvasElement) => void) | null;
export type PreviewSize = 'small' | 'large' | 'folded';
export function CapturePreview({ mode, frames, options, nextIndex, countdown, gridOn, ratio, sourceRect, viewSize, drawRef, size, onSize, bottomInset }: {
  mode: 'half' | 'booth' | 'instant'; frames: CapturedFrame[]; options: CompositionOptions; nextIndex: number;
  countdown: number | null; gridOn: boolean;
  ratio: { w: number; h: number };
  sourceRect: { left: number; top: number; w: number; h: number };
  viewSize: { w: number; h: number }; drawRef: MutableRefObject<PreviewDraw>;
  size: PreviewSize; onSize: (size: PreviewSize) => void; bottomInset: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusAfterResize = useRef(false);
  const id = useId();
  const folded = size === 'folded';
  const name = mode === 'half' ? '하프프레임' : mode === 'instant' ? '즉석사진' : '네 컷';
  const target = mode === 'half' ? 2 : mode === 'instant' ? 1 : 4;
  const fw = frames[0]?.canvas.width ?? ratio.w * 1000, fh = frames[0]?.canvas.height ?? ratio.h * 1000;
  const full = compositionLayout(fw, fh, mode, options, Infinity);
  const aspect = full.width / full.height;
  const [box, setBox] = useState({ left: 0, top: 0, w: 168, h: 44, photoW: 156, photoH: 78 });
  useLayoutEffect(() => {
    const viewer = rootRef.current?.parentElement;
    const dock = document.querySelector<HTMLElement>('.dock');
    if (!viewer || !dock) return;
    const measure = () => {
      const r = viewer.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('.app-header');
      const inset = Math.max(12, header ? parseFloat(getComputedStyle(header).paddingRight) || 0 : 0);
      const w = Math.max(100, Math.min(size === 'large' ? 320 : 168, r.width - inset * 2));
      const minTop = r.top + 8, maxBottom = dock.getBoundingClientRect().top - 8;
      // The fixed window can escape a short landscape viewer, but never the dock.
      const availablePhotoH = Math.max(1, maxBottom - minTop - 56);
      const photoH = Math.min((w - 12) / aspect, size === 'large' ? 360 : 180, availablePhotoH);
      const photoW = photoH * aspect;
      const h = folded ? 44 : photoH + 56;
      const top = Math.max(minTop, Math.min(r.bottom - bottomInset - h, maxBottom - h));
      const next = { left: r.right - inset - w, top, w, h, photoW, photoH };
      setBox((previous) => Object.keys(next).every((key) => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewer); observer.observe(dock);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure); };
  }, [aspect, size, folded, viewSize, bottomInset]);
  const changeSize = (next: PreviewSize) => { focusAfterResize.current = true; onSize(next); };
  useLayoutEffect(() => {
    if (!focusAfterResize.current) return;
    focusAfterResize.current = false; rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [size]);
  const layout = compositionLayout(fw, fh, mode, options, Math.min(2048, Math.max(box.photoW, box.photoH) * Math.min(devicePixelRatio || 1, 2)));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || folded) return;
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
  }, [mode, frames, options, nextIndex, sourceRect, viewSize, drawRef, folded, layout.width, layout.height]);
  return <div ref={rootRef} className={`capture-preview ${size}`} role="region" aria-label={`${name} 합성 미리보기 · ${nextIndex + 1}번째 촬영`} style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
    onPointerDown={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()}
    onKeyDown={(e) => { if (e.key === 'Escape' && !folded) { e.stopPropagation(); changeSize('folded'); } }}>
    {folded ? <button className="preview-unfold" aria-label="합성 미리보기 펼치기" aria-expanded={false} aria-controls={id} onClick={() => changeSize('small')}>
      <span>{name} · {nextIndex + 1}/{target}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 15 6-6 6 6" /></svg>
    </button> : <div className="preview-tools">
      <span>{mode === 'instant' ? '즉석사진' : '합성'} <span>{nextIndex + 1}/{target}</span></span>
      <button aria-label={`합성 미리보기 ${size === 'large' ? '축소' : '확대'}`} title={size === 'large' ? '작게 보기' : '크게 보기'} onClick={() => changeSize(size === 'large' ? 'small' : 'large')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={size === 'large' ? 'M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5' : 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'} /></svg>
      </button>
      <button aria-label="합성 미리보기 접기" title="접기" aria-expanded={true} aria-controls={id} onClick={() => changeSize('folded')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
    </div>}
    <div id={id} className="preview-body" hidden={folded}>
    <div className="capture-frame" role="img" aria-label={`${frames.filter((_, i) => i !== nextIndex).length}컷 완료 · ${nextIndex + 1}번째 촬영`} style={{ width: box.photoW, height: box.photoH }}>
      <canvas ref={ref} />
      {layout.cells.map((r, i) => {
        const current = i === nextIndex, complete = !current && !!frames[i];
        const w = box.photoW * r.w / layout.width, h = box.photoH * r.h / layout.height;
        const small = w < 90 || h < 55;
        const countSize = Math.min(64, w * .35, h * .6);
        return <div key={i} aria-hidden="true" className={`capture-cell ${current ? 'current' : complete ? 'complete' : 'pending'}${small ? ' small' : ''}`} style={{ left: `${r.x / layout.width * 100}%`, top: `${r.y / layout.height * 100}%`, width: `${r.w / layout.width * 100}%`, height: `${r.h / layout.height * 100}%` }}>
          <span className="cell-label">{i + 1}<span className="cell-state"> · {current ? '현재 컷' : complete ? '완료' : '대기'}</span></span>
          {current && gridOn && <div className="grid-overlay"><i className="v1" /><i className="v2" /><i className="h1" /><i className="h2" /></div>}
          {current && countdown !== null && <span className="cell-countdown" style={{ width: countSize, height: countSize, fontSize: countSize * .6 }}>{countdown}</span>}
        </div>;
      })}
    </div>
    </div>
  </div>;
}
