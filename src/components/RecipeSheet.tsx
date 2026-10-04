import { useState } from 'react';
import { readRecipes, writeRecipes, type Recipe } from '../capture/recipes';
import type { CameraSettings } from '../capture/types';
import { CameraDialog } from './CameraDialog';

export function RecipeSheet({ settings, onApply, onClose }: { settings: CameraSettings; onApply: (s: CameraSettings) => Promise<void>; onClose: () => void }) {
  const [initial] = useState(() => { try { return { rows: readRecipes(), failed: false }; } catch { return { rows: [] as Recipe[], failed: true }; } });
  const [unreadable, setUnreadable] = useState(initial.failed);
  const [error, setError] = useState<string | null>(initial.failed ? '저장된 레시피를 읽을 수 없습니다. 기존 데이터는 변경하지 않았습니다.' : null);
  const [rows, setRows] = useState<Recipe[]>(initial.rows);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (next: Recipe[]) => { try { writeRecipes(next); setRows(next); setError(null); } catch (e) { setError((e as Error).message); } };
  return <CameraDialog title="카메라 레시피" onClose={onClose} busy={busy}>
    <p className="camera-note">필터·보정·날짜·렌즈·비율을 함께 저장합니다. 사진과 사용자 LUT 파일은 포함하지 않습니다.</p>
    <label className="camera-field">레시피 이름<input aria-label="레시피 이름" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 빨간 날짜 여행용" /></label>
    <button className="camera-primary" disabled={unreadable || !name.trim() || busy || rows.length >= 20} onClick={() => { const next = [{ version: 1 as const, id: crypto.randomUUID(), name: name.trim(), settings: structuredClone(settings) }, ...rows]; change(next); }}>현재 설정 저장</button>
    {error && <p role="alert" className="camera-warning">{error}</p>}
    {unreadable && <button onClick={() => { if (!window.confirm('읽을 수 없는 레시피 데이터를 지우고 새로 시작할까요?')) return; try { writeRecipes([]); setUnreadable(false); setError(null); } catch { setError('레시피 저장 공간을 사용할 수 없습니다.'); } }}>레시피 초기화</button>}
    <div className="recipe-list">{rows.map((r) => <div className="recipe-row" key={r.id}>
      <button disabled={busy} aria-label={`${r.name} 적용`} onClick={async () => { setBusy(true); setError(null); try { await onApply(r.settings); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{r.name}<span>적용</span></button>
      <button disabled={busy} aria-label={`${r.name} 이름 변경`} onClick={() => { const renamed = window.prompt('레시피 이름', r.name); if (renamed !== null) change(rows.map((v) => v.id === r.id ? { ...v, name: renamed.trim() } : v)); }}>이름 변경</button>
      <button disabled={busy} aria-label={`${r.name} 삭제`} onClick={() => change(rows.filter((v) => v.id !== r.id))}>삭제</button>
    </div>)}</div>
    {!rows.length && <p className="camera-empty">자주 쓰는 설정을 첫 레시피로 저장해보세요.</p>}
  </CameraDialog>;
}
