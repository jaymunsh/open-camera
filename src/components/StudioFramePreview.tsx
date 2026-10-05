import { useEffect, useRef, useState } from 'react';
import { composeFrames, drawCompositionDate, snapshotFrame } from '../capture/composite';
import type { CapturedFrame, CompositionOptions } from '../capture/types';
import type { RenderLook } from '../engine/look';
import { renderFilteredCanvas, type DateStampOptions } from '../engine/pipeline';
import type { FilterParams, FxSpec, LutData } from '../engine/types';
import { getSampleImage } from './thumbs';
import type { BeautyParams } from './BeautyPanel';

export interface StudioCaptureInputs {
  mirror: boolean; mask: HTMLCanvasElement | null; beauty: BeautyParams;
  warp: Float32Array | HTMLCanvasElement | null; eyes: { x: number; y: number; r: number }[];
}

export function StudioFramePreview({ source, frames, options, ratio, mode = 'booth', params, lut, lutKey, amount, fx, look, ready, date, inputs }: {
  source: HTMLCanvasElement | null; frames: CapturedFrame[]; options: CompositionOptions; ratio: { w: number; h: number };
  params: FilterParams; lut: LutData | null; lutKey: string | null; amount: number; fx: FxSpec | null; look: RenderLook; ready: boolean;
  mode?: 'booth' | 'instant';
  date?: DateStampOptions;
  inputs?: StudioCaptureInputs;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('미리보기 준비 중…');
  useEffect(() => {
    let live = true;
    setScene(null); setStatus('미리보기 준비 중…');
    const prepare = async () => {
      const frozen = source ?? snapshotFrame(await getSampleImage(), null, false, 768);
      const capture = source ? inputs : undefined;
      const result = ready ? await renderFilteredCanvas(frozen, params, lutKey, lut, amount, capture?.mirror ?? false, ratio, fx, capture?.mask, capture?.beauty, capture?.warp, capture?.eyes, undefined, look) : snapshotFrame(frozen, ratio, capture?.mirror);
      if (live) setScene(result);
    };
    void prepare().catch(() => { if (live) setStatus('미리보기를 불러오지 못했어요. 스튜디오를 닫고 다시 열어주세요.'); });
    return () => { live = false; };
  }, [source, params, lut, lutKey, amount, fx, look.lens, look.lensAmount, look.gentle, ready, ratio.w, ratio.h, inputs]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !scene) return;
    let live = true;
    setStatus('미리보기 준비 중…');
    const snapshot = snapshotFrame(scene, ratio, false, 512);
    const images = Array.from({ length: mode === 'instant' ? 1 : 4 }, (_, i) => frames[i]?.canvas ?? snapshot);
    const composed = composeFrames(images, mode, options);
    const prepare = async () => {
      if (date) await drawCompositionDate(composed, images, mode, options, date);
      if (live) { c.width = composed.width; c.height = composed.height; c.getContext('2d')!.drawImage(composed, 0, 0); setStatus(''); }
    };
    void prepare().catch(() => { if (live) setStatus('미리보기를 불러오지 못했어요. 스튜디오를 닫고 다시 열어주세요.'); });
    return () => { live = false; };
  }, [scene, frames, options, ratio.w, ratio.h, mode, date?.on, date?.fmt, date?.size, date?.orient, date?.style, date?.timestamp]);
  return <figure className="studio-frame-preview">
    <div className="studio-preview-stage"><canvas ref={ref} role="img" aria-label="스튜디오 프레임 미리보기" hidden={!!status} />
      {status && <p className="camera-note" role="status">{status}</p>}
    </div>
    <figcaption>{source ? frames.length ? '찍은 컷은 유지하고, 남은 칸은 현재 장면으로 미리 봐요.' : mode === 'instant' ? '현재 장면 · 한 장의 즉석사진으로 저장해요.' : '현재 장면 · 같은 사진으로 네 컷의 배치를 미리 봐요.' : '예시 사진 · 촬영 결과는 선택한 필터에 따라 달라져요.'}</figcaption>
  </figure>;
}
