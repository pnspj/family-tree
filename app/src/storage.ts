// Browser-only persistence: the family file in IndexedDB, view preferences in localStorage.
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
export const clearFile = () => tx('readwrite', (s) => s.delete(KEY));

export interface ViewPrefs {
  kana: boolean;
  showKinship: boolean;
  showLife: boolean;
  genderColor: boolean;
  pathFallback: boolean;
  showSide: boolean;
  preferNickname: boolean;
}

export const DEFAULT_PREFS: ViewPrefs = {
  kana: false,
  showKinship: true,
  showLife: true,
  genderColor: true,
  pathFallback: true,
  showSide: false,
  preferNickname: false,
};

const PREFS_KEY = 'family-tree:prefs';

export function loadPrefs(): ViewPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: ViewPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable (private mode etc.): preferences just aren't remembered
  }
}

/** Triggers a browser download of the file as JSON. */
export function downloadJson(file: FamilyFile) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = `family-tree-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
