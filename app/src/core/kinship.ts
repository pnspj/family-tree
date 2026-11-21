// Kinship resolution: who is `target` as seen from `ego`?
import { compareDates } from './date';
import { type KinAge, type KinGender, type KinRow, YOMI, hasKey, lookup, usesAge } from './kinshipMaster';
import type { FamilyData, LabelOverride, Union } from './types';

export interface Kinship {
  /** 'master': one row of the master. 'path': composed from several steps (out of master range). */
  kind: 'master' | 'path';
  kanji: string;
  kana: string;
  /** Kanji label with readings for furigana, markup {漢字|よみ}. */
  ruby: string;
  /** Master key for kind 'master' (e.g. "B(2,1)"). */
  key?: string;
  /** Label ids of each part (one for 'master'). */
  labelIds: string[];
  /** Through the father's or mother's side (lineal ancestors and their relatives). */
  side?: 'paternal' | 'maternal';
}

interface Blood {
  a: number;
  b: number;
  ancestor: string;
  /** Person on x's side at y's generation (age reference), when y is not below x. */
  ref?: string;
  /** x's parent on the path (for paternal/maternal side). */
  firstUp?: string;
}

type Step = { kind: 'u' | 'd' | 's' | 'sf'; to: string };

export function createKinship(data: FamilyData, overrides: Record<string, LabelOverride> = {}) {
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const seq = new Map(data.persons.map((p, i) => [p.id, i]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const unionsOf = new Map<string, Union[]>();
  const childrenOf = new Map<string, string[]>();
  for (const u of data.unions)
    for (const p of u.partners) if (p) unionsOf.set(p, [...(unionsOf.get(p) ?? []), u]);
  for (const p of data.persons)
    if (p.childOf) childrenOf.set(p.childOf, [...(childrenOf.get(p.childOf) ?? []), p.id]);

  // Siblings whose parents are not registered yet share a union without partners. That union
  // stands in as a virtual parent node, so they are still siblings (and their children cousins).
  const VIRTUAL = '#union:';
  const parentsOf = (id: string) => {
    const cu = persons.get(id)?.childOf;
    if (!cu) return [];
    const known = unions.get(cu)!.partners.filter((p): p is string => !!p);
    return known.length ? known : [VIRTUAL + cu];
  };
  const childrenOfPerson = (id: string) =>
    id.startsWith(VIRTUAL)
      ? (childrenOf.get(id.slice(VIRTUAL.length)) ?? [])
      : (unionsOf.get(id) ?? []).flatMap((u) => childrenOf.get(u.id) ?? []);
  const spousesOf = (id: string, status?: Union['status']) =>
    (unionsOf.get(id) ?? [])
      .filter((u) => !status || u.status === status)
      .flatMap((u) => u.partners.filter((p): p is string => !!p && p !== id).map((p) => ({ id: p, status: u.status })));

  const ancestorCache = new Map<string, Map<string, number>>();
  /** All ancestors with their (minimal) generation distance; includes self at 0. */
  const ancestors = (id: string) => {
    let m = ancestorCache.get(id);
    if (m) return m;
    m = new Map([[id, 0]]);
    const queue = [id];
    while (queue.length) {
      const x = queue.shift()!;
      for (const p of parentsOf(x))
        if (!m.has(p)) {
          m.set(p, m.get(x)! + 1);
          queue.push(p);
        }
    }
    ancestorCache.set(id, m);
    return m;
  };

  const blood = (x: string, y: string): Blood | undefined => {
    const ax = ancestors(x);
    const ay = ancestors(y);
    let best: Blood | undefined;
    for (const [anc, a] of ax) {
      const b = ay.get(anc);
      if (b === undefined) continue;
      if (!best || a + b < best.a + best.b || (a + b === best.a + best.b && a < best.a)) best = { a, b, ancestor: anc };
    }
    if (!best) return undefined;
    // the ancestor of x at depth d that descends from the common ancestor at depth `b`
    const onPath = (d: number, depthToAnc: number) =>
      [...ax].find(([n, dn]) => dn === d && ancestors(n).get(best!.ancestor) === depthToAnc)?.[0];
    if (best.a >= best.b) best.ref = onPath(best.a - best.b, best.b);
    if (best.a >= 1) best.firstUp = onPath(1, best.a - 1);
    return best;
  };

  const genderOf = (id: string): KinGender => {
    const g = persons.get(id)?.gender;
    return g === 'M' || g === 'F' ? g : 'N';
  };
  /** Is `t` older or younger than `r`? Ties on full dates fall back to registration order. */
  const ageVs = (t: string, r: string | undefined): KinAge => {
    if (!r || t === r) return 'any';
    const c = compareDates(persons.get(t)?.birth, persons.get(r)?.birth);
    if (c === undefined) return 'any';
    if (c === 0) return seq.get(t)! < seq.get(r)! ? 'older' : 'younger';
    return c < 0 ? 'older' : 'younger';
  };
  /** Side through ego's parent `firstUp`; none for that parent themself (or their spouse). */
  const sideOf = (firstUp: string | undefined, reached: string): Kinship['side'] => {
    const g = firstUp && firstUp !== reached ? persons.get(firstUp)?.gender : undefined;
    return g === 'M' ? 'paternal' : g === 'F' ? 'maternal' : undefined;
  };
  const apply = (row: KinRow) => {
    const kanji = overrides[row.id]?.kanji;
    return {
      kanji: kanji ?? row.kanji,
      kana: overrides[row.id]?.kana ?? row.kana,
      // A custom kanji wording has no known reading: show it without furigana.
      ruby: kanji ? kanji.replace(/[{}|]/g, '') : (YOMI[row.id] ?? row.kanji),
    };
  };
  const master = (key: string, gender: KinGender, age: KinAge, side?: Kinship['side']): Kinship | undefined => {
    const row = lookup(key, gender, usesAge(key) ? age : 'any');
    return row ? { kind: 'master', key, labelIds: [row.id], side, ...apply(row) } : undefined;
  };
  const bKey = (bl: Blood) => `B(${bl.a},${bl.b})`;

  /** Relation via the master only (no path fallback). */
  function resolveMaster(ego: string, target: string): Kinship | undefined {
    if (ego === target) return master('B(0,0)', 'N', 'any');
    const direct = spousesOf(ego).find((s) => s.id === target);
    if (direct) return master(direct.status === 'former' ? 'S(former)' : 'S', genderOf(target), 'any');

    const bl = blood(ego, target);
    if (bl) {
      const k = master(bKey(bl), genderOf(target), ageVs(target, bl.ref), sideOf(bl.firstUp, target));
      if (k) return k;
    }
    // In-law candidates through current unions, closest first.
    const cands: { deg: number; make: () => Kinship | undefined }[] = [];
    for (const s of spousesOf(ego, 'current')) {
      const sb = blood(s.id, target);
      if (sb && sb.a + sb.b > 0)
        cands.push({ deg: sb.a + sb.b, make: () => master(`S+${bKey(sb)}`, genderOf(target), ageVs(target, sb.ref)) });
    }
    for (const t of spousesOf(target, 'current')) {
      const tb = blood(ego, t.id);
      if (tb && tb.a + tb.b > 0)
        cands.push({
          deg: tb.a + tb.b,
          make: () => master(`${bKey(tb)}+S`, genderOf(target), ageVs(t.id, tb.ref), sideOf(tb.firstUp, t.id)),
        });
    }
    cands.sort((x, y) => x.deg - y.deg);
    for (const c of cands) {
      const k = c.make();
      if (k) return k;
    }
    return undefined;
  }

  /** Shortest path ego -> target over parent/child/spouse edges. */
  function shortestPath(ego: string, target: string): Step[] | undefined {
    const prev = new Map<string, { from: string; step: Step }>();
    const seen = new Set([ego]);
    const queue = [ego];
    while (queue.length) {
      const x = queue.shift()!;
      if (x === target) break;
      const next: Step[] = [
        ...parentsOf(x).map((to) => ({ kind: 'u' as const, to })),
        ...childrenOfPerson(x).map((to) => ({ kind: 'd' as const, to })),
        ...spousesOf(x).map((s) => ({ kind: s.status === 'former' ? ('sf' as const) : ('s' as const), to: s.id })),
      ];
      for (const st of next)
        if (!seen.has(st.to)) {
          seen.add(st.to);
          prev.set(st.to, { from: x, step: st });
          queue.push(st.to);
        }
    }
    if (!seen.has(target)) return undefined;
    const steps: Step[] = [];
    for (let cur = target; cur !== ego; cur = prev.get(cur)!.from) steps.unshift(prev.get(cur)!.step);
    return steps;
  }

  /** Compose a label like 伯父の妻の甥 from the shortest path, greedily taking the longest master match. */
  function resolvePath(ego: string, target: string): Kinship | undefined {
    const steps = shortestPath(ego, target);
    if (!steps) return undefined;
    const parts: Kinship[] = [];
    let from = ego;
    let i = 0;
    while (i < steps.length) {
      let taken = 0;
      let part: Kinship | undefined;
      // longest run of up/down steps that the master knows
      for (let j = steps.length; j > i && !part; j--) {
        const run = steps.slice(i, j);
        if (run.some((s) => s.kind === 's' || s.kind === 'sf')) continue;
        const firstDown = run.findIndex((s) => s.kind === 'd');
        if (firstDown >= 0 && run.slice(firstDown).some((s) => s.kind === 'u')) continue; // not of form u*d*
        const a = firstDown < 0 ? run.length : firstDown;
        const b = run.length - a;
        const to = run[run.length - 1].to;
        if (!hasKey(`B(${a},${b})`)) continue;
        const bl = blood(from, to);
        const ref = bl && bl.a === a && bl.b === b ? bl.ref : undefined;
        part = master(`B(${a},${b})`, genderOf(to), ageVs(to, ref));
        taken = run.length;
      }
      if (!part) {
        const s = steps[i];
        part = master(s.kind === 'sf' ? 'S(former)' : 'S', genderOf(s.to), 'any');
        taken = 1;
      }
      parts.push(part!);
      from = steps[i + taken - 1].to;
      i += taken;
    }
    return {
      kind: 'path',
      kanji: parts.map((p) => p.kanji).join('の'),
      ruby: parts.map((p) => p.ruby).join('の'),
      kana: parts.map((p) => p.kana).join('の '),
      labelIds: parts.flatMap((p) => p.labelIds),
    };
  }

  return {
    /** Master label if the relation is in range, otherwise a composed path label (or undefined if unrelated). */
    resolve(ego: string, target: string, opts: { pathFallback?: boolean } = {}): Kinship | undefined {
      return resolveMaster(ego, target) ?? (opts.pathFallback === false ? undefined : resolvePath(ego, target));
    },
    blood,
  };
}

export type KinshipResolver = ReturnType<typeof createKinship>;
