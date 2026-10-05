import type { VariationSettings } from '../engine/variation';

interface Props {
  settings: VariationSettings; locked: boolean; warning: string | null; writable: boolean; notice?: string;
  onChange(settings: VariationSettings): void;
  onReroll(): void; onFreeze(): void; onSaveRecipe(): void; onReset(): void;
}
const RANGES = [['grain', '추가 입자'], ['leak', '추가 빛샘'], ['dust', '추가 먼지'], ['color', '색 편차']] as const;
export function FilmVariationControls({ settings, locked, warning, writable, notice, onChange, onReroll, onFreeze, onSaveRecipe, onReset }: Props) {
  return <fieldset className="camera-field film-variation" disabled={locked}>
    <legend>빈티지 우연성</legend>
    <div className="camera-choices">{([['off', '꺼짐'], ['new', '매 컷 새롭게'], ['fixed', '패턴 고정']] as const).map(([mode, label]) => <button type="button" key={mode} aria-pressed={settings.mode === mode} onClick={() => mode === 'fixed' ? onFreeze() : onChange({ ...settings, mode })}>{label}</button>)}</div>
    <p className="camera-note">선택한 필터 위에 질감을 더해요. 0%는 추가 효과만 끕니다.</p>
    {settings.mode !== 'off' && <>
      <p className="camera-note">{settings.mode === 'new' ? '지금 보이는 패턴으로 찍고, 촬영이 끝나면 새 패턴을 준비해요.' : '필터를 바꾸거나 앱을 다시 열어도 같은 패턴을 사용해요.'}</p>
      {RANGES.map(([key, label]) => <label className="camera-range" key={key}><span className="variation-range-label"><span>{label}</span><output>{Math.round(settings[key] * 100)}%</output></span><input aria-label={label} aria-valuetext={`${Math.round(settings[key] * 100)}%`} type="range" min={0} max={1} step={.01} value={settings[key]} onChange={event => onChange({ ...settings, [key]: Number(event.target.value) })} /></label>)}
      {notice && <p className="camera-note">{notice}</p>}
      <div className="camera-actions"><button type="button" onClick={onReroll}>다른 패턴</button><button type="button" onClick={onFreeze}>이 패턴 고정</button><button type="button" onClick={onSaveRecipe}>레시피 저장</button></div>
    </>}
    {warning && <p className="camera-warning" role="status">{warning}</p>}
    {!writable && <button type="button" onClick={() => { if (window.confirm('저장된 빈티지 설정만 초기화할까요? 사진·레시피·사용자 LUT는 유지됩니다.')) onReset(); }}>빈티지 설정 초기화</button>}
  </fieldset>;
}
