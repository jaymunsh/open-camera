import type { CameraSettings, CaptureMode } from '../capture/types';
import { CameraDialog } from './CameraDialog';

export type CreativeOptions = Pick<CameraSettings, 'strengthMode' | 'gentle' | 'lens' | 'lensAmount'>;
export const DEFAULT_CREATIVE: CreativeOptions = { strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5 };
export function CreativeSettings({ mode, options, originals, locked, gentleAvailable, onMode, onOptions, onOriginals, onClose }: { mode: CaptureMode; options: CreativeOptions; originals: boolean; locked: boolean; gentleAvailable: boolean; onMode: (mode: CaptureMode) => void; onOptions: (o: CreativeOptions) => void; onOriginals: (value: boolean) => void; onClose: () => void }) {
  return <CameraDialog title="촬영 모드 · 효과" onClose={onClose}>
    <fieldset className="camera-field"><legend>촬영 모드</legend><div className="camera-choices">{([['normal', '일반'], ['half', '하프프레임'], ['booth', '네 컷'], ['double', '다중노출']] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>{label}</button>)}</div></fieldset>
    <p className="camera-note">하프프레임·네 컷은 3:4로 촬영합니다. 합성본은 긴 변 최대 2048px입니다.</p>
    <label className="camera-check"><input type="checkbox" checked={originals} onChange={(e) => onOriginals(e.target.checked)} disabled={locked} />원본도 보관</label>
    <p className="camera-note">다시 현상할 수 있는 필터 적용 전 사진을 함께 보관합니다. RAW는 아니며 보관 용량이 늘어납니다.</p>
    <fieldset className="camera-field" disabled={locked}><legend>필터 강도 적용</legend><div className="camera-choices">{([['color', '색상만'], ['whole', '전체 룩']] as const).map(([id, label]) => <button key={id} aria-pressed={options.strengthMode === id} onClick={() => onOptions({ ...options, strengthMode: id })}>{label}</button>)}</div></fieldset>
    <label className="camera-check"><input type="checkbox" checked={options.gentle} disabled={locked || !gentleAvailable} onChange={(e) => onOptions({ ...options, gentle: e.target.checked })} />은은한 빈티지 질감</label>
    <p className="camera-note">기존은 유지하고 입자·빛샘을 줄입니다. 질감 효과가 있는 필터에서만 적용되며 디지캠은 제외합니다.</p>
    <fieldset className="camera-field" disabled={locked}><legend>렌즈 효과</legend><div className="camera-choices">{([['none', '없음'], ['star', '스타'], ['prism', '프리즘']] as const).map(([id, label]) => <button key={id} aria-pressed={options.lens === id} onClick={() => onOptions({ ...options, lens: id })}>{label}</button>)}</div>
    {options.lens !== 'none' && <label className="camera-range">렌즈 강도 {Math.round(options.lensAmount * 100)}%<input aria-label="렌즈 강도" type="range" min={0} max={1} step={.01} value={options.lensAmount} onChange={(e) => onOptions({ ...options, lensAmount: Number(e.target.value) })} /></label>}</fieldset>
    <p className="camera-note">스타는 밝은 조명에 빛줄기, 프리즘은 가장자리에 굴절된 상을 더합니다.</p>
  </CameraDialog>;
}
