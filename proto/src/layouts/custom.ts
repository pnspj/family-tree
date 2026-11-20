// Custom generational layout.
//  1. Assign a generation to every person (parent = gen-1, spouse = same gen).
//  2. Group spouses chained by unions into "units" placed side by side.
//  3. Order units per generation with barycenter sweeps (siblings keep birth order).
//  4. Assign x coordinates by iterative relaxation + isotonic regression (PAVA),
//     pulling sibling groups under their parents and parents over their children.
import * as d3 from 'd3';
import { type FamilyData, type Union, index } from '../model';
import { CARD_H, CARD_W, createZoomableSvg, drawCard, type ViewOptions } from '../render';

const SPOUSE_GAP = 28;
const UNIT_GAP = 36;
const GEN_GAP = 90;

interface Unit {
  gen: number;
  members: string[];
  x: number; // left edge
}

export function computeCustomLayout(data: FamilyData) {
  const idx = index(data);

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
    // collect component
    const comp = new Set<string>([p.id]);
    const stack = [p.id];
    while (stack.length) for (const s of spouses(stack.pop()!)) if (!comp.has(s)) (comp.add(s), stack.push(s));
    // walk the chain from an endpoint
    const start = [...comp].find((c) => spouses(c).length <= 1) ?? p.id;
    const members: string[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      members.push(cur);
      cur = spouses(cur).find((s) => !seen.has(s));
    }
    for (const c of comp) if (!seen.has(c)) members.push(c); // safety for odd shapes
    const unit: Unit = { gen: gen.get(p.id)!, members, x: 0 };
    units.push(unit);
    members.forEach((m) => unitOf.set(m, unit));
  }

  // ---- 3. ordering ----------------------------------------------------------
  // The family graph is (almost) a tree of units and unions, so the row order is
  // built recursively as nested blocks: a unit's children go directly below it,
  // in-law families branch outward to the left/right. Blocks are concatenated
  // row by row, which yields a crossing-free order for tree-shaped families.
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

  // Visit a unit. `fromChildOf`: entered from the union this unit's member is a child of.
  // `fromParentOf`: entered from one of this unit's unions (coming up from a child).
  function visitUnit(unit: Unit, fromChildOf?: string, fromParentOf?: string): Rows {
    visitedUnits.add(unit);
    const g = unit.gen;
    const fromMember = fromChildOf ? unit.members.find((m) => idx.persons.get(m)!.childOf === fromChildOf) : undefined;
    if (fromMember && unit.members.length > 1) {
      // Put in-laws on the side away from most siblings.
      const p = idx.persons.get(fromMember)!;
      const sibs = idx.childrenOf.get(p.childOf!)!;
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
    const ownUnions = [...new Set(unit.members.flatMap((m) => idx.unionsOf.get(m) ?? []))].sort(
      (a, b) => d3.mean(a.partners.filter(Boolean), (p) => unit.members.indexOf(p!))! - d3.mean(b.partners.filter(Boolean), (p) => unit.members.indexOf(p!))!,
    );
    for (const u of ownUnions) {
      if (u.id === fromParentOf || visitedFamilies.has(u.id)) continue;
      visitedFamilies.add(u.id);
      for (const c of idx.childrenOf.get(u.id) ?? []) {
        const cu = unitOf.get(c.id)!;
        if (!visitedUnits.has(cu)) below.push(visitUnit(cu, u.id));
      }
    }
    // Child blocks may reach rows <= g (e.g. parents of a child's spouse); the
    // first half of the child blocks goes left of this unit, the rest right.
    const half = Math.ceil(below.length / 2);
    return assemble([...left, ...below, ...right], (r) =>
      r <= g
        ? [...left, ...below.slice(0, half), 'self', ...below.slice(half), ...right]
        : [...left, ...below, ...right], unit);
  }

  // Visit union `pu` coming up from its child `anchor`; everything goes to `side` of the anchor.
  function visitFamilyFromChild(pu: string, anchor: string, side: 'left' | 'right'): Rows {
    visitedFamilies.add(pu);
    const g = gen.get(anchor)!;
    const union = idx.unions.get(pu)!;
    const partner = union.partners.find((p): p is string => !!p);
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
        ? r < g ? [parentBlock, ...sibBlocks] : [...sibBlocks, parentBlock]
        : r < g ? [...sibBlocks, parentBlock] : [parentBlock, ...sibBlocks]);
  }

  // Root: the top-generation unit with the most descendants; repeat for disconnected parts.
  const descendants = (unit: Unit): number =>
    d3.sum(unit.members.flatMap((m) => idx.unionsOf.get(m) ?? []), (u) =>
      d3.sum(idx.childrenOf.get(u.id) ?? [], (c) => 1 + descendants(unitOf.get(c.id)!)));
  const rows: Unit[][] = Array.from({ length: maxGen + 1 }, () => []);
  while (visitedUnits.size < units.length) {
    const rest = units.filter((u) => !visitedUnits.has(u));
    const top = Math.min(...rest.map((u) => u.gen));
    const root = rest.filter((u) => u.gen === top).sort((a, b) => descendants(b) - descendants(a))[0];
    const block = visitUnit(root);
    for (const [r, list] of block) rows[r].push(...list);
  }

  // ---- 4. x positioning -----------------------------------------------------
  const unitWidth = (u: Unit) => u.members.length * CARD_W + (u.members.length - 1) * SPOUSE_GAP;
  const center = (id: string) => {
    const unit = unitOf.get(id)!;
    return unit.x + unit.members.indexOf(id) * (CARD_W + SPOUSE_GAP) + CARD_W / 2;
  };
  const unionCenter = (u: Union) => {
    const ps = u.partners.filter((p): p is string => !!p);
    return ps.length ? d3.mean(ps, center)! : undefined;
  };
  const groupCenter = (ids: string[]) => {
    const xs = ids.map(center);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };
  rows.forEach((row) => {
    let x = 0;
    for (const u of row) (u.x = x), (x += unitWidth(u) + UNIT_GAP);
  });

  const desiredShift = (unit: Unit) => {
    const shifts: number[] = [];
    // Each child is pulled toward its parents' union; each union toward its children.
    for (const m of unit.members) {
      const pu = idx.persons.get(m)!.childOf;
      const uc = pu ? unionCenter(idx.unions.get(pu)!) : undefined;
      if (uc !== undefined) shifts.push(uc - center(m));
    }
    const ownUnions = new Set(unit.members.flatMap((m) => idx.unionsOf.get(m) ?? []));
    for (const u of ownUnions) {
      const kids = idx.childrenOf.get(u.id);
      if (kids?.length) shifts.push(groupCenter(kids.map((c) => c.id)) - unionCenter(u)!);
    }
    return shifts.length ? d3.mean(shifts)! : 0;
  };
  const relaxRow = (row: Unit[]) => {
    const targets = row.map((u) => u.x + 0.5 * desiredShift(u));
    const xs = pava(targets, row.map(unitWidth), UNIT_GAP);
    row.forEach((u, i) => (u.x = xs[i]));
  };
  for (let iter = 0; iter < 150; iter++) {
    const order = iter % 2 === 0 ? rows : [...rows].reverse();
    order.forEach(relaxRow);
  }
  const minX = Math.min(...units.map((u) => u.x));
  units.forEach((u) => (u.x -= minX));

  const top = (id: string) => gen.get(id)! * (CARD_H + GEN_GAP);
  return { idx, gen, center, unionCenter, top, rows };
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

