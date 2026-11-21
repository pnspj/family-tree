// Captures the link-preview image (app/public/og.png, 1200x630) from the sample family and renders
// the home-screen icon (app/public/apple-touch-icon.png, 180x180) from the favicon.
// Needs the dev server (cd app && npx vite --port 5200) and Playwright (npm i -D playwright, npx playwright install chromium).
// Usage: node tools/capture_og.mjs [base-url]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5200/';
const pub = (name) => new URL(`../app/public/${name}`, import.meta.url).pathname;
const legal = readFileSync(new URL('../app/src/legal.ts', import.meta.url), 'utf8');
const favicon = readFileSync(pub('favicon.svg'), 'utf8');
const css = readFileSync(new URL('../app/src/styles/base.css', import.meta.url), 'utf8');
const font = css.match(/font-family: ([^;]+);/)[1];

const b = await chromium.launch();

// 1. The sample family in view mode with furigana (fictional people only).
const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
// Skip the consent screen in this throwaway browser profile.
const version = legal.match(/TERMS_VERSION = '([^']+)'/)[1];
await ctx.addInitScript((v) => localStorage.setItem('family-tree:consent', JSON.stringify({ version: v, at: '' })), version);
const p = await ctx.newPage();
await p.goto(base);
await p.getByRole('button', { name: 'サンプルの家族で試す' }).click();
await p.getByRole('button', { name: 'ふりがな' }).click();
await p.waitForTimeout(500);
const tree = (await p.locator('.stage').screenshot()).toString('base64');
await ctx.close();

// 2. Title and tagline over the tree.
const card = await b.newPage({ viewport: { width: 1200, height: 630 } });
await card.setContent(`<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #fbf8f3; color: #2b2724;
         font-family: ${font}; display: grid; grid-template-columns: 470px 1fr; }
  .text { padding: 70px 0 0 64px; display: flex; flex-direction: column; gap: 26px; }
  .logo { display: flex; align-items: center; gap: 16px; font-size: 66px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; }
  .logo svg { width: 76px; height: 76px; flex: none; }
  p { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.55; }
  small { font-size: 23px; color: #6f6760; line-height: 1.6; }
  .tree { background: url(data:image/png;base64,${tree}) center / cover; border-left: 6px solid #e07a2f; }
</style>
<div class="text">
  <div class="logo">${favicon}かけいず</div>
  <p>家族・親戚の<br>つながりを<br>楽しく学べる家系図</p>
  <small>ブラウザだけで動き、<br>データは外に送りません</small>
</div>
<div class="tree"></div>`);
await card.screenshot({ path: pub('og.png') });

// 3. Home-screen icon: the favicon on a light square (iOS rounds the corners itself).
await card.setViewportSize({ width: 180, height: 180 });
await card.setContent(`<!doctype html><style>body{margin:0;background:#fbf8f3;display:grid;place-items:center;height:180px}
  svg{width:136px;height:136px}</style>${favicon}`);
await card.screenshot({ path: pub('apple-touch-icon.png') });

await b.close();
console.log('wrote', pub('og.png'), pub('apple-touch-icon.png'));
