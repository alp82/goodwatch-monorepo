// The a11y gate's one accepted axe finding (lib/a11y.ts ACCEPTED) on synthetic pages: the Rotten Tomatoes chip's
// brand-red contrast passes (owner decision 2026-11-14, Q69), the same colors anywhere else and any other rule
// inside the chip still fail. No stack, no app.
import { test, expect, type Page } from '@playwright/test';
import { audit } from '../lib/a11y';

const ORIGIN = 'http://a11y.test';
// The chip as react-native-web renders it: brand #f83309, white values, the audience value at 0.9 opacity.
const CHIP = (testid: string) => `<div data-testid="${testid}"
  style="display:flex;gap:4px;padding:0 6px;height:28px;align-items:center;border-radius:6px;background:#f83309">
  <span style="color:#fff;font:bold 13px sans-serif">91%</span><span style="color:#fff;font:bold 13px sans-serif;opacity:0.9">88%</span></div>`;

async function auditOf(page: Page, body: string, signature: string) {
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=390"><title>a11y</title></head>
    <body style="background:#111"><main>${body}</main><script>window.__yw = { signature: () => ${JSON.stringify(signature)} };</script></body></html>`;
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await page.goto(`${ORIGIN}/`);
  return audit(page, 'tester', signature);
}

test('the Rotten Tomatoes chip keeps its brand red: its color-contrast is accepted', async ({ page }) => {
  expect(await auditOf(page, CHIP('source-score-rotten'), 'rt-chip')).toEqual([]);
});

test('the same red and white outside the chip still fail color-contrast', async ({ page }) => {
  const failures = await auditOf(page, CHIP('source-score-other'), 'other-chip');
  expect(failures.map((f) => f.detail).join('\n')).toContain('axe color-contrast');
});

test('another rule inside the chip still fails', async ({ page }) => {
  const failures = await auditOf(page, CHIP('source-score-rotten').replace('<span', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span'), 'rt-chip-img');
  const details = failures.map((f) => f.detail).join('\n');
  expect(details).toContain('axe image-alt');
  expect(details).not.toContain('axe color-contrast');
});

test('the same colors in a shadow root outside the chip still fail, even beside the chip', async ({ page }) => {
  const shadow = `<div id="host"></div><script>document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
    ${JSON.stringify(CHIP('source-score-shadow'))};</script>`;
  const failures = await auditOf(page, CHIP('source-score-rotten') + shadow, 'shadow-chip');
  expect(failures.map((f) => f.detail).join('\n')).toContain('axe color-contrast');
});
