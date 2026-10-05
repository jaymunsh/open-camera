import { SAMPLES, type SampleId } from '../preview/samples';
import type { PreviewSource } from '../preview/source';

export function PreviewSourcePicker({ sampleId, sourceKind, sceneAvailable, importAvailable, captureFrames, captureIndex, busy, error, onSample, onScene, onImport, onCaptureIndex, onRefresh, onRetry }: {
  sampleId: SampleId; sourceKind: PreviewSource['kind']; sceneAvailable: boolean; importAvailable: boolean; captureFrames: number; captureIndex: number; busy: boolean; error: string | null;
  onSample(id: SampleId): void; onScene(): void; onImport(): void; onCaptureIndex(index: number): void; onRefresh(): void; onRetry(): void;
}) {
  return <div className="preview-source-picker" role="group" aria-label="비교 사진 선택" aria-busy={busy}>
    <div className="sample-choices">{SAMPLES.map((sample) => <button className="sample-choice" key={sample.id} aria-pressed={sourceKind === 'sample' && sampleId === sample.id} onClick={() => onSample(sample.id)}><img src={sample.thumbUrl} alt="" loading="lazy" /><span>{sample.label}</span></button>)}</div>
    <div className="preview-source-actions">
      <button disabled={!sceneAvailable} aria-pressed={sourceKind === 'scene'} onClick={onScene}>현재 장면</button>
      {importAvailable && <button aria-pressed={sourceKind === 'import'} onClick={onImport}>편집 사진</button>}
      {Array.from({ length: captureFrames }, (_, i) => <button key={i} aria-pressed={sourceKind === 'capture' && captureIndex === i} onClick={() => onCaptureIndex(i)}>원본 컷 {i + 1}</button>)}
      {sourceKind === 'scene' && <button disabled={busy} onClick={onRefresh}>장면 새로고침</button>}
    </div>
    <p className="camera-note">{sourceKind === 'sample' ? 'AI 기준 사진 · 색감을 고르는 예시예요.' : '필터 적용 전 사진 · 새로 선택하기 전까지 같은 장면을 비교해요.'}</p>
    {busy && <p role="status" className="camera-note">사진 준비 중…</p>}
    {error && <p role="alert" className="camera-warning">{error} <button onClick={onRetry}>다시 시도</button></p>}
  </div>;
}
