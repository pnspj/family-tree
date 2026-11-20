import { describe, expect, it } from 'vitest';
import {
  addChild,
  addParent,
  addSibling,
  addSpouse,
  cleanup,
  createFirstPerson,
  deletePerson,
  emptyFile,
  normalizeFields,
  parseFamilyFile,
  setLabelOverride,
  updatePerson,
  validate,
  wouldSplit,
  type OpResult,
} from './ops';
import { sampleFile } from './sample';
import type { FamilyFile } from './types';

const ok = (r: OpResult) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const person = (f: FamilyFile, id: string) => f.persons.find((p) => p.id === id)!;
const start = () => ok(createFirstPerson(emptyFile(), { givenName: '太郎', gender: 'M' }));

describe('building a tree', () => {
  it('first person becomes ego', () => {
    const r = start();
    expect(r.file.settings.egoId).toBe(r.personId);
  });

  it('adds up to two parents into one union', () => {
    const { file: f0, personId: me } = start();
    const r1 = ok(addParent(f0, me!, { givenName: '父', gender: 'M' }));
    const r2 = ok(addParent(r1.file, me!, { givenName: '母', gender: 'F' }));
    expect(r2.file.unions).toHaveLength(1);
    expect(r2.file.unions[0].partners).toEqual([r1.personId, r2.personId]);
    const r3 = addParent(r2.file, me!, { givenName: '3人目' });
    expect(r3.ok).toBe(false);
  });

  it('adding a parent to someone with only siblings fills the shared union', () => {
    const { file: f0, personId: me } = start();
    const s = ok(addSibling(f0, me!, { givenName: '妹', gender: 'F' }));
    expect(s.file.unions[0].partners).toEqual([null, null]);
    const p = ok(addParent(s.file, me!, { givenName: '母', gender: 'F' }));
    expect(person(p.file, s.personId!).childOf).toBe(person(p.file, me!).childOf);
    expect(p.file.unions[0].partners).toEqual([p.personId, null]);
  });

  it('limits a person to two unions', () => {
    const { file: f0, personId: me } = start();
    const a = ok(addSpouse(f0, me!, { givenName: '前妻' }, 'former'));
    const b = ok(addSpouse(a.file, me!, { givenName: '妻' }));
    expect(addSpouse(b.file, me!, { givenName: '3人目' }).ok).toBe(false);
  });

  it('adds children to a chosen union or a single-parent union', () => {
    const { file: f0, personId: me } = start();
    const single = ok(addChild(f0, me!, { givenName: '子1' }));
    const again = ok(addChild(single.file, me!, { givenName: '子2' }));
    expect(person(again.file, single.personId!).childOf).toBe(person(again.file, again.personId!).childOf);
    const sp = ok(addSpouse(again.file, me!, { givenName: '妻' }));
    const u = sp.file.unions.find((x) => x.partners.includes(sp.personId!))!;
    const c = ok(addChild(sp.file, me!, { givenName: '子3' }, u.id));
    expect(person(c.file, c.personId!).childOf).toBe(u.id);
    // two unions and no single-parent union -> must choose
    const f2 = ok(addSpouse(ok(addSpouse(f0, me!, { givenName: 'A' })).file, me!, { givenName: 'B' }));
    expect(addChild(f2.file, me!, { givenName: 'x' }).ok).toBe(false);
  });

  it('keeps childOf when updating and normalizes fields', () => {
    const f = sampleFile();
    const r = ok(updatePerson(f, 'ren', { givenName: ' 蓮 ', familyName: '', death: { y: 2100 }, deceased: true }));
    const p = person(r.file, 'ren');
    expect(p.childOf).toBe('u_kenichi2');
    expect(p.givenName).toBe('蓮');
    expect(p.familyName).toBeUndefined();
    expect(p.deceased).toBeUndefined(); // implied by death date
    expect(normalizeFields({ gender: 'M', genderLabel: 'x' }).genderLabel).toBeUndefined();
  });
});

describe('deleting', () => {
  it('detects when deletion splits the tree', () => {
    const f = sampleFile();
    expect(wouldSplit(f, 'kenichi')).toBe(true); // connects 山田 and 鈴木 sides
    expect(wouldSplit(f, 'aoi')).toBe(false);
    expect(wouldSplit(f, 'misaki')).toBe(true); // only link to 鈴木家
  });

  it('removes the person, empties the slot and cleans up unions', () => {
    const f = sampleFile();
    const r = ok(deletePerson(f, 'naomi'));
    expect(r.file.unions.find((u) => u.id === 'u_kenichi1')!.partners).toEqual(['kenichi', null]); // takuya keeps a parent
    const r2 = ok(deletePerson(r.file, 'takuya'));
    expect(r2.file.unions.some((u) => u.id === 'u_kenichi1')).toBe(false); // no children, one partner
    expect(validate(r2.file)).toEqual([]);
  });

  it('moves ego when the ego is deleted', () => {
    const r = ok(deletePerson(sampleFile(), 'ren'));
    expect(r.file.settings.egoId).toBeDefined();
    expect(r.file.settings.egoId).not.toBe('ren');
  });
});

describe('validation and import', () => {
  it('accepts the sample', () => expect(validate(sampleFile())).toEqual([]));

  it('detects cycles, bad references, too many unions and bad dates', () => {
    const f = sampleFile();
    const cyc = { ...f, persons: f.persons.map((p) => (p.id === 'ichiro' ? { ...p, childOf: 'u_kenichi2' } : p)) };
    expect(validate(cyc).join()).toContain('循環');
    const bad = { ...f, unions: [...f.unions, { id: 'x', partners: ['ghost', null] as [string, null], status: 'current' as const }] };
    expect(validate(bad).join()).toContain('存在しない人物');
    const many = {
      ...f,
      unions: [...f.unions, { id: 'x', partners: ['kenichi', 'sakura'] as [string, string], status: 'current' as const }],
    };
    expect(validate(many).join()).toContain('3つ以上');
    const date = { ...f, persons: f.persons.map((p) => (p.id === 'ren' ? { ...p, birth: { y: 2016, m: 2, d: 30 } } : p)) };
    expect(validate(date).join()).toContain('日が不正');
  });

  it('round-trips through JSON and rejects foreign files', () => {
    const f = sampleFile();
    const r = parseFamilyFile(JSON.stringify(f));
    expect(r.ok && r.file).toEqual(f);
    expect(parseFamilyFile('{"hello":1}').ok).toBe(false);
    expect(parseFamilyFile('not json').ok).toBe(false);
  });

  it('cleanup drops meaningless unions', () => {
    const f = emptyFile();
    f.persons.push({ id: 'a', childOf: 'u1' });
    f.unions.push({ id: 'u1', partners: [null, null], status: 'current' });
    const c = cleanup(f);
    expect(c.unions).toHaveLength(0);
    expect(c.persons[0].childOf).toBeUndefined();
  });

  it('stores and clears label overrides', () => {
    const r = ok(setLabelOverride(sampleFile(), 'father', { kana: 'パパ', kanji: '' }));
    expect(r.file.settings.labelOverrides.father).toEqual({ kana: 'パパ' });
    const r2 = ok(setLabelOverride(r.file, 'father', undefined));
    expect(r2.file.settings.labelOverrides.father).toBeUndefined();
  });
});
