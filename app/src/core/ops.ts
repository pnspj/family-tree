// Editing operations and invariant checks. All operations are immutable:
// they return a new FamilyFile (or an error) and never mutate the input.
import type { FamilyFile, LabelOverride, PartialDate, Person, Union } from './types';

export type PersonFields = Omit<Person, 'id' | 'childOf'>;
export type OpResult = { ok: true; file: FamilyFile; personId?: string } | { ok: false; error: string };

export const MAX_UNIONS_PER_PERSON = 2;

export const newId = () => crypto.randomUUID();

export function emptyFile(): FamilyFile {
  return { format: 'family-tree', version: 1, persons: [], unions: [], settings: { labelOverrides: {} } };
}

const fail = (error: string): OpResult => ({ ok: false, error });

/** Drops empty strings / undefined and the redundant deceased flag. */
export function normalizeFields(f: PersonFields): PersonFields {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '' || v === false) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
    if (out[k] === '') delete out[k];
  }
  if (out.death) delete out.deceased;
  if (out.gender !== 'O') delete out.genderLabel;
  return out as PersonFields;
}

const unionsOf = (file: FamilyFile, id: string) => file.unions.filter((u) => u.partners.includes(id));
export const parentUnion = (file: FamilyFile, id: string) => {
  const cu = file.persons.find((p) => p.id === id)?.childOf;
  return cu ? file.unions.find((u) => u.id === cu) : undefined;
};
export const parentCount = (file: FamilyFile, id: string) => parentUnion(file, id)?.partners.filter(Boolean).length ?? 0;
export const unionCount = (file: FamilyFile, id: string) => unionsOf(file, id).length;

/** Removes unions that carry no information and clears dangling childOf. */
export function cleanup(file: FamilyFile): FamilyFile {
  const kids = new Map<string, number>();
  for (const p of file.persons) if (p.childOf) kids.set(p.childOf, (kids.get(p.childOf) ?? 0) + 1);
  const keep = file.unions.filter((u) => {
    const partners = u.partners.filter(Boolean).length;
    const n = kids.get(u.id) ?? 0;
    if (partners === 0) return n >= 2; // unknown parents but known siblings
    if (partners === 1) return n >= 1; // single known parent
    return true;
  });
  const ids = new Set(keep.map((u) => u.id));
  const persons = file.persons.map((p) => (p.childOf && !ids.has(p.childOf) ? withoutKey(p, 'childOf') : p));
  return { ...file, unions: keep, persons };
}

function withoutKey<T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> {
  const { [k]: _omit, ...rest } = o;
  return rest;
}

function addPerson(file: FamilyFile, fields: PersonFields, childOf?: string): [FamilyFile, string] {
  const id = newId();
  const person: Person = { id, ...normalizeFields(fields), ...(childOf ? { childOf } : {}) };
  return [{ ...file, persons: [...file.persons, person] }, id];
}

export function createFirstPerson(file: FamilyFile, fields: PersonFields): OpResult {
  const [f, id] = addPerson(file, fields);
  return { ok: true, file: { ...f, settings: { ...f.settings, egoId: f.settings.egoId ?? id } }, personId: id };
}

export function updatePerson(file: FamilyFile, id: string, fields: PersonFields): OpResult {
  const old = file.persons.find((p) => p.id === id);
  if (!old) return fail('人物が見つかりません');
  const updated: Person = { id, ...normalizeFields(fields), ...(old.childOf ? { childOf: old.childOf } : {}) };
  return { ok: true, file: { ...file, persons: file.persons.map((p) => (p.id === id ? updated : p)) }, personId: id };
}

export function addParent(file: FamilyFile, childId: string, fields: PersonFields): OpResult {
  const child = file.persons.find((p) => p.id === childId);
  if (!child) return fail('人物が見つかりません');
  const pu = parentUnion(file, childId);
  if (pu && pu.partners.every(Boolean)) return fail('親はすでに2人登録されています');
  const [f, id] = addPerson(file, fields);
  if (pu) {
    const slot = pu.partners[0] ? 1 : 0;
    const partners: Union['partners'] = slot === 0 ? [id, pu.partners[1]] : [pu.partners[0], id];
    return { ok: true, file: { ...f, unions: f.unions.map((u) => (u.id === pu.id ? { ...u, partners } : u)) }, personId: id };
  }
  const union: Union = { id: newId(), partners: [id, null], status: 'current' };
  return {
    ok: true,
    file: {
      ...f,
      unions: [...f.unions, union],
      persons: f.persons.map((p) => (p.id === childId ? { ...p, childOf: union.id } : p)),
    },
    personId: id,
  };
}

