// Random tree-shaped family generator for layout stress tests.
import type { FamilyData, Person, Union } from './model';

function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); }
export function randomFamily(n: number, seed: number): FamilyData {
  const r = rng(seed);
  const persons: Person[] = [{ id: 'p0', givenName: 'p0', gender: 'M', birth: { y: 1950 } }];
  const unions: Union[] = [];
  const genOf = new Map([['p0', 0]]);
  const inlaw = new Set<string>(); // married-in spouses never remarry (keeps spouse chains realistic)
  let k = 1;
  const add = (g: number, extra: Partial<Person> = {}) => { const id = `p${k++}`; persons.push({ id, givenName: id, gender: r() < .5 ? 'M' : 'F', birth: { y: 1950 + g * 25 + Math.floor(r() * 10) }, ...extra }); genOf.set(id, g); return id; };
  while (persons.length < n) {
    const p = persons[Math.floor(r() * persons.length)];
    const g = genOf.get(p.id)!;
    const my = unions.filter(u => u.partners.includes(p.id));
    const x = r();
    if (x < 0.3 && !inlaw.has(p.id) && (my.length === 0 || (my.length === 1 && r() < 0.2))) { const s = add(g); inlaw.add(s); unions.push({ id: `u${unions.length}`, partners: [p.id, s], status: my.length ? 'current' : (r() < .2 ? 'former' : 'current') }); }
    else if (x < 0.75 && my.length && g < 4) { const u = my[Math.floor(r() * my.length)]; add(g + 1, { childOf: u.id }); }
    else if (x >= 0.75 && !p.childOf && g > -3) { const u: Union = { id: `u${unions.length}`, partners: [add(g - 1), r() < .85 ? add(g - 1) : null], status: 'current' }; unions.push(u); p.childOf = u.id; }
  }
  return { persons, unions };
}
