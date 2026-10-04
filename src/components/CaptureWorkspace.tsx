import { useEffect, useRef } from 'react';
import type { useCreativeCapture } from '../capture/useCreativeCapture';
import type { CapturedFrame } from '../capture/types';
import { CameraDialog } from './CameraDialog';
import { TemplateChooser } from './TemplateChooser';

type Controller = ReturnType<typeof useCreativeCapture>;
function FrameThumbnail({ frame, index, disabled, onRetake }: { frame: CapturedFrame; index: number; disabled: boolean; onRetake: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const scale = Math.min(1, 192 / Math.max(frame.canvas.width, frame.canvas.height));
    c.width = Math.max(1, Math.round(frame.canvas.width * scale));
    c.height = Math.max(1, Math.round(frame.canvas.height * scale));
    c.getContext('2d')!.drawImage(frame.canvas, 0, 0, c.width, c.height);
  }, [frame]);
  return <button disabled={disabled} aria-label={`${index + 1}번째 다시 찍기`} onClick={onRetake}>
    <canvas ref={ref} aria-hidden="true" />
    <span>{index + 1} · 다시 찍기</span>
  </button>;
}
export function CaptureWorkspace({ capture }: { capture: Controller }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current, source = capture.preview; if (!c || !source) return; c.width = source.width; c.height = source.height; c.getContext('2d')!.drawImage(source, 0, 0); }, [capture.preview]);
  const close = () => { if (window.confirm('촬영 확인을 종료할까요? 보관함에 저장되지 않은 사진과 변경 내용은 버려집니다.')) capture.cancel(); };
  return <CameraDialog title="촬영 확인" onClose={close} busy={capture.working} className="capture-workspace" footer={
    <button className="camera-primary" disabled={!capture.prepared || capture.working} aria-busy={capture.working} onClick={() => void capture.saveReview()}>공유 / 저장</button>
  }>
    <div className="capture-review-body">
    <canvas className="capture-result" ref={ref} aria-label="합성 사진 미리보기" aria-busy={!capture.prepared && !capture.failure} />
    {capture.failure && <p role="alert" className="camera-warning">{capture.failure}</p>}
    <p className="camera-note" role="status">{capture.prepared ? `${capture.prepared.width}×${capture.prepared.height} · 날짜는 합성본에 한 번 표시됩니다.` : capture.failure ? '다시 찍거나 설정을 바꿔 다시 시도해주세요.' : '사진을 준비하고 있습니다…'}</p>
    <p className="capture-retake-hint">다시 찍을 컷을 선택하세요. 나머지 컷은 유지됩니다.</p>
    <div className="capture-retakes" style={{ gridTemplateColumns: `repeat(${capture.frames.length}, minmax(0, 1fr))` }}>
      {capture.frames.map((frame, index) => <FrameThumbnail key={index} frame={frame} index={index} disabled={capture.working} onRetake={() => capture.retake(index)} />)}
    </div>
    {capture.mode === 'double' && <fieldset disabled={capture.working} className="camera-field"><legend>혼합 방식</legend><div className="camera-choices">{([['average', '평균'], ['lighten', '밝게'], ['multiply', '곱하기']] as const).map(([blend, label]) => <button key={blend} aria-pressed={capture.options.blend === blend} onClick={() => capture.setOptions({ ...capture.options, blend })}>{label}</button>)}</div>
      <label className="camera-range">겹침 비율 {Math.round(capture.options.mix * 100)}%<input aria-label="겹침 비율" type="range" min={0} max={1} step={.01} value={capture.options.mix} onChange={(e) => capture.setOptions({ ...capture.options, mix: Number(e.target.value) })} /></label>
    </fieldset>}
    {capture.mode === 'booth' && <details className="capture-layout"><summary>배치 · 여백</summary>
      <p className="camera-note">프레임만 바뀌고 촬영한 네 장은 그대로 유지됩니다.</p>
      <TemplateChooser options={capture.options} ratio={{ w: capture.frames[0].canvas.width, h: capture.frames[0].canvas.height }} disabled={capture.working} onChoose={capture.setOptions} />
      <fieldset disabled={capture.working} className="camera-field"><legend>네 컷 배치</legend><div className="camera-choices">{([['grid', '2×2'], ['strip', '세로 스트립']] as const).map(([layout, label]) => <button key={layout} aria-pressed={capture.options.layout === layout} onClick={() => capture.setOptions({ ...capture.options, layout })}>{label}</button>)}</div></fieldset>
      <fieldset disabled={capture.working} className="camera-field"><legend>여백 색</legend><div className="camera-choices">{([['white', '흰 여백'], ['black', '검은 여백']] as const).map(([paper, label]) => <button key={paper} aria-pressed={capture.options.paper === paper} onClick={() => capture.setOptions({ ...capture.options, paper })}>{label}</button>)}</div></fieldset>
    </details>}
    </div>
  </CameraDialog>;
}
