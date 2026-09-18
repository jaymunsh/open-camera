import { useEffect, useRef } from 'react';
import { PRESETS } from '../engine/lut';
import { applyThumb, renderPresetThumbs } from './thumbs';

const THUMB = 96;

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  getSource: () => TexImageSource | null;
  onExpand: () => void;
  deps: readonly unknown[];
  customs: { id: string; name: string }[];
  expandTop?: number;
}

export function FilterStrip({ selected, onSelect, getSource, onExpand, deps, customs, expandTop }: Props) {
  const refs = useRef(new Map<HTMLCanvasElement, string>());
  const items = useRef(new Map<string, HTMLButtonElement>());
  const strip = useRef<HTMLDivElement>(null);
  const dragY = useRef<number | null>(null);

  useEffect(() => {
    const el = items.current.get(selected);
    const box = strip.current;
    if (el && box)
      box.scrollTo({
        left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      });
  }, [selected]);

  const thumbItems = [
    ...PRESETS.map((p) => ({ id: p.id, fx: p.fx })),
    ...customs.map((c) => ({ id: c.id, custom: true })),
  ];

  useEffect(() => {
    let cancelled = false;
    renderPresetThumbs(refs.current, thumbItems, getSource(), () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div
      className="strip-wrap"
      onPointerDown={(e) => {
        dragY.current = e.clientY;
      }}
      onPointerMove={(e) => {
        if (dragY.current !== null && dragY.current - e.clientY > 30) {
          dragY.current = null;
          onExpand();
        }
      }}
      onPointerUp={() => {
        dragY.current = null;
      }}
      onPointerCancel={() => {
        dragY.current = null;
      }}
    >
      <button
        className="strip-expand"
        style={expandTop !== undefined ? { top: expandTop } : undefined}
        onClick={onExpand}
        aria-label="필터 전체 보기"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <div className="strip" ref={strip}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              if (el) items.current.set(p.id, el);
              else items.current.delete(p.id);
            }}
            className={`strip-item${p.id === selected ? ' sel' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <canvas
              width={THUMB}
              height={THUMB}
              ref={(el) => {
                if (el) {
                  refs.current.set(el, p.id);
                  applyThumb(el, p.id);
              }
              }}
            />
            <span>{p.label}</span>
          </button>
        ))}
        {customs.map((c) => (
          <button
            key={c.id}
            ref={(el) => {
              if (el) items.current.set(c.id, el);
            }}
            className={`strip-item${c.id === selected ? ' sel' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <canvas
              width={THUMB}
              height={THUMB}
              ref={(el) => {
                if (el) {
                  refs.current.set(el, c.id);
                  applyThumb(el, c.id);
                }
              }}
            />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
