import type { PartialDate, Person } from './types';

/**
 * Compares two birth dates. -1: a is earlier (older), 1: a is later, 0: identical
 * full dates, undefined: cannot be decided with the given precision.
 */
export function compareDates(a?: PartialDate, b?: PartialDate): -1 | 0 | 1 | undefined {
  if (!a || !b) return undefined;
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.m === undefined || b.m === undefined) return undefined;
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.d === undefined || b.d === undefined) return undefined;
  if (a.d !== b.d) return a.d < b.d ? -1 : 1;
  return 0;
}

/** Sort key for sibling order: birth date (missing month/day = start of period), unknown last. */
export function birthSortKey(p: Person): [number, number, number] {
  return p.birth ? [p.birth.y, p.birth.m ?? 0, p.birth.d ?? 0] : [Infinity, 0, 0];
}

/**
 * Full years between two dates. Missing month/day count as 1, so a year-only
 * birth ages on Jan 1 and a year+month birth on the 1st of that month.
 */
export function yearsBetween(from: PartialDate, to: PartialDate): number {
  const fm = from.m ?? 1;
  const fd = from.d ?? 1;
  const tm = to.m ?? 1;
  const td = to.d ?? 1;
  let age = to.y - from.y;
  if (tm < fm || (tm === fm && td < fd)) age--;
  return age;
}

export const isDeceased = (p: Person) => !!p.death || !!p.deceased;

/** "42歳" / "満78歳で没" / undefined when it cannot be computed. */
export function ageText(p: Person, today: Date): string | undefined {
  if (!p.birth) return undefined;
  if (isDeceased(p)) return p.death ? `満${yearsBetween(p.birth, p.death)}歳で没` : undefined;
  const now = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
  return `${yearsBetween(p.birth, now)}歳`;
}
