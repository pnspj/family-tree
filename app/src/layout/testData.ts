// Test fixtures for layout tests.
import type { FamilyData, Person, Union } from '../core/types';

function rng(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

/** Random tree-shaped family (married-in spouses never remarry, like most real families). */
export function randomFamily(n: number, seed: number): FamilyData {
  const r = rng(seed);
  const persons: Person[] = [{ id: 'p0', gender: 'M', birth: { y: 1950 } }];
  const unions: Union[] = [];
  const genOf = new Map([['p0', 0]]);
  const inlaw = new Set<string>();
  let k = 1;
  const add = (g: number, extra: Partial<Person> = {}) => {
    const id = `p${k++}`;
    persons.push({ id, gender: r() < 0.5 ? 'M' : 'F', birth: { y: 1950 + g * 25 + Math.floor(r() * 10) }, ...extra });
    genOf.set(id, g);
    return id;
  };
  while (persons.length < n) {
    const p = persons[Math.floor(r() * persons.length)];
    const g = genOf.get(p.id)!;
    const my = unions.filter((u) => u.partners.includes(p.id));
    const x = r();
    if (x < 0.3 && !inlaw.has(p.id) && (my.length === 0 || (my.length === 1 && r() < 0.2))) {
      const s = add(g);
      inlaw.add(s);
      unions.push({ id: `u${unions.length}`, partners: [p.id, s], status: my.length ? 'current' : r() < 0.2 ? 'former' : 'current' });
    } else if (x < 0.75 && my.length && g < 4) {
      add(g + 1, { childOf: my[Math.floor(r() * my.length)].id });
    } else if (x >= 0.75 && !p.childOf && g > -3) {
      const u: Union = { id: `u${unions.length}`, partners: [add(g - 1), r() < 0.85 ? add(g - 1) : null], status: 'current' };
      unions.push(u);
      p.childOf = u.id;
    }
  }
  return { persons, unions };
}

/** Reported case: the wife's single parent was placed left of the husband's parents. */
export const inlawRightCase: FamilyData = {
  persons: [
    { id: 'tatsuo', gender: 'M', birth: { y: 1981, m: 6, d: 25 }, childOf: 'u_ken' },
    { id: 'yuu', gender: 'F', birth: { y: 1980, m: 11, d: 5 }, childOf: 'u_yoshizo' },
    { id: 'ken', gender: 'M', birth: { y: 1950, m: 5, d: 1 }, death: { y: 2026, m: 5, d: 6 } },
    { id: 'kei', gender: 'F', birth: { y: 1956, m: 1, d: 21 } },
    { id: 'yoshizo', gender: 'M', birth: { y: 1949, m: 12, d: 23 } },
  ],
  unions: [
    { id: 'u_tatsuo', partners: ['tatsuo', 'yuu'], status: 'current' },
    { id: 'u_ken', partners: ['ken', 'kei'], status: 'current' },
    { id: 'u_yoshizo', partners: ['yoshizo', null], status: 'current' },
  ],
};
