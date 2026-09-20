import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
  srcKey?: string;
  preferSrc?: boolean;
  intensity?: number;
  onIntensity?: (v: number) => void;
}

export function FilterStrip({
  selected,
  onSelect,
  getSource,
  onExpand,
  deps,
  customs,
  expandTop,
  srcKey = 'smp',
  preferSrc = false,
  intensity = 1,
  onIntensity,
}: Props) {
  const refs = useRef(new Map<HTMLCanvasElement, string>());
  const items = useRef(new Map<string, HTMLButtonElement>());
  const strip = useRef<HTMLDivElement>(null);
  const dragY = useRef<number | null>(null);
  const [intensityOpen, setIntensityOpen] = useState(false);

  useEffect(() => {
    const el = items.current.get(selected);
    const box = strip.current;
    if (el && box)
      box.scrollTo({
        left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      });
  }, [selected]);

  useEffect(() => {
    if (selected === 'none') setIntensityOpen(false);
  }, [selected]);

  const pick = (id: string) => {
    if (id === selected && id !== 'none' && onIntensity) {
      setIntensityOpen((s) => !s);
      return;
    }
    setIntensityOpen(false);
    onSelect(id);
  };

  const thumbItems = [
    ...PRESETS.map((p) => ({ id: p.id, fx: p.fx })),
    ...customs.map((c) => ({ id: c.id, custom: true })),
  ];

  useEffect(() => {
    let cancelled = false;
    renderPresetThumbs(refs.current, thumbItems, getSource(), () => cancelled, {
      srcKey,
      preferSrc,
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const pct = Math.round(intensity * 100);
  const track = `linear-gradient(90deg, #8a7cff ${pct}%, rgba(255,255,255,0.16) ${pct}%)`;

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
      {intensityOpen && (
        <div className="strip-intensity adj-slider">
          <span className="lbl">강도</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            style={{ '--track': track } as CSSProperties}
            onChange={(e) => onIntensity?.(parseFloat(e.target.value))}
            onDoubleClick={() => onIntensity?.(1)}
          />
          <span className="val">{pct}%</span>
        </div>
      )}
      <div className="strip" ref={strip}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              if (el) items.current.set(p.id, el);
              else items.current.delete(p.id);
            }}
            className={`strip-item${p.id === selected ? ' sel' : ''}`}
            onClick={() => pick(p.id)}
          >
            <canvas
              width={THUMB}
              height={THUMB}
              ref={(el) => {
                if (el) {
                  refs.current.set(el, p.id);
                  applyThumb(el, p.id, srcKey);
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
            onClick={() => pick(c.id)}
          >
            <canvas
              width={THUMB}
              height={THUMB}
              ref={(el) => {
                if (el) {
                  refs.current.set(el, c.id);
                  applyThumb(el, c.id, srcKey);
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
