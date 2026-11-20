import type { FamilyData, Person, Union } from './model';

// Fictional sample family. Covers: 5 generations, remarriage (half siblings),
// in-law families joining, a single known parent, gender "other".
const P = (
  id: string, fam: string, given: string, famK: string, givenK: string,
  gender: Person['gender'], birthYear?: number, childOf?: string,
): Person => ({ id, familyName: fam, givenName: given, familyNameKana: famK, givenNameKana: givenK, gender, birth: birthYear ? { y: birthYear } : undefined, childOf });
const U = (id: string, a: string | null, b: string | null, status: Union['status'] = 'current'): Union =>
  ({ id, partners: [a, b], status });

export const sample: FamilyData = {
  persons: [
    // Generation 1
    P('ichiro', '山田', '一郎', 'やまだ', 'いちろう', 'M', 1920),
    P('hana', '山田', 'ハナ', 'やまだ', 'はな', 'F', 1924),
    P('tadashi', '佐藤', '正', 'さとう', 'ただし', 'M', 1925),
    P('kiyo', '佐藤', 'キヨ', 'さとう', 'きよ', 'F', 1928),
    // Generation 2
    P('shigeru', '山田', '茂', 'やまだ', 'しげる', 'M', 1948, 'u_ichiro'),
    P('haruko', '木村', '春子', 'きむら', 'はるこ', 'F', 1952, 'u_ichiro'),
    P('osamu', '木村', '修', 'きむら', 'おさむ', 'M', 1950),
    P('kazuko', '山田', '和子', 'やまだ', 'かずこ', 'F', 1950, 'u_tadashi'),
    P('susumu', '佐藤', '進', 'さとう', 'すすむ', 'M', 1955, 'u_tadashi'),
    P('hiroshi', '鈴木', '博', 'すずき', 'ひろし', 'M', 1952),
    P('keiko', '鈴木', '恵子', 'すずき', 'けいこ', 'F', 1955),
    // Generation 3
    P('yumi', '高橋', '由美', 'たかはし', 'ゆみ', 'F', 1975, 'u_shigeru'),
    P('makoto', '高橋', '誠', 'たかはし', 'まこと', 'M', 1973),
    P('kenichi', '山田', '健一', 'やまだ', 'けんいち', 'M', 1978, 'u_shigeru'),
    P('naomi', '田中', '直美', 'たなか', 'なおみ', 'F', 1979),
    P('misaki', '山田', '美咲', 'やまだ', 'みさき', 'F', 1985, 'u_hiroshi'),
    P('daisuke', '鈴木', '大輔', 'すずき', 'だいすけ', 'M', 1982, 'u_hiroshi'),
    P('sakura', '鈴木', 'さくら', 'すずき', 'さくら', 'F', 1984),
    P('takeshi', '木村', '剛', 'きむら', 'たけし', 'M', 1980, 'u_osamu'),
    P('kenta', '佐藤', '健太', 'さとう', 'けんた', 'M', 1985, 'u_susumu'),
    // Generation 4
    P('takuya', '山田', '拓也', 'やまだ', 'たくや', 'M', 2002, 'u_kenichi1'),
    P('rin', '山田', '凛', 'やまだ', 'りん', 'O', 2003),
    P('sho', '高橋', '翔', 'たかはし', 'しょう', 'M', 2008, 'u_yumi'),
    P('hina', '鈴木', '陽菜', 'すずき', 'ひな', 'F', 2014, 'u_daisuke'),
    P('ren', '山田', '蓮', 'やまだ', 'れん', 'M', 2016, 'u_kenichi2'),
    P('aoi', '山田', '葵', 'やまだ', 'あおい', 'F', 2019, 'u_kenichi2'),
    // Generation 5
    P('minato', '山田', '湊', 'やまだ', 'みなと', 'M', 2025, 'u_takuya'),
  ],
  unions: [
    U('u_ichiro', 'ichiro', 'hana'),
    U('u_tadashi', 'tadashi', 'kiyo'),
    U('u_shigeru', 'shigeru', 'kazuko'),
    U('u_osamu', 'osamu', 'haruko'),
    U('u_susumu', 'susumu', null), // only one parent known
    U('u_hiroshi', 'hiroshi', 'keiko'),
    U('u_yumi', 'makoto', 'yumi'),
    U('u_kenichi1', 'kenichi', 'naomi', 'former'),
    U('u_kenichi2', 'kenichi', 'misaki'),
    U('u_daisuke', 'daisuke', 'sakura'),
    U('u_takuya', 'takuya', 'rin'),
  ],
};
