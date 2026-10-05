import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PRESETS } from '../engine/lut';
import { applyThumb, observePresetThumbs, type ThumbnailOptions } from './thumbs';

const THUMB = 112;
const FAV_KEY = 'oc-favs';
const RECENT_KEY = 'oc-recent';
const RECENT_MAX = 5;

function loadIds(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  getSource: () => TexImageSource | null;
  onClose: () => void;
  customs: { id: string; name: string }[];
  srcKey?: string;
  preferSrc?: boolean;
  previewOptions?: ThumbnailOptions;
  previewToolbar?: ReactNode;
  active?: boolean;
}

export function FilterSheet({ selected, onSelect, getSource, onClose, customs, srcKey = 'smp', preferSrc = false, previewOptions, previewToolbar, active = true }: Props) {
  const refs = useRef(new Map<HTMLCanvasElement, string>());
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const [favs, setFavs] = useState<string[]>(() => loadIds(FAV_KEY));
  const [recents, setRecents] = useState<string[]>(() => loadIds(RECENT_KEY));
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const pressTimer = useRef<number>(0);
  const pressConsumed = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null; sheetRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const controls = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])].filter((el) => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1); const outside = !controls.includes(document.activeElement as HTMLElement);
      if (!first) { event.preventDefault(); sheetRef.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [active]);

  const allItems = useMemo(
    () => [
      ...PRESETS.map((p) => ({ id: p.id, label: p.label, group: p.group, custom: false, fx: p.fx })),
      ...customs.map((c) => ({ id: c.id, label: c.name, group: '커스텀', custom: true, fx: undefined })),
    ],
    [customs],
  );
  const baseGroups = useMemo(() => [...new Set(allItems.map((p) => p.group))], [allItems]);
  const favSet = useMemo(() => new Set(favs), [favs]);
  const byId = useMemo(() => new Map(allItems.map((p) => [p.id, p])), [allItems]);

  const sections = useMemo(() => {
    const out: { title: string; items: typeof allItems }[] = [];
    const recent = recents.map((id) => byId.get(id)).filter((p): p is (typeof allItems)[number] => !!p);
    const fav = favs.map((id) => byId.get(id)).filter((p): p is (typeof allItems)[number] => !!p);
    if (recent.length) out.push({ title: '최근 사용', items: recent });
    if (fav.length) out.push({ title: '즐겨찾기', items: fav });
    for (const g of baseGroups)
      out.push({ title: g, items: allItems.filter((p) => p.group === g) });
    return out;
  }, [recents, favs, baseGroups, byId, allItems]);

  useEffect(() => {
    return observePresetThumbs(
      refs.current,
      allItems.map((i) => ({ id: i.id, custom: i.custom, fx: i.fx })),
      getSource(),
      { srcKey, preferSrc, ...previewOptions },
      scrollRef.current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs, srcKey, previewOptions, sections]);

  const jumpTo = (title: string) => {
    const el = groupRefs.current.get(title);
    const box = scrollRef.current;
    if (el && box) {
      const top =
        el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 6;
      box.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const pushRecent = (id: string) => {
    const next = [id, ...recents.filter((r) => r !== id)].slice(0, RECENT_MAX);
    setRecents(next);
    saveIds(RECENT_KEY, next);
  };

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    saveIds(FAV_KEY, next);
  };

  return (
    <div className="sheet-backdrop" hidden={!active} style={!active ? { display: 'none' } : undefined} onClick={onClose}>
      <div
        className="sheet"
        ref={sheetRef}
        role="dialog" aria-label="필터" aria-modal={active ? 'true' : undefined} tabIndex={-1}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-head"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, active: true };
          }}
          onPointerMove={(e) => {
            if (drag.current.active) setDragY(Math.max(0, e.clientY - drag.current.y));
          }}
          onPointerUp={() => {
            drag.current.active = false;
            if (dragY > 80) onClose();
            setDragY(0);
          }}
          onPointerCancel={() => {
            drag.current.active = false;
            setDragY(0);
          }}
        >
          <span className="sheet-title">
            필터
            <em className="sheet-hint">길게 눌러 즐겨찾기</em>
          </span>
          <button onClick={onClose}>닫기</button>
        </div>
        {previewToolbar}
        <div className="sheet-tabs">
          {sections.map((s) => (
            <button key={s.title} onClick={() => jumpTo(s.title)}>
              {s.title}
            </button>
          ))}
        </div>
        <div className="sheet-scroll" ref={scrollRef}>
          {sections.map((s) => (
            <div
              key={s.title}
              ref={(el) => {
                if (el) groupRefs.current.set(s.title, el);
                else groupRefs.current.delete(s.title);
              }}
            >
              <div className="sheet-group">{s.title}</div>
              {s.title === '빈티지 질감' && <p className="sheet-group-note">구형 디지캠은 저해상도·색 노이즈, 일회용 필름은 입자·빛 번짐, 인화사진은 바랜 색감이에요. 저장할 때 축소·압축 질감을 더합니다. 강도는 스튜디오의 ‘전체 룩’으로 조절해요.</p>}
              <div className="sheet-grid">
                {s.items.map((p) => (
                  <button
                    key={`${s.title}-${p.id}`}
                    className={`sheet-item${p.id === selected ? ' sel' : ''}`}
                    onPointerDown={() => {
                      pressConsumed.current = false;
                      pressTimer.current = window.setTimeout(() => {
                        pressConsumed.current = true;
                        toggleFav(p.id);
                      }, 450);
                    }}
                    onPointerUp={() => clearTimeout(pressTimer.current)}
                    onPointerCancel={() => clearTimeout(pressTimer.current)}
                    onPointerLeave={() => clearTimeout(pressTimer.current)}
                    onClick={() => {
                      if (pressConsumed.current) return;
                      pushRecent(p.id);
                      onSelect(p.id);
                      onClose();
                    }}
                  >
                    <canvas
                      width={THUMB}
                      height={THUMB}
                      ref={(el) => {
                        if (el) {
                          refs.current.set(el, p.id);
                          applyThumb(el, p.id, srcKey);
                          return () => { refs.current.delete(el); };
                      }
                      }}
                    />
                    {favSet.has(p.id) && (
                      <svg className="fav-mark" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    )}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
