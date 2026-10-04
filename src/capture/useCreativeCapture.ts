import { useCallback, useEffect, useRef, useState } from 'react';
import { drawDateStamp } from '../engine/pipeline';
import { saveImage } from '../utils/share';
import { timestampName } from '../utils/image';
import { canvasBlob, composeFrames } from './composite';
import { deleteCapture, listCaptures, saveCapture } from './store';
import { DEFAULT_COMPOSITION, type CaptureMode, type CapturedFrame, type CaptureRecord } from './types';

function recent(rows: CaptureRecord[]) {
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()].sort((a, b) => b.createdAt - a.createdAt);
  return unique.slice(0, 10);
}
export function useCreativeCapture(captureFrame: () => Promise<CapturedFrame>, onError: (message: string) => void) {
  const [mode, setModeState] = useState<CaptureMode>('normal');
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [review, setReview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [records, setRecords] = useState<CaptureRecord[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [options, setOptions] = useState(DEFAULT_COMPOSITION);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [prepared, setPrepared] = useState<{ blob: Blob; width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null);
  const generation = useRef(0);
  const lock = useRef(false);
  const remembered = useRef<{ blob: Blob; name: string } | null>(null);
  const deleted = useRef(new Set<string>());
  const input = useRef(captureFrame); input.current = captureFrame;
  const report = useRef(onError); report.current = onError;
  const target = mode === 'booth' ? 4 : 2;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => {
    let live = true;
    void listCaptures().then((rows) => { if (live) setRecords((current) => recent([...rows.filter((r) => !deleted.current.has(r.id) && !current.some((v) => v.id === r.id)), ...current])); }).catch(() => { if (live) setWarning('기기 보관함을 사용할 수 없습니다. 촬영은 계속 가능하며 이번 세션에서만 확인할 수 있습니다.'); });
    return () => { live = false; };
  }, []);
  const remember = useCallback(async (record: CaptureRecord, originals?: Promise<Blob[]>) => {
    setRecords((rows) => recent([{ ...record, persisted: false }, ...rows]));
    let next = record;
    if (originals) {
      try { next = { ...record, originals: await originals }; }
      catch { setWarning('완성 사진은 보관했지만 원본을 만들지 못해 다시 현상할 수 없습니다.'); }
    }
    if (!mounted.current || deleted.current.has(record.id)) return;
    try {
      await saveCapture(next);
      if (deleted.current.has(next.id)) { await deleteCapture(next.id); return; }
      if (mounted.current) { const saved = await listCaptures(); setRecords((rows) => recent([...saved.filter((r) => !deleted.current.has(r.id)), ...rows.filter((r) => r.persisted === false && r.id !== next.id)])); }
    } catch {
      if (mounted.current) { setRecords((rows) => rows.map((r) => r.id === next.id ? { ...next, persisted: false } : r)); setWarning('기기에 보관하지 못했습니다. 이번 세션에서만 확인할 수 있습니다. 사진을 직접 공유 / 저장해주세요.'); }
    }
  }, []);
  const remove = async (record: CaptureRecord) => {
    deleted.current.add(record.id);
    try { await deleteCapture(record.id); }
    catch (e) { if (record.persisted !== false) { deleted.current.delete(record.id); throw e; } }
    setRecords((rows) => rows.filter((r) => r.id !== record.id));
  };
  const cancel = useCallback(() => { generation.current++; remembered.current = null; setFrames([]); setReview(false); setPrepared(null); setPreview(null); setFailure(null); setRetakeIndex(null); setPaused(false); setCountdown(null); }, []);
  const pause = () => { if (mode === 'booth' && frames.length > 0) { setPaused(true); setCountdown(null); } };
  const changeMode = (next: CaptureMode) => {
    if (next === mode) return;
    if (frames.length && !window.confirm('진행 중인 촬영을 버리고 모드를 바꿀까요?')) return;
    cancel(); setModeState(next); setOptions(DEFAULT_COMPOSITION);
  };
  const shoot = useCallback(async () => {
    if (lock.current || document.hidden || mode === 'normal' || review) return;
    lock.current = true; setWorking(true); setCountdown(null);
    const token = generation.current;
    try {
      const frame = await input.current();
      if (token !== generation.current || !mounted.current) return;
      const next = [...frames];
      if (retakeIndex !== null) { frame.createdAt = next[retakeIndex].createdAt; next[retakeIndex] = frame; setRetakeIndex(null); }
      else next.push(frame);
      setFrames(next);
      if (next.length === target) { setReview(true); setPrepared(null); }
    } catch (e) { if (token === generation.current) { report.current(e instanceof Error ? e.message : '촬영에 실패했습니다. 다시 시도해주세요.'); setPaused(true); } }
    finally { lock.current = false; if (mounted.current) setWorking(false); }
  }, [frames, mode, retakeIndex, review, target]);
  const shootRef = useRef(shoot); shootRef.current = shoot;
  useEffect(() => {
    if (mode !== 'booth' || !frames.length || frames.length >= 4 || working || paused || review || retakeIndex !== null || historyOpen) return;
    let n = 3; setCountdown(n);
    const iv = window.setInterval(() => { n--; setCountdown(n || null); if (n <= 0) { clearInterval(iv); void shootRef.current(); } }, 1000);
    return () => { clearInterval(iv); setCountdown(null); };
  }, [frames.length, mode, paused, working, review, retakeIndex, historyOpen]);
  useEffect(() => {
    const hide = () => { if (document.hidden && mode === 'booth') { setPaused(true); setCountdown(null); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [mode]);
  useEffect(() => {
    if (!review || frames.length !== target || mode === 'normal') return;
    let live = true; setPrepared(null); setFailure(null);
    const make = async () => {
      const canvas = composeFrames(frames.map((f) => f.canvas), mode, options);
      const last = frames.at(-1)!;
      const d = last.settings.date;
      await drawDateStamp(canvas, { on: d.mode === 'on' || (d.mode === 'auto' && !!last.fx?.date), ...d, timestamp: last.createdAt });
      const blob = await canvasBlob(canvas);
      if (live) { setPreview(canvas); setPrepared({ blob, width: canvas.width, height: canvas.height }); }
    };
    void make().catch((e) => { if (live) setFailure(e instanceof Error ? e.message : '합성에 실패했습니다'); });
    return () => { live = false; };
  }, [review, frames, options, target, mode]);
  const retake = (index: number) => { setRetakeIndex(index); setReview(false); setPrepared(null); setPaused(true); };
  const saveReview = async () => {
    if (!prepared || working || lock.current) return;
    lock.current = true; setWorking(true);
    const last = frames.at(-1)!;
    if (remembered.current?.blob !== prepared.blob) {
      const record: CaptureRecord = { id: crypto.randomUUID(), createdAt: last.createdAt, blob: prepared.blob, name: timestampName(), width: prepared.width, height: prepared.height, mode, originals: [], settings: last.settings, frameSettings: frames.map((f) => f.settings), composition: options };
      const originals = frames.every((f) => f.original) ? Promise.all(frames.map((f) => canvasBlob(f.original!))) : undefined;
      remembered.current = { blob: prepared.blob, name: record.name };
      void remember(record, originals);
    }
    setFailure(null);
    try { const result = await saveImage(prepared.blob, remembered.current.name); if (result !== 'aborted') cancel(); }
    catch (e) { setFailure(e instanceof Error ? e.message : '저장에 실패했습니다'); }
    finally { lock.current = false; setWorking(false); }
  };
  return { mode, changeMode, frames, review, historyOpen, setHistoryOpen, records, warning, failure, working, options, setOptions, countdown, paused, pause, resume: () => setPaused(false), retakeIndex, prepared, preview, remember, remove, cancel, shoot, retake, saveReview,
    locked: mode === 'booth' && frames.length > 0 && !review,
    nextIndex: retakeIndex === null ? frames.length : retakeIndex,
    target,
  };
}
