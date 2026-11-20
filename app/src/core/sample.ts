import type { FamilyFile, PartialDate, Person, Union } from './types';

// Fictional sample family (5 generations, remarriage, in-law families,
// a single known parent, gender "other", deceased people).
const P = (
  id: string,
  fam: string,
  given: string,
  famK: string,
  givenK: string,
  gender: Person['gender'],
  birth?: PartialDate,
  childOf?: string,
  extra: Partial<Person> = {},
): Person => ({ id, familyName: fam, givenName: given, familyNameKana: famK, givenNameKana: givenK, gender, birth, childOf, ...extra });
const U = (id: string, a: string | null, b: string | null, status: Union['status'] = 'current'): Union => ({ id, partners: [a, b], status });

export function sampleFile(): FamilyFile {
  return {
    format: 'family-tree',
    version: 1,
    persons: [
      P('ichiro', '山田', '一郎', 'やまだ', 'いちろう', 'M', { y: 1920, m: 4, d: 3 }, undefined, { death: { y: 2001, m: 3 } }),
      P('hana', '山田', 'ハナ', 'やまだ', 'はな', 'F', { y: 1924 }, undefined, { deceased: true }),
      P('tadashi', '佐藤', '正', 'さとう', 'ただし', 'M', { y: 1925 }, undefined, { death: { y: 1999 } }),
      P('kiyo', '佐藤', 'キヨ', 'さとう', 'きよ', 'F', { y: 1928, m: 8 }, undefined, { death: { y: 2015, m: 2 } }),
      P('shigeru', '山田', '茂', 'やまだ', 'しげる', 'M', { y: 1948, m: 6, d: 12 }, 'u_ichiro'),
      P('haruko', '木村', '春子', 'きむら', 'はるこ', 'F', { y: 1952 }, 'u_ichiro', { birthFamilyName: '山田', birthFamilyNameKana: 'やまだ' }),
      P('osamu', '木村', '修', 'きむら', 'おさむ', 'M', { y: 1950 }),
      P('kazuko', '山田', '和子', 'やまだ', 'かずこ', 'F', { y: 1950, m: 1, d: 20 }, 'u_tadashi', { birthFamilyName: '佐藤', birthFamilyNameKana: 'さとう' }),
      P('susumu', '佐藤', '進', 'さとう', 'すすむ', 'M', { y: 1955 }, 'u_tadashi'),
      P('hiroshi', '鈴木', '博', 'すずき', 'ひろし', 'M', { y: 1952 }, undefined, { nickname: 'しずおかの じいじ' }),
      P('keiko', '鈴木', '恵子', 'すずき', 'けいこ', 'F', { y: 1955 }, undefined, { nickname: 'しずおかの ばあば' }),
      P('yumi', '高橋', '由美', 'たかはし', 'ゆみ', 'F', { y: 1975 }, 'u_shigeru', { birthFamilyName: '山田', birthFamilyNameKana: 'やまだ' }),
      P('makoto', '高橋', '誠', 'たかはし', 'まこと', 'M', { y: 1973 }),
      P('kenichi', '山田', '健一', 'やまだ', 'けんいち', 'M', { y: 1978, m: 9, d: 1 }, 'u_shigeru'),
      P('naomi', '田中', '直美', 'たなか', 'なおみ', 'F', { y: 1979 }),
      P('misaki', '山田', '美咲', 'やまだ', 'みさき', 'F', { y: 1985, m: 5, d: 5 }, 'u_hiroshi', { birthFamilyName: '鈴木', birthFamilyNameKana: 'すずき' }),
      P('daisuke', '鈴木', '大輔', 'すずき', 'だいすけ', 'M', { y: 1982 }, 'u_hiroshi'),
      P('sakura', '鈴木', 'さくら', 'すずき', 'さくら', 'F', { y: 1984 }),
      P('takeshi', '木村', '剛', 'きむら', 'たけし', 'M', { y: 1980 }, 'u_osamu'),
      P('kenta', '佐藤', '健太', 'さとう', 'けんた', 'M', { y: 1985 }, 'u_susumu'),
      P('takuya', '山田', '拓也', 'やまだ', 'たくや', 'M', { y: 2002 }, 'u_kenichi1'),
      P('rin', '山田', '凛', 'やまだ', 'りん', 'O', { y: 2003 }),
      P('sho', '高橋', '翔', 'たかはし', 'しょう', 'M', { y: 2008 }, 'u_yumi'),
      P('hina', '鈴木', '陽菜', 'すずき', 'ひな', 'F', { y: 2014 }, 'u_daisuke'),
      P('ren', '山田', '蓮', 'やまだ', 'れん', 'M', { y: 2016, m: 7, d: 7 }, 'u_kenichi2'),
      P('aoi', '山田', '葵', 'やまだ', 'あおい', 'F', { y: 2019, m: 2 }, 'u_kenichi2'),
      P('minato', '山田', '湊', 'やまだ', 'みなと', 'M', { y: 2025 }, 'u_takuya'),
    ],
    unions: [
      U('u_ichiro', 'ichiro', 'hana'),
      U('u_tadashi', 'tadashi', 'kiyo'),
      U('u_shigeru', 'shigeru', 'kazuko'),
      U('u_osamu', 'osamu', 'haruko'),
      U('u_susumu', 'susumu', null),
      U('u_hiroshi', 'hiroshi', 'keiko'),
      U('u_yumi', 'makoto', 'yumi'),
      U('u_kenichi1', 'kenichi', 'naomi', 'former'),
      U('u_kenichi2', 'kenichi', 'misaki'),
      U('u_daisuke', 'daisuke', 'sakura'),
      U('u_takuya', 'takuya', 'rin'),
    ],
    settings: { egoId: 'ren', labelOverrides: {} },
  };
}
