import { useEffect, useRef, useState } from 'react';
import { renderFilteredCanvas } from '../engine/pipeline';
import type { RenderLook } from '../engine/look';
import type { FilterParams, FxSpec, LutData } from '../engine/types';

export function LensComparison({ source, params, lut, lutKey, amount, fx, look, ready }: { source: HTMLCanvasElement | null; params: FilterParams; lut: LutData | null; lutKey: string | null; amount: number; fx: FxSpec | null; look: RenderLook; ready: boolean }) {
  const base = useRef<HTMLCanvasElement>(null), effect = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('비교 준비 중…');
  const label = look.lens === 'star' ? '빛줄기' : '가장자리 굴절';
  useEffect(() => {
    let live = true;
    setStatus('비교 준비 중…');
    if (!source || !ready) return;
    void Promise.all([renderFilteredCanvas(source, params, lutKey, lut, amount, false, null, fx, undefined, undefined, undefined, undefined, undefined, { ...look, lens: 'none' }), renderFilteredCanvas(source, params, lutKey, lut, amount, false, null, fx, undefined, undefined, undefined, undefined, undefined, look)]).then((results) => {
      if (!live) return;
      [base.current, effect.current].forEach((canvas, i) => { if (canvas) { canvas.width = results[i].width; canvas.height = results[i].height; canvas.getContext('2d')!.drawImage(results[i], 0, 0); } });
      setStatus('');
    }).catch(() => { if (live) setStatus('비교를 불러오지 못했습니다. 창을 닫고 다시 열어주세요.'); });
    return () => { live = false; };
  }, [source, params, lut, lutKey, amount, fx, look.lens, look.lensAmount, look.gentle, ready]);
  if (!source) return <p className="camera-note">카메라가 준비되면 창을 다시 열어 같은 장면으로 비교할 수 있어요.</p>;
  return <><div className="lens-comparison" hidden={!!status}><figure><canvas ref={base} aria-label="렌즈 없음 비교" /><figcaption>렌즈 없음</figcaption></figure><figure><canvas ref={effect} aria-label={`${label} 비교`} /><figcaption>{label}</figcaption></figure></div>{status && <p className="camera-note" role="status">{status}</p>}<p className="camera-note">같은 장면을 멈춰 렌즈 효과만 비교합니다.</p></>;
}
