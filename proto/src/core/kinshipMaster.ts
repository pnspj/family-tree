// Kinship label master.
//
// Key notation (relation from ego to target):
//   B(a,b)      blood: up `a` generations to the nearest common ancestor, then down `b`
//   S+B(a,b)    blood relative of ego's current spouse
//   B(a,b)+S    current spouse of ego's blood relative
//   S / S(former)  ego's own spouse
// Gender: M / F / N (other or unknown).
// Age: target is older / younger than the reference person (see docs), or any.
// Lookup order: (gender, age) -> (gender, any) -> (N, any).

export type KinGender = 'M' | 'F' | 'N';
export type KinAge = 'older' | 'younger' | 'any';

export interface KinRow {
  key: string;
  gender: KinGender;
  age: KinAge;
  id: string; // stable label id, used for per-family overrides
  kanji: string;
  kana: string; // child-friendly wording
}

const rows: [string, KinGender, KinAge, string, string, string][] = [
  // --- self / spouse ---
  ['B(0,0)', 'N', 'any', 'self', '本人', 'じぶん'],
  ['S', 'M', 'any', 'husband', '夫', 'だんなさん'],
  ['S', 'F', 'any', 'wife', '妻', 'おくさん'],
  ['S', 'N', 'any', 'spouse', '配偶者', 'パートナー'],
  ['S(former)', 'M', 'any', 'ex_husband', '元夫', 'もとの だんなさん'],
  ['S(former)', 'F', 'any', 'ex_wife', '元妻', 'もとの おくさん'],
  ['S(former)', 'N', 'any', 'ex_spouse', '元配偶者', 'もとの パートナー'],

  // --- lineal ascendants ---
  ['B(1,0)', 'M', 'any', 'father', '父', 'おとうさん'],
  ['B(1,0)', 'F', 'any', 'mother', '母', 'おかあさん'],
  ['B(1,0)', 'N', 'any', 'parent', '親', 'おや'],
  ['B(2,0)', 'M', 'any', 'grandfather', '祖父', 'おじいさん'],
  ['B(2,0)', 'F', 'any', 'grandmother', '祖母', 'おばあさん'],
  ['B(2,0)', 'N', 'any', 'grandparent', '祖父母', 'おやの おや'],
  ['B(3,0)', 'M', 'any', 'great_grandfather', '曾祖父', 'ひいおじいさん'],
  ['B(3,0)', 'F', 'any', 'great_grandmother', '曾祖母', 'ひいおばあさん'],
  ['B(3,0)', 'N', 'any', 'great_grandparent', '曾祖父母', 'ひいおじいさん・ひいおばあさん'],
  ['B(4,0)', 'M', 'any', 'gg_grandfather', '高祖父', 'ひいひいおじいさん'],
  ['B(4,0)', 'F', 'any', 'gg_grandmother', '高祖母', 'ひいひいおばあさん'],
  ['B(4,0)', 'N', 'any', 'gg_grandparent', '高祖父母', 'ひいひいおじいさん・ひいひいおばあさん'],

  // --- lineal descendants ---
  ['B(0,1)', 'M', 'any', 'son', '息子', 'むすこ'],
  ['B(0,1)', 'F', 'any', 'daughter', '娘', 'むすめ'],
  ['B(0,1)', 'N', 'any', 'child', '子', 'こども'],
  ['B(0,2)', 'N', 'any', 'grandchild', '孫', 'まご'],
  ['B(0,3)', 'N', 'any', 'great_grandchild', '曾孫', 'ひまご'],
  ['B(0,4)', 'N', 'any', 'gg_grandchild', '玄孫', 'やしゃご'],

  // --- siblings (age: target vs ego) ---
  ['B(1,1)', 'M', 'older', 'elder_brother', '兄', 'おにいさん'],
  ['B(1,1)', 'M', 'younger', 'younger_brother', '弟', 'おとうと'],
  ['B(1,1)', 'F', 'older', 'elder_sister', '姉', 'おねえさん'],
  ['B(1,1)', 'F', 'younger', 'younger_sister', '妹', 'いもうと'],
  ['B(1,1)', 'M', 'any', 'brother', '兄弟', 'きょうだい'],
  ['B(1,1)', 'F', 'any', 'sister', '姉妹', 'きょうだい'],
  ['B(1,1)', 'N', 'any', 'sibling', '兄弟姉妹', 'きょうだい'],

  // --- parent's siblings (age: target vs ego's parent) ---
  ['B(2,1)', 'M', 'older', 'uncle_elder', '伯父', 'おじさん'],
  ['B(2,1)', 'M', 'younger', 'uncle_younger', '叔父', 'おじさん'],
  ['B(2,1)', 'F', 'older', 'aunt_elder', '伯母', 'おばさん'],
  ['B(2,1)', 'F', 'younger', 'aunt_younger', '叔母', 'おばさん'],
  ['B(2,1)', 'M', 'any', 'uncle', 'おじ', 'おじさん'],
  ['B(2,1)', 'F', 'any', 'aunt', 'おば', 'おばさん'],
  ['B(2,1)', 'N', 'any', 'parents_sibling', '親のきょうだい', 'おやの きょうだい'],

  // --- grandparent's siblings (age: target vs ego's grandparent) ---
  ['B(3,1)', 'M', 'older', 'granduncle_elder', '大伯父', 'おおおじさん'],
  ['B(3,1)', 'M', 'younger', 'granduncle_younger', '大叔父', 'おおおじさん'],
  ['B(3,1)', 'F', 'older', 'grandaunt_elder', '大伯母', 'おおおばさん'],
  ['B(3,1)', 'F', 'younger', 'grandaunt_younger', '大叔母', 'おおおばさん'],
  ['B(3,1)', 'M', 'any', 'granduncle', '大おじ', 'おおおじさん'],
  ['B(3,1)', 'F', 'any', 'grandaunt', '大おば', 'おおおばさん'],
  ['B(3,1)', 'N', 'any', 'grandparents_sibling', '祖父母のきょうだい', 'おじいさん・おばあさんの きょうだい'],

  // --- siblings' descendants ---
  ['B(1,2)', 'M', 'any', 'nephew', '甥', 'おい'],
  ['B(1,2)', 'F', 'any', 'niece', '姪', 'めい'],
  ['B(1,2)', 'N', 'any', 'siblings_child', 'きょうだいの子', 'きょうだいの こども'],
  ['B(1,3)', 'M', 'any', 'grandnephew', '大甥', 'おおおい'],
  ['B(1,3)', 'F', 'any', 'grandniece', '大姪', 'おおめい'],
  ['B(1,3)', 'N', 'any', 'siblings_grandchild', 'きょうだいの孫', 'きょうだいの まご'],

  // --- cousins (age: target vs ego) ---
  ['B(2,2)', 'M', 'older', 'cousin_m_elder', '従兄', 'いとこ'],
  ['B(2,2)', 'M', 'younger', 'cousin_m_younger', '従弟', 'いとこ'],
  ['B(2,2)', 'F', 'older', 'cousin_f_elder', '従姉', 'いとこ'],
  ['B(2,2)', 'F', 'younger', 'cousin_f_younger', '従妹', 'いとこ'],
  ['B(2,2)', 'M', 'any', 'cousin_m', '従兄弟', 'いとこ'],
  ['B(2,2)', 'F', 'any', 'cousin_f', '従姉妹', 'いとこ'],
  ['B(2,2)', 'N', 'any', 'cousin', 'いとこ', 'いとこ'],

  // --- spouse's blood relatives (age: target vs the ego-side reference within spouse's family) ---
  ['S+B(1,0)', 'M', 'any', 'father_in_law', '義父', 'ぎりの おとうさん'],
  ['S+B(1,0)', 'F', 'any', 'mother_in_law', '義母', 'ぎりの おかあさん'],
  ['S+B(1,0)', 'N', 'any', 'parent_in_law', '義理の親', 'ぎりの おや'],
  ['S+B(2,0)', 'M', 'any', 'grandfather_in_law', '義祖父', 'ぎりの おじいさん'],
  ['S+B(2,0)', 'F', 'any', 'grandmother_in_law', '義祖母', 'ぎりの おばあさん'],
  ['S+B(2,0)', 'N', 'any', 'grandparent_in_law', '義理の祖父母', 'ぎりの おやの おや'],
  ['S+B(0,1)', 'M', 'any', 'stepson', '継子', 'ぎりの むすこ'],
  ['S+B(0,1)', 'F', 'any', 'stepdaughter', '継子', 'ぎりの むすめ'],
  ['S+B(0,1)', 'N', 'any', 'stepchild', '継子', 'ぎりの こども'],
  ['S+B(1,1)', 'M', 'older', 'brother_in_law_elder', '義兄', 'ぎりの おにいさん'],
  ['S+B(1,1)', 'M', 'younger', 'brother_in_law_younger', '義弟', 'ぎりの おとうと'],
  ['S+B(1,1)', 'F', 'older', 'sister_in_law_elder', '義姉', 'ぎりの おねえさん'],
  ['S+B(1,1)', 'F', 'younger', 'sister_in_law_younger', '義妹', 'ぎりの いもうと'],
  ['S+B(1,1)', 'M', 'any', 'brother_in_law', '義兄弟', 'ぎりの きょうだい'],
  ['S+B(1,1)', 'F', 'any', 'sister_in_law', '義姉妹', 'ぎりの きょうだい'],
  ['S+B(1,1)', 'N', 'any', 'sibling_in_law', '義理のきょうだい', 'ぎりの きょうだい'],
  ['S+B(2,1)', 'M', 'older', 'uncle_elder', '伯父', 'おじさん'],
  ['S+B(2,1)', 'M', 'younger', 'uncle_younger', '叔父', 'おじさん'],
  ['S+B(2,1)', 'F', 'older', 'aunt_elder', '伯母', 'おばさん'],
  ['S+B(2,1)', 'F', 'younger', 'aunt_younger', '叔母', 'おばさん'],
  ['S+B(2,1)', 'M', 'any', 'uncle', 'おじ', 'おじさん'],
  ['S+B(2,1)', 'F', 'any', 'aunt', 'おば', 'おばさん'],
  ['S+B(2,1)', 'N', 'any', 'parents_sibling', '親のきょうだい', 'おやの きょうだい'],
  ['S+B(1,2)', 'M', 'any', 'nephew', '甥', 'おい'],
  ['S+B(1,2)', 'F', 'any', 'niece', '姪', 'めい'],
  ['S+B(1,2)', 'N', 'any', 'siblings_child', 'きょうだいの子', 'きょうだいの こども'],

  // --- blood relatives' spouses (gender = target; age: the blood relative vs reference) ---
  ['B(1,0)+S', 'M', 'any', 'stepfather', '継父', 'ぎりの おとうさん'],
  ['B(1,0)+S', 'F', 'any', 'stepmother', '継母', 'ぎりの おかあさん'],
  ['B(1,0)+S', 'N', 'any', 'stepparent', '継親', 'ぎりの おや'],
  ['B(2,0)+S', 'M', 'any', 'step_grandfather', '継祖父', 'ぎりの おじいさん'],
  ['B(2,0)+S', 'F', 'any', 'step_grandmother', '継祖母', 'ぎりの おばあさん'],
  ['B(2,0)+S', 'N', 'any', 'step_grandparent', '継祖父母', 'ぎりの おやの おや'],
  ['B(0,1)+S', 'M', 'any', 'son_in_law', '婿', 'おむこさん'],
  ['B(0,1)+S', 'F', 'any', 'daughter_in_law', '嫁', 'およめさん'],
  ['B(0,1)+S', 'N', 'any', 'childs_spouse', '子の配偶者', 'こどもの パートナー'],
  ['B(0,2)+S', 'M', 'any', 'grandson_in_law', '孫婿', 'まごの だんなさん'],
  ['B(0,2)+S', 'F', 'any', 'granddaughter_in_law', '孫嫁', 'まごの おくさん'],
  ['B(0,2)+S', 'N', 'any', 'grandchilds_spouse', '孫の配偶者', 'まごの パートナー'],
  ['B(1,1)+S', 'M', 'older', 'brother_in_law_elder', '義兄', 'ぎりの おにいさん'],
  ['B(1,1)+S', 'M', 'younger', 'brother_in_law_younger', '義弟', 'ぎりの おとうと'],
  ['B(1,1)+S', 'F', 'older', 'sister_in_law_elder', '義姉', 'ぎりの おねえさん'],
  ['B(1,1)+S', 'F', 'younger', 'sister_in_law_younger', '義妹', 'ぎりの いもうと'],
  ['B(1,1)+S', 'M', 'any', 'brother_in_law', '義兄弟', 'ぎりの きょうだい'],
  ['B(1,1)+S', 'F', 'any', 'sister_in_law', '義姉妹', 'ぎりの きょうだい'],
  ['B(1,1)+S', 'N', 'any', 'siblings_spouse', 'きょうだいの配偶者', 'きょうだいの パートナー'],
  ['B(2,1)+S', 'M', 'older', 'uncle_elder', '伯父', 'おじさん'],
  ['B(2,1)+S', 'M', 'younger', 'uncle_younger', '叔父', 'おじさん'],
  ['B(2,1)+S', 'F', 'older', 'aunt_elder', '伯母', 'おばさん'],
  ['B(2,1)+S', 'F', 'younger', 'aunt_younger', '叔母', 'おばさん'],
  ['B(2,1)+S', 'M', 'any', 'uncle', 'おじ', 'おじさん'],
  ['B(2,1)+S', 'F', 'any', 'aunt', 'おば', 'おばさん'],
  ['B(2,1)+S', 'N', 'any', 'parents_siblings_spouse', '親のきょうだいの配偶者', 'おやの きょうだいの パートナー'],
  ['B(3,1)+S', 'M', 'older', 'granduncle_elder', '大伯父', 'おおおじさん'],
  ['B(3,1)+S', 'M', 'younger', 'granduncle_younger', '大叔父', 'おおおじさん'],
  ['B(3,1)+S', 'F', 'older', 'grandaunt_elder', '大伯母', 'おおおばさん'],
  ['B(3,1)+S', 'F', 'younger', 'grandaunt_younger', '大叔母', 'おおおばさん'],
  ['B(3,1)+S', 'M', 'any', 'granduncle', '大おじ', 'おおおじさん'],
  ['B(3,1)+S', 'F', 'any', 'grandaunt', '大おば', 'おおおばさん'],
  ['B(3,1)+S', 'N', 'any', 'grandparents_siblings_spouse', '祖父母のきょうだいの配偶者', 'おじいさん・おばあさんの きょうだいの パートナー'],
];

export const KIN_MASTER: KinRow[] = rows.map(([key, gender, age, id, kanji, kana]) => ({ key, gender, age, id, kanji, kana }));

const byKey = new Map<string, KinRow[]>();
for (const r of KIN_MASTER) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);

export const hasKey = (key: string) => byKey.has(key);
/** Whether the key distinguishes older/younger (so age comparison is needed). */
export const usesAge = (key: string) => (byKey.get(key) ?? []).some((r) => r.age !== 'any');

export function lookup(key: string, gender: KinGender, age: KinAge): KinRow | undefined {
  const list = byKey.get(key);
  if (!list) return undefined;
  const find = (g: KinGender, a: KinAge) => list.find((r) => r.gender === g && r.age === a);
  return (age !== 'any' ? find(gender, age) : undefined) ?? find(gender, 'any') ?? find('N', 'any');
}