export function renderCustom(host: HTMLElement, data: FamilyData, opt: ViewOptions) {
  const { idx, gen, center, unionCenter, top } = computeCustomLayout(data);
  const { content, fit } = createZoomableSvg(host);
  const lines = content.append('g').attr('fill', 'none').attr('stroke', '#555').attr('stroke-width', 1.5);

  // Marriage lines (double line, dashed when former).
  for (const u of idx.unions.values()) {
    const [a, b] = u.partners;
    if (!a || !b) continue;
    const [l, r] = center(a) < center(b) ? [a, b] : [b, a];
    const y = top(l) + CARD_H / 2;
    for (const dy of [-3, 3]) {
      lines
        .append('line')
        .attr('x1', center(l) + CARD_W / 2).attr('x2', center(r) - CARD_W / 2)
        .attr('y1', y + dy).attr('y2', y + dy)
        .attr('stroke-dasharray', u.status === 'former' ? '5 4' : null);
    }
  }

  // Parent-child lines: union drop -> horizontal bus -> each child. Overlapping buses get separate lanes.
  const byGen = new Map<number, { u: Union; from: number; to: number; ux?: number }[]>();
  for (const u of idx.unions.values()) {
    const kids = idx.childrenOf.get(u.id);
    if (!kids?.length) continue;
    const ux = unionCenter(u);
    const xs = kids.map((c) => center(c.id)).concat(ux === undefined ? [] : [ux]);
    const g = gen.get(kids[0].id)! - 1;
    const list = byGen.get(g) ?? [];
    list.push({ u, from: Math.min(...xs), to: Math.max(...xs), ux });
    byGen.set(g, list);
  }
  for (const [g, list] of byGen) {
    list.sort((a, b) => a.from - b.from);
    const laneEnds: number[] = [];
    const lanes = list.map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.from - 12);
      if (lane < 0) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = item.to;
      return lane;
    });
    const baseY = g * (CARD_H + GEN_GAP) + CARD_H + GEN_GAP / 2;
    list.forEach((item, i) => {
      const busY = baseY + (lanes[i] - (laneEnds.length - 1) / 2) * 12;
      const kids = idx.childrenOf.get(item.u.id)!;
      const partners = item.u.partners.filter((p): p is string => !!p);
      const path = d3.path();
      if (item.ux !== undefined) {
        const startY = partners.length === 2 ? top(partners[0]) + CARD_H / 2 + 3 : top(partners[0]) + CARD_H;
        path.moveTo(item.ux, startY);
        path.lineTo(item.ux, busY);
      }
      path.moveTo(item.from, busY);
      path.lineTo(item.to, busY);
      for (const c of kids) {
        path.moveTo(center(c.id), busY);
        path.lineTo(center(c.id), top(c.id));
      }
      lines.append('path').attr('d', path.toString());
    });
  }

  const cards = content.append('g');
  for (const p of idx.persons.values()) drawCard(cards, p, center(p.id) - CARD_W / 2, top(p.id), opt);
  return fit;
}
