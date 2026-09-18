import { useCallback, useEffect, useRef, useState } from 'react';

export type Facing = 'user' | 'environment';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [backCams, setBackCams] = useState<number | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    setReady(false);
    setError(null);
    setZoomCaps(null);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('카메라를 사용할 수 없습니다. HTTPS 또는 localhost 환경이 필요합니다.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 4032 },
            height: { ideal: 3024 },
            aspectRatio: { ideal: 4 / 3 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities() as MediaTrackCapabilities & {
          zoom?: { min: number; max: number; step: number };
        };
        setTorchOk(!!(caps as { torch?: boolean }).torch);
        setTorchOn(false);
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomCaps(caps.zoom);
          const cur = (track.getSettings() as { zoom?: number }).zoom;
          setZoomState(cur ?? caps.zoom.min);
        } else {
          setZoomState(1);
        }
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          const vids = devs.filter((d) => d.kind === 'videoinput');
          let n: number | null = null;
          if (vids.length) {
            if (vids.every((d) => !d.label)) {
              n = Math.max(0, vids.length - 1);
            } else {
              const fronts = vids.filter((d) =>
                /front|user|selfie|avant|vorder|전면|フロント|facetime/i.test(d.label),
              );
              n = vids.filter(
                (d) => !fronts.includes(d) && !/desk|continuity/i.test(d.label),
              ).length;
            }
          }
          if (!cancelled) setBackCams(n);
        } catch {
          /* lens enumeration unavailable */
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? '카메라 권한이 거부되었습니다. 설정에서 허용해주세요.'
              : '카메라를 시작할 수 없습니다.',
          );
      }
    }
    start();

    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const v = videoRef.current;
      const dead = !stream || stream.getTracks().every((t) => t.readyState === 'ended');
      const stalled = !!v && v.readyState < 2;
      if (dead || stalled) setNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, nonce]);

  const onLoaded = useCallback(() => {
    const v = videoRef.current;
    if (v && v.videoWidth) setSize({ w: v.videoWidth, h: v.videoHeight });
    setReady(true);
  }, []);
  const flip = useCallback(() => setFacing((f) => (f === 'user' ? 'environment' : 'user')), []);

  const setZoom = useCallback(
    async (v: number) => {
      const t = trackRef.current;
      if (!t || !zoomCaps) return;
      const clamped = Math.min(zoomCaps.max, Math.max(zoomCaps.min, v));
      try {
        await t.applyConstraints({
          advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
        });
        setZoomState(clamped);
      } catch {
        /* zoom not applicable */
      }
    },
    [zoomCaps],
  );

  const setTorch = useCallback(async (on: boolean) => {
    const t = trackRef.current;
    if (!t || !torchOk) return;
    try {
      await t.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
      setTorchOn(on);
    } catch {
      /* torch not applicable */
    }
  }, [torchOk]);

  return { videoRef, facing, ready, error, flip, onLoaded, size, zoomCaps, zoom, setZoom, backCams, torchOk, torchOn, setTorch };
}
