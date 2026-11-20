import { describe, expect, it } from 'vitest';
import { sampleFile } from '../core/sample';
import type { FamilyData } from '../core/types';
import { computeLayout, DEFAULT_LAYOUT } from './layout';
import { inlawRightCase, randomFamily } from './testData';

/** Counts crossings between parent-union -> child edges (by card centers). */
function crossings(data: FamilyData) {
  const L = computeLayout(data);
  const cx = new Map(L.cards.map((c) => [c.id, c.x + DEFAULT_LAYOUT.cardW / 2]));
  const cy = new Map(L.cards.map((c) => [c.id, c.y]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const byRow = new Map<number, [number, number][]>();
  for (const p of data.persons) {
    if (!p.childOf) continue;
    const ps = unions.get(p.childOf)!.partners.filter((x): x is string => !!x);
    if (!ps.length) continue;
    const ux = ps.reduce((a, x) => a + cx.get(x)!, 0) / ps.length;
    const row = cy.get(p.id)!;
    byRow.set(row, [...(byRow.get(row) ?? []), [ux, cx.get(p.id)!]]);
  }
  let n = 0;
  for (const edges of byRow.values())
    for (let i = 0; i < edges.length; i++)
      for (let j = i + 1; j < edges.length; j++)
        if ((edges[i][0] - edges[j][0]) * (edges[i][1] - edges[j][1]) < -1) n++;
  return n;
}

/** Card overlaps within a row. */
function overlaps(data: FamilyData) {
  const L = computeLayout(data);
  const rows = new Map<number, number[]>();
  for (const c of L.cards) rows.set(c.y, [...(rows.get(c.y) ?? []), c.x]);
  let n = 0;
  for (const xs of rows.values()) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < DEFAULT_LAYOUT.cardW - 0.5) n++;
  }
  return n;
}

describe('layout', () => {
  it('puts a spouse’s parents on the spouse’s side (no crossing)', () => {
    expect(crossings(inlawRightCase)).toBe(0);
  });

  it('draws the sample family without crossings', () => {
    expect(crossings(sampleFile())).toBe(0);
  });

  it('places everyone once without overlaps on random families', () => {
    for (const [n, seed] of [[30, 1], [60, 2], [120, 3], [200, 4]]) {
      const data = randomFamily(n, seed);
      const L = computeLayout(data);
      expect(new Set(L.cards.map((c) => c.id)).size).toBe(data.persons.length);
      expect(overlaps(data)).toBe(0);
    }
  });

  it('keeps crossings low on random families', () => {
    const total = [[30, 1], [60, 2], [120, 3], [200, 4], [300, 5]].map(([n, s]) => crossings(randomFamily(n, s)));
    console.log('random crossings', total);
    expect(total.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(BASELINE);
  });
});

// Sum of crossings over the random cases above; lower it when the layout improves.
const BASELINE = 522;
