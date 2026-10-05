import { useEffect, useRef, useState } from 'react';
import type { CameraSettings } from '../capture/types';
import type { LutData } from '../engine/types';
import { renderFilmTextureComparison, type FilmTextureImages } from '../preview/filmTextureCompare';
import type { PreviewSource } from '../preview/source';
import { CameraDialog } from './CameraDialog';

function TexturePhoto({ canvas, label, zoom }: { canvas: HTMLCanvasElement; label: string; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const out = ref.current; if (out) { out.width = canvas.width; out.height = canvas.height; out.getContext('2d')!.drawImage(canvas, 0, 0); } }, [canvas]);
  return <figure><div className="comparison-photo"><canvas ref={ref} role="img" aria-label={label} style={{ transform: `scale(${zoom})` }} /></div><figcaption>{label}</figcaption></figure>;
}

export function FilmTextureComparison({ source, settings, lut, onClose }: { source: PreviewSource; settings: CameraSettings; lut: LutData | null; onClose(): void }) {
  const [view, setView] = useState<'before' | 'after' | 'paired'>('after'); const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState<{ key: string; images: FilmTextureImages } | null>(null);
  const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  const key = JSON.stringify([source.key, settings, retry]); const images = rendered?.key === key ? rendered.images : null;
  useEffect(() => {
    const controller = new AbortController(); let output: FilmTextureImages | null = null;
    setRendered(null); setError(null);
    void renderFilmTextureComparison(source, settings, lut, controller.signal).then(result => {
      output = result;
      if (controller.signal.aborted) result.release(); else setRendered({ key, images: result });
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '질감 비교를 만들지 못했어요.'); });
    return () => { controller.abort(); output?.release(); };
  }, [source, settings, lut, retry, key]);
  return <CameraDialog title="질감 비교" className="comparison-dialog texture-comparison-dialog" onClose={onClose}>
    <div className="comparison-body">
      <p className="comparison-source">{source.label}<span>같은 원본 · 최대 1024px</span></p>
      <div className="comparison-toolbar"><div className="camera-choices" role="group" aria-label="질감 비교 보기">{([['before', '질감 전'], ['after', '질감 적용'], ['paired', '나란히']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div><div className="camera-choices" role="group" aria-label="질감 확대">{[1, 2].map(value => <button key={value} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value}×</button>)}</div></div>
      <div className={`comparison-stage${view === 'paired' ? ' paired' : ''}`} aria-busy={!images && !error}>
        {images ? view === 'paired' ? <><TexturePhoto canvas={images.before} label="질감 전" zoom={zoom} /><TexturePhoto canvas={images.after} label="질감 적용" zoom={zoom} /></> : <TexturePhoto canvas={images[view]} label={view === 'before' ? '질감 전' : '질감 적용'} zoom={zoom} /> : <p className="camera-note" role="status">{error ? '비교를 준비하지 못했어요.' : '질감 준비 중…'}</p>}
      </div>
      {error && <p className="camera-warning" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>다시 시도</button></p>}
      <p className="camera-note">색감·보정에 필름 질감만 비교 · 뷰티·렌즈·날짜·추가 우연성은 제외해요. 닫아도 촬영 설정은 바뀌지 않아요.</p>
    </div>
  </CameraDialog>;
}
