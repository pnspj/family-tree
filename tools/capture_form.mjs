// Captures the person form shown on the about page (app/src/assets/person-form.png).
// Needs the dev server (cd app && npx vite --port 5200) and Playwright (npm i -D playwright, npx playwright install chromium).
// Usage: node tools/capture_form.mjs [base-url]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5200/';
const out = new URL('../app/src/assets/person-form.png', import.meta.url).pathname;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
// Skip the consent screen in this throwaway browser profile (sample data only).
const legal = readFileSync(new URL('../app/src/legal.ts', import.meta.url), 'utf8');
const version = legal.match(/TERMS_VERSION = '([^']+)'/)[1];
await ctx.addInitScript((v) => localStorage.setItem('family-tree:consent', JSON.stringify({ version: v, at: '' })), version);
const p = await ctx.newPage();
await p.goto(base);
await p.getByRole('button', { name: 'サンプルの家族で試す' }).click();
await p.getByRole('button', { name: 'へんしゅう' }).click();
await p.locator('[data-person-id="misaki"]').click();
const modal = p.locator('.modal');
await modal.waitFor();
await p.locator('.modal input').first().blur();
// From the top of the dialog down to the save button.
const m = await modal.boundingBox();
const save = await p.getByRole('button', { name: '保存する' }).boundingBox();
await p.screenshot({ path: out, clip: { x: m.x, y: m.y, width: m.width, height: save.y + save.height + 16 - m.y } });
await b.close();
console.log('wrote', out);
