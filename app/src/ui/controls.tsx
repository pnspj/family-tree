// Small controls shared by the main screen and the about-page demo.
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Script } from '../prefs';

const SCRIPTS: [Script, string][] = [
  ['kanji', 'かんじ'],
  ['furigana', 'ふりがな'],
  ['kana', 'ひらがな'],
];

/** かんじ / ふりがな / ひらがな switch. */
export function ScriptSwitch({ script, onChange }: { script: Script; onChange: (s: Script) => void }) {
  return (
    <div class="seg" role="group" aria-label="文字">
      {SCRIPTS.map(([s, label]) => (
        <button type="button" key={s} class={script === s ? 'on' : ''} aria-pressed={script === s} onClick={() => onChange(s)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** 隠す：名前 / 続柄 switches, with the number of cards left while masking is on. */
export function MaskControls(props: {
  kana: boolean;
  name: boolean;
  kinship: boolean;
  onToggle: (part: 'name' | 'kinship') => void;
  /** Cards still hidden; undefined while masking is off. */
  left?: number;
  onRemask: () => void;
}) {
  const { kana } = props;
  return (
    <div class="quiz" role="group" aria-label="クイズ">
      <span class="quiz-title">{kana ? 'かくす' : '隠す'}：</span>
      <label class="switch">
        <input type="checkbox" checked={props.name} onChange={() => props.onToggle('name')} />
        {kana ? 'なまえ' : '名前'}
      </label>
      <label class="switch">
        <input type="checkbox" checked={props.kinship} onChange={() => props.onToggle('kinship')} />
        {kana ? 'よびかた' : '続柄'}
      </label>
      {props.left !== undefined && (
        <>
          <span class="quiz-count">{props.left ? `あと ${props.left} にん` : 'ぜんぶ わかった！'}</span>
          <button type="button" class="small" onClick={props.onRemask}>
            もういちど かくす
          </button>
        </>
      )}
    </div>
  );
}

/** Link to a page that opens in a new tab, marked with ↗ (announced to screen readers). */
export function ExtLink({ href, class: cls, children }: { href: string; class?: string; children: ComponentChildren }) {
  return (
    <a class={cls} href={href} target="_blank" rel="noopener">
      {children}
      <span class="ext" aria-hidden="true">
        ↗
      </span>
      <span class="sr-only">（新しいタブで開く）</span>
    </a>
  );
}

/** Message at the bottom of the screen; disappears after a few seconds. */
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [text]);
  return text ? (
    <div class="toast" role="status">
      {text}
    </div>
  ) : null;
}
