import { describe, expect, it } from 'vitest';
import { createKinship } from './kinship';
import { isCorrectFind, labelKey, makeQuestion, quizCandidates } from './quiz';
import { sampleFile } from './sample';

const file = sampleFile();
const kin = createKinship(file);
const seeded = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;

describe('quiz', () => {
  it('only asks about relatives inside the kinship master', () => {
    const ids = quizCandidates(file, 'ren', kin).map((c) => c.id);
    expect(ids).toContain('shigeru');
    expect(ids).not.toContain('takeshi'); // 大叔母の息子 is a composed path label
    expect(ids).not.toContain('ren');
  });

  it('accepts every person with the shown label in find questions', () => {
    for (let s = 1; s < 200; s++) {
      const q = makeQuestion(file, 'ren', kin, { kana: true, rng: seeded(s) })!;
      if (q.kind !== 'find' || q.label.kana !== 'おじいさん') continue;
      expect(q.answers.sort()).toEqual(['hiroshi', 'shigeru']); // both grandfathers
      expect(isCorrectFind(q, 'shigeru')).toBe(true);
      expect(isCorrectFind(q, 'ichiro')).toBe(false);
      return;
    }
    throw new Error('no おじいさん question generated');
  });

  it('builds four distinct choices containing the right label', () => {
    for (let s = 1; s < 100; s++) {
      for (const kana of [true, false]) {
        const q = makeQuestion(file, 'ren', kin, { kana, rng: seeded(s) })!;
        if (q.kind !== 'name') continue;
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices.map((c) => labelKey(c, kana))).size).toBe(4);
        const truth = kin.resolve('ren', q.targetId)!;
        expect(labelKey(q.choices[q.correct], kana)).toBe(kana ? truth.kana : truth.kanji);
      }
    }
  });

  it('avoids repeating recent targets when possible', () => {
    const avoid = quizCandidates(file, 'ren', kin)
      .map((c) => c.id)
      .filter((id) => id !== 'aoi');
    for (let s = 1; s < 30; s++) {
      const q = makeQuestion(file, 'ren', kin, { kana: true, rng: seeded(s), avoid })!;
      if (q.kind === 'name') expect(q.targetId).toBe('aoi');
      else expect(q.answers).toContain('aoi');
    }
  });

  it('returns undefined when nobody is related', () => {
    const lonely = { persons: [{ id: 'a' }], unions: [] };
    expect(makeQuestion(lonely, 'a', createKinship(lonely), { kana: true })).toBeUndefined();
  });
});
