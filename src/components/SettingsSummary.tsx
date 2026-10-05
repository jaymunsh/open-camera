import { useId, useLayoutEffect, useRef, useState } from 'react';
import { CAPTURE_LABELS, type SettingsSnapshot } from './SettingsOverview';

export function SettingsSummary({ snapshot, compositeSize, covered, onOpen }: { snapshot: SettingsSnapshot; compositeSize: string; covered: boolean; onOpen: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  const [folded, setFolded] = useState(false);
  const [box, setBox] = useState({ left: 12, top: 70, width: 240, compact: false });
  const id = useId();
  useLayoutEffect(() => {
    const viewer = root.current?.parentElement, dock = document.querySelector<HTMLElement>('.dock');
    if (!viewer || !dock) return;
    const progress = viewer.querySelector<HTMLElement>('.capture-progress');
    const preview = viewer.querySelector<HTMLElement>('.capture-preview');
    const strip = document.querySelector<HTMLElement>('.strip-wrap');
    const measure = () => {
      const rect = viewer.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('.app-header');
      const inset = Math.max(12, header ? parseFloat(getComputedStyle(header).paddingLeft) || 0 : 0);
      const left = rect.left + inset, top = Math.max(rect.top + 12, (progress?.getBoundingClientRect().bottom ?? rect.top) + 8);
      const available = preview ? preview.getBoundingClientRect().left - left - 12 : rect.width - inset * 2;
      const bottom = Math.min(dock.getBoundingClientRect().top, strip?.getBoundingClientRect().top ?? Infinity);
      const compact = available < 180 || bottom - top < 176;
      const width = Math.max(100, Math.min(compact ? 132 : 240, compact ? rect.width - inset * 2 : available));
      const next = { left, top, width, compact };
      setBox(previous => previous.left === left && previous.top === top && previous.width === width && previous.compact === compact ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewer); observer.observe(dock); if (progress) observer.observe(progress); if (preview) observer.observe(preview); if (strip) observer.observe(strip);
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure); window.visualViewport?.addEventListener('scroll', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure); };
  }, [snapshot.captureMode, compositeSize, snapshot.source]);
  const collapsed = folded || box.compact;
  useLayoutEffect(() => {
    if (!covered && collapsed && focused.current?.closest('.settings-summary-body')) {
      root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [collapsed, covered]);
  const focusToggle = () => requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('button')?.focus());
  const filter = snapshot.settings.lutId === 'none' ? '원본' : snapshot.filterLabel;
  return <div ref={root} hidden={covered} className={`settings-summary${collapsed ? ' folded' : ''}`} role="region" aria-label="설정 요약" style={{ left: box.left, top: box.top, width: box.width }} onFocusCapture={e => { focused.current = e.target as HTMLElement; }} onBlurCapture={e => { if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) focused.current = null; }} onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}>
    <button className="settings-summary-toggle" aria-label={box.compact ? '설정 요약 전체 보기' : collapsed ? '설정 요약 펼치기' : '설정 요약 접기'} aria-haspopup={box.compact ? 'dialog' : undefined} aria-expanded={box.compact ? undefined : !collapsed} aria-controls={box.compact ? undefined : id} onClick={() => { if (box.compact) onOpen(); else { setFolded(!folded); focusToggle(); } }}>
      <span>{collapsed ? '설정 요약' : '현재 설정'}</span><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={collapsed ? 'm6 9 6 6 6-6' : 'M5 12h14'} /></svg>
    </button>
    <div id={id} hidden={collapsed} className="settings-summary-body">
      <p>{filter}{snapshot.settings.lutId !== 'none' && <span> · {Math.round(snapshot.settings.intensity * 100)}%</span>}</p>
      <p className="settings-summary-meta">{snapshot.source === 'edit' ? '사진 편집' : CAPTURE_LABELS[snapshot.captureMode]} · {snapshot.ratioLabel}</p>
      <button onClick={onOpen}>전체 설정 보기<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 5 7 7-7 7" /></svg></button>
    </div>
  </div>;
}
