// Canonical data model (v1). See docs/data-model.md for the specification.

/** A date that may be known only to the year or year+month. */
export interface PartialDate {
  y: number;
  m?: number; // 1-12, requires y
  d?: number; // 1-31, requires m
}

export type Gender = 'M' | 'F' | 'O';

export interface Person {
  id: string;
  familyName?: string; // 姓
  givenName?: string; // 名
  familyNameKana?: string; // みょうじ
  givenNameKana?: string; // なまえ
  birthFamilyName?: string; // 旧姓
  birthFamilyNameKana?: string; // 旧姓（かな）
  nickname?: string; // 呼び名（例: 大阪のおばあちゃん）
  gender?: Gender;
  genderLabel?: string; // free text when gender === 'O'
  birth?: PartialDate;
  death?: PartialDate;
  deceased?: boolean; // only needed when the death date is unknown
  childOf?: string; // Union id of the parents
}

export interface Union {
  id: string;
  partners: [string | null, string | null];
  status: 'current' | 'former';
}

export interface LabelOverride {
  kanji?: string;
  kana?: string;
}

export interface Settings {
  egoId?: string;
  /** Per-family label wording, keyed by kinship label id (e.g. father -> パパ). */
  labelOverrides: Record<string, LabelOverride>;
}

/** The persisted/exported document. Array order of `persons` = registration order. */
export interface FamilyFile {
  format: 'family-tree';
  version: 1;
  persons: Person[];
  unions: Union[];
  settings: Settings;
}

export type FamilyData = Pick<FamilyFile, 'persons' | 'unions'>;
