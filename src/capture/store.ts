import type { CaptureRecord } from './types';

const LIMIT = 50 * 1024 * 1024;
let pending: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const request = indexedDB.open('oc-captures', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('captures', { keyPath: 'id' });
    request.onerror = () => { pending = null; reject(request.error); };
    request.onblocked = () => { pending = null; reject(new Error('사진 보관함이 다른 창에서 사용 중입니다')); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); pending = null; };
      resolve(db);
    };
  });
  return pending;
}
function bytes(record: CaptureRecord) { return record.blob.size + record.originals.reduce((sum, b) => sum + b.size, 0); }
export async function saveCapture(record: CaptureRecord): Promise<void> {
  if (bytes(record) > LIMIT) throw new Error('사진과 원본이 보관 한도 50 MB를 초과합니다');
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('captures', 'readwrite');
    const store = tx.objectStore('captures');
    store.put(record);
    const all = store.getAll();
    all.onsuccess = () => {
      const rows = (all.result as CaptureRecord[]).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
      let total = rows.reduce((sum, r) => sum + bytes(r), 0);
      while (rows.length > 10 || total > LIMIT) {
        const oldest = rows.pop()!;
        total -= bytes(oldest);
        store.delete(oldest.id);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('사진을 기기에 보관하지 못했습니다'));
  });
}
export async function listCaptures(): Promise<CaptureRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('captures', 'readonly');
    const all = tx.objectStore('captures').getAll();
    tx.oncomplete = () => resolve((all.result as CaptureRecord[]).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).map((r) => ({ ...r, persisted: true })));
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('사진 보관함을 열지 못했습니다'));
  });
}
export async function deleteCapture(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('captures', 'readwrite');
    tx.objectStore('captures').delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('사진을 삭제하지 못했습니다'));
  });
}
