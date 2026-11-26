// "About this app" page: concept and features, with a live demo of the kinship view.
// Shown before consent (with the consent card at the bottom) and from the menu afterwards.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { demoFile } from '../core/sample';
import { GUIDE_URL, PRIVACY_URL, TERMS_URL } from '../legal';
import { DEFAULT_PREFS, type Script, type ViewPrefs } from '../prefs';
import { MaskControls, ScriptSwitch } from './controls';
import { isKana, personName } from './display';
import { countHidden, hiddenParts, masksFor, NO_REVEAL, tapCard, type View } from './masks';
import { Ruby } from './Ruby';
import { TreeContent, useTreeModel } from './TreeDrawing';
// Captured from the sample family by tools/capture_form.mjs.
import personFormShot from '../assets/person-form.png';

const PAD = 16;

/** The page's three sections, one per age group, in the order children grow into them. */
const STAGES = [
  { id: 'about-kin', age: '未就学児〜小学校低学年', what: '見て、さわって、呼び方を覚える', title: 'タップで変わる続柄' },
  { id: 'about-make', age: '小学校中学年〜', what: '自分で入力して、家族を広げる', title: '我が家の家系図づくり' },
  { id: 'about-privacy', age: '小学校高学年〜', what: 'データの扱い方と、守り方を知る', title: '個人情報のしくみと守り方' },
] as const;
type StageId = (typeof STAGES)[number]['id'];

/** Small "rough age" line under a section heading. */
function AgeNote(props: { id: StageId }) {
  const st = STAGES.find((x) => x.id === props.id)!;
  return (
    <p class="about-age">
      <span class="about-age-badge">めやす：{st.age}</span>
      <span>{st.what}</span>
    </p>
  );
}

