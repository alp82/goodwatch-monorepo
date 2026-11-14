/**
 * Draws the native intro film's first and last frames into assets/intro/ (@2x and @3x, 576 × 224 dp), from the
 * same page the app's WebView plays. The last frame leaves out its caption: the app sets those words as native
 * text in the device's system font, the font the WebView uses. Prints where that caption sits.
 * Run: npx tsx scripts/intro-frames.ts
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { nativeIntroHtml } from '../src/features/home/native-intro-html';

const out = path.join(__dirname, '../assets/intro');

async function main() {
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const scale of [2, 3]) {
    const page = await browser.newPage({ viewport: { width: 576, height: 224 }, deviceScaleFactor: scale });
    await page.setContent(nativeIntroHtml);
    await page.evaluate(() => document.fonts.ready);
    const suffix = `@${scale}x.png`;
    await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }));
    await page.screenshot({ path: path.join(out, `first-frame${suffix}`) });
    const caption = await page.evaluate(() => {
      document.getAnimations().forEach(a => a.finish());
      const third = document.querySelector('.mini-caption.third') as HTMLElement;
      const box = third.getBoundingClientRect();
      const style = getComputedStyle(third);
      document.querySelector<HTMLElement>('.mini-captions')!.style.visibility = 'hidden';
      return { top: box.top, height: box.height, fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, opacity: style.opacity };
    });
    await page.screenshot({ path: path.join(out, `last-frame${suffix}`) });
    if (scale === 3) console.log('caption (before the 1.45 film scale for sizes):', JSON.stringify(caption));
    await page.close();
  }
} finally {
  await browser.close();
}
}

void main();
