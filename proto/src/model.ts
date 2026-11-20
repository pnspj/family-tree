// Layout-side helpers on top of the canonical model in core/types.ts.
import { birthSortKey } from './core/date';
import type { FamilyData, Person, Union } from './core/types';
export type { FamilyData, Gender, Person, Union } from './core/types';

export const displayName = (p: Person) =>
  `${p.familyName ?? ''} ${p.givenName ?? ''}`.trim() || '（なまえなし）';

export function index(data: FamilyData) {
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const order = new Map(data.persons.map((p, i) => [p.id, i]));
  const childrenOf = new Map<string, Person[]>();
  for (const p of data.persons) {
    if (!p.childOf) continue;
    const list = childrenOf.get(p.childOf) ?? [];
    list.push(p);
    childrenOf.set(p.childOf, list);
  }
  // Siblings ordered by birth year, then registration order.
  for (const list of childrenOf.values()) {
    list.sort((a, b) => {
      const ka = birthSortKey(a);
      const kb = birthSortKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || order.get(a.id)! - order.get(b.id)!;
    });
  }
  const unionsOf = new Map<string, Union[]>();
  for (const u of data.unions) {
    for (const pid of u.partners) {
      if (!pid) continue;
      const list = unionsOf.get(pid) ?? [];
      list.push(u);
      unionsOf.set(pid, list);
    }
  }
  return { persons, unions, childrenOf, unionsOf };
}
export type Index = ReturnType<typeof index>;
