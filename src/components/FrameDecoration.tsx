import { PAPERS } from '../capture/paper';
import type { CompositionOptions } from '../capture/types';

export function FrameDecoration({ options, disabled, onChange }: {
  options: CompositionOptions; disabled: boolean; onChange: (options: CompositionOptions) => void;
}) {
  return <>
    <fieldset className="camera-field" disabled={disabled}><legend>여백 색</legend>
      <div className="camera-choices paper-choices">{PAPERS.map((paper) => <button key={paper.id} aria-pressed={options.paper === paper.id} onClick={() => onChange({ ...options, paper: paper.id })}>
        <span className="paper-swatch" aria-hidden="true" style={{ backgroundColor: paper.color }} />{paper.label}
      </button>)}</div>
    </fieldset>
    {options.frame === 'memory' && <fieldset className="camera-field" disabled={disabled}><legend>프레임 문구</legend>
      <input aria-label="프레임 문구" maxLength={32} value={options.caption ?? ''} placeholder="기억하고 싶은 한 줄" onChange={(e) => onChange({ ...options, caption: e.target.value })} />
      <p className="camera-note">하단 여백에 표시됩니다. 문구가 있으면 날짜는 사진 안쪽에 표시해요.</p>
    </fieldset>}
  </>;
}
