// Generational family-tree layout (pure function, no rendering).
//  1. Assign a generation to every person (parent = gen-1, spouse = same gen).
//  2. Group spouses chained by unions into "units" placed side by side.
//  3. Order units per row by recursive block assembly: children directly below,
//     in-law families branching outward. Crossing-free for tree-shaped families.
//  4. Assign x by iterative relaxation + isotonic regression (PAVA).
import { birthSortKey } from '../core/date';
import type { FamilyData, Person, Union } from '../core/types';

export interface LayoutOptions {
  cardW: number;
  cardH: number;
  spouseGap: number;
  unitGap: number;
  genGap: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = { cardW: 144, cardH: 80, spouseGap: 28, unitGap: 36, genGap: 90 };

export interface LayoutResult {
  cards: { id: string; x: number; y: number }[]; // top-left corners
  marriages: { d: string; former: boolean }[];
  descents: { d: string }[];
  width: number;
  height: number;
}

interface Unit {
  gen: number;
  members: string[];
  x: number; // left edge
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function indexFamily(data: FamilyData) {
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const order = new Map(data.persons.map((p, i) => [p.id, i]));
  const childrenOf = new Map<string, Person[]>();
  for (const p of data.persons) {
    if (!p.childOf) continue;
    childrenOf.set(p.childOf, [...(childrenOf.get(p.childOf) ?? []), p]);
  }
  // Siblings: birth date, then registration order.
  for (const list of childrenOf.values())
    list.sort((a, b) => {
      const ka = birthSortKey(a);
      const kb = birthSortKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || order.get(a.id)! - order.get(b.id)!;
    });
  const unionsOf = new Map<string, Union[]>();
  for (const u of data.unions)
    for (const pid of u.partners) if (pid) unionsOf.set(pid, [...(unionsOf.get(pid) ?? []), u]);
  return { persons, unions, childrenOf, unionsOf };
}

export function computeLayout(data: FamilyData, opt: LayoutOptions = DEFAULT_LAYOUT): LayoutResult {
  if (!data.persons.length) return { cards: [], marriages: [], descents: [], width: 0, height: 0 };
  const { cardW, cardH, spouseGap, unitGap, genGap } = opt;
  const idx = indexFamily(data);

  // ---- 1. generations -------------------------------------------------------
  const gen = new Map<string, number>();
  for (const start of data.persons) {
    if (gen.has(start.id)) continue;
    gen.set(start.id, 0);
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift()!;
      const g = gen.get(id)!;
      const visit = (other: string | null, gg: number) => {
        if (other && !gen.has(other)) {
          gen.set(other, gg);
          queue.push(other);
        }
      };
      const me = idx.persons.get(id)!;
      if (me.childOf) {
        idx.unions.get(me.childOf)!.partners.forEach((pp) => visit(pp, g - 1));
        idx.childrenOf.get(me.childOf)!.forEach((s) => visit(s.id, g));
      }
      for (const u of idx.unionsOf.get(id) ?? []) {
        u.partners.forEach((pp) => visit(pp, g));
        (idx.childrenOf.get(u.id) ?? []).forEach((c) => visit(c.id, g + 1));
      }
    }
  }
  const minGen = Math.min(...gen.values());
  for (const [k, v] of gen) gen.set(k, v - minGen);
  const maxGen = Math.max(...gen.values());

  // ---- 2. units (chains of spouses) ----------------------------------------
  const spouses = (id: string) =>
    (idx.unionsOf.get(id) ?? []).flatMap((u) => u.partners.filter((p): p is string => !!p && p !== id));
  const unitOf = new Map<string, Unit>();
  const units: Unit[] = [];
  for (const p of data.persons) {
    if (unitOf.has(p.id)) continue;
    const comp = new Set<string>([p.id]);
    const stack = [p.id];
    while (stack.length)
      for (const s of spouses(stack.pop()!))
        if (!comp.has(s)) {
          comp.add(s);
          stack.push(s);
        }
    const start = [...comp].find((c) => spouses(c).length <= 1) ?? p.id;
    const members: string[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      members.push(cur);
      cur = spouses(cur).find((s) => !seen.has(s));
    }
    for (const c of comp) if (!seen.has(c)) members.push(c);
    const unit: Unit = { gen: gen.get(p.id)!, members, x: 0 };
    units.push(unit);
    members.forEach((m) => unitOf.set(m, unit));
  }

