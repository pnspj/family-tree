// The tree screen: toolbar (mode, script, masks, viewpoint, menu), a hint line and the tree.
import type { FamilyFile } from '../core/types';
import type { BoolPref, ViewPrefs } from '../prefs';
import type { Action } from './appState';
import { AppMenu, type MenuDialog } from './AppMenu';
import { MaskControls, ScriptSwitch } from './controls';
import { isKana, personName } from './display';
import { countHidden, hiddenParts, type Masks, type Reveal } from './masks';
import { QuizBar, type Quiz } from './Quiz';
import { Ruby } from './Ruby';
import { TreeView } from './TreeView';

export type Mode = 'view' | 'quiz' | 'edit';

const MODES: [Mode, string][] = [
  ['view', 'みる'],
  ['quiz', 'クイズ'],
  ['edit', 'へんしゅう'],
];

function modeHint(mode: Mode, kana: boolean, masking: boolean): string {
  if (mode === 'edit') return 'カードを押すと、その人の編集・家族の追加ができます（キーボードでは矢印キーでカードを移動、Enterで開く）';
  if (mode === 'quiz')
    return kana ? 'もんだいに こたえてね。きじゅんを かえるときは「みる」で カードを おしてね' : '問題に答えましょう。基準の人を変えるときは「みる」でカードを押します';
  if (masking) return 'だれかな？ カードを おして こたえを みてみよう。もう いちど おすと、その ひとから みた よびかたに かわるよ';
  return kana ? 'カードを おすと、その ひとから みた よびかたに かわるよ' : 'カードを押すと、その人から見た続柄に切り替わります';
}

export function MainScreen(props: {
  file: FamilyFile;
  prefs: ViewPrefs;
  onPrefs: (patch: Partial<ViewPrefs>) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  /** Masks in effect in view mode (null when off). */
  masks: Masks;
  reveal: Reveal;
  quiz: Quiz;
  fit: { whole: boolean };
  focus: { id: string } | null;
  dispatch: (a: Action) => void;
  menuButton: { current: HTMLButtonElement | null };
  onMenuDialog: (d: MenuDialog) => void;
  onSample: () => void;
  onStartOver: () => void;
  onAbout: () => void;
}) {
  const { file, prefs, mode, masks, reveal, quiz, dispatch } = props;
  const egoId = file.settings.egoId;
  const ego = file.persons.find((p) => p.id === egoId);
  const kana = isKana(prefs);
  const toggle = (k: BoolPref) => props.onPrefs({ [k]: !prefs[k] });

  const onCardClick = (id: string) => {
    if (mode === 'edit') dispatch({ type: 'openDialog', dialog: { kind: 'edit', id } });
    else if (mode === 'quiz') quiz.answerCard(id);
    else dispatch({ type: 'tapCard', id, masks });
  };

  return (
    <div class="app">
      <header class="toolbar">
        <div class="seg" role="group" aria-label="モード">
          {MODES.map(([m, label]) => (
            <button type="button" key={m} class={mode === m ? 'on' : ''} onClick={() => props.onMode(m)}>
              {label}
            </button>
          ))}
        </div>
        <ScriptSwitch script={prefs.script} onChange={(script) => props.onPrefs({ script })} />
        {mode === 'view' && (
          <MaskControls
            kana={kana}
            name={prefs.maskName}
            kinship={prefs.maskKinship}
            onToggle={(part) => toggle(part === 'name' ? 'maskName' : 'maskKinship')}
            left={masks ? countHidden(file.persons, masks, reveal, egoId) : undefined}
            onRemask={() => dispatch({ type: 'remask' })}
          />
        )}
        <span class="ego">
          {kana ? 'きじゅん' : '基準'}：<strong>{ego ? <Ruby text={personName(ego, prefs) || '（なまえなし）'} /> : '—'}</strong>
        </span>
        <span class="spacer" />
        <button type="button" onClick={() => dispatch({ type: 'fitAll' })}>
          全体を表示
        </button>
        <AppMenu
          buttonRef={props.menuButton}
          prefs={prefs}
          onToggle={toggle}
          onDialog={props.onMenuDialog}
          onSample={props.onSample}
          onStartOver={props.onStartOver}
          onAbout={props.onAbout}
        />
      </header>
      <p class="mode-hint">{modeHint(mode, kana, !!masks)}</p>
      <main class="stage">
        {mode === 'quiz' && <QuizBar quiz={quiz} script={prefs.script} />}
        <TreeView
          file={file}
          prefs={prefs}
          hidden={mode === 'quiz' ? quiz.hidden : (id) => hiddenParts(masks, reveal, egoId, id)}
          cardClass={mode === 'quiz' ? quiz.cardClass : undefined}
          onCardClick={onCardClick}
          fitRequest={props.fit}
          focusRequest={props.focus}
        />
      </main>
    </div>
  );
}
