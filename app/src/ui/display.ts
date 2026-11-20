// Text helpers for showing people on cards and dialogs.
import { isDeceased, yearsBetween } from '../core/date';
import type { Kinship } from '../core/kinship';
import type { PartialDate, Person } from '../core/types';
import type { Script, ViewPrefs } from '../storage';

const join = (a?: string, b?: string) => [a, b].filter(Boolean).join(' ');
const esc = (s: string) => s.replace(/[{}|]/g, '');
const ruby = (base?: string, reading?: string) => (base ? (reading ? `{${esc(base)}|${esc(reading)}}` : esc(base)) : '');

export const isKana = (p: { script: Script }) => p.script === 'kana';

const parts = (...xs: (string | undefined)[]) => xs.map((x) => (x ? esc(x) : '')).filter(Boolean);
/** Splits free text at the first space: "しずおかの ばあば" -> two parts. */
const splitFirstSpace = (s: string) => {
  const m = esc(s).trim().match(/^(\S+)\s+(.+)$/);
  return m ? [m[1], m[2]] : [esc(s).trim()];
};

/**
 * Name split into parts (family / given), each as ruby markup in furigana mode,
 * so long names can be shown on two lines.
 */
export function personNameParts(p: Person, prefs: Pick<ViewPrefs, 'script' | 'preferNickname'>): string[] {
  if (prefs.preferNickname && p.nickname) return splitFirstSpace(p.nickname);
  const kanji = parts(p.familyName, p.givenName);
  const kana = parts(p.familyNameKana, p.givenNameKana);
  if (prefs.script === 'kana') return kana.length ? kana : kanji.length ? kanji : p.nickname ? splitFirstSpace(p.nickname) : [];
  if (prefs.script === 'furigana' && kanji.length) {
    // Per-part readings; a part without its kana reading is shown bare.
    return [ruby(p.familyName, p.familyNameKana), ruby(p.givenName, p.givenNameKana)].filter(Boolean);
  }
  return kanji.length ? kanji : kana.length ? kana : p.nickname ? splitFirstSpace(p.nickname) : [];
}

/** Name as one line of (ruby) markup. */
export const personName = (p: Person, prefs: Pick<ViewPrefs, 'script' | 'preferNickname'>) => personNameParts(p, prefs).join(' ');

/** Plain name for dialogs and labels. */
export const plainName = (p?: Person) =>
  p ? join(p.familyName, p.givenName) || join(p.familyNameKana, p.givenNameKana) || p.nickname || '（なまえなし）' : '';

export const formatDate = (d: PartialDate) => `${d.y}年${d.m ? `${d.m}月` : ''}${d.d ? `${d.d}日` : ''}`;

export function lifeText(p: Person, today: Date, kana: boolean): string {
  const now = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
  if (isDeceased(p)) {
    const span = p.birth || p.death ? `${p.birth?.y ?? '?'}–${p.death?.y ?? '?'}` : '';
    const age = p.birth && p.death ? yearsBetween(p.birth, p.death) : undefined;
    if (kana) return age === undefined ? 'なくなった' : `${age}さいで なくなった`;
    return [span, age === undefined ? '故人' : `満${age}歳で没`].filter(Boolean).join('・');
  }
  if (!p.birth) return '';
  const age = yearsBetween(p.birth, now);
  return kana ? `${age}さい` : `${p.birth.y}年生・${age}歳`;
}

/** Kinship label; ruby markup in furigana mode. */
export function kinshipText(k: Kinship | undefined, prefs: Pick<ViewPrefs, 'script' | 'showSide'>): string {
  if (!k) return '';
  const base = prefs.script === 'kana' ? k.kana : prefs.script === 'furigana' ? k.ruby : esc(k.kanji);
  if (!prefs.showSide || !k.side) return base;
  const paternal = k.side === 'paternal';
  const side =
    prefs.script === 'kana'
      ? paternal ? 'おとうさんがわの ' : 'おかあさんがわの '
      : prefs.script === 'furigana'
        ? paternal ? '{父方|ちちかた}の' : '{母方|ははかた}の'
        : paternal ? '父方の' : '母方の';
  return side + base;
}

/** Text length without readings (for choosing a smaller font). */
export const visibleLength = (markup: string) => markup.replace(/\{([^|}]*)\|[^}]*\}/g, '$1').length;

const plainUnits = (s: string) => {
  let u = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    u += c < 0x1100 || (c >= 0xff61 && c <= 0xff9f) ? 0.55 : 1;
  }
  return u;
};

/** Ruby text is drawn at about this fraction of the base font size. */
const RT_SCALE = 0.55;

/**
 * Display width in full-width characters (half-width letters/digits/kana count ~0.55).
 * A ruby segment is as wide as the wider of its base text and its reading.
 */
export function textUnits(markup: string): number {
  let u = 0;
  const rest = markup.replace(/\{([^|}]*)\|([^}]*)\}/g, (_m, base: string, reading: string) => {
    u += Math.max(plainUnits(base), plainUnits(reading) * RT_SCALE);
    return '';
  });
  return u + plainUnits(rest);
}

/** Full-width characters that fit on one name line of a card at normal size. */
export const NAME_LINE_UNITS = 8;

export interface NameFit {
  lines: string[];
  size: 'm' | 's' | 'xs';
}

/** One line when it fits, otherwise family/given on two lines; shrink the font for long lines. */
export function fitName(nameParts: string[]): NameFit {
  const oneLine = nameParts.join(' ');
  const lines = textUnits(oneLine) <= NAME_LINE_UNITS || nameParts.length < 2 ? [oneLine] : nameParts;
  const widest = Math.max(0, ...lines.map(textUnits));
  const size = widest <= NAME_LINE_UNITS ? 'm' : widest <= 9.5 ? 's' : 'xs';
  return { lines, size };
}