/** Links to the three sections. Scrolls in place: the URL hash is the page route (#about). */
function StageNav() {
  const go = (e: Event, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav class="about-stages" aria-labelledby="about-stages-title">
      <p id="about-stages-title" class="about-stages-title">お子さまの成長に合わせて、3つの楽しみ方</p>
      <ol>
        {STAGES.map((st) => (
          <li key={st.id}>
            <a href={`#${st.id}`} onClick={(e) => go(e, st.id)}>
              <span class="about-age-badge">{st.age}</span>
              <span class="about-stage-title">{st.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

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

      <StageNav />

      <section class="about-sec" aria-labelledby="about-kin">
        <h2 id="about-kin">
          ぼくのおばあちゃんを、お母さんから見ると？
          <br />
          タップで変わる続柄
        </h2>
        <AgeNote id="about-kin" />
        <ul class="about-points">
          <li>タップ（クリック）した人を「本人」にして、続柄の表示が切り替わります。</li>
          <li>名前や続柄は、かんたんなひらがなでも表示できます。呼び方はご家庭に合わせて変えられます。</li>
          <li>名前や続柄を隠して、クイズで遊ぶこともできます。</li>
          <li>印刷して、名前や続柄を空欄にした書きこみプリントにもできます。</li>
        </ul>
        <KinshipDemo />
      </section>

      <section class="about-sec" aria-labelledby="about-make">
        <h2 id="about-make">
          タイピングに慣れてきたら、作ってみよう！
          <br />
          我が家の家系図
        </h2>
        <AgeNote id="about-make" />
        <ul class="about-points">
          <li>直感的な編集画面で、つなげるように次々と家族を加えていけます。</li>
          <li>旧姓や呼び名、男女以外の性別なども、柔軟に入力できます。</li>
          <li>必須の入力項目はありません。名前と生まれた年だけでも、十分に学べる家系図ができます。</li>
          <li>よみを入れておくと、ひらがな表示で小さい子も読めます。上の子が作って、下の子が遊ぶこともできます。</li>
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
        <h2 id="about-privacy">
          大切な家族の個人情報、
          <br />
          しくみを学んで、しっかり守ろう
        </h2>
        <AgeNote id="about-privacy" />
        <ul class="about-points">
          <li>家系図のデータは、お使いの端末のブラウザの中だけに保存し、外部へは送信しません。</li>
          <li>
            「
            <a href={GUIDE_URL} target="_blank" rel="noopener">
              仕組みと注意
            </a>
            」のページは、ふりがなと図付きで、お子さまと一緒に読めます。アプリの仕組みと個人情報の扱いを、親子で学べます。
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

// The first section's heading asks how "my grandmother" looks from my mother: on the starting
// family, the hint suggests tapping her (the two grandmothers become 母 and 義母).
const DEMO_EGO = 'ren';
const DEMO_MOTHER = 'misaki';

/** The real tree drawing with a small fictional family. Kept in memory only (never saved). */
function KinshipDemo() {
  const start = (): View => ({ file: demoFile(), reveal: NO_REVEAL });
  const [view, setView] = useState<View>(start);
  const [script, setScript] = useState<Script>('kanji');
  const [mask, setMask] = useState({ name: false, kinship: false });
  const prefs: ViewPrefs = useMemo(() => ({ ...DEFAULT_PREFS, script, maskName: mask.name, maskKinship: mask.kinship }), [script, mask]);
  const { file, reveal } = view;
  const model = useTreeModel(file, prefs);
  const { layout } = model;
  const egoId = file.settings.egoId;
  const ego = file.persons.find((p) => p.id === egoId);
  const mother = file.persons.find((p) => p.id === DEMO_MOTHER);
  const kana = isKana(prefs);
  const masks = masksFor(prefs);
  const reset = () => {
    setView(start());
    setScript('kanji');
    setMask({ name: false, kinship: false });
  };
  const w = layout.width + PAD * 2;
  const h = layout.height + PAD * 2;
  // On narrow screens the tree scrolls sideways: start with the ego card in the middle.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const card = layout.cards.find((c) => c.id === egoId);
    if (!el || !card || el.scrollWidth <= el.clientWidth) return;
    const x = ((card.x + model.opt.cardW / 2 + PAD) / w) * el.scrollWidth;
    el.scrollLeft = x - el.clientWidth / 2;
  }, []);
  return (
    <div class="demo" role="group" aria-label="続柄の切り替えを試せる見本">
      <div class="demo-bar">
        <ScriptSwitch script={script} onChange={setScript} />
        <MaskControls
          kana={kana}
          name={mask.name}
          kinship={mask.kinship}
          onToggle={(part) => setMask({ ...mask, [part]: !mask[part] })}
          left={masks ? countHidden(file.persons, masks, reveal, egoId) : undefined}
          onRemask={() => setView({ ...view, reveal: NO_REVEAL })}
        />
      </div>
      <p class="demo-hint" aria-live="polite">
        {kana ? 'きじゅん' : '基準'}：<strong>{ego ? <Ruby text={personName(ego, prefs)} /> : '—'}</strong>
        <span>
          {masks
            ? '　カードを押すと答えが出ます。もう一度押すと、その人から見た続柄に切り替わります。'
            : '　カードを押すと、その人から見た続柄に切り替わります。'}
          {!masks && egoId === DEMO_EGO && mother && (
            <>
              お母さん（<Ruby text={personName(mother, prefs)} />）を押して、2人のおばあちゃんの続柄を見比べてみよう。
            </>
          )}
        </span>
      </p>
      <p class="demo-swipe hint">← 左右にスクロールできます →</p>
      <div class="demo-scroll" ref={scroller}>
        <svg class={`tree demo-tree script-${script}`} viewBox={`${-PAD} ${-PAD} ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }}>
          <TreeContent
            file={file}
            prefs={prefs}
            model={model}
            hidden={(id) => hiddenParts(masks, reveal, egoId, id)}
            onCardClick={(id) => setView(tapCard(view, masks, id))}
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
