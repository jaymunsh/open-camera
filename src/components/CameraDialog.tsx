import { useEffect, useRef, type ReactNode } from 'react';

export function CameraDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) close.current();
      if (e.key !== 'Tab') return;
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])];
      const first = controls[0], last = controls.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="camera-dialog-back" onClick={() => !busy && onClose()}>
    <div className="camera-dialog" role="dialog" aria-label={title} aria-modal="true" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="camera-dialog-head"><h2>{title}</h2><button disabled={busy} onClick={onClose}>닫기</button></div>
      {children}
    </div>
  </div>;
}
