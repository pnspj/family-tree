// Hooks that connect the app to the browser (storage, URL hash, document events).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FamilyFile } from '../core/types';
import { loadPrefs, savePrefs, type ViewPrefs } from '../prefs';
import { loadFile, saveFile } from '../storage';

/** Loads the stored family once `enabled`, then saves every change (debounced). */
export function useStoredFile(
  file: FamilyFile | null | undefined,
  enabled: boolean,
  onLoaded: (f: FamilyFile | null) => void,
  onSaveError: () => void,
) {
  useEffect(() => {
    if (enabled) loadFile().then((f) => onLoaded(f ?? null));
  }, [enabled]);
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => saveFile(file).catch(onSaveError), 400);
    return () => clearTimeout(t);
  }, [file]);
}

/** View preferences; every change is remembered right away. */
export function usePrefs(): [ViewPrefs, (patch: Partial<ViewPrefs>) => void] {
  const [prefs, setPrefs] = useState(loadPrefs);
  const update = (patch: Partial<ViewPrefs>) => {
    const next = { ...prefs, ...patch };
    savePrefs(next);
    setPrefs(next);
  };
  return [prefs, update];
}

/**
 * A page shown while the URL hash is `#name`, so the browser's back button closes it.
 * Closing goes back in history when the page was opened from the app, and otherwise (a direct
 * link) just drops the hash.
 */
export function useHashPage(name: string) {
  const hash = `#${name}`;
  const [open, setOpen] = useState(() => location.hash === hash);
  const fromApp = useRef(false);
  useEffect(() => {
    const onHash = () => setOpen(location.hash === hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const show = () => {
    fromApp.current = true;
    location.hash = name;
  };
  const close = () => {
    if (fromApp.current) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      setOpen(false);
    }
    fromApp.current = false;
  };
  return { open, show, close };
}

/** While `active`, a pointer press outside `root` or the Escape key calls `onDismiss`. */
export function useDismiss(root: { current: HTMLElement | null }, active: boolean, onDismiss: (how: 'outside' | 'escape') => void) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onDismiss('outside');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss('escape');
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}
