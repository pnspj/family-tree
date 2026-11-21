// Browser-only persistence of the family file (IndexedDB) and file downloads.
import type { FamilyFile } from './core/types';

const DB_NAME = 'family-tree';
const STORE = 'files';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadFile(): Promise<FamilyFile | undefined> {
  try {
    return (await tx('readonly', (s) => s.get(KEY))) as FamilyFile | undefined;
  } catch {
    return undefined;
  }
}

export const saveFile = (file: FamilyFile) => tx('readwrite', (s) => s.put(file, KEY));

/** Triggers a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Triggers a browser download of the file as JSON. */
export function downloadJson(file: FamilyFile) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  downloadBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), `family-tree-${stamp}.json`);
}