export function addSpouse(file: FamilyFile, personId: string, fields: PersonFields, status: Union['status'] = 'current'): OpResult {
  if (!file.persons.some((p) => p.id === personId)) return fail('人物が見つかりません');
  if (unionCount(file, personId) >= MAX_UNIONS_PER_PERSON) return fail('婚姻関係は1人につき2つまでです');
  const [f, id] = addPerson(file, fields);
  const union: Union = { id: newId(), partners: [personId, id], status };
  return { ok: true, file: { ...f, unions: [...f.unions, union] }, personId: id };
}

/** `unionId`: one of the person's unions; omitted = a union where the person is the only known parent. */
export function addChild(file: FamilyFile, personId: string, fields: PersonFields, unionId?: string): OpResult {
  if (!file.persons.some((p) => p.id === personId)) return fail('人物が見つかりません');
  let f = file;
  let target = unionId ? file.unions.find((u) => u.id === unionId && u.partners.includes(personId)) : undefined;
  if (unionId && !target) return fail('指定された婚姻関係が見つかりません');
  if (!target) {
    target = unionsOf(file, personId).find((u) => u.partners.filter(Boolean).length === 1);
    if (!target) {
      if (unionCount(file, personId) >= MAX_UNIONS_PER_PERSON) return fail('婚姻関係が2つあるため、どちらの子かを選んでください');
      target = { id: newId(), partners: [personId, null], status: 'current' };
      f = { ...f, unions: [...f.unions, target] };
    }
  }
  const [f2, id] = addPerson(f, fields, target.id);
  return { ok: true, file: f2, personId: id };
}

export function addSibling(file: FamilyFile, personId: string, fields: PersonFields): OpResult {
  const person = file.persons.find((p) => p.id === personId);
  if (!person) return fail('人物が見つかりません');
  if (person.childOf) {
    const [f, id] = addPerson(file, fields, person.childOf);
    return { ok: true, file: f, personId: id };
  }
  const union: Union = { id: newId(), partners: [null, null], status: 'current' };
  const f = {
    ...file,
    unions: [...file.unions, union],
    persons: file.persons.map((p) => (p.id === personId ? { ...p, childOf: union.id } : p)),
  };
  const [f2, id] = addPerson(f, fields, union.id);
  return { ok: true, file: f2, personId: id };
}

export function setUnionStatus(file: FamilyFile, unionId: string, status: Union['status']): OpResult {
  if (!file.unions.some((u) => u.id === unionId)) return fail('婚姻関係が見つかりません');
  return { ok: true, file: { ...file, unions: file.unions.map((u) => (u.id === unionId ? { ...u, status } : u)) } };
}

/** People reachable from `start` without passing through `removed`. */
function reachable(file: FamilyFile, start: string, removed: string): Set<string> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  };
  for (const u of file.unions) {
    // Everyone attached to a union (partners and children) stays connected through it.
    const members = [
      ...u.partners.filter((p): p is string => !!p),
      ...file.persons.filter((p) => p.childOf === u.id).map((p) => p.id),
    ].filter((m) => m !== removed);
    for (let i = 1; i < members.length; i++) link(members[i - 1], members[i]);
  }
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n) && n !== removed) (seen.add(n), stack.push(n));
  return seen;
}

/** Whether deleting the person would split the tree into separate parts. */
export function wouldSplit(file: FamilyFile, personId: string): boolean {
  const rest = file.persons.filter((p) => p.id !== personId);
  if (rest.length < 2) return false;
  return reachable(file, rest[0].id, personId).size < rest.length;
}

export function deletePerson(file: FamilyFile, personId: string): OpResult {
  if (!file.persons.some((p) => p.id === personId)) return fail('人物が見つかりません');
  const f: FamilyFile = {
    ...file,
    persons: file.persons.filter((p) => p.id !== personId),
    unions: file.unions.map((u) => ({
      ...u,
      partners: u.partners.map((p) => (p === personId ? null : p)) as Union['partners'],
    })),
    settings: {
      ...file.settings,
      egoId: file.settings.egoId === personId ? undefined : file.settings.egoId,
    },
  };
  const cleaned = cleanup(f);
  if (!cleaned.settings.egoId && cleaned.persons.length)
    cleaned.settings = { ...cleaned.settings, egoId: cleaned.persons[0].id };
  return { ok: true, file: cleaned };
}

export function setEgo(file: FamilyFile, personId: string): OpResult {
  if (!file.persons.some((p) => p.id === personId)) return fail('人物が見つかりません');
  return { ok: true, file: { ...file, settings: { ...file.settings, egoId: personId } } };
}

