// View preferences (script, what cards show, masks), remembered in localStorage.

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

/** The boolean switches among the preferences. */
export type BoolPref = { [K in keyof ViewPrefs]: ViewPrefs[K] extends boolean ? K : never }[keyof ViewPrefs];

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
