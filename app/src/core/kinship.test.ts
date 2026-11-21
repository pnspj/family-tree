import { describe, expect, it } from 'vitest';
import { sampleFile } from './sample';
import { createKinship } from './kinship';
import { KIN_MASTER } from './kinshipMaster';
import { ageText, compareDates, yearsBetween } from './date';
import type { FamilyData } from './types';

const sample = sampleFile();
const k = createKinship(sample);
const label = (ego: string, target: string) => {
  const r = k.resolve(ego, target);
  return r ? `${r.kanji}/${r.kana}` : undefined;
};

describe('kinship from 蓮 (ren, 2016, M)', () => {
  it.each([
    ['ren', '本人/じぶん'],
    ['kenichi', '父/おとうさん'],
    ['misaki', '母/おかあさん'],
    ['takuya', '兄/おにいさん'], // half brother (former union)
    ['aoi', '妹/いもうと'],
    ['shigeru', '祖父/おじいさん'],
    ['hiroshi', '祖父/おじいさん'],
    ['ichiro', '曾祖父/ひいおじいさん'],
    ['kiyo', '曾祖母/ひいおばあさん'], // via 父→祖母(和子)
    ['yumi', '伯母/おばさん'], // older than 父
    ['makoto', '伯父/おじさん'], // spouse of 伯母; age follows 由美
    ['daisuke', '伯父/おじさん'], // older than 母
    ['sakura', '伯母/おばさん'],
    ['sho', '従兄/いとこ'],
    ['hina', '従姉/いとこ'],
    ['haruko', '大叔母/おおおばさん'], // younger than 祖父
    ['osamu', '大叔父/おおおじさん'],
    ['susumu', '大叔父/おおおじさん'], // 祖母's younger brother
    ['minato', '甥/おい'],
    ['rin', 'きょうだいの配偶者/きょうだいの パートナー'], // gender other
    // out of master range -> composed path
    ['takeshi', '大叔母の息子/おおおばさんの むすこ'],
    ['kenta', '大叔父の息子/おおおじさんの むすこ'],
    ['naomi', '父の元妻/おとうさんの もとの おくさん'],
  ])('%s -> %s', (target, expected) => expect(label('ren', target)).toBe(expected));

  it('reports paternal / maternal side', () => {
    expect(k.resolve('ren', 'shigeru')?.side).toBe('paternal');
    expect(k.resolve('ren', 'hiroshi')?.side).toBe('maternal');
    expect(k.resolve('ren', 'sakura')?.side).toBe('maternal');
    // the parents themselves have no side (not 「母方の母」)
    expect(k.resolve('ren', 'kenichi')?.side).toBeUndefined();
    expect(k.resolve('ren', 'misaki')?.side).toBeUndefined();
  });
});

describe('kinship from other egos', () => {
  it.each([
    ['kenichi', 'misaki', '妻/おくさん'],
    ['kenichi', 'naomi', '元妻/もとの おくさん'],
    ['kenichi', 'takuya', '息子/むすこ'],
    ['kenichi', 'rin', '子の配偶者/こどもの パートナー'],
    ['kenichi', 'minato', '孫/まご'],
    ['kenichi', 'hiroshi', '義父/ぎりの おとうさん'],
    ['kenichi', 'daisuke', '義兄/ぎりの おにいさん'], // older than 妻
    ['kenichi', 'hina', '姪/めい'],
    ['kenichi', 'sakura', '妻の兄の妻/おくさんの おにいさんの おくさん'],
    ['misaki', 'takuya', '継子/ぎりの むすこ'],
    ['misaki', 'naomi', '夫の元妻/だんなさんの もとの おくさん'],
    ['shigeru', 'misaki', '嫁/およめさん'],
    ['yumi', 'misaki', '義妹/ぎりの いもうと'], // 弟の妻
    ['ichiro', 'minato', '玄孫/やしゃご'],
    ['minato', 'ichiro', '高祖父/ひいひいおじいさん'],
    ['minato', 'ren', '叔父/おじさん'], // half-uncle, younger than 父(拓也)
    ['sho', 'hina', '叔父の妻の姪/おじさんの おくさんの めい'], // いとこのいとこ
  ])('%s -> %s = %s', (ego, target, expected) => expect(label(ego, target)).toBe(expected));

  it('returns undefined for unrelated people and when path fallback is disabled', () => {
    const data: FamilyData = { ...sample, persons: [...sample.persons, { id: 'stranger' }] };
    expect(createKinship(data).resolve('ren', 'stranger')).toBeUndefined();
    expect(k.resolve('ren', 'takeshi', { pathFallback: false })).toBeUndefined();
  });

  it('applies per-family label overrides', () => {
    const kk = createKinship(sample, { father: { kana: 'パパ' }, grandmother: { kana: 'ばあば' } });
    expect(kk.resolve('ren', 'kenichi')?.kana).toBe('パパ');
    expect(kk.resolve('ren', 'kazuko')?.kana).toBe('ばあば');
    expect(kk.resolve('ren', 'naomi')?.kana).toBe('パパの もとの おくさん');
  });

  it('falls back to neutral labels when ages cannot be compared', () => {
    const data: FamilyData = {
      persons: [
        { id: 'p', gender: 'M' },
        { id: 'a', gender: 'M', childOf: 'u' },
        { id: 'b', gender: 'F', birth: { y: 2000 }, childOf: 'u' },
        { id: 'c', gender: 'F', birth: { y: 2000, m: 5 }, childOf: 'u' },
      ],
      unions: [{ id: 'u', partners: ['p', null], status: 'current' }],
    };
    const kk = createKinship(data);
    expect(kk.resolve('a', 'b')?.kanji).toBe('姉妹'); // a has no birth date
    expect(kk.resolve('c', 'b')?.kanji).toBe('姉妹'); // 2000 vs 2000-05: undecidable
  });
});

