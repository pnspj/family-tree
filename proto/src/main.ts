import { sample as fixedSample } from './sample';
import { randomFamily } from './random';

// ?random=<count>&seed=<n> loads a generated family instead of the sample.
const params = new URLSearchParams(location.search);
const sample = params.has('random')
  ? randomFamily(Number(params.get('random')) || 40, Number(params.get('seed')) || 1)
  : fixedSample;
import { displayName } from './model';
import { renderCustom } from './layouts/custom';
import { renderElk } from './layouts/elk';
import { renderFamilyChart } from './layouts/familyChart';

type Tab = 'custom' | 'elk' | 'f3';
const state = { tab: 'custom' as Tab, kana: false, selectedId: (params.has('random') ? 'p0' : 'ren') as string | null };

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header>
    <nav>
      <button data-tab="custom">C: 自前レイアウト</button>
      <button data-tab="elk">B: ELK (汎用グラフ)</button>
      <button data-tab="f3">A: family-chart</button>
    </nav>
    <label><input type="checkbox" id="kana"> ひらがな</label>
    <span id="sel"></span>
    <button id="fit">全体表示</button>
  </header>
  <p id="note"></p>
  <main id="stage"></main>
`;
const stage = document.querySelector<HTMLElement>('#stage')!;
const notes: Record<Tab, string> = {
  custom: '世代ごとに行を揃え、夫婦を横並び（二重線、元配偶者は点線）、子は親の下に配置。カードをクリックで選択。',
  elk: '汎用グラフ配置。人物→婚姻ノード(●)→子 の有向グラフとして配置。配偶者が隣り合う保証はない。',
  f3: '起点人物中心の表示（祖先＋子孫＋きょうだい）。カードをクリックで起点が切り替わる。全員を同時に表示はできない。',
};
let fit: (() => void) | undefined;

async function render() {
  document.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  document.querySelector('#note')!.textContent = notes[state.tab];
  const sel = state.selectedId ? sample.persons.find((p) => p.id === state.selectedId) : undefined;
  document.querySelector('#sel')!.textContent = sel ? `選択中: ${displayName(sel)}` : '';
  const opt = {
    kana: state.kana,
    selectedId: state.selectedId,
    onSelect: (id: string) => {
      state.selectedId = id;
      render(); // keeps zoom reset simple for a prototype
    },
  };
  fit = undefined;
  if (state.tab === 'custom') fit = renderCustom(stage, sample, opt);
  else if (state.tab === 'elk') fit = await renderElk(stage, sample, opt);
  else renderFamilyChart(stage, sample, state.kana, state.selectedId ?? sample.persons[0].id);
  fit?.();
}

document.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) =>
  b.addEventListener('click', () => {
    state.tab = b.dataset.tab as Tab;
    render();
  }),
);
document.querySelector<HTMLInputElement>('#kana')!.addEventListener('change', (e) => {
  state.kana = (e.target as HTMLInputElement).checked;
  render();
});
document.querySelector('#fit')!.addEventListener('click', () => fit?.());
render();
