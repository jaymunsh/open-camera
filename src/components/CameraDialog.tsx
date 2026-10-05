import { useEffect, useRef, type ReactNode } from 'react';

export function CameraDialog({ title, onClose, children, busy = false, className = '', footer, active = true }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean; className?: string; footer?: ReactNode; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) close.current();
      if (e.key !== 'Tab') return;
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') ?? [])].filter((el) => {
        const closed = el.closest('details:not([open])');
        return el.getClientRects().length > 0 && (!closed || closed.firstElementChild === el);
      });
      const first = controls[0], last = controls.at(-1);
      if (!first) { e.preventDefault(); ref.current?.focus(); return; }
      const outsideControls = !controls.includes(document.activeElement as HTMLElement);
      if (e.shiftKey && (document.activeElement === first || outsideControls)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || outsideControls)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [active]);
  return <div className="camera-dialog-back" hidden={!active} style={!active ? { display: 'none' } : undefined} onClick={() => !busy && onClose()}>
    <div className={`camera-dialog ${className}`} role="dialog" aria-label={title} aria-modal="true" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="camera-dialog-head"><h2>{title}</h2><button disabled={busy} onClick={onClose}>닫기</button></div>
      {children}
      {footer && <div className="camera-dialog-foot">{footer}</div>}
    </div>
  </div>;
}