describe('master integrity', () => {
  it('has unique (key, gender, age) rows and an N/any fallback for every key', () => {
    const seen = new Set<string>();
    for (const r of KIN_MASTER) {
      const id = `${r.key}|${r.gender}|${r.age}`;
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
    }
    for (const key of new Set(KIN_MASTER.map((r) => r.key))) expect(seen.has(`${key}|N|any`), key).toBe(true);
  });
  it('maps a label id to one wording', () => {
    const byId = new Map<string, string>();
    for (const r of KIN_MASTER) {
      const w = `${r.kanji}/${r.kana}`;
      expect(byId.get(r.id) ?? w, r.id).toBe(w);
      byId.set(r.id, w);
    }
  });
});

describe('dates', () => {
  it('compares partial dates', () => {
    expect(compareDates({ y: 1980 }, { y: 1981 })).toBe(-1);
    expect(compareDates({ y: 1980 }, { y: 1980, m: 3 })).toBeUndefined();
    expect(compareDates({ y: 1980, m: 3, d: 1 }, { y: 1980, m: 3, d: 1 })).toBe(0);
  });
  it('ages on the start of the known period', () => {
    expect(yearsBetween({ y: 2000 }, { y: 2026, m: 1, d: 1 })).toBe(26);
    expect(yearsBetween({ y: 2000, m: 12 }, { y: 2026, m: 11, d: 20 })).toBe(25);
    expect(yearsBetween({ y: 2000, m: 11, d: 20 }, { y: 2026, m: 11, d: 20 })).toBe(26);
  });
  it('formats age and age at death', () => {
    const today = new Date(2026, 10, 20);
    expect(ageText({ id: 'x', birth: { y: 2016 } }, today)).toBe('10歳');
    expect(ageText({ id: 'x', birth: { y: 1920, m: 4 }, death: { y: 2001, m: 3 } }, today)).toBe('満80歳で没');
    expect(ageText({ id: 'x', birth: { y: 1920 }, deceased: true }, today)).toBeUndefined();
  });
});

describe('furigana readings', () => {
  it('has a reading for every label id whose base text matches the kanji label', async () => {
    const { YOMI, rubyBase } = await import('./kinshipMaster');
    for (const r of KIN_MASTER) {
      expect(YOMI[r.id], r.id).toBeDefined();
      expect(rubyBase(YOMI[r.id]), r.id).toBe(r.kanji);
    }
  });
  it('composes readings for path labels and drops them for custom kanji', () => {
    expect(k.resolve('ren', 'takeshi')?.ruby).toBe('{大叔母|おおおば}の{息子|むすこ}');
    const kk = createKinship(sample, { father: { kanji: 'お父ちゃん' } });
    expect(kk.resolve('ren', 'kenichi')?.ruby).toBe('お父ちゃん');
  });
});

describe('siblings whose parents are not registered yet', () => {
  // 太郎 and 花子 are siblings (shared union without partners); 一郎 is 太郎's son, 二郎 is 花子's son.
  const data: FamilyData = {
    persons: [
      { id: 'taro', gender: 'M', birth: { y: 1980 }, childOf: 'u_sib' },
      { id: 'hanako', gender: 'F', birth: { y: 1983 }, childOf: 'u_sib' },
      { id: 'ichiro', gender: 'M', birth: { y: 2010 }, childOf: 'u_taro' },
      { id: 'jiro', gender: 'M', birth: { y: 2012 }, childOf: 'u_hanako' },
    ],
    unions: [
      { id: 'u_sib', partners: [null, null], status: 'current' },
      { id: 'u_taro', partners: ['taro', null], status: 'current' },
      { id: 'u_hanako', partners: ['hanako', null], status: 'current' },
    ],
  };
  const kk = createKinship(data);
  const kanji = (a: string, b: string) => kk.resolve(a, b)?.kanji;

  it('are siblings to each other', () => {
    expect(kanji('taro', 'hanako')).toBe('妹');
    expect(kanji('hanako', 'taro')).toBe('兄');
  });
  it('make their children nephews / cousins', () => {
    expect(kanji('ichiro', 'hanako')).toBe('叔母'); // younger than 一郎's father
    expect(kanji('hanako', 'ichiro')).toBe('甥');
    expect(kanji('ichiro', 'jiro')).toBe('従弟');
  });
  it('carry no paternal / maternal side through the unknown parents', () => {
    expect(kk.resolve('ichiro', 'hanako')?.side).toBe('paternal'); // via 太郎 (father)
    expect(kk.resolve('taro', 'hanako')?.side).toBeUndefined();
  });
});
