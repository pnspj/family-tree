// The toolbar's menu: display switches, data actions and pages about the app.
import { useRef, useState } from 'preact/hooks';
import { GUIDE_URL, PRIVACY_URL, TERMS_URL } from '../legal';
import type { BoolPref, ViewPrefs } from '../prefs';
import { ExtLink } from './controls';
import { useDismiss } from './hooks';

const DISPLAY_SWITCHES: [BoolPref, string][] = [
  ['showKinship', '続柄'],
  ['showSide', '父方・母方'],
  ['pathFallback', '遠い関係も「〜の〜」で表示'],
  ['showLife', '生年・年齢'],
  ['genderColor', '性別の色'],
  ['preferNickname', '呼び名で表示'],
  ['showBirthName', '旧姓'],
];

/** Dialogs opened from the menu. */
export type MenuDialog = 'labels' | 'print' | 'export' | 'import';

/**
 * The menu opens leftward from its button; when the toolbar wraps and the button sits at the
 * left edge, open it rightward instead so it stays on screen (and scrolls when too tall).
 */
const keepOnScreen = (el: HTMLDivElement | null) => {
  if (!el) return;
  el.classList.remove('open-right');
  const r = el.getBoundingClientRect();
  if (r.left < 8) el.classList.add('open-right');
  el.style.setProperty('--menu-top', `${Math.round(r.top)}px`);
};

export function AppMenu(props: {
  /** The menu button; dialogs opened from the menu return focus to it. */
  buttonRef: { current: HTMLButtonElement | null };
  prefs: ViewPrefs;
  onToggle: (k: BoolPref) => void;
  onDialog: (d: MenuDialog) => void;
  onSample: () => void;
  onStartOver: () => void;
  onAbout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(wrap, open, (how) => {
    setOpen(false);
    if (how === 'escape') props.buttonRef.current?.focus();
  });

  return (
    <div class="menu-wrap" ref={wrap}>
      <button ref={props.buttonRef} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        メニュー ▾
      </button>
      {open && (
        // Choosing an item closes the menu; the display switches keep it open.
        <div class="menu" ref={keepOnScreen} onClick={() => setOpen(false)}>
          <p class="menu-title">表示</p>
          {DISPLAY_SWITCHES.map(([k, label]) => (
            <label key={k} class="menu-check" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={props.prefs[k]} onChange={() => props.onToggle(k)} />
              {label}
            </label>
          ))}
          <button type="button" onClick={() => props.onDialog('labels')}>
            呼び方の設定…
          </button>
          <hr />
          <p class="menu-title">データ</p>
          <button type="button" onClick={() => props.onDialog('print')}>
            印刷・画像で保存…
          </button>
          <button type="button" onClick={() => props.onDialog('export')}>
            JSONで書き出す…
          </button>
          <button type="button" onClick={() => props.onDialog('import')}>
            JSONを読み込む…
          </button>
          <button type="button" onClick={props.onSample}>
            サンプルを開く…
          </button>
          <button type="button" class="danger-text" onClick={props.onStartOver}>
            新しく作り直す…
          </button>
          <hr />
          <p class="menu-title">このアプリ</p>
          <button type="button" onClick={props.onAbout}>
            このアプリについて
          </button>
          <ExtLink class="menu-link" href={GUIDE_URL}>
            仕組みと注意
          </ExtLink>
          <p class="menu-legal">
            <ExtLink href={TERMS_URL}>利用規約</ExtLink>
            <span aria-hidden="true">・</span>
            <ExtLink href={PRIVACY_URL}>プライバシーポリシー</ExtLink>
          </p>
        </div>
      )}
    </div>
  );
}
