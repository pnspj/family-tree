import { describe, expect, it } from 'vitest';
import { fitName, personNameParts, textUnits } from './display';

const prefs = { script: 'kana' as const, preferNickname: false };

describe('name fitting', () => {
  it('keeps short names on one line', () => {
    expect(fitName(['やまだ', 'れん'])).toEqual({ lines: ['やまだ れん'], size: 'm' });
    expect(fitName(['たかはし', 'まこと'])).toEqual({ lines: ['たかはし まこと'], size: 'm' }); // 7 + space
  });

  it('splits family / given onto two lines when longer than one line', () => {
    expect(fitName(['ちょうそかべ', 'もとちか']).lines).toEqual(['ちょうそかべ', 'もとちか']);
    expect(fitName(['たかはし', 'まことろう']).size).toBe('m');
  });

  it('shrinks the font for long single parts', () => {
    expect(fitName(['かでのこうじ', 'まさのすけろう']).size).toBe('m'); // 7 fits
    expect(fitName(['むしゃのこうじ', 'さねあつろうた']).size).toBe('m');
    expect(fitName(['ひがしくぜみち', 'あれくさんどろす']).size).toBe('m'); // 8
    expect(fitName(['ひがしくぜみち', 'あれくさんどろすた']).size).toBe('s'); // 9
    expect(fitName(['ひがしくぜみち', 'あれくさんどろすたあ']).size).toBe('xs'); // 10
  });

  it('counts half-width characters narrower', () => {
    expect(textUnits('ABC')).toBeCloseTo(1.65);
    expect(textUnits('{山田|やまだ}')).toBe(2);
    expect(textUnits('{亜歴山多|あれくさんどろすた}')).toBeCloseTo(9 * 0.55); // reading is wider than the kanji
    expect(textUnits('{山田|やまだ} {蓮|れん}')).toBeCloseTo(3.65); // 2 + space 0.55 + max(1, れん 2 * 0.55)
    expect(fitName(['Alex', 'Smith']).lines).toEqual(['Alex Smith']); // 10 * 0.55 = 5.5
    expect(fitName(['Alexander', 'Smith']).lines).toEqual(['Alexander', 'Smith']); // 15 * 0.55 = 8.25
  });

  it('splits nicknames at the first space', () => {
    expect(personNameParts({ id: 'x', nickname: 'しずおかの ばあば' }, { ...prefs, preferNickname: true })).toEqual([
      'しずおかの',
      'ばあば',
    ]);
  });

  it('builds per-part ruby in furigana mode', () => {
    expect(
      personNameParts(
        { id: 'x', familyName: '長宗我部', familyNameKana: 'ちょうそかべ', givenName: '元親', givenNameKana: 'もとちか' },
        { script: 'furigana', preferNickname: false },
      ),
    ).toEqual(['{長宗我部|ちょうそかべ}', '{元親|もとちか}']);
  });
});
