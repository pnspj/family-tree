// "About this app" page: concept and features, with a live demo of the kinship view.
// Shown before consent (with the consent card at the bottom) and from the menu afterwards.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as ops from '../core/ops';
import { demoFile } from '../core/sample';
import type { FamilyFile } from '../core/types';
import { PRIVACY_URL, TERMS_URL } from '../legal';
import { DEFAULT_PREFS, type Script, type ViewPrefs } from '../storage';
import { GUIDE_URL } from './DataDialogs';
import { isKana, personName } from './display';
import { Ruby } from './Ruby';
import { TreeContent, useTreeModel } from './TreeDrawing';
// Captured from the sample family by tools/capture_form.mjs.
import personFormShot from '../assets/person-form.png';
import { isKinshipHidden, isNameHidden, type MaskState } from './TreeView';

const PAD = 16;

export function AboutPage(props: {
  /** Top call to action (e.g. "はじめる" jumping to the consent card, or "かけいずに戻る"). */
  action: ComponentChildren;
  /** Bottom part: the consent card, or a back button. */
  footer: ComponentChildren;
}) {
  useEffect(() => window.scrollTo(0, 0), []);
  return (
    <div class="about">
      <header class="about-hero">
        <h1>かけいず</h1>
        <p class="about-catch">さわってわかる、家族のつながり</p>
        <p class="about-lead">お子さまが家族や親戚の関係を学べる、インタラクティブな家系図です。</p>
        <div class="about-action">{props.action}</div>
      </header>

      <section class="about-sec" aria-labelledby="about-kin">
        <h2 id="about-kin">
          あの仲良しのおじさんとの関係は？
          <br />
          タップで変わる続柄
        </h2>
        <ul class="about-points">
          <li>タップ（クリック）した人を「本人」にして、続柄の表示が切り替わります。</li>
          <li>名前や続柄は、かんたんなひらがなでも表示できます。呼び方はご家庭に合わせて変えられます。</li>
          <li>名前や続柄を隠して、クイズで遊ぶこともできます。</li>
        </ul>
        <KinshipDemo />
      </section>

      <section class="about-sec" aria-labelledby="about-make">
        <h2 id="about-make">作ってみよう！ 我が家の家系図</h2>
        <ul class="about-points">
          <li>直感的な編集画面で、つなげるように次々と家族を加えていけます。</li>
          <li>旧姓や呼び名、男女以外の性別なども、柔軟に入力できます。</li>
          <li>必須の入力項目はありません。名前と生まれた年だけでも、十分に学べる家系図ができます。</li>
        </ul>
        <figure class="about-fig about-shot">
          <img
            src={personFormShot}
            alt="人物の編集画面。上に「家族を追加」のボタン（父・母・配偶者・子・きょうだい）、その下に姓・名とよみの入力欄が並ぶ"
            loading="lazy"
          />
          <figcaption>見本の家族の編集画面（上半分）。「家族を追加」から、つながる人を次々に加えられます。</figcaption>
        </figure>
      </section>

      <section class="about-sec" aria-labelledby="about-privacy">
        <h2 id="about-privacy">個人情報の管理について</h2>
        <ul class="about-points">
          <li>家系図のデータは、お使いの端末のブラウザの中だけに保存し、外部へは送信しません。</li>
          <li>
            「
            <a href={GUIDE_URL} target="_blank" rel="noopener">
              仕組みと注意
            </a>
            」のページで、お子さまがアプリの仕組みと個人情報の扱いについて学べます。
          </li>
        </ul>
        <PrivacyFigure />
      </section>

      <footer class="about-footer">{props.footer}</footer>
      <p class="about-links">
        <a href={TERMS_URL} target="_blank" rel="noopener">
          利用規約・免責事項
        </a>
        <a href={PRIVACY_URL} target="_blank" rel="noopener">
          プライバシーポリシー
        </a>
        <a href={GUIDE_URL} target="_blank" rel="noopener">
          仕組みと注意
        </a>
      </p>
    </div>
  );
}

// ---- live demo ------------------------------------------------------------------------------

