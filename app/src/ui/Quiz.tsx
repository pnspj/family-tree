// Quiz mode: asks "which one is おばあさん?" / "what is 茂 to you?" and keeps score.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { createKinship } from '../core/kinship';
import { isCorrectFind, makeQuestion, type Label, type Question } from '../core/quiz';
import type { FamilyFile } from '../core/types';
import type { Script, ViewPrefs } from '../storage';
import { personName } from './display';
import { Ruby } from './Ruby';
import type { CardHidden } from './TreeDrawing';

interface Feedback {
  ok: boolean;
  message: string;
  tappedId?: string;
}

const labelText = (l: Label, script: Script) => (script === 'kana' ? l.kana : script === 'furigana' ? l.ruby : l.kanji);

export function useQuiz(file: FamilyFile, prefs: ViewPrefs, active: boolean) {
  const kin = useMemo(() => createKinship(file, file.settings.labelOverrides), [file.persons, file.unions, file.settings.labelOverrides]);
  const ego = file.settings.egoId;
  const kana = prefs.script === 'kana';
  const [question, setQuestion] = useState<Question | undefined>();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [recent, setRecent] = useState<string[]>([]);

  const next = () => {
    if (!ego) return setQuestion(undefined);
    const q = makeQuestion(file, ego, kin, { kana, avoid: recent });
    setQuestion(q);
    setFeedback(null);
    if (q) setRecent((r) => [...(q.kind === 'name' ? [q.targetId] : q.answers), ...r].slice(0, 4));
  };

  // New round when quiz mode starts or the viewpoint / family changes.
  useEffect(() => {
    if (!active) return;
    setScore({ right: 0, total: 0 });
    setRecent([]);
    next();
  }, [active, ego, file.persons, file.unions, kana]);

  const record = (ok: boolean, message: string, tappedId?: string) => {
    setFeedback({ ok, message, tappedId });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };

  const name = (id: string) => {
    const p = file.persons.find((x) => x.id === id);
    return p ? personName(p, prefs) || '？' : '？';
  };

  const answerCard = (id: string) => {
    if (!question || feedback || question.kind !== 'find' || !ego) return;
    if (isCorrectFind(question, id)) {
      const more = question.answers.length - 1;
      record(true, more > 0 ? (kana ? `せいかい！ ほかにも ${more}にん いるよ` : `正解！ ほかにも${more}人います`) : kana ? 'せいかい！' : '正解！');
      return;
    }
    if (id === ego) return record(false, kana ? 'それは じぶん だよ' : 'それは本人です', id);
    const k = kin.resolve(ego, id);
    const what = k ? labelText(k, prefs.script) : '';
    record(false, what ? (kana ? `ちがうよ。その ひとは「${what}」だよ` : `ちがいます。その人は「${what}」です`) : kana ? 'ちがうよ' : 'ちがいます', id);
  };

  const answerChoice = (i: number) => {
    if (!question || feedback || question.kind !== 'name') return;
    const correct = labelText(question.choices[question.correct], prefs.script);
    if (i === question.correct) record(true, kana ? 'せいかい！' : '正解！');
    else record(false, kana ? `ざんねん。こたえは「${correct}」` : `ざんねん。答えは「${correct}」`);
  };

  // During the quiz every kinship label except the ego's is hidden.
  const hidden = (id: string): CardHidden => ({ name: false, kinship: id !== ego });
  const cardClass = (id: string) => {
    if (!question) return '';
    const cls: string[] = [];
    if (question.kind === 'name' && question.targetId === id) cls.push('quiz-target');
    if (feedback) {
      if (question.kind === 'find' && question.answers.includes(id)) cls.push('quiz-correct');
      if (feedback.tappedId === id && !feedback.ok) cls.push('quiz-wrong');
    }
    return cls.join(' ');
  };

  return { question, feedback, score, next, answerCard, answerChoice, hidden, cardClass, name, egoName: ego ? name(ego) : '' };
}

export function QuizBar({ quiz, script }: { quiz: ReturnType<typeof useQuiz>; script: Script }) {
  const { question: q, feedback, score } = quiz;
  const kana = script === 'kana';
  if (!q)
    return <div class="quiz-bar">{kana ? 'クイズに できる しんせきが まだ いません' : 'クイズにできる親族がまだいません'}</div>;
  const ask =
    q.kind === 'find'
      ? `${quiz.egoName}${kana ? ' から みて「' : 'から見て「'}${labelText(q.label, script)}${kana ? '」は どの ひと？' : '」はどの人？'}`
      : `${quiz.name(q.targetId)}${kana ? ' は ' : 'は'}${quiz.egoName}${kana ? ' の なに？' : 'の何？'}`;
  return (
    <div class="quiz-bar" role="status">
      <p class="quiz-question">
        <Ruby text={ask} />
      </p>
      {q.kind === 'name' && (
        <div class="quiz-choices">
          {q.choices.map((c, i) => (
            <button
              type="button"
              key={i}
              disabled={!!feedback}
              class={feedback ? (i === q.correct ? 'right' : '') : ''}
              onClick={() => quiz.answerChoice(i)}
            >
              <Ruby text={labelText(c, script)} />
            </button>
          ))}
        </div>
      )}
      {q.kind === 'find' && !feedback && <p class="hint">{kana ? 'カードを おしてね' : 'カードを押して答えます'}</p>}
      {feedback && (
        <div class={`quiz-feedback ${feedback.ok ? 'ok' : 'ng'}`}>
          <span>
            <Ruby text={feedback.message} />
          </span>
          <button type="button" class="primary" onClick={quiz.next}>
            {kana ? 'つぎの もんだい' : '次の問題'}
          </button>
        </div>
      )}
      <span class="quiz-score">
        {kana ? 'せいかい' : '正解'} {score.right} / {score.total}
      </span>
    </div>
  );
}
