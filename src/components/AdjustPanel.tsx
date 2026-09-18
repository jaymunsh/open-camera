import { useState, type CSSProperties, type ReactNode } from 'react';
import { PARAM_DEFS, type FilterParams, type ParamDef } from '../engine/types';

interface Props {
  params: FilterParams;
  onChange: (p: FilterParams) => void;
  intensity: number;
  onIntensity: (v: number) => void;
  onReset: () => void;
  lutEnabled: boolean;
}

const ICONS: Record<string, ReactNode> = {
  intensity: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.4" fill="currentColor" stroke="none" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  exposure: (
    <>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2.5" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="21.5" y2="12" />
      <line x1="5.2" y1="5.2" x2="7" y2="7" />
      <line x1="17" y1="17" x2="18.8" y2="18.8" />
      <line x1="18.8" y1="5.2" x2="17" y2="7" />
      <line x1="7" y1="17" x2="5.2" y2="18.8" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  saturation: (
    <>
      <path d="M12 3c3.5 4.5 6 7.6 6 10.5a6 6 0 1 1-12 0C6 10.6 8.5 7.5 12 3z" />
    </>
  ),
  temperature: (
    <>
      <path d="M10 4a2 2 0 0 1 4 0v8.5a4.5 4.5 0 1 1-4 0z" />
      <line x1="16" y1="7" x2="20" y2="7" />
      <line x1="16" y1="10" x2="20" y2="10" />
    </>
  ),
  tint: (
    <>
      <path d="M12 3c3.5 4.5 6 7.6 6 10.5a6 6 0 1 1-12 0C6 10.6 8.5 7.5 12 3z" />
      <circle cx="9.5" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  highlights: (
    <>
      <circle cx="12" cy="9" r="4" />
      <path d="M7 20h10" />
      <path d="M9.5 16.5h5" />
    </>
  ),
  shadows: (
    <>
      <path d="M15 4a7.5 7.5 0 1 0 5 13A9 9 0 0 1 15 4z" />
    </>
  ),
  sharpen: (
    <>
      <path d="M12 3l8 9-8 9-8-9z" />
      <path d="M12 8l4 4-4 4-4-4z" fill="currentColor" stroke="none" />
    </>
  ),
  fade: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <line x1="8" y1="7" x2="8" y2="17" />
      <line x1="13" y1="7" x2="13" y2="17" />
      <line x1="18" y1="7" x2="18" y2="17" />
    </>
  ),
  vignette: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
    </>
  ),
  grain: (
    <>
      <circle cx="6" cy="7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
};

interface Item {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export function AdjustPanel({ params, onChange, intensity, onIntensity, onReset, lutEnabled }: Props) {
  const items: Item[] = [
    ...(lutEnabled ? [{ key: 'intensity', label: '강도', min: 0, max: 1, step: 0.01 }] : []),
    ...PARAM_DEFS.map((d: ParamDef) => ({ key: d.key, label: d.label, min: d.min, max: d.max, step: d.step })),
  ];
  const [sel, setSel] = useState('exposure');
  const cur = items.find((i) => i.key === sel) ?? items[0];
  const val = cur.key === 'intensity' ? intensity : params[cur.key as keyof FilterParams];
  const setVal = (v: number) => {
    if (cur.key === 'intensity') onIntensity(v);
    else onChange({ ...params, [cur.key]: v });
  };
  const isSet = (k: string) => {
    const v = k === 'intensity' ? intensity - 1 : params[k as keyof FilterParams];
    return Math.abs(v) > 0.001;
  };

  const track = (() => {
    const pct = ((val - cur.min) / (cur.max - cur.min)) * 100;
    const base = 'rgba(255,255,255,0.16)';
    const acc = '#8a7cff';
    if (cur.min < 0) {
      const c = ((0 - cur.min) / (cur.max - cur.min)) * 100;
      const a = Math.min(pct, c);
      const b = Math.max(pct, c);
      return `linear-gradient(90deg, ${base} ${a}%, ${acc} ${a}%, ${acc} ${b}%, ${base} ${b}%)`;
    }
    return `linear-gradient(90deg, ${acc} ${pct}%, ${base} ${pct}%)`;
  })();

  return (
    <div className="panel">
      <div className="adj-strip">
        {items.map((i) => (
          <button
            key={i.key}
            className={`adj-chip${i.key === cur.key ? ' sel' : ''}`}
            onClick={() => setSel(i.key)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[i.key]}
            </svg>
            <span>{i.label}</span>
            {isSet(i.key) && <i className="adj-dot" />}
          </button>
        ))}
      </div>
      <div className="adj-slider">
        <input
          type="range"
          min={cur.min}
          max={cur.max}
          step={cur.step}
          value={val}
          style={{ '--track': track } as CSSProperties}
          onChange={(e) => setVal(parseFloat(e.target.value))}
          onDoubleClick={() => setVal(cur.key === 'intensity' ? 1 : 0)}
        />
        <span className="adj-val">{val.toFixed(2)}</span>
        <button className="reset" onClick={onReset}>
          초기화
        </button>
      </div>
    </div>
  );
}
