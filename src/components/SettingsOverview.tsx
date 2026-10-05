import { useState } from 'react';
import type { BoothInterval, BoothMethod, CameraSettings, CaptureMode, CompositionOptions } from '../capture/types';
import { PARAM_DEFS, DEFAULT_PARAMS } from '../engine/types';
import { DEFAULT_VARIATION } from '../engine/variation';
import { DATE_FORMATS, DATE_SIZES } from '../engine/pipeline';
import { PAPERS } from '../capture/paper';
import { DEFAULT_BEAUTY, DEFS as BEAUTY_DEFS } from './BeautyPanel';
import { CameraDialog } from './CameraDialog';
import { StudioDisclosure } from './StudioDisclosure';
import { DEFAULT_FILM_QUALITY, type ResolvedFilmQuality } from '../engine/filmQuality';

export type SettingsDestination = 'shooting' | 'templates' | 'effects' | 'filters' | 'adjust' | 'beauty' | 'date';
export interface SettingsSnapshot {
  settings: CameraSettings;
  filterLabel: string;
  source: 'camera' | 'edit';
  captureMode: CaptureMode;
  ratioLabel: string;
  composition: CompositionOptions;
  boothMethod: BoothMethod;
  boothInterval: BoothInterval;
  grid: boolean;
  timer: number;
  originals: boolean;
  facing: 'user' | 'environment';
  zoom: number | null;
  torch: 'on' | 'off' | 'unavailable';
  gentleAvailable: boolean;
  showDate: boolean;
  beautyAvailable: boolean;
  patternSeed: number | null;
  mixedPatterns: boolean;
  resolvedFilmQuality?: ResolvedFilmQuality | null;
}
export const CAPTURE_LABELS: Record<CaptureMode, string> = { normal: '일반', instant: '즉석사진', half: '하프프레임', booth: '네 컷', double: '다중노출' };
const percent = (value: number) => `${Math.round(value * 100)}%`;
const number = (value: number) => Number(value.toFixed(2)).toString();
type Row = readonly [string, string];
function Values({ rows }: { rows: Row[] }) {
  return <dl className="settings-values">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function SettingsOverview({ snapshot: s, unavailable, onClose, onNavigate }: { snapshot: SettingsSnapshot; unavailable: Partial<Record<SettingsDestination, string>>; onClose: () => void; onNavigate: (destination: SettingsDestination) => void }) {
  const [defaults, setDefaults] = useState(false);
  const p = s.settings, v = p.variation ?? DEFAULT_VARIATION, c = s.composition;
  const adjustment = PARAM_DEFS.filter(d => defaults || p.params[d.key] !== DEFAULT_PARAMS[d.key]).map(d => [d.label, d.key === 'exposure' ? `${p.params[d.key] > 0 ? '+' : ''}${number(p.params[d.key])} EV` : `${p.params[d.key] > 0 ? '+' : ''}${percent(p.params[d.key])}`] as Row);
  const beautyDefs = [...BEAUTY_DEFS, { key: 'spotRange' as const, label: '잡티 범위' }];
  const beauty = beautyDefs.filter(d => defaults || p.beauty[d.key] !== DEFAULT_BEAUTY[d.key]).map(d => [d.label, percent(p.beauty[d.key])] as Row);
  const group = (title: string, summary: string, rows: Row[], destination: SettingsDestination, action: string, open = false, note?: string) => <StudioDisclosure title={title} summary={summary} initiallyOpen={open}>
    {note && <p className="camera-note">{note}</p>}
    {rows.length ? <Values rows={rows} /> : <p className="camera-note">변경한 값이 없어요. 기본값도 표시하면 모든 항목을 볼 수 있어요.</p>}
    <button className="settings-edit-link" disabled={!!unavailable[destination]} onClick={() => onNavigate(destination)}>{action}<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 5 7 7-7 7" /></svg></button>
    {unavailable[destination] && <p className="camera-note">{unavailable[destination]}</p>}
  </StudioDisclosure>;
  const patternLabel = v.mode === 'off' ? '꺼짐' : v.mode === 'fixed' ? '고정 패턴' : '매 컷 새롭게';
  const lensLabel = p.lens === 'none' ? '꺼짐' : p.lens === 'star' ? '빛줄기' : '가장자리 굴절';
  const q = p.filmQuality ?? DEFAULT_FILM_QUALITY, activeQuality = s.resolvedFilmQuality;
  const inactiveQuality = q.model === 'legacy' ? ' · 현재 미사용' : '';
  return <CameraDialog title="현재 설정" onClose={onClose} className="settings-overview-dialog">
    <div className="settings-overview-body">
      <p className="settings-overview-intro">{s.filterLabel} · {s.ratioLabel}<span>현재 설정을 확인하는 화면이에요. 변경은 각 설정에서 할 수 있어요.</span></p>
      <label className="camera-check settings-defaults"><input type="checkbox" checked={defaults} onChange={e => setDefaults(e.target.checked)} />기본값도 표시</label>
      {group('촬영', `${s.source === 'edit' ? '사진 편집' : CAPTURE_LABELS[s.captureMode]} · ${s.ratioLabel}`, [
        ['작업', s.source === 'edit' ? '사진 편집' : '카메라 촬영'], ['촬영 모드', CAPTURE_LABELS[s.captureMode]], ['한 컷의 비율', s.ratioLabel],
        ['카메라', s.source === 'edit' ? '미사용' : s.facing === 'user' ? '전면' : '후면'], ['웹 줌', s.zoom === null || s.source === 'edit' ? '미사용 / 지원 정보 없음' : `${number(s.zoom)}×`],
        ['타이머', `${s.timer === 0 ? '꺼짐' : `${s.timer}초`}${s.source === 'edit' ? ' · 편집 중 미사용' : ''}`], ['격자', s.grid ? '켜짐' : '꺼짐'],
        ['플래시', s.source === 'edit' ? '미사용' : s.torch === 'unavailable' ? '현재 카메라 미지원' : s.torch === 'on' ? '켜짐' : '꺼짐'],
        ['네 컷 촬영 방식', `${s.boothMethod === 'auto' ? '자동' : '수동'}${s.captureMode !== 'booth' ? ' · 네 컷에서 사용' : ''}`], ['네 컷 간격', `${s.boothInterval}초${s.boothMethod === 'manual' || s.captureMode !== 'booth' ? ' · 현재 미사용' : ''}`],
      ], 'shooting', '촬영 설정 열기', true)}
      {group('프레임', s.captureMode === 'normal' ? '일반 사진 · 프레임 없음' : CAPTURE_LABELS[s.captureMode], [
        ['배치', c.layout === 'grid' ? '2×2' : c.layout === 'strip' ? '세로 스트립' : '가로 네 컷'], ['여백 형태', c.frame === 'memory' ? '하단 여백' : c.frame === 'film' ? '필름 스트립' : '기본'],
        ['여백 색', PAPERS.find(paper => paper.id === c.paper)?.label ?? c.paper], ['하단 문구', c.caption?.trim() || '없음'], ['즉석사진 형태', c.instantFormat === 'portrait' ? '세로' : '정사각'],
        ['다중노출 혼합', c.blend === 'average' ? '평균' : c.blend === 'lighten' ? '밝게' : '곱하기'], ['겹침 비율', percent(c.mix)],
      ], 'templates', '프레임 설정 열기', false, '모드에 따라 필요한 항목만 적용돼요. 일반 사진에는 프레임, 여백, 문구가 적용되지 않아요. 혼합·겹침은 다중노출에서만 사용해요.')}
      {group('필름', `${s.filterLabel}${p.lutId === 'none' ? '' : ` · ${percent(p.intensity)}`}`, [
        ['선택한 필름', s.filterLabel], ['필터 강도', `${percent(p.intensity)}${p.lutId === 'none' ? ' · 필름 없음일 때 미사용' : ''}`], ['강도 적용', p.strengthMode === 'color' ? '색상만' : '전체 룩'],
        ['필터·추가 입자', p.grainOff ? '입자 꺼짐' : '필터·패턴 설정에 따라 적용'], ['은은한 질감', !p.gentle ? '꺼짐' : s.gentleAvailable ? '켜짐' : '켜짐 · 현재 필터 미지원'],
      ], 'filters', '필름 선택 열기', true)}
      {group('질감', `${lensLabel} · 패턴 ${patternLabel}`, [
        ['필름 처리', q.model === 'film-v2' ? '새 필름 처리' : '기존 처리'],
        ['유효 필름 입자', percent(activeQuality?.grain ?? 0)], ['유효 광원 번짐', percent(activeQuality?.glow ?? 0)],
        ...(p.filmQuality || defaults ? [
          ['필름 입자 저장값', `${percent(q.grain)}${inactiveQuality}`], ['입자 크기', `${percent(q.size)}${inactiveQuality}`],
          ['컬러 입자', `${percent(q.color)}${inactiveQuality}`], ['암부 입자', `${percent(q.shadows)}${inactiveQuality}`],
          ['광원 번짐 저장값', `${percent(q.glow)}${inactiveQuality}`], ['번짐 범위', `${percent(q.glowRadius)}${inactiveQuality}`],
          ['필름 패턴 값', String(activeQuality?.seed ?? q.seed)],
        ] as Row[] : []),
        ['렌즈 효과', lensLabel], ['렌즈 강도', `${percent(p.lensAmount)}${p.lens === 'none' ? ' · 현재 미사용' : ''}`], ['빈티지 패턴', patternLabel],
        ['추가 입자', `${percent(v.grain)}${p.grainOff ? ' · 입자 꺼짐' : v.mode === 'off' ? ' · 현재 미사용' : ''}`], ['빛샘', `${percent(v.leak)}${v.mode === 'off' ? ' · 현재 미사용' : ''}`],
        ['먼지', `${percent(v.dust)}${v.mode === 'off' ? ' · 현재 미사용' : ''}`], ['색 편차', `${percent(v.color)}${v.mode === 'off' ? ' · 현재 미사용' : ''}`],
        ['고정 패턴 값', `${v.fixedSeed}${v.mode !== 'fixed' ? ' · 현재 미사용' : ''}`], ['현재 패턴 값', s.patternSeed === null ? '없음' : String(s.patternSeed)], ['컷별 패턴', s.mixedPatterns ? '컷별 설정 보관 · 혼합' : '현재 패턴 설정'],
      ], 'effects', '효과 설정 열기')}
      {group('보정', adjustment.length ? `${adjustment.length}개 표시` : '기본값', adjustment, 'adjust', '보정 설정 열기', false, '직접 조절한 값이에요. 필름 내부의 색상 변환과 패턴의 색 편차는 별도로 적용돼요.')}
      {group('뷰티', s.beautyAvailable ? beauty.length ? `${beauty.length}개 표시` : '기본값' : '현재 작업 미지원', beauty, 'beauty', '뷰티 설정 열기', false, s.beautyAvailable ? undefined : '설정값은 유지되지만 합성 사진 다시 현상에는 미용 보정이 적용되지 않아요.')}
      {group('날짜 · 보관', `${s.showDate ? '날짜 켜짐' : '날짜 꺼짐'} · 원본 ${s.originals ? '보관' : '미보관'}`, [
        ['날짜 표시', p.date.mode === 'auto' ? `자동 · 현재 ${s.showDate ? '켜짐' : '꺼짐'}` : p.date.mode === 'on' ? '항상 켜짐' : '꺼짐'],
        ['날짜 색', p.date.style === 'red' ? '빨간 아날로그' : '주황 디지캠'], ['날짜 형식', DATE_FORMATS.find(f => f.id === p.date.fmt)?.label ?? p.date.fmt],
        ['날짜 크기', DATE_SIZES.find(size => size.id === p.date.size)?.label ?? p.date.size], ['날짜 방향', p.date.orient === 'auto' ? '자동' : p.date.orient === 'p' ? '세로 사진' : '가로 사진'], ['원본도 보관', s.originals ? '켜짐' : '꺼짐'],
      ], 'date', '날짜 설정 열기')}
    </div>
  </CameraDialog>;
}
