import { useEffect, useRef } from 'react';
import type { useCreativeCapture } from '../capture/useCreativeCapture';
import { CameraDialog } from './CameraDialog';

type Controller = ReturnType<typeof useCreativeCapture>;
export function CaptureWorkspace({ capture }: { capture: Controller }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current, source = capture.preview; if (!c || !source) return; c.width = source.width; c.height = source.height; c.getContext('2d')!.drawImage(source, 0, 0); }, [capture.preview]);
  return <CameraDialog title="촬영 확인" onClose={capture.cancel} busy={capture.working}>
    <canvas className="capture-result" ref={ref} aria-label="합성 사진 미리보기" />
    {capture.failure && <p role="alert" className="camera-warning">{capture.failure}</p>}
    <p className="camera-note">{capture.prepared ? `${capture.prepared.width}×${capture.prepared.height}` : '사진을 준비하고 있습니다…'} · 날짜는 합성본에 한 번 표시됩니다.</p>
    {capture.mode === 'double' && <fieldset disabled={capture.working} className="camera-field"><legend>혼합 방식</legend><div className="camera-choices">{([['average', '평균'], ['lighten', '밝게'], ['multiply', '곱하기']] as const).map(([blend, label]) => <button key={blend} aria-pressed={capture.options.blend === blend} onClick={() => capture.setOptions({ ...capture.options, blend })}>{label}</button>)}</div>
      <label className="camera-range">겹침 비율 {Math.round(capture.options.mix * 100)}%<input aria-label="겹침 비율" type="range" min={0} max={1} step={.01} value={capture.options.mix} onChange={(e) => capture.setOptions({ ...capture.options, mix: Number(e.target.value) })} /></label>
    </fieldset>}
    {capture.mode === 'booth' && <fieldset disabled={capture.working} className="camera-field"><legend>네 컷 배치</legend><div className="camera-choices">{([['grid', '2×2'], ['strip', '세로 스트립']] as const).map(([layout, label]) => <button key={layout} aria-pressed={capture.options.layout === layout} onClick={() => capture.setOptions({ ...capture.options, layout })}>{label}</button>)}{([['white', '흰 여백'], ['black', '검은 여백']] as const).map(([paper, label]) => <button key={paper} aria-pressed={capture.options.paper === paper} onClick={() => capture.setOptions({ ...capture.options, paper })}>{label}</button>)}</div></fieldset>}
    <div className="camera-actions">{capture.frames.map((_, index) => <button key={index} disabled={capture.working} onClick={() => capture.retake(index)}>{index + 1}번째 다시 찍기</button>)}</div>
    <button className="camera-primary" disabled={!capture.prepared || capture.working} onClick={() => void capture.saveReview()}>공유 / 저장</button>
  </CameraDialog>;
}
