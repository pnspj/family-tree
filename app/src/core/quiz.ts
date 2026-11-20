// Kinship quiz: question generation and answer checking (pure logic).
import type { Kinship, KinshipResolver } from './kinship';
import type { FamilyData } from './types';

export interface Label {
  kanji: string;
  kana: string;
  ruby: string;
}

export type Question =
  /** "Which one is おばあさん?" — tap any card whose label matches. */
  | { kind: 'find'; label: Label; answers: string[] }
  /** "What is 茂 to you?" — pick the label. */
  | { kind: 'name'; targetId: string; choices: Label[]; correct: number };

export type Rng = () => number;

/** Common labels used as distractors when the family itself has few kinds of relatives. */
const POOL: Label[] = [
  ['父', 'おとうさん', '{父|ちち}'],
  ['母', 'おかあさん', '{母|はは}'],
  ['祖父', 'おじいさん', '{祖父|そふ}'],
  ['祖母', 'おばあさん', '{祖母|そぼ}'],
  ['兄', 'おにいさん', '{兄|あに}'],
  ['姉', 'おねえさん', '{姉|あね}'],
  ['弟', 'おとうと', '{弟|おとうと}'],
  ['妹', 'いもうと', '{妹|いもうと}'],
  ['伯父', 'おじさん', '{伯父|おじ}'],
  ['叔母', 'おばさん', '{叔母|おば}'],
  ['従兄', 'いとこ', '{従兄|いとこ}'],
  ['孫', 'まご', '{孫|まご}'],
  ['甥', 'おい', '{甥|おい}'],
  ['姪', 'めい', '{姪|めい}'],
  ['曾祖母', 'ひいおばあさん', '{曾祖母|そうそぼ}'],
].map(([kanji, kana, ruby]) => ({ kanji, kana, ruby }));

/** In kana mode 伯父 and 叔父 are both おじさん, so questions compare by the shown wording. */
export const labelKey = (l: Label, kana: boolean) => (kana ? l.kana : l.kanji);

const toLabel = (k: Kinship): Label => ({ kanji: k.kanji, kana: k.kana, ruby: k.ruby });

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** People who can be asked about: related through the kinship master (not composed paths). */
export function quizCandidates(data: FamilyData, egoId: string, kin: KinshipResolver) {
  return data.persons
    .filter((p) => p.id !== egoId)
    .map((p) => ({ id: p.id, k: kin.resolve(egoId, p.id, { pathFallback: false }) }))
    .filter((x): x is { id: string; k: Kinship } => !!x.k);
}

export function makeQuestion(
  data: FamilyData,
  egoId: string,
  kin: KinshipResolver,
  opts: { kana: boolean; rng?: Rng; avoid?: string[] },
): Question | undefined {
  const rng = opts.rng ?? Math.random;
  const cands = quizCandidates(data, egoId, kin);
  if (!cands.length) return undefined;
  const fresh = cands.filter((c) => !opts.avoid?.includes(c.id));
  const pickFrom = fresh.length ? fresh : cands;
  const target = pickFrom[Math.floor(rng() * pickFrom.length)];
  const label = toLabel(target.k);
  const key = labelKey(label, opts.kana);

  if (rng() < 0.5) {
    const answers = cands.filter((c) => labelKey(toLabel(c.k), opts.kana) === key).map((c) => c.id);
    return { kind: 'find', label, answers };
  }
  // Distractors: other labels in this family first, then the common pool.
  const seen = new Set([key]);
  const others: Label[] = [];
  for (const l of [...shuffle(cands.map((c) => toLabel(c.k)), rng), ...shuffle(POOL, rng)]) {
    const k = labelKey(l, opts.kana);
    if (seen.has(k)) continue;
    seen.add(k);
    others.push(l);
    if (others.length === 3) break;
  }
  const choices = shuffle([label, ...others], rng);
  return { kind: 'name', targetId: target.id, choices, correct: choices.indexOf(label) };
}

/** Whether tapping `id` answers a find-question correctly. */
export const isCorrectFind = (q: Question, id: string) => q.kind === 'find' && q.answers.includes(id);