  // ---- 3. ordering ----------------------------------------------------------
  type Rows = Map<number, Unit[]>;
  const visitedUnits = new Set<Unit>();
  const visitedFamilies = new Set<string>();
  const birthIndex = (id: string) => {
    const p = idx.persons.get(id)!;
    return p.childOf ? idx.childrenOf.get(p.childOf)!.findIndex((c) => c.id === id) : 0;
  };
  const assemble = (blocks: Rows[], orderFor: (r: number) => (Rows | 'self')[], self?: Unit): Rows => {
    const out: Rows = new Map();
    const allRows = new Set(blocks.flatMap((b) => [...b.keys()]));
    if (self) allRows.add(self.gen);
    for (const r of allRows) {
      const list: Unit[] = [];
      for (const b of orderFor(r)) {
        if (b === 'self') {
          if (self && r === self.gen) list.push(self);
        } else list.push(...(b.get(r) ?? []));
      }
      if (list.length) out.set(r, list);
    }
    return out;
  };

  // `fromChildOf`: entered from the union one member is a child of.
  // `fromParentOf`: entered from one of this unit's unions (coming up from a child).
  function visitUnit(unit: Unit, fromChildOf?: string, fromParentOf?: string): Rows {
    visitedUnits.add(unit);
    const g = unit.gen;
    const fromMember = fromChildOf ? unit.members.find((m) => idx.persons.get(m)!.childOf === fromChildOf) : undefined;
    if (fromMember && unit.members.length > 1) {
      // Put in-laws on the side away from most siblings.
      const sibs = idx.childrenOf.get(idx.persons.get(fromMember)!.childOf!)!;
      const i = birthIndex(fromMember);
      const preferLeft = i >= sibs.length - 1 - i;
      const pos = unit.members.indexOf(fromMember);
      const n = unit.members.length;
      if (preferLeft ? pos > n - 1 - pos : pos < n - 1 - pos) unit.members.reverse();
    }
    const f = fromMember ? unit.members.indexOf(fromMember) : (unit.members.length - 1) / 2;
    const left: Rows[] = [];
    const right: Rows[] = [];
    unit.members.forEach((m, i) => {
      const pu = idx.persons.get(m)!.childOf;
      if (!pu || pu === fromChildOf || visitedFamilies.has(pu)) return;
      const side = i < f ? 'left' : 'right';
      const block = visitFamilyFromChild(pu, m, side);
      if (side === 'left') left.unshift(block);
      else right.push(block);
    });
    const below: Rows[] = [];
    const posOf = (u: Union) => mean(u.partners.filter((p): p is string => !!p).map((p) => unit.members.indexOf(p)))!;
    const ownUnions = [...new Set(unit.members.flatMap((m) => idx.unionsOf.get(m) ?? []))].sort((a, b) => posOf(a) - posOf(b));
    for (const u of ownUnions) {
      if (u.id === fromParentOf || visitedFamilies.has(u.id)) continue;
      visitedFamilies.add(u.id);
      for (const c of idx.childrenOf.get(u.id) ?? []) {
        const cu = unitOf.get(c.id)!;
        if (!visitedUnits.has(cu)) below.push(visitUnit(cu, u.id));
      }
    }
    // Child blocks may reach rows <= g (e.g. parents of a child's spouse).
    const half = Math.ceil(below.length / 2);
    return assemble(
      [...left, ...below, ...right],
      (r) =>
        r <= g
          ? [...left, ...below.slice(0, half), 'self', ...below.slice(half), ...right]
          : [...left, ...below, ...right],
      unit,
    );
  }

