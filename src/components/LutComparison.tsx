import { useEffect, useRef, useState, type ReactNode } from 'react';
import { renderColorComparison, type ComparisonChoice, type ComparisonImages } from '../preview/compare';
import { clonePreviewSource, type PreviewSource } from '../preview/source';
import { CameraDialog } from './CameraDialog';

function ComparisonPhoto({ canvas, zoom, label }: { canvas: HTMLCanvasElement; zoom: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const out = ref.current; if (out) { out.width = canvas.width; out.height = canvas.height; out.getContext('2d')!.drawImage(canvas, 0, 0); } }, [canvas]);
  return <figure><div className="comparison-photo"><canvas ref={ref} role="img" aria-label={label} style={{ transform: `scale(${zoom})` }} /></div><figcaption>{label}</figcaption></figure>;
}
export function LutComparison({ source, choices, selectedId, locked, onApply, onClose, sourcePicker }: {
  source: PreviewSource; choices: readonly Omit<ComparisonChoice, 'amount'>[]; selectedId: string; locked: boolean;
  onApply(choice: ComparisonChoice): void; onClose(): void; sourcePicker?: ReactNode;
}) {
  const [aId, setA] = useState(selectedId); const [bId, setB] = useState('none'); const [aAmount, setAAmount] = useState(1); const [bAmount, setBAmount] = useState(1);
  const [view, setView] = useState<'original' | 'a' | 'b'>('a'); const [zoom, setZoom] = useState(1);
  const [paired, setPaired] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [images, setImages] = useState<ComparisonImages | null>(null); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0); const [busy, setBusy] = useState(true);
  const a = choices.find((c) => c.id === aId); const b = choices.find((c) => c.id === bId);
  useEffect(() => {
    const controller = new AbortController(); let output: ComparisonImages | null = null;
    setBusy(true); setError(null); setImages(null);
    const frozen = clonePreviewSource(source);
    const run = async () => {
      if (!a || !b) throw new Error('선택한 LUT가 없어요. 다른 필터를 선택해주세요.');
      output = await renderColorComparison(frozen, { ...a, amount: aAmount }, { ...b, amount: bAmount }, controller.signal);
      if (!controller.signal.aborted) { setImages(output); setBusy(false); }
    };
    void run().catch((e) => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : '비교를 만들지 못했어요.'); setBusy(false); } }).finally(() => frozen.release());
    return () => { controller.abort(); output?.release(); };
  }, [source, a, b, aAmount, bAmount, retry]);
  const unavailable = busy || locked || !!error || !images;
  return <CameraDialog title="색감 비교" className="comparison-dialog" onClose={onClose} footer={<div className="comparison-apply"><button disabled={unavailable || !a} onClick={() => a && onApply({ ...a, amount: aAmount })}>A 적용</button><button className="camera-primary" disabled={unavailable || !b} onClick={() => b && onApply({ ...b, amount: bAmount })}>B 적용</button></div>}>
    <div className="comparison-body">
      <p className="comparison-source">{source.label}<span>같은 원본 · 색감만 비교</span></p>
      {sourcePicker}
      <div className="comparison-toolbar"><div className="camera-choices" role="group" aria-label="비교 보기">{([['original', '원본'], ['a', 'A'], ['b', 'B']] as const).map(([id, name]) => <button key={id} aria-pressed={view === id && !paired} onClick={() => { setView(id); setPaired(false); }}>{name}</button>)}<button aria-pressed={paired} onClick={() => setPaired(!paired)}>나란히</button></div><div className="camera-choices" role="group" aria-label="비교 확대">{[1, 2].map((value) => <button key={value} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value}×</button>)}</div></div>
      <div className={`comparison-stage${paired ? ' paired' : ''}`} aria-busy={busy}>
        {images ? paired ? <><ComparisonPhoto canvas={images.a} zoom={zoom} label={`A · ${a?.label} · ${Math.round(aAmount * 100)}%`} /><ComparisonPhoto canvas={images.b} zoom={zoom} label={`B · ${b?.label} · ${Math.round(bAmount * 100)}%`} /></> : <ComparisonPhoto canvas={images[view]} zoom={zoom} label={view === 'original' ? '원본' : `${view.toUpperCase()} · ${view === 'a' ? a?.label : b?.label} · ${Math.round((view === 'a' ? aAmount : bAmount) * 100)}%`} /> : <p className="camera-note" role="status">{busy ? '색감 준비 중…' : '비교를 준비하지 못했어요.'}</p>}
      </div>
      {error && <p className="camera-warning" role="alert">{error} <button onClick={() => setRetry((v) => v + 1)}>다시 시도</button></p>}
      <div className="comparison-slots">{([['A', aId, setA, aAmount, setAAmount], ['B', bId, setB, bAmount, setBAmount]] as const).map(([slot, id, select, amount, change]) => <fieldset key={slot} className="camera-field"><legend>{slot} 필터</legend><select aria-label={`${slot} 필터`} value={id} onChange={(e) => select(e.target.value)}>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.custom ? '사용자 · ' : ''}{choice.label}</option>)}</select><label className="camera-range">강도 {Math.round(amount * 100)}%<input aria-label={`${slot} 강도`} type="range" min={0} max={1} step={.01} value={amount} onChange={(e) => change(Number(e.target.value))} /></label></fieldset>)}</div>
      <p className="camera-note">최대 1024px 미리보기 · 입자, 빛샘, 렌즈, 뷰티, 날짜는 제외해요. 적용하면 선택한 필터와 강도만 바뀌고 나머지 촬영 설정은 유지돼요.</p>
    </div>
  </CameraDialog>;
}
