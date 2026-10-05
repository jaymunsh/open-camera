import { useEffect, useState } from 'react';
import type { CaptureRecord } from '../capture/types';
import { saveImage } from '../utils/share';
import { CameraDialog } from './CameraDialog';

export function BlobPhoto({ blob, className, alt }: { blob: Blob; className?: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url ? <img src={url} className={className} alt={alt} /> : null;
}
const labels = { normal: '일반', half: '하프프레임', booth: '네 컷', double: '다중노출', instant: '즉석사진' };
export function PhotoHistory({ records, warning, onClose, onDelete, onReprocess }: { records: CaptureRecord[]; warning: string | null; onClose: () => void; onDelete: (r: CaptureRecord) => Promise<void>; onReprocess: (r: CaptureRecord) => Promise<void> }) {
  const [selectedId, setSelected] = useState<string | null>(null);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(null); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '작업에 실패했습니다. 다시 시도해주세요.'); } finally { setBusy(false); } };
  return <CameraDialog title="최근 촬영" onClose={onClose} busy={busy}>
    <p className="camera-note">이 앱에서 만든 최근 10장 · 기기에만 보관합니다.<br />브라우저 데이터 삭제 시 사라질 수 있습니다.</p>
    {warning && <p className="camera-warning" role="status">{warning}</p>}
    {error && <p className="camera-warning" role="alert">{error}</p>}
    {selected ? <>
      <BlobPhoto blob={selected.blob} className="history-large" alt="선택한 촬영 사진" />
      <p className="camera-note">{labels[selected.mode]} · {selected.width}×{selected.height} · {new Date(selected.createdAt).toLocaleString('ko-KR')}{selected.persisted === false ? ' · 이번 세션에만 보관' : ''}</p>
      {!selected.originals.length && <p className="camera-note">원본을 보관하지 않은 사진은 다시 현상할 수 없어요.</p>}
      <div className="camera-actions">
        <button disabled={busy} onClick={() => setSelected(null)}>목록</button>
        <button disabled={busy} onClick={() => void run(() => saveImage(selected.blob, selected.name))}>다시 공유 / 저장</button>
        {selected.originals.length > 0 && <button disabled={busy} onClick={() => void run(() => onReprocess(selected))}>다시 현상</button>}
        <button disabled={busy} onClick={() => { if (window.confirm('이 사진과 보관한 원본을 삭제할까요?')) void run(async () => { await onDelete(selected); setSelected(null); }); }}>삭제</button>
      </div>
    </> : records.length ? <div className="history-grid">{records.map((r) => <button className="history-photo" key={r.id} onClick={() => setSelected(r.id)} aria-label={`${labels[r.mode]} ${new Date(r.createdAt).toLocaleString('ko-KR')} 보기`}>
      <BlobPhoto blob={r.blob} alt={`${labels[r.mode]} 촬영 사진`} /><span>{labels[r.mode]}{r.persisted === false ? ' · 임시' : ''}</span>
    </button>)}</div> : <p className="camera-empty">아직 촬영한 사진이 없습니다.</p>}
  </CameraDialog>;
}
