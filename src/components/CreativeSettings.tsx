import { useId, useState, type ReactNode } from 'react';
import type { BoothMethod, CameraSettings, CaptureMode, CompositionOptions } from '../capture/types';
import { CameraDialog } from './CameraDialog';
import { TemplateChooser } from './TemplateChooser';

export type CreativeOptions = Pick<CameraSettings, 'strengthMode' | 'gentle' | 'lens' | 'lensAmount'>;
export const DEFAULT_CREATIVE: CreativeOptions = { strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5 };
export type StudioTab = 'templates' | 'shooting' | 'effects';
const TABS = [['templates', '템플릿'], ['shooting', '촬영 모드'], ['effects', '효과']] as const;
export function CreativeSettings({ initialTab, mode, composition, boothMethod, methodLocked, working, onTemplate, onBoothMethod, options, originals, locked, gentleAvailable, ratioIdx, ratioLocked, onRatio, lensPreview, onMode, onOptions, onOriginals, onClose }: {
  initialTab: StudioTab; mode: CaptureMode; composition: CompositionOptions; boothMethod: BoothMethod;
  methodLocked: boolean; working: boolean; onTemplate: (options: CompositionOptions) => void; onBoothMethod: (method: BoothMethod) => void;
  options: CreativeOptions; originals: boolean; locked: boolean; gentleAvailable: boolean; ratioIdx: number;
  ratioLocked: boolean; onRatio: (index: number) => void; lensPreview: ReactNode; onMode: (mode: CaptureMode) => void;
  onOptions: (o: CreativeOptions) => void; onOriginals: (value: boolean) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const id = useId();
  const ratio = ratioIdx === 0 ? { w: 1, h: 1 } : ratioIdx === 1 ? { w: 4, h: 5 } : { w: 3, h: 4 };
  return <CameraDialog title="스튜디오" onClose={onClose} className="studio-dialog">
    <div className="studio-tabs" role="tablist" aria-label="스튜디오 메뉴">
      {TABS.map(([key, label], index) => <button key={key} role="tab" id={`${id}-${key}`} aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => {
        const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); setTab(TABS[next][0]); document.getElementById(`${id}-${TABS[next][0]}`)?.focus();
      }}>{label}</button>)}
    </div>
    <div className="studio-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
    {tab === 'templates' && <>
      <p className="studio-intro">네 장의 사진, 나만의 프레임.</p>
      <p className="camera-note">선택하면 네 컷 모드로 적용됩니다. 아래 그림은 사진의 배치예요. 촬영 후에도 프레임을 바꿀 수 있어요.</p>
      <TemplateChooser options={composition} ratio={ratio} active={mode === 'booth'} disabled={working} onChoose={onTemplate} />
      <p className="camera-note">메모리 프레임은 아래쪽에 넉넉한 여백을 남깁니다. 한 컷의 비율과 자동·수동 촬영은 ‘촬영 모드’에서 선택하세요.</p>
    </>}
    {tab === 'shooting' && <>
    <fieldset className="camera-field"><legend>촬영 모드</legend><div className="camera-choices">{([['normal', '일반'], ['half', '하프프레임'], ['booth', '네 컷'], ['double', '다중노출']] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>{label}</button>)}</div></fieldset>
    {mode === 'booth' && <fieldset className="camera-field" disabled={methodLocked}><legend>네 컷 촬영 방식</legend><div className="camera-choices">{([['auto', '자동'], ['manual', '수동']] as const).map(([key, label]) => <button key={key} aria-pressed={boothMethod === key} onClick={() => onBoothMethod(key)}>{label}</button>)}</div><p className="camera-note">{boothMethod === 'auto' ? '첫 컷은 셔터로, 다음 컷부터 3초 간격으로 촬영합니다.' : '매 컷마다 셔터를 눌러 촬영합니다.'} 첫 컷 이후에는 방식을 바꿀 수 없어요.</p></fieldset>}
    {(mode === 'half' || mode === 'booth') && <fieldset className="camera-field" disabled={ratioLocked}><legend>한 컷의 비율</legend><div className="camera-choices">{([[0, '1:1'], [2, '3:4'], [1, '4:5']] as const).map(([id, label]) => <button key={id} aria-pressed={ratioIdx === id} onClick={() => onRatio(id)}>{label}</button>)}</div></fieldset>}
    <p className="camera-note">{mode === 'normal' ? '하프프레임·네 컷은 촬영 전에 한 컷의 비율을 선택할 수 있어요.' : '첫 컷을 찍으면 비율이 고정됩니다. 취소하거나 촬영을 마치면 다시 선택할 수 있어요.'} 합성본은 긴 변 최대 2048px입니다.</p>
    <label className="camera-check"><input type="checkbox" checked={originals} onChange={(e) => onOriginals(e.target.checked)} disabled={locked} />원본도 보관</label>
    <p className="camera-note">다시 현상할 수 있는 필터 적용 전 사진을 함께 보관합니다. RAW는 아니며 보관 용량이 늘어납니다.</p>
    </>}
    {tab === 'effects' && <>
    <fieldset className="camera-field" disabled={locked}><legend>필터 강도 적용</legend><div className="camera-choices">{([['color', '색상만'], ['whole', '전체 룩']] as const).map(([id, label]) => <button key={id} aria-pressed={options.strengthMode === id} onClick={() => onOptions({ ...options, strengthMode: id })}>{label}</button>)}</div></fieldset>
    <label className="camera-check"><input type="checkbox" checked={options.gentle} disabled={locked || !gentleAvailable} onChange={(e) => onOptions({ ...options, gentle: e.target.checked })} />은은한 빈티지 질감</label>
    <p className="camera-note">기존은 유지하고 입자·빛샘을 줄입니다. 질감 효과가 있는 필터에서만 적용되며 디지캠은 제외합니다.</p>
    <fieldset className="camera-field" disabled={locked}><legend>렌즈 효과</legend><div className="camera-choices">{([['none', '없음'], ['star', '빛줄기'], ['prism', '가장자리 굴절']] as const).map(([id, label]) => <button key={id} aria-pressed={options.lens === id} onClick={() => onOptions({ ...options, lens: id })}>{label}</button>)}</div>
    {options.lens !== 'none' && <label className="camera-range">렌즈 강도 {Math.round(options.lensAmount * 100)}%<input aria-label="렌즈 강도" type="range" min={0} max={1} step={.01} value={options.lensAmount} onChange={(e) => onOptions({ ...options, lensAmount: Number(e.target.value) })} /></label>}</fieldset>
    <p className="camera-note">{options.lens === 'star' ? '밝은 조명이나 반사점에 빛줄기를 더합니다. 밝은 점이 없는 장면에서는 차이가 작아요.' : options.lens === 'prism' ? '가장자리에 색이 갈라지는 굴절을 더합니다. 중앙은 유지됩니다.' : '빛줄기는 밝은 조명에, 가장자리 굴절은 화면 가장자리에 적용됩니다.'}</p>
    {options.lens !== 'none' && lensPreview}
    </>}
    </div>
  </CameraDialog>;
}
