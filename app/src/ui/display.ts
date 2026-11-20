// Text helpers for showing people on cards and dialogs.
import { isDeceased, yearsBetween } from '../core/date';
import type { Kinship } from '../core/kinship';
import type { PartialDate, Person } from '../core/types';
import type { Script, ViewPrefs } from '../storage';

const join = (a?: string, b?: string) => [a, b].filter(Boolean).join(' ');
const esc = (s: string) => s.replace(/[{}|]/g, '');
const ruby = (base?: string, reading?: string) => (base ? (reading ? `{${esc(base)}|${esc(reading)}}` : esc(base)) : '');

export const isKana = (p: { script: Script }) => p.script === 'kana';

/** Name as ruby markup ({山田|やまだ} {蓮|れん}) in furigana mode, plain text otherwise. */
export function personName(p: Person, prefs: Pick<ViewPrefs, 'script' | 'preferNickname'>): string {
  if (prefs.preferNickname && p.nickname) return esc(p.nickname);
  const kanji = join(p.familyName, p.givenName);
  const kana = join(p.familyNameKana, p.givenNameKana);
  if (prefs.script === 'kana') return esc(kana || kanji || p.nickname || '');
  if (prefs.script === 'furigana' && kanji) {
    // Per-part readings; a part without its kana reading is shown bare.
    return join(ruby(p.familyName, p.familyNameKana) || undefined, ruby(p.givenName, p.givenNameKana) || undefined);
  }
  return esc(kanji || kana || p.nickname || '');
}

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