  // Visit union `pu` coming up from its child `anchor`; everything goes to `side` of the anchor.
  function visitFamilyFromChild(pu: string, anchor: string, side: 'left' | 'right'): Rows {
    visitedFamilies.add(pu);
    const g = gen.get(anchor)!;
    const partner = idx.unions.get(pu)!.partners.find((p): p is string => !!p);
    const parentUnit = partner ? unitOf.get(partner)! : undefined;
    const parentBlock: Rows =
      parentUnit && !visitedUnits.has(parentUnit) ? visitUnit(parentUnit, undefined, pu) : new Map();
    const sibBlocks: Rows[] = [];
    for (const c of idx.childrenOf.get(pu)!) {
      const cu = unitOf.get(c.id)!;
      if (c.id === anchor || visitedUnits.has(cu)) continue;
      sibBlocks.push(visitUnit(cu, pu));
    }
    return assemble([parentBlock, ...sibBlocks], (r) =>
      side === 'right'
        ? r < g
          ? [parentBlock, ...sibBlocks]
          : [...sibBlocks, parentBlock]
        : r < g
          ? [...sibBlocks, parentBlock]
          : [parentBlock, ...sibBlocks],
    );
  }

  const descCache = new Map<Unit, number>();
  const descendants = (unit: Unit, guard = new Set<Unit>()): number => {
    if (descCache.has(unit)) return descCache.get(unit)!;
    if (guard.has(unit)) return 0;
    guard.add(unit);
    const n = sum(
      unit.members
        .flatMap((m) => idx.unionsOf.get(m) ?? [])
        .flatMap((u) => idx.childrenOf.get(u.id) ?? [])
        .map((c) => 1 + descendants(unitOf.get(c.id)!, guard)),
    );
    descCache.set(unit, n);
    return n;
  };
  const rows: Unit[][] = Array.from({ length: maxGen + 1 }, () => []);
  while (visitedUnits.size < units.length) {
    const rest = units.filter((u) => !visitedUnits.has(u));
    const top = Math.min(...rest.map((u) => u.gen));
    const root = rest.filter((u) => u.gen === top).sort((a, b) => descendants(b) - descendants(a))[0];
    for (const [r, list] of visitUnit(root)) rows[r].push(...list);
  }

  // ---- 4. x positioning -----------------------------------------------------
  const unitWidth = (u: Unit) => u.members.length * cardW + (u.members.length - 1) * spouseGap;
  const center = (id: string) => {
    const unit = unitOf.get(id)!;
    return unit.x + unit.members.indexOf(id) * (cardW + spouseGap) + cardW / 2;
  };
  const unionCenter = (u: Union) => mean(u.partners.filter((p): p is string => !!p).map(center));
  const groupCenter = (ids: string[]) => {
    const xs = ids.map(center);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };
  rows.forEach((row) => {
    let x = 0;
    for (const u of row) {
      u.x = x;
      x += unitWidth(u) + unitGap;
    }
  });
  const desiredShift = (unit: Unit) => {
    const shifts: number[] = [];
    for (const m of unit.members) {
      const pu = idx.persons.get(m)!.childOf;
      const uc = pu ? unionCenter(idx.unions.get(pu)!) : undefined;
      if (uc !== undefined) shifts.push(uc - center(m));
    }
    for (const u of new Set(unit.members.flatMap((m) => idx.unionsOf.get(m) ?? []))) {
      const kids = idx.childrenOf.get(u.id);
      if (kids?.length) shifts.push(groupCenter(kids.map((c) => c.id)) - unionCenter(u)!);
    }
    return mean(shifts) ?? 0;
  };
  const relaxRow = (row: Unit[]) => {
    const xs = pava(
      row.map((u) => u.x + 0.5 * desiredShift(u)),
      row.map(unitWidth),
      unitGap,
    );
    row.forEach((u, i) => (u.x = xs[i]));
  };
  for (let iter = 0; iter < 150; iter++) (iter % 2 === 0 ? rows : [...rows].reverse()).forEach(relaxRow);
  const minX = Math.min(...units.map((u) => u.x));
  units.forEach((u) => (u.x -= minX));

