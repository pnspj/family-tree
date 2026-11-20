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

export type Script = 'kanji' | 'furigana' | 'kana';

export interface ViewPrefs {
  script: Script;
  maskName: boolean;
  maskKinship: boolean;
  showKinship: boolean;
  showLife: boolean;
  genderColor: boolean;
  pathFallback: boolean;
  showSide: boolean;
  preferNickname: boolean;
  showBirthName: boolean;
}

export const DEFAULT_PREFS: ViewPrefs = {
  script: 'kanji',
  maskName: false,
  maskKinship: false,
  showKinship: true,
  showLife: true,
  genderColor: true,
  pathFallback: true,
  showSide: false,
  preferNickname: false,
  showBirthName: false,
};

const PREFS_KEY = 'family-tree:prefs';

export function loadPrefs(): ViewPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    // v1 stored a boolean `kana` instead of `script`
    if (typeof saved.kana === 'boolean' && !saved.script) saved.script = saved.kana ? 'kana' : 'kanji';
    delete saved.kana;
    return { ...DEFAULT_PREFS, ...saved };
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
