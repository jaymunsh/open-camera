import { useState, type CSSProperties, type ReactNode } from 'react';
import { ResetChip } from './ResetChip';

export interface BeautyParams {
  skin: number;
  tone: number;
  undereye: number;
  spot: number;
  face: number;
  blush: number;
  lip: number;
  eyeclear: number;
  eye: number;
  slim: number;
  nose: number;
  head: number;
  spotRange: number;
}

export const DEFAULT_BEAUTY: BeautyParams = {
  skin: 0,
  tone: 0,
  undereye: 0,
  spot: 0,
  face: 0,
  blush: 0,
  lip: 0,
  eyeclear: 0,
  eye: 0,
  slim: 0,
  nose: 0,
  head: 0,
  spotRange: 1,
};
export const AUTO_BEAUTY: BeautyParams = {
  skin: 0.45,
  tone: 0.2,
  undereye: 0.25,
  spot: 0.4,
  face: 0.15,
  blush: 0.1,
  lip: 0.12,
  eyeclear: 0.2,
  eye: 0.2,
  slim: 0.25,
  nose: 0.1,
  head: 0,
  spotRange: 1,
};

const DEFS: {
  key: keyof BeautyParams;
  label: string;
  min: number;
  max: number;
  step: number;
 }[] = [
  { key: 'skin', label: '피부', min: 0, max: 1, step: 0.01 },
  { key: 'tone', label: '톤', min: 0, max: 1, step: 0.01 },
  { key: 'undereye', label: '눈밑', min: 0, max: 1, step: 0.01 },
  { key: 'spot', label: '잡티', min: 0, max: 1, step: 0.01 },
  { key: 'face', label: '얼굴밝기', min: 0, max: 1, step: 0.01 },
  { key: 'blush', label: '볼터치', min: 0, max: 1, step: 0.01 },
  { key: 'lip', label: '립', min: 0, max: 1, step: 0.01 },
  { key: 'eyeclear', label: '눈빛', min: 0, max: 1, step: 0.01 },
  { key: 'eye', label: '눈', min: 0, max: 1, step: 0.01 },
  { key: 'slim', label: '갸름', min: 0, max: 1, step: 0.01 },
  { key: 'nose', label: '코', min: 0, max: 1, step: 0.01 },
  { key: 'head', label: '머리', min: 0, max: 1, step: 0.01 },
];

const ICONS: Record<string, ReactNode> = {
  skin: (
    <>
      <circle cx="12" cy="9" r="4.2" />
      <path d="M5 19c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  slim: (
    <>
      <path d="M8 4.5c-2 2-3 4.5-3 7.5s1 5.5 3 7.5" />
      <path d="M16 4.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5" />
      <path d="M10.5 12h3" />
    </>
  ),
  tone: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none" />
    </>
  ),
  undereye: (
    <>
      <path d="M3 10s3-4.5 9-4.5 9 4.5 9 4.5" />
      <path d="M6 15.5c1.5 1.8 3.6 2.8 6 2.8s4.5-1 6-2.8" />
    </>
  ),
  spot: (
    <>
      <circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <path d="M18.5 4.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" stroke="none" />
      <path d="M5 19c1.2-3 3.7-4.6 7-4.6s5.8 1.6 7 4.6" />
    </>
  ),
  nose: (
    <>
      <path d="M10 4l4 10" />
      <path d="M9 17.5c1 1 4 1 6 0" />
      <path d="M7.5 15.5c-.8 1.5 0 3 1.5 3" />
      <path d="M16.5 15.5c.8 1.5 0 3-1.5 3" />
    </>
  ),
  face: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 7v3" />
      <path d="M9.5 12.5h5" />
      <path d="M12 15v2" opacity="0.6" />
      <path d="M17.5 6.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none" />
    </>
  ),
  blush: (
    <>
      <circle cx="12" cy="10.5" r="6.5" />
      <circle cx="9" cy="11.5" r="1.6" fill="currentColor" stroke="none" opacity="0.55" />
      <circle cx="15" cy="11.5" r="1.6" fill="currentColor" stroke="none" opacity="0.55" />
      <path d="M5 19.5c1.4-2.6 4-4 7-4s5.6 1.4 7 4" />
    </>
  ),
  lip: (
    <>
      <path d="M4 11.5c2-2 4.5-2.6 6.5-1.4 1 .6 2 .6 3 0 2-1.2 4.5-.6 6.5 1.4-2.4 4-5 5.4-8 5.4s-5.6-1.4-8-5.4z" />
    </>
  ),
  eyeclear: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M18.5 4.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none" />
    </>
  ),
  head: (
    <>
      <circle cx="12" cy="10" r="5.5" />
      <path d="M6.5 19c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4" />
      <path d="M4.5 4.5l3 3M7.5 4.5v3h-3" />
      <path d="M19.5 4.5l-3 3M16.5 4.5v3h3" />
    </>
  ),
};

interface Props {
  beauty: BeautyParams;
  onChange: (b: BeautyParams) => void;
  onReset: () => void;
}

export function BeautyPanel({ beauty, onChange, onReset }: Props) {
  const [sel, setSel] = useState<keyof BeautyParams>('skin');
  const cur = DEFS.find((d) => d.key === sel) ?? DEFS[0];
  const val = beauty[cur.key];
  const setVal = (v: number) => onChange({ ...beauty, [cur.key]: v });

  const pct = ((val - cur.min) / (cur.max - cur.min)) * 100;
  const track = `linear-gradient(90deg, #8a7cff ${pct}%, rgba(255,255,255,0.16) ${pct}%)`;

  return (
    <div className="panel">
      <div className="adj-strip">
        <ResetChip label="보정리셋" onReset={onReset} />
        <button className="adj-chip auto" onClick={() => onChange({ ...AUTO_BEAUTY })}>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4l.7 1.8L17 6.5l-1.8.7-.7 1.8-.7-1.8L12 6.5l1.8-.7z" fill="currentColor" stroke="none" />
            <path d="M19 10l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none" />
            <path d="M6 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="none" />
          </svg>
          <span>자동</span>
        </button>
        {DEFS.map((d) => (
          <button
            key={d.key}
            className={`adj-chip${d.key === cur.key ? ' sel' : ''}`}
            onClick={() => setSel(d.key)}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[d.key]}
            </svg>
            <span>{d.label}</span>
            {Math.abs(beauty[d.key]) > 0.001 && <i className="adj-dot" />}
          </button>
        ))}
      </div>
      <div className="adj-slider">
        {cur.key === 'spot' && (
          <div className="seg">
            {['좁게', '보통', '넓게'].map((t, i) => (
              <button
                key={t}
                className={`seg-btn${beauty.spotRange === i ? ' on' : ''}`}
                onClick={() => onChange({ ...beauty, spotRange: i })}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <input
          type="range"
          min={cur.min}
          max={cur.max}
          step={cur.step}
          value={val}
          style={{ '--track': track } as CSSProperties}
          onChange={(e) => setVal(parseFloat(e.target.value))}
          onDoubleClick={() => setVal(0)}
        />
        <span className="adj-val">{val.toFixed(2)}</span>
        <button className="reset" onClick={() => setVal(0)}>
          초기화
        </button>
      </div>
    </div>
  );
}
