import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

// Exercise the real component with an asynchronous native accessibility bridge.
// The data URI is decoded before mounting, matching a warm image cache.
for (const preference of ['animate', 'reduce', 'unavailable'] as const)
test(`cached poster waits for motion settings: ${preference}`, async ({ page }) => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {AccessibilityInfo} from 'react-native';
      import {FadeImage} from './src/features/glow/FadeImage';
      AccessibilityInfo.isReduceMotionEnabled = () => new Promise((resolve, reject) => {
        window.resolveMotion = resolve;
        window.rejectMotion = reject;
      });
      window.mountPoster = source => createRoot(document.getElementById('root')).render(
        <FadeImage source={{uri: source}} testID="art" style={{width: 200, height: 300}} />
      );
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    alias: { 'react-native': 'react-native-web' },
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"', 'process.env.EXPO_PUBLIC_DEVELOPMENT_NOTICE': 'undefined' },
    plugins: [{ name: 'unused-safe-area', setup(builder) {
      builder.onResolve({ filter: /^react-native-safe-area-context$/ }, () => ({ path: 'safe-area', namespace: 'unused' }));
      builder.onLoad({ filter: /.*/, namespace: 'unused' }, () => ({ contents: 'export const SafeAreaView = null;' }));
    } }],
  });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(async () => {
    const src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="purple"/></svg>');
    const image = new Image(); image.src = src; await image.decode();
    (window as any).mountPoster(src);
  });
  const art = page.getByTestId('art');
  await expect(art.locator('img')).toHaveJSProperty('complete', true);
  await page.waitForTimeout(100);
  await expect(art).toHaveCSS('opacity', '0');
  await page.evaluate(preference => {
    (window as any).frames = [];
    const end = performance.now() + 500;
    function sample() {
      (window as any).frames.push(Number(getComputedStyle(document.querySelector('[data-testid="art"]')!).opacity));
      if (performance.now() < end) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    if (preference === 'unavailable') (window as any).rejectMotion(new Error('Bridge unavailable'));
    else (window as any).resolveMotion(preference === 'reduce');
  }, preference);
  await expect(art).toHaveCSS('opacity', '1');
  const frames: number[] = await page.evaluate(() => (window as any).frames);
  if (preference === 'animate') expect(frames.some(value => value > 0 && value < 0.9)).toBe(true);
  else expect(frames.every(value => value === 0 || value === 1)).toBe(true);
  for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
});
