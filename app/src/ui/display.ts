// Text helpers for showing people on cards and dialogs.
import { isDeceased, yearsBetween } from '../core/date';
import type { Kinship } from '../core/kinship';
import type { PartialDate, Person } from '../core/types';
import type { ViewPrefs } from '../storage';

const join = (a?: string, b?: string) => [a, b].filter(Boolean).join(' ');

export function personName(p: Person, prefs: Pick<ViewPrefs, 'kana' | 'preferNickname'>): string {
  if (prefs.preferNickname && p.nickname) return p.nickname;
  const kanji = join(p.familyName, p.givenName);
  const kana = join(p.familyNameKana, p.givenNameKana);
  return (prefs.kana ? kana || kanji : kanji || kana) || (p.nickname ?? '');
}

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

export function kinshipText(k: Kinship | undefined, prefs: Pick<ViewPrefs, 'kana' | 'showSide'>): string {
  if (!k) return '';
  const base = prefs.kana ? k.kana : k.kanji;
  if (!prefs.showSide || !k.side) return base;
  const side = k.side === 'paternal' ? (prefs.kana ? 'おとうさんがわの ' : '父方の') : prefs.kana ? 'おかあさんがわの ' : '母方の';
  return side + base;
}