export function setLabelOverride(file: FamilyFile, labelId: string, override: LabelOverride | undefined): OpResult {
  const labelOverrides = { ...file.settings.labelOverrides };
  const clean: LabelOverride = {};
  if (override?.kanji?.trim()) clean.kanji = override.kanji.trim();
  if (override?.kana?.trim()) clean.kana = override.kana.trim();
  if (clean.kanji || clean.kana) labelOverrides[labelId] = clean;
  else delete labelOverrides[labelId];
  return { ok: true, file: { ...file, settings: { ...file.settings, labelOverrides } } };
}

// ---- validation -------------------------------------------------------------

function dateError(d: PartialDate | undefined, label: string): string | undefined {
  if (!d) return;
  if (!Number.isInteger(d.y)) return `${label}の年が不正です`;
  if (d.m !== undefined && !(Number.isInteger(d.m) && d.m >= 1 && d.m <= 12)) return `${label}の月が不正です`;
  if (d.d !== undefined) {
    if (d.m === undefined) return `${label}に月がないのに日があります`;
    const last = new Date(d.y, d.m, 0).getDate();
    if (!(Number.isInteger(d.d) && d.d >= 1 && d.d <= last)) return `${label}の日が不正です`;
  }
}

/** Returns the list of invariant violations (empty = valid). */
export function validate(file: FamilyFile): string[] {
  const errors: string[] = [];
  const pIds = new Set<string>();
  for (const p of file.persons) {
    if (!p.id || pIds.has(p.id)) errors.push(`人物IDが重複または空です: ${p.id}`);
    pIds.add(p.id);
    const e1 = dateError(p.birth, '生年月日');
    const e2 = dateError(p.death, '没年月日');
    if (e1) errors.push(`${p.id}: ${e1}`);
    if (e2) errors.push(`${p.id}: ${e2}`);
  }
  const uIds = new Set<string>();
  const pairs = new Set<string>();
  const count = new Map<string, number>();
  for (const u of file.unions) {
    if (!u.id || uIds.has(u.id)) errors.push(`婚姻IDが重複または空です: ${u.id}`);
    uIds.add(u.id);
    if (!Array.isArray(u.partners) || u.partners.length !== 2) {
      errors.push(`${u.id}: partners の形式が不正です`);
      continue;
    }
    if (u.status !== 'current' && u.status !== 'former') errors.push(`${u.id}: status が不正です`);
    const [a, b] = u.partners;
    if (a && a === b) errors.push(`${u.id}: 同じ人物が2回入っています`);
    for (const p of [a, b]) {
      if (!p) continue;
      if (!pIds.has(p)) errors.push(`${u.id}: 存在しない人物 ${p} を参照しています`);
      count.set(p, (count.get(p) ?? 0) + 1);
    }
    if (a && b) {
      const key = [a, b].sort().join('|');
      if (pairs.has(key)) errors.push(`${u.id}: 同じ2人の婚姻関係が重複しています`);
      pairs.add(key);
    }
  }
  for (const [p, n] of count) if (n > MAX_UNIONS_PER_PERSON) errors.push(`${p}: 婚姻関係が3つ以上あります`);
  for (const p of file.persons) if (p.childOf && !uIds.has(p.childOf)) errors.push(`${p.id}: 存在しない婚姻 ${p.childOf} を参照しています`);

  // cycles: nobody may be their own ancestor
  const parents = new Map<string, string[]>();
  const unionMap = new Map(file.unions.map((u) => [u.id, u]));
  for (const p of file.persons) {
    const u = p.childOf ? unionMap.get(p.childOf) : undefined;
    parents.set(p.id, u ? u.partners.filter((x): x is string => !!x) : []);
  }
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const par of parents.get(id) ?? []) if (dfs(par)) return true;
    state.set(id, 2);
    return false;
  };
  for (const p of file.persons)
    if (dfs(p.id)) {
      errors.push('親子関係が循環しています（自分が自分の祖先になっています）');
      break;
    }
  return errors;
}

/** Parses an imported JSON text into a valid FamilyFile. */
export function parseFamilyFile(text: string): { ok: true; file: FamilyFile } | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON として読み込めませんでした'] };
  }
  const o = raw as Partial<FamilyFile>;
  if (!o || o.format !== 'family-tree') return { ok: false, errors: ['家系図のファイルではありません'] };
  if (o.version !== 1) return { ok: false, errors: [`対応していないバージョンです: ${String(o.version)}`] };
  if (!Array.isArray(o.persons) || !Array.isArray(o.unions)) return { ok: false, errors: ['persons / unions がありません'] };
  const file = cleanup({
    format: 'family-tree',
    version: 1,
    persons: o.persons,
    unions: o.unions,
    settings: { labelOverrides: {}, ...(o.settings ?? {}) },
  });
  const errors = validate(file);
  if (errors.length) return { ok: false, errors };
  if (file.settings.egoId && !file.persons.some((p) => p.id === file.settings.egoId)) file.settings.egoId = file.persons[0]?.id;
  return { ok: true, file };
}
