import { useEffect, useRef, useState } from 'react';

export function ResetChip({ label, onReset }: { label: string; onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!armed) return;
    const off = (e: PointerEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setArmed(false);
    };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [armed]);
  return (
    <button
      ref={btnRef}
      className={`adj-chip reset-chip${armed ? ' armed' : ''}`}
      onClick={() => {
        if (armed) {
          onReset();
          setArmed(false);
          clearTimeout(timer.current);
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 2500);
        }
      }}
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
        <path d="M3 12a9 9 0 1 0 2.6-6.4" />
        <path d="M3 4v5h5" />
      </svg>
      <span>{armed ? '확인' : label}</span>
    </button>
  );
}
