import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureRecord } from '../capture/types';
import { loadSample, readSamplePreference, SAMPLES, writeSamplePreference, type SampleId } from './samples';
import { capturePreviewSource, clonePreviewSource, freezePreviewSource, samplePreviewSource, type PreviewSource } from './source';

interface PreviewContext { getCameraSource(): TexImageSource | null; cameraRatio: { w: number; h: number }; cameraMirror: boolean; sceneAvailable: boolean; editSource: TexImageSource | null; editToken: number; reprocessRecord: CaptureRecord | null }
type Selection = { kind: 'sample'; id: SampleId } | { kind: 'scene' } | { kind: 'import' } | { kind: 'capture'; record: CaptureRecord; index: number };
export function usePreviewSource(context: PreviewContext) {
  const ctx = useRef(context); ctx.current = context;
  const [sampleId, setSampleId] = useState(readSamplePreference);
  const selection = useRef<Selection>({ kind: 'sample', id: sampleId });
  const [sourceKind, setKind] = useState<PreviewSource['kind']>('sample');
  const [thumbnailSource, setThumbnail] = useState<TexImageSource | null>(null);
  const [sourceKey, setKey] = useState('loading');
  const [activeCapture, setCapture] = useState<CaptureRecord | null>(null);
  const [captureIndex, setIndex] = useState(0);
  const [busy, setBusy] = useState(true); const [error, setError] = useState<string | null>(null);
  const owned = useRef<PreviewSource | null>(null); const generation = useRef(0);
  const status = useRef({ busy: true, error: null as string | null });
  const select = useCallback(async (next: Selection) => {
    const token = ++generation.current; selection.current = next; setKind(next.kind); setBusy(true); setError(null);
    status.current = { busy: true, error: null };
    if (next.kind === 'sample') { setSampleId(next.id); writeSamplePreference(next.id); }
    setCapture(next.kind === 'capture' ? next.record : null); setIndex(next.kind === 'capture' ? next.index : 0);
    let frozen: PreviewSource | null = null;
    try {
      let input: TexImageSource;
      if (next.kind === 'sample') input = await loadSample(next.id);
      else {
        if (next.kind === 'capture') frozen = await capturePreviewSource(next.record, next.index);
        else {
          const source = next.kind === 'scene' ? ctx.current.getCameraSource() : ctx.current.reprocessRecord ? null : ctx.current.editSource;
          if (!source) throw new Error('비교할 사진이 준비되지 않았어요.');
          frozen = freezePreviewSource({ source, kind: next.kind, label: next.kind === 'scene' ? '현재 장면' : '편집 사진', ratio: next.kind === 'scene' ? ctx.current.cameraRatio : null, mirror: next.kind === 'scene' && ctx.current.cameraMirror });
        }
        input = frozen.canvas;
      }
      if (token !== generation.current) { frozen?.release(); return; }
      const previous = owned.current; owned.current = frozen; setThumbnail(input);
      setKey(frozen?.key ?? `sample-${(next as { id: SampleId }).id}-${SAMPLES.find((s) => s.id === (next as { id: SampleId }).id)?.version}`);
      previous?.release();
    } catch (e) { frozen?.release(); if (token === generation.current) { const message = e instanceof Error ? e.message : '사진을 불러오지 못했어요.'; status.current.error = message; setError(message); } }
    finally { if (token === generation.current) { status.current.busy = false; setBusy(false); } }
  }, []);
  const release = useCallback(() => { generation.current++; owned.current?.release(); owned.current = null; }, []);
  useEffect(() => {
    if (context.reprocessRecord) void select({ kind: 'capture', record: context.reprocessRecord, index: 0 });
    else if (context.editSource) void select({ kind: 'import' });
    else void select({ kind: 'sample', id: selection.current.kind === 'sample' ? selection.current.id : readSamplePreference() });
    // Edit token changes only when a new input is installed, not on color edits.
  }, [context.editToken, context.reprocessRecord?.id, !!context.editSource, select]);
  useEffect(() => release, [release]);
  const prepareComparison = async () => {
    if (status.current.busy || status.current.error) throw new Error(status.current.error ?? '사진을 준비하고 있어요.');
    const token = generation.current;
    const result = selection.current.kind === 'sample' ? await samplePreviewSource(selection.current.id) : owned.current ? clonePreviewSource(owned.current) : null;
    if (!result) throw new Error('비교할 원본이 없어요.');
    if (token !== generation.current) { result.release(); throw new Error('사진 선택이 바뀌었어요. 다시 비교해주세요.'); }
    return result;
  };
  return { sampleId, sourceKind, thumbnailSource, sourceKey, activeCapture, captureIndex, busy, error,
    selectSample: (id: SampleId) => select({ kind: 'sample', id }), selectScene: () => select({ kind: 'scene' }), selectImport: () => select({ kind: 'import' }),
    selectCapture: (record: CaptureRecord, index: number) => select({ kind: 'capture', record, index }), prepareComparison, retry: () => select(selection.current), release };
}
