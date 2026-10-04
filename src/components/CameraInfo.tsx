import { useEffect, useState } from 'react';
import type { CameraInfoSnapshot } from '../camera/useCamera';

export function CameraInfo({ read, ready, zoom }: { read: () => CameraInfoSnapshot | null; ready: boolean; zoom: number }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<CameraInfoSnapshot | null>(null);
  useEffect(() => { if (open) setInfo(read()); }, [open, read, ready, zoom]);
  const facing = info?.facing === 'user' ? '전면' : info?.facing === 'environment' ? '후면' : null;
  return <details className="camera-info" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>카메라 정보</summary>
    <div className="camera-info-report" role="status">
      {info ? <>
        <p>{facing ?? `${info.requestedFacing === 'user' ? '전면' : '후면'} 요청 · 실제 방향 미제공`}
          {info.width !== null && info.height !== null && <> · {info.width}×{info.height}</>}</p>
        <p>웹 줌: {info.zoomRange ? `${info.zoomRange.min}–${info.zoomRange.max}` : '범위 미제공'}<br />
          현재 값 {info.zoom ?? '미제공'}</p>
        <p className="camera-info-note">웹 줌 값은 기본 카메라의 배율 표시와 다를 수 있어요. 범위가 제공되지 않으면 0.5배 전환을 보장할 수 없습니다.</p>
      </> : <p>카메라 정보가 아직 준비되지 않았어요.</p>}
    </div>
  </details>;
}