/** The real tree drawing with a small fictional family. Kept in memory only (never saved). */
function KinshipDemo() {
  const [file, setFile] = useState<FamilyFile>(demoFile);
  const [script, setScript] = useState<Script>('kanji');
  const [maskName, setMaskName] = useState(false);
  const [maskKinship, setMaskKinship] = useState(false);
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
  const [revealedKinship, setRevealedKinship] = useState<Set<string>>(new Set());
  const prefs: ViewPrefs = useMemo(() => ({ ...DEFAULT_PREFS, script, maskName, maskKinship }), [script, maskName, maskKinship]);
  const model = useTreeModel(file, prefs);
  const { layout } = model;
  const egoId = file.settings.egoId;
  const ego = file.persons.find((p) => p.id === egoId);
  const kana = isKana(prefs);
  const masks: MaskState | null =
    maskName || maskKinship ? { name: maskName, kinship: maskKinship, revealedNames, revealedKinship } : null;
  const hiddenCount = file.persons.filter((p) => isNameHidden(masks, p.id, egoId) || isKinshipHidden(masks, p.id, egoId)).length;
  const remask = () => {
    setRevealedNames(new Set());
    setRevealedKinship(new Set());
  };
  const onCardClick = (id: string) => {
    if (isNameHidden(masks, id, egoId) || isKinshipHidden(masks, id, egoId)) {
      setRevealedNames((s) => new Set(s).add(id));
      setRevealedKinship((s) => new Set(s).add(id));
      return;
    }
    const r = ops.setEgo(file, id);
    if (r.ok && id !== egoId) {
      setFile(r.file);
      setRevealedKinship(new Set());
    }
  };
  const reset = () => {
    setFile(demoFile());
    setScript('kanji');
    setMaskName(false);
    setMaskKinship(false);
    remask();
  };
  const w = layout.width + PAD * 2;
  const h = layout.height + PAD * 2;
  // On narrow screens the tree scrolls sideways: start with the ego card in the middle.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const card = layout.cards.find((c) => c.id === demoFile().settings.egoId);
    if (!el || !card || el.scrollWidth <= el.clientWidth) return;
    const x = ((card.x + model.opt.cardW / 2 + PAD) / w) * el.scrollWidth;
    el.scrollLeft = x - el.clientWidth / 2;
  }, []);
  return (
    <div class="demo" role="group" aria-label="続柄の切り替えを試せる見本">
      <div class="demo-bar">
        <div class="seg" role="group" aria-label="文字">
          {(
            [
              ['kanji', 'かんじ'],
              ['furigana', 'ふりがな'],
              ['kana', 'ひらがな'],
            ] as [Script, string][]
          ).map(([s, label]) => (
            <button type="button" key={s} class={script === s ? 'on' : ''} aria-pressed={script === s} onClick={() => setScript(s)}>
              {label}
            </button>
          ))}
        </div>
        <div class="quiz" role="group" aria-label="クイズ">
          <span class="quiz-title">{kana ? 'かくす' : '隠す'}：</span>
          <label class="switch">
            <input type="checkbox" checked={maskName} onChange={() => setMaskName(!maskName)} />
            {kana ? 'なまえ' : '名前'}
          </label>
          <label class="switch">
            <input type="checkbox" checked={maskKinship} onChange={() => setMaskKinship(!maskKinship)} />
            {kana ? 'よびかた' : '続柄'}
          </label>
          {masks && (
            <>
              <span class="quiz-count">{hiddenCount ? `あと ${hiddenCount} にん` : 'ぜんぶ わかった！'}</span>
              <button type="button" class="small" onClick={remask}>
                もういちど かくす
              </button>
            </>
          )}
        </div>
      </div>
      <p class="demo-hint" aria-live="polite">
        {kana ? 'きじゅん' : '基準'}：<strong>{ego ? <Ruby text={personName(ego, prefs)} /> : '—'}</strong>
        <span>
          {masks
            ? '　カードを押すと答えが出ます。もう一度押すと、その人から見た続柄に切り替わります。'
            : '　カードを押すと、その人から見た続柄に切り替わります。'}
        </span>
      </p>
      <p class="demo-swipe hint">← 左右にスクロールできます →</p>
      <div class="demo-scroll" ref={scroller}>
        <svg class={`tree demo-tree script-${script}`} viewBox={`${-PAD} ${-PAD} ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }}>
          <TreeContent
            file={file}
            prefs={prefs}
            model={model}
            hidden={(id) => ({ name: isNameHidden(masks, id, egoId), kinship: isKinshipHidden(masks, id, egoId) })}
            onCardClick={onCardClick}
          />
        </svg>
      </div>
      <div class="demo-foot">
        <span class="hint">見本の家族です（架空の人物）。ここでの操作は保存されません。</span>
        <button type="button" class="small" onClick={reset}>
          最初に戻す
        </button>
      </div>
    </div>
  );
}

// ---- figures --------------------------------------------------------------------------------

/** Data stays in the browser; the server only delivers the program. */
function PrivacyFigure() {
  return (
    <figure class="about-fig about-fig-wide">
      <svg viewBox="0 0 560 190" role="img" aria-labelledby="fig-priv-t" class="fig-wide">
        <title id="fig-priv-t">サーバーはアプリのプログラムを届けるだけで、家系図のデータは端末のブラウザの中だけに保存される図</title>
        <defs>
          <marker id="about-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="fig-ah" />
          </marker>
        </defs>
        <rect x="10" y="40" width="150" height="110" rx="14" class="fig-server" />
        <text x="85" y="88" text-anchor="middle" class="fig-title">
          アプリの配信元
        </text>
        <text x="85" y="110" text-anchor="middle" class="fig-small">
          （プログラムだけ）
        </text>
        <rect x="350" y="16" width="200" height="158" rx="16" class="fig-device" />
        <text x="450" y="42" text-anchor="middle" class="fig-title">
          お使いの端末
        </text>
        <rect x="368" y="56" width="164" height="102" rx="10" class="fig-browser" />
        <text x="450" y="78" text-anchor="middle" class="fig-small">
          ブラウザ
        </text>
        <rect x="384" y="90" width="132" height="52" rx="8" class="fig-data" />
        <text x="450" y="113" text-anchor="middle" class="fig-text">
          家系図のデータ
        </text>
        <text x="450" y="131" text-anchor="middle" class="fig-small">
          ここにだけ保存
        </text>
        <line x1="166" y1="72" x2="342" y2="72" class="fig-arrow" marker-end="url(#about-ah)" />
        <text x="254" y="60" text-anchor="middle" class="fig-blue">
          プログラムを届ける
        </text>
        <line x1="342" y1="124" x2="166" y2="124" class="fig-arrow-no" />
        <text x="254" y="160" text-anchor="middle" class="fig-red">
          データは送らない
        </text>
        <g transform="translate(254 124)">
          <circle r="12" class="fig-no" />
          <path d="M-5.5,-5.5 L5.5,5.5 M5.5,-5.5 L-5.5,5.5" class="fig-no-x" />
        </g>
      </svg>
      <svg viewBox="0 0 300 330" role="img" aria-labelledby="fig-priv-t2" class="fig-narrow">
        <title id="fig-priv-t2">サーバーはアプリのプログラムを届けるだけで、家系図のデータは端末のブラウザの中だけに保存される図</title>
        <defs>
          <marker id="about-ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="fig-ah" />
          </marker>
        </defs>
        <rect x="60" y="6" width="180" height="64" rx="14" class="fig-server" />
        <text x="150" y="34" text-anchor="middle" class="fig-title">
          アプリの配信元
        </text>
        <text x="150" y="54" text-anchor="middle" class="fig-small">
          （プログラムだけ）
        </text>
        <line x1="105" y1="76" x2="105" y2="170" class="fig-arrow" marker-end="url(#about-ah2)" />
        <text x="95" y="128" text-anchor="end" class="fig-blue">
          届ける
        </text>
        <line x1="195" y1="170" x2="195" y2="76" class="fig-arrow-no" />
        <g transform="translate(195 123)">
          <circle r="12" class="fig-no" />
          <path d="M-5.5,-5.5 L5.5,5.5 M5.5,-5.5 L-5.5,5.5" class="fig-no-x" />
        </g>
        <text x="215" y="118" class="fig-red">
          データは
        </text>
        <text x="215" y="136" class="fig-red">
          送らない
        </text>
        <rect x="30" y="176" width="240" height="148" rx="16" class="fig-device" />
        <text x="150" y="202" text-anchor="middle" class="fig-title">
          お使いの端末
        </text>
        <rect x="48" y="214" width="204" height="98" rx="10" class="fig-browser" />
        <text x="150" y="234" text-anchor="middle" class="fig-small">
          ブラウザ
        </text>
        <rect x="74" y="244" width="152" height="56" rx="8" class="fig-data" />
        <text x="150" y="268" text-anchor="middle" class="fig-text">
          家系図のデータ
        </text>
        <text x="150" y="288" text-anchor="middle" class="fig-small">
          ここにだけ保存
        </text>
      </svg>
    </figure>
  );
}
