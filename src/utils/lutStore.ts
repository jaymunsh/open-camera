const DB_NAME = 'oc-store';
const STORE = 'lut-files';

let dbp: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => {
        r.result.onversionchange = () => {
          r.result.close();
          dbp = null;
        };
        res(r.result);
      };
      r.onerror = () => rej(r.error);
    }).catch((e) => {
      dbp = null;
      throw e;
    });
  }
  return dbp;
}

export async function idbGet(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result ?? null);
      q.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function idbPut(key: string, val: ArrayBuffer): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => res();
    tx.onabort = () => rej(tx.error ?? new Error('LUT 저장이 취소되었습니다'));
    tx.onerror = () => rej(tx.error ?? new Error('LUT를 저장할 수 없습니다'));
    tx.objectStore(STORE).put(val, key);
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => res();
    tx.onabort = () => rej(tx.error ?? new Error('LUT 삭제가 취소되었습니다'));
    tx.onerror = () => rej(tx.error ?? new Error('LUT를 삭제할 수 없습니다'));
    tx.objectStore(STORE).delete(key);
  });
}
