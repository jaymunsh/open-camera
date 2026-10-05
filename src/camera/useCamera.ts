import { useCallback, useEffect, useRef, useState } from 'react';

export type Facing = 'user' | 'environment';
export type CameraInfoSnapshot = {
  requestedFacing: Facing; facing: string | null; width: number | null; height: number | null;
  zoomRange: { min: number; max: number } | null; zoom: number | null;
};

export function useCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const resumeZoomRef = useRef<number | null>(null);
  const actualZoomRef = useRef<{ track: MediaStreamTrack; value: number | null } | null>(null);
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
    let suspended = false;
    let recoveryQueued = false;
    const resumeZoom = facing === 'user' ? resumeZoomRef.current : null;
    resumeZoomRef.current = null;
    setReady(false);
    setError(null);
    setZoomCaps(null);
    setTorchOk(false);
    setTorchOn(false);
    trackRef.current = null;
    if (!enabled) return;

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
        if (cancelled || suspended) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // loadeddata can mark the camera ready before play() resolves.
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities() as MediaTrackCapabilities & {
          zoom?: { min: number; max: number; step: number };
        };
        // Match the working raw-video probe: native minimum means widest, not
        // necessarily web zoom 0.5 or 1. Restore only a previously read value.
        if (facing === 'user' && caps.zoom && Number.isFinite(caps.zoom.min)
          && caps.zoom.min > 0 && caps.zoom.max >= caps.zoom.min) {
          const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, resumeZoom ?? caps.zoom.min));
          try { await track.applyConstraints({ advanced: [{ zoom: target } as MediaTrackConstraintSet] }); }
          catch { /* Optional zoom support is not guaranteed; read back below. */ }
        }
        if (cancelled || suspended) return;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        if (cancelled || suspended) return;
        const cur = (track.getSettings() as { zoom?: number }).zoom;
        actualZoomRef.current = { track, value: typeof cur === 'number' && Number.isFinite(cur) ? cur : null };
        setTorchOk(!!(caps as { torch?: boolean }).torch);
        setTorchOn(false);
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomCaps(caps.zoom);
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
        if (!cancelled && !suspended)
          setError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? '카메라 권한이 거부되었습니다. 설정에서 허용해주세요.'
              : '카메라를 시작할 수 없습니다.',
          );
      }
    }
    const suspendSelfie = () => {
      if (cancelled || facing !== 'user' || suspended) return;
      suspended = true;
      const track = trackRef.current;
      resumeZoomRef.current = track && actualZoomRef.current?.track === track
        ? actualZoomRef.current.value : resumeZoom;
      setReady(false);
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      const v = videoRef.current;
      if (v?.srcObject === stream) { v.pause(); v.srcObject = null; }
    };
    const resume = () => {
      if (cancelled || recoveryQueued || document.visibilityState !== 'visible') return;
      // A live/ready Safari track can still resume with different framing.
      // Recreate the selfie session just as the isolated probe does.
      if (suspended) { recoveryQueued = true; setNonce((n) => n + 1); return; }
      const v = videoRef.current;
      const dead = !stream || stream.getTracks().every((t) => t.readyState === 'ended');
      const stalled = !!v && v.readyState < 2;
      if (dead || stalled) setNonce((n) => n + 1);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') suspendSelfie();
      else resume();
    };
    const onPageShow = () => { if (suspended) resume(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', suspendSelfie);
    window.addEventListener('pageshow', onPageShow);
    // A queued recovery can render after the page was hidden again. Preserve
    // its zoom snapshot and wait for visibility instead of starting in background.
    if (facing === 'user' && document.visibilityState === 'hidden') suspendSelfie();
    else start();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', suspendSelfie);
      window.removeEventListener('pageshow', onPageShow);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      const v = videoRef.current;
      if (v?.srcObject === stream) {
        v.pause();
        v.srcObject = null;
      }
    };
  }, [enabled, facing, nonce]);

  const onLoaded = useCallback(() => {
    // Selfie suspension clears the active track. A rear stream can load while
    // hidden and must remain ready when its live stream is reused on return.
    if (!enabled || !trackRef.current) return;
    const v = videoRef.current;
    if (v && v.videoWidth) setSize({ w: v.videoWidth, h: v.videoHeight });
    setReady(true);
  }, [enabled]);
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
        // Optional constraints may succeed without being applied. Display readback,
        // not the requested number, and ignore an old track after camera switching.
        const actual = (t.getSettings() as { zoom?: number }).zoom;
        if (trackRef.current === t && typeof actual === 'number' && Number.isFinite(actual)) {
          actualZoomRef.current = { track: t, value: actual };
          setZoomState(actual);
        }
      } catch {
        /* zoom not applicable */
      }
    },
    [zoomCaps],
  );

  const inspectCamera = useCallback((): CameraInfoSnapshot | null => {
    const track = trackRef.current;
    if (!track || track.readyState !== 'live') return null;
    try {
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min?: number; max?: number } };
      const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
      const min = number(caps.zoom?.min), max = number(caps.zoom?.max);
      return {
        requestedFacing: facing, facing: settings.facingMode ?? null,
        width: number(settings.width), height: number(settings.height), zoom: number(settings.zoom),
        zoomRange: min !== null && max !== null && min > 0 && max >= min ? { min, max } : null,
      };
    } catch { return null; }
  }, [facing]);

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

  return { videoRef, facing, ready, error, flip, onLoaded, size, zoomCaps, zoom, setZoom, inspectCamera, backCams, torchOk, torchOn, setTorch };
}