  // ---- 5. geometry ------------------------------------------------------------
  const rowTop = (g: number) => g * (cardH + genGap);
  const top = (id: string) => rowTop(gen.get(id)!);
  const cards = data.persons.map((p) => ({ id: p.id, x: center(p.id) - cardW / 2, y: top(p.id) }));

  const marriages: LayoutResult['marriages'] = [];
  for (const u of data.unions) {
    const [a, b] = u.partners;
    if (!a || !b) continue;
    const [l, r] = center(a) < center(b) ? [a, b] : [b, a];
    const y = top(l) + cardH / 2;
    const x1 = center(l) + cardW / 2;
    const x2 = center(r) - cardW / 2;
    marriages.push({ d: `M${x1},${y - 3}H${x2}M${x1},${y + 3}H${x2}`, former: u.status === 'former' });
  }

  // Parent-child lines: union drop -> horizontal bus -> each child. Overlapping buses get lanes.
  const byGen = new Map<number, { u: Union; from: number; to: number; ux?: number }[]>();
  for (const u of data.unions) {
    const kids = idx.childrenOf.get(u.id);
    if (!kids?.length) continue;
    const ux = unionCenter(u);
    const xs = kids.map((c) => center(c.id)).concat(ux === undefined ? [] : [ux]);
    const g = gen.get(kids[0].id)! - 1;
    byGen.set(g, [...(byGen.get(g) ?? []), { u, from: Math.min(...xs), to: Math.max(...xs), ux }]);
  }
  const descents: LayoutResult['descents'] = [];
  for (const [g, list] of byGen) {
    list.sort((a, b) => a.from - b.from);
    const laneEnds: number[] = [];
    const lanes = list.map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.from - 12);
      if (lane < 0) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = item.to;
      return lane;
    });
    const baseY = rowTop(g) + cardH + genGap / 2;
    list.forEach((item, i) => {
      const busY = baseY + (lanes[i] - (laneEnds.length - 1) / 2) * 12;
      const partners = item.u.partners.filter((p): p is string => !!p);
      let d = '';
      if (item.ux !== undefined) {
        const startY = partners.length === 2 ? top(partners[0]) + cardH / 2 + 3 : top(partners[0]) + cardH;
        d += `M${item.ux},${startY}V${busY}`;
      }
      d += `M${item.from},${busY}H${item.to}`;
      for (const c of idx.childrenOf.get(item.u.id)!) d += `M${center(c.id)},${busY}V${top(c.id)}`;
      descents.push({ d });
    });
  }

  const width = Math.max(...cards.map((c) => c.x)) + cardW;
  const height = rowTop(maxGen) + cardH;
  return { cards, marriages, descents, width, height };
}

/** Isotonic regression with minimum spacing: positions closest to targets keeping order. */
function pava(targets: number[], widths: number[], gap: number): number[] {
  const off: number[] = [];
  targets.forEach((_, i) => off.push(i === 0 ? 0 : off[i - 1] + widths[i - 1] + gap));
  const blocks: { sum: number; n: number }[] = [];
  targets.forEach((t, i) => {
    blocks.push({ sum: t - off[i], n: 1 });
    while (blocks.length > 1) {
      const a = blocks[blocks.length - 2];
      const b = blocks[blocks.length - 1];
      if (a.sum / a.n <= b.sum / b.n) break;
      blocks.pop();
      a.sum += b.sum;
      a.n += b.n;
    }
  });
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.n + off[out.length]);
  return out;
}
