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

/** Horizontal offset between each only child and the center of its parents. */
function onlyChildOffsets(data: FamilyData) {
  const L = computeLayout(data);
  const cx = new Map(L.cards.map((c) => [c.id, c.x + DEFAULT_LAYOUT.cardW / 2]));
  const out: { id: string; d: number }[] = [];
  for (const u of data.unions) {
    const kids = data.persons.filter((p) => p.childOf === u.id);
    const ps = u.partners.filter((x): x is string => !!x);
    if (kids.length !== 1 || !ps.length) continue;
    const ux = ps.reduce((a, x) => a + cx.get(x)!, 0) / ps.length;
    out.push({ id: kids[0].id, d: cx.get(kids[0].id)! - ux });
  }
  return out;
}

describe('layout', () => {
  it('draws an only child straight under the parents when there is room', () => {
    const offsets = new Map(onlyChildOffsets(sampleFile()).map((o) => [o.id, o.d]));
    expect(Math.abs(offsets.get('minato')!)).toBeLessThan(0.01); // 湊
    expect(Math.abs(offsets.get('hina')!)).toBeLessThan(0.01); // 陽菜
  });

  it('keeps an only child off-center only when a neighbour blocks the way', () => {
    const { cardW, spouseGap, unitGap } = DEFAULT_LAYOUT;
    for (const [n, seed] of [[30, 1], [60, 2], [120, 3], [200, 4], [300, 5]]) {
      const data = randomFamily(n, seed);
      const L = computeLayout(data);
      const rowOf = new Map(L.cards.map((c) => [c.id, c.y]));
      const xOf = new Map(L.cards.map((c) => [c.id, c.x]));
      for (const { id, d } of onlyChildOffsets(data)) {
        if (Math.abs(d) < 0.01) continue;
        // Walk toward the parents over spouse-spaced cards (same unit) to the unit's edge,
        // then the next card must sit at exactly the minimum unit gap.
        const dir = d > 0 ? -1 : 1;
        const xs = L.cards.filter((c) => c.y === rowOf.get(id)).map((c) => c.x).sort((p, q) => p - q);
        let i = xs.indexOf(xOf.get(id)!);
        while (xs[i + dir] !== undefined && Math.abs(Math.abs(xs[i + dir] - xs[i]) - (cardW + spouseGap)) < 0.01) i += dir;
        const next = xs[i + dir];
        expect(next, `${id} (seed ${seed}) is ${d.toFixed(1)}px off with free space`).toBeDefined();
        expect(Math.abs(next - xs[i]), `${id} (seed ${seed})`).toBeCloseTo(cardW + unitGap, 1);
      }
    }
  });

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
