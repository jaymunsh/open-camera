import { useId, useState, type ReactNode } from 'react';
import type { BoothInterval, BoothMethod, CameraSettings, CaptureMode, CompositionOptions } from '../capture/types';
import { CameraDialog } from './CameraDialog';
import { TemplateChooser } from './TemplateChooser';
import { FrameDecoration } from './FrameDecoration';
import { BoothControls } from './BoothControls';
import { compositionLayout } from '../capture/composite';
import { compositionPaper } from '../capture/paper';
import { STUDIO_FILMS } from '../engine/lut';

export type CreativeOptions = Pick<CameraSettings, 'strengthMode' | 'gentle' | 'lens' | 'lensAmount'>;
export const DEFAULT_CREATIVE: CreativeOptions = { strengthMode: 'color', gentle: false, lens: 'none', lensAmount: .5 };
export type StudioTab = 'templates' | 'shooting' | 'effects';
const TABS = [['templates', '템플릿'], ['shooting', '촬영 모드'], ['effects', '효과']] as const;
export function CreativeSettings({ initialTab, mode, composition, boothMethod, boothInterval, methodLocked, working, onTemplate, onInstantFormat, selectedFilm, onFilm, onComposition, onBoothMethod, onBoothInterval, framePreview, variationControls, options, originals, locked, gentleAvailable, ratioIdx, ratioLocked, onRatio, lensPreview, onMode, onOptions, onOriginals, onClose }: {
  initialTab: StudioTab; mode: CaptureMode; composition: CompositionOptions; boothMethod: BoothMethod;
  methodLocked: boolean; working: boolean; onTemplate: (options: CompositionOptions) => void; onBoothMethod: (method: BoothMethod) => void;
  boothInterval: BoothInterval; onBoothInterval: (interval: BoothInterval) => void;
  onComposition: (options: CompositionOptions) => void; framePreview: ReactNode;
  variationControls?: ReactNode;
  onInstantFormat: (format: 'square' | 'portrait') => void; selectedFilm: string; onFilm: (id: string) => void;
  options: CreativeOptions; originals: boolean; locked: boolean; gentleAvailable: boolean; ratioIdx: number;
  ratioLocked: boolean; onRatio: (index: number) => void; lensPreview: ReactNode; onMode: (mode: CaptureMode) => void;
  onOptions: (o: CreativeOptions) => void; onOriginals: (value: boolean) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const id = useId();
  const ratio = ratioIdx === 0 ? { w: 1, h: 1 } : ratioIdx === 1 ? { w: 4, h: 5 } : { w: 3, h: 4 };
  const ratioControls = <fieldset className="camera-field" disabled={ratioLocked}><legend>한 컷의 비율</legend><div className="camera-choices">{([[0, '1:1'], [2, '3:4'], [1, '4:5']] as const).map(([id, label]) => <button key={id} aria-pressed={ratioIdx === id} onClick={() => onRatio(id)}>{label}</button>)}</div></fieldset>;
  const boothControls = <BoothControls method={boothMethod} interval={boothInterval} locked={methodLocked} onMethod={onBoothMethod} onInterval={onBoothInterval} />;
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
      {framePreview}
      <div className="studio-section-head"><h3>한 장의 즉석사진</h3><span>넓은 하단 여백 · 문구</span></div>
      <div className="camera-choices instant-choices">{([['square', '즉석 정사각'], ['portrait', '즉석 세로']] as const).map(([format, label]) => {
        const layout = compositionLayout(100, format === 'square' ? 100 : 133, 'instant', { frame: 'memory' });
        const r = layout.cells[0];
        return <button key={format} aria-pressed={mode === 'instant' && (composition.instantFormat ?? 'square') === format} disabled={working || (mode === 'instant' && ratioLocked)} onClick={() => onInstantFormat(format)}><svg aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`}><rect width={layout.width} height={layout.height} fill={compositionPaper(composition).color} /><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#45424f" /></svg>{label}</button>;
      })}</div>
      {mode === 'instant' && <FrameDecoration options={composition} disabled={working} onChange={onComposition} />}
      <div className="studio-section-head"><h3>네 컷 프레임</h3><span>{mode === 'booth' ? '촬영 후에도 변경 가능' : '선택하면 네 컷 모드'}</span></div>
      <TemplateChooser options={composition} ratio={ratio} active={mode === 'booth'} disabled={working} onChoose={onTemplate} />
      {mode === 'booth' && <div className="studio-frame-settings">
        <FrameDecoration options={composition} disabled={working} onChange={onComposition} />
        {ratioControls}{boothControls}
      </div>}
    </>}
    {tab === 'shooting' && <>
    <fieldset className="camera-field"><legend>촬영 모드</legend><div className="camera-choices">{([['normal', '일반'], ['instant', '즉석사진'], ['half', '하프프레임'], ['booth', '네 컷'], ['double', '다중노출']] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>{label}</button>)}</div></fieldset>
    {mode === 'booth' && boothControls}
    {(mode === 'half' || mode === 'booth') && ratioControls}
    <p className="camera-note">{mode === 'normal' ? '하프프레임·네 컷은 촬영 전에 한 컷의 비율을 선택할 수 있어요.' : '첫 컷을 찍으면 비율이 고정됩니다. 취소하거나 촬영을 마치면 다시 선택할 수 있어요.'} 합성본은 긴 변 최대 2048px입니다.</p>
    <label className="camera-check"><input type="checkbox" checked={originals} onChange={(e) => onOriginals(e.target.checked)} disabled={locked} />원본도 보관</label>
    <p className="camera-note">다시 현상할 수 있는 필터 적용 전 사진을 함께 보관합니다. RAW는 아니며 보관 용량이 늘어납니다.</p>
    </>}
    {tab === 'effects' && <>
    {framePreview}
    <fieldset className="camera-field" disabled={locked || working}><legend>스튜디오 필름</legend><div className="studio-films">
      {STUDIO_FILMS.map((film) => <button key={film.id} aria-label={film.label} aria-pressed={selectedFilm === film.id} onClick={() => onFilm(film.id)}><span>{film.label}</span><small>{film.description}</small></button>)}
    </div><p className="camera-note">프레임과 별개로 선택하는 새 필터예요. 기존 필터는 하단 필터 목록에서 그대로 사용할 수 있어요.</p></fieldset>
    <fieldset className="camera-field" disabled={locked}><legend>필터 강도 적용</legend><div className="camera-choices">{([['color', '색상만'], ['whole', '전체 룩']] as const).map(([id, label]) => <button key={id} aria-pressed={options.strengthMode === id} onClick={() => onOptions({ ...options, strengthMode: id })}>{label}</button>)}</div></fieldset>
    <label className="camera-check"><input type="checkbox" checked={options.gentle} disabled={locked || !gentleAvailable} onChange={(e) => onOptions({ ...options, gentle: e.target.checked })} />은은한 빈티지 질감</label>
    <p className="camera-note">기존은 유지하고 입자·빛샘을 줄입니다. 질감 효과가 있는 필터에서만 적용되며 디지캠은 제외합니다.</p>
    <fieldset className="camera-field" disabled={locked}><legend>렌즈 효과</legend><div className="camera-choices">{([['none', '없음'], ['star', '빛줄기'], ['prism', '가장자리 굴절']] as const).map(([id, label]) => <button key={id} aria-pressed={options.lens === id} onClick={() => onOptions({ ...options, lens: id })}>{label}</button>)}</div>
    {options.lens !== 'none' && <label className="camera-range">렌즈 강도 {Math.round(options.lensAmount * 100)}%<input aria-label="렌즈 강도" type="range" min={0} max={1} step={.01} value={options.lensAmount} onChange={(e) => onOptions({ ...options, lensAmount: Number(e.target.value) })} /></label>}</fieldset>
    <p className="camera-note">{options.lens === 'star' ? '밝은 조명이나 반사점에 빛줄기를 더합니다. 밝은 점이 없는 장면에서는 차이가 작아요.' : options.lens === 'prism' ? '가장자리에 색이 갈라지는 굴절을 더합니다. 중앙은 유지됩니다.' : '빛줄기는 밝은 조명에, 가장자리 굴절은 화면 가장자리에 적용됩니다.'}</p>
    {options.lens !== 'none' && lensPreview}
    {variationControls}
    </>}
    </div>
  </CameraDialog>;
}
