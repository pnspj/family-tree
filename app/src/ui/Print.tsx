// Print sheet (one page, optional fill-in worksheet) and SVG / PNG export.
import { useRef, useState } from 'preact/hooks';
import type { FamilyFile } from '../core/types';
import type { ViewPrefs } from '../prefs';
import { downloadBlob } from '../storage';
import { Modal } from './Modal';
import { TreeContent, useTreeModel } from './TreeDrawing';

type Paper = 'A4' | 'A3';
type Orientation = 'landscape' | 'portrait';

interface PrintOptions {
  title: string;
  paper: Paper;
  orientation: Orientation;
  blankNames: boolean;
  blankKinship: boolean;
  showDate: boolean;
}

const PAPER_MM: Record<Paper, [number, number]> = { A4: [297, 210], A3: [420, 297] };
const MARGIN_MM = 10;
const HEADER_MM = 14;
const FOOTER_MM = 6;
const PAD = 24;

function defaultTitle(file: FamilyFile) {
  const ego = file.persons.find((p) => p.id === file.settings.egoId);
  const fam = ego?.familyName || ego?.familyNameKana;
  return fam ? `${fam}家の家系図` : '家系図';
}

const todayText = () => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function PrintDialog({ file, prefs, onClose }: { file: FamilyFile; prefs: ViewPrefs; onClose: () => void }) {
  const [o, setO] = useState<PrintOptions>({
    title: defaultTitle(file),
    paper: 'A4',
    orientation: 'landscape',
    blankNames: false,
    blankKinship: false,
    showDate: true,
  });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const model = useTreeModel(file, prefs);
  const { layout } = model;
  const ego = file.settings.egoId;
  const vb = { x: -PAD, y: -PAD, w: layout.width + PAD * 2, h: layout.height + PAD * 2 };
  const [pw, ph] = o.orientation === 'landscape' ? PAPER_MM[o.paper] : [PAPER_MM[o.paper][1], PAPER_MM[o.paper][0]];
  const set = <K extends keyof PrintOptions>(k: K, v: PrintOptions[K]) => setO((x) => ({ ...x, [k]: v }));
  const fileBase = (o.title || '家系図').replace(/[\\/:*?"<>|]/g, '_');

  const print = () => {
    // Page size can only be set through CSS; inject it for this print job.
    const style = document.createElement('style');
    style.textContent = `@page { size: ${o.paper} ${o.orientation}; margin: ${MARGIN_MM}mm; }`;
    document.head.appendChild(style);
    document.body.classList.add('printing');
    const done = () => {
      style.remove();
      document.body.classList.remove('printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  const exportImage = async (kind: 'svg' | 'png') => {
    setBusy(kind);
    setError('');
    try {
      const svgText = standaloneSvg(svgRef.current!, o.title, o.showDate ? todayText() : '');
      if (kind === 'svg') downloadBlob(new Blob([svgText], { type: 'image/svg+xml' }), `${fileBase}.svg`);
      else downloadBlob(await svgToPng(svgText), `${fileBase}.png`);
    } catch (e) {
      setError(`画像を作れませんでした：${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal title="印刷・画像で保存" onClose={onClose} wide>
      <div class="print-options">
        <label>
          <span>タイトル</span>
          <input type="text" value={o.title} onInput={(e) => set('title', (e.target as HTMLInputElement).value)} />
        </label>
        <div class="row">
          <label>
            <span>用紙</span>
            <select value={o.paper} onChange={(e) => set('paper', (e.target as HTMLSelectElement).value as Paper)}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <label>
            <span>向き</span>
            <select value={o.orientation} onChange={(e) => set('orientation', (e.target as HTMLSelectElement).value as Orientation)}>
              <option value="landscape">横</option>
              <option value="portrait">縦</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>書きこみプリント（クイズ用）</legend>
          <label class="check">
            <input type="checkbox" checked={o.blankNames} onChange={() => set('blankNames', !o.blankNames)} />
            名前を空欄にする
          </label>
          <label class="check">
            <input type="checkbox" checked={o.blankKinship} onChange={() => set('blankKinship', !o.blankKinship)} />
            続柄を空欄にする
          </label>
          <p class="hint">起点の人（{prefs.script === 'kana' ? 'じぶん' : '本人'}）はそのまま表示されます。</p>
        </fieldset>
        <label class="check">
          <input type="checkbox" checked={o.showDate} onChange={() => set('showDate', !o.showDate)} />
          作成日を入れる
        </label>
        <p class="hint">文字（かんじ・ふりがな・ひらがな）や表示項目は、いまの画面の設定が使われます。</p>
      </div>

      <div
        class="print-sheet"
        style={{
          '--sheet-w': `${pw - MARGIN_MM * 2}mm`,
          '--sheet-h': `${ph - MARGIN_MM * 2}mm`,
          '--tree-h': `${ph - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM}mm`,
          aspectRatio: `${pw} / ${ph}`,
        }}
      >
        <h1 class="sheet-title">{o.title}</h1>
        <svg
          ref={svgRef}
          class={`tree-static script-${prefs.script}`}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <TreeContent
            file={file}
            prefs={prefs}
            model={model}
            blanks
            hidden={(id) => ({ name: o.blankNames && id !== ego, kinship: o.blankKinship && id !== ego })}
          />
        </svg>
        <p class="sheet-footer">{o.showDate ? `作成日：${todayText()}` : ''}</p>
      </div>

      {error && <p class="error">{error}</p>}
      <div class="form-actions">
        <button type="button" onClick={() => exportImage('svg')} disabled={!!busy}>
          SVGで保存
        </button>
        <button type="button" onClick={() => exportImage('png')} disabled={!!busy}>
          {busy === 'png' ? '作成中…' : 'PNGで保存'}
        </button>
        <button type="button" class="primary" onClick={print}>
          印刷する
        </button>
      </div>
    </Modal>
  );
}

/** All same-origin CSS rules, so the exported SVG looks the same outside the app. */
function collectCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out.push(rule.cssText);
    } catch {
      // cross-origin sheet: skip
    }
  }
  return out.join('\n');
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** Self-contained SVG document: tree + title + embedded styles on a white background. */
export function standaloneSvg(svg: SVGSVGElement, title: string, date: string): string {
  const [x, y, w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  const head = title ? 56 : 0;
  const foot = date ? 32 : 0;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = [x, y - head, w, h + head + foot];
  clone.setAttribute('viewBox', vb.join(' '));
  clone.setAttribute('width', String(vb[2]));
  clone.setAttribute('height', String(vb[3]));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const extras =
    `<style>${collectCss()}\nsvg{background:#fff}</style>` +
    `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#fff"/>` +
    (title
      ? `<text x="${x + w / 2}" y="${y - head / 2 + 10}" text-anchor="middle" font-size="28" font-weight="700" fill="#2b2724">${escapeXml(title)}</text>`
      : '') +
    (date ? `<text x="${x + w - 8}" y="${y + h + foot - 10}" text-anchor="end" font-size="14" fill="#6f6760">作成日：${escapeXml(date)}</text>` : '');
  const body = new XMLSerializer().serializeToString(clone);
  // insert extras right after the opening <svg ...> tag, so they are drawn first
  const open = body.indexOf('>') + 1;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body.slice(0, open)}${extras}${body.slice(open)}`;
}

/** Rasterizes the SVG at 2x for crisp text. */
export function svgToPng(svgText: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(img.width * scale);
      canvas.height = Math.ceil(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNGに変換できませんでした'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVGを読み込めませんでした'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });
}
