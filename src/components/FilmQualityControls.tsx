import { DEFAULT_FILM_QUALITY, type FilmQualitySettings } from '../engine/filmQuality';

export function FilmQualityControls({ settings, locked, warning, onChange, onCompare }: {
  settings: FilmQualitySettings | undefined; locked: boolean; warning: string | null;
  onChange(s: FilmQualitySettings | undefined): void; onCompare?: () => void;
}) {
  const s = settings ?? DEFAULT_FILM_QUALITY;
  const change = (patch: Partial<FilmQualitySettings>) => {
    if (!locked) onChange({ ...s, ...patch, origin: 'manual', profile: undefined });
  };
  const range = (key: 'grain' | 'glow' | 'size' | 'color' | 'shadows' | 'glowRadius', label: string) => <label className="camera-range">
    <span className="film-range-label">{label}<output>{Math.round(s[key] * 100)}%</output></span>
    <input aria-label={label} type="range" min={0} max={1} step={.01} value={s[key]} onChange={e => change({ [key]: Number(e.target.value) })} />
  </label>;
  return <div className="film-quality-controls">
    {warning && <p className="camera-warning" role="status">{warning}</p>}
    <fieldset className="camera-field" disabled={locked}><legend>필름 처리</legend>
      <div className="camera-choices">{([['legacy', '기존 처리'], ['film-v2', '새 필름 처리']] as const).map(([model, label]) => <button key={model} aria-pressed={s.model === model} onClick={() => change({ model })}>{label}</button>)}</div>
      {s.model === 'film-v2' ? <>
        <div className="film-size-presets"><span>입자 크기</span><div className="camera-choices">{([['고운', .08], ['보통', .38], ['거친', .85]] as const).map(([label, size]) => <button key={label} aria-pressed={s.size === size} onClick={() => change({ size })}>{label}</button>)}</div></div>
        {range('grain', '입자 강도')}{range('glow', '광원 번짐')}
        <details className="film-quality-details"><summary>세부 조정</summary>
          {range('size', '입자 크기')}{range('color', '컬러 입자')}{range('shadows', '암부 입자')}{range('glowRadius', '번짐 범위')}
        </details>
        <p className="camera-note">같은 사진 크기로 볼 때 입자 크기를 유지해요. 광원 번짐은 밝은 빛 주변에만 더해요.</p>
      </> : <p className="camera-note">기존 필터의 입자 처리를 그대로 사용해요. 새 필름 조절값은 보관하지만 적용하지 않아요.</p>}
    </fieldset>
    {onCompare && <button disabled={locked || s.model !== 'film-v2'} onClick={onCompare}>질감 비교</button>}
  </div>;
}
