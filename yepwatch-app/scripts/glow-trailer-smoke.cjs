// Real HTTP/catalog/YouTube evidence. No player or API responses are mocked.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, '../artifacts/glow/real');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const referers = new Set();
  const results = [];
  page.on('request', async request => {
    try {
      const url = new URL(request.url());
      if (url.hostname.endsWith('youtube.com') && url.pathname.startsWith('/embed/')) {
        const headers = await request.allHeaders();
        if (headers.referer) referers.add(new URL(headers.referer).origin);
      }
    } catch {}
  });
  try {
    await page.addInitScript(() => {
      window.__yepwatchPlayerReports = [];
      window.addEventListener('message', event => {
        if (event.data?.channel?.startsWith('yepwatch-player-'))
          window.__yepwatchPlayerReports.push({ state: event.data.state, muted: event.data.muted, volume: event.data.volume, error: event.data.error });
      });
    });
    await page.goto('http://127.0.0.1:8132');
    await page.getByLabel('Your nickname').fill('Trailer check');
    await page.getByRole('button', { name: 'Create a room', exact: true }).click();
    await page.getByRole('button', { name: 'Choose our services', exact: true }).click();
    await page.getByRole('button', { name: 'Change country', exact: true }).click();
    await page.getByLabel('Find country').fill('Germany');
    await page.getByRole('button', { name: 'Germany', exact: true }).click();
    await page.getByRole('button', { name: 'Netflix (service 8)', exact: true }).click();
    await page.getByRole('button', { name: 'Use these services', exact: true }).click();
    await page.getByRole('button', { name: 'Start choosing', exact: true }).click();
    await page.getByRole('button', { name: 'Nope', exact: true }).waitFor({ timeout: 30000 });
    for (let index = 0; index < 7; index++) {
      const before = await page.getByTestId('poster').innerText();
      if (await page.getByRole('button', { name: 'Watch trailer', exact: true }).count()) {
        await page.evaluate(() => { window.__yepwatchPlayerReports = []; });
        await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
        await page.waitForFunction(() => window.__yepwatchPlayerReports.some(p => p.error || p.state === 1), undefined, { timeout: 20000 }).catch(() => {});
        const embedded = page.locator('iframe[title="Title trailer"]').contentFrame().locator('iframe');
        const iframeUrl = await embedded.getAttribute('src').catch(() => null);
        const reports = await page.evaluate(() => window.__yepwatchPlayerReports);
        const refused = reports.some(p => ['101', '150'].includes(p.error));
        let sourceLinkCorrect = false;
        let mediaProgress = null;
        if (refused) {
          await expect(page.getByText('This trailer cannot play inside the app. Watch it on YouTube.', { exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
          const popupPromise = page.waitForEvent('popup');
          await page.getByRole('button', { name: 'Watch on YouTube', exact: true }).click();
          const popup = await popupPromise;
          await popup.waitForURL('https://www.youtube.com/watch?v=*', { timeout: 10000 });
          sourceLinkCorrect = new URL(popup.url()).searchParams.get('v') === new URL(iframeUrl).pathname.split('/').at(-1);
          await popup.close();
          await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
        } else {
          await page.getByRole('button', { name: 'Play with sound', exact: true }).click();
          await page.waitForFunction(() => window.__yepwatchPlayerReports.some(p => p.state === 1 && !p.error && !p.muted && p.volume > 0), undefined, { timeout: 10000 }).catch(() => {});
          const playerFrame = page.frames().find(f => f.url().startsWith('https://www.youtube.com/embed/'));
          if (playerFrame) {
            const first = await playerFrame.evaluate(() => document.querySelector('video')?.currentTime ?? null);
            await page.waitForTimeout(1600);
            const second = await playerFrame.evaluate(() => document.querySelector('video')?.currentTime ?? null);
            mediaProgress = { first, second, advanced: second !== null && first !== null && second > first };
          }
        }
        const finalReports = await page.evaluate(() => window.__yepwatchPlayerReports);
        results.push({ index, iframeUrl, refused, sourceLinkCorrect, mediaProgress, reports: finalReports });
        await page.screenshot({ path: path.join(output, `trailer-catalog-${index}.png`) });
        await page.getByRole('button', { name: 'Close panel', exact: true }).last().click();
        await expect.poll(() => page.getByTestId('poster').innerText()).toBe(before);
        results.at(-1).closePreservedCard = true;
        console.log(JSON.stringify({ index, refused, sourceLinkCorrect, mediaProgress }));
      } else results.push({ index, noTrailer: true });
      if (index < 6) {
        await page.getByRole('button', { name: 'Nope', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeEnabled();
      }
    }
    expect(results.some(r => r.refused && r.sourceLinkCorrect)).toBe(true);
    expect(results.some(r => r.mediaProgress?.advanced && r.reports.some(p => p.state === 1 && !p.error && !p.muted && p.volume > 0))).toBe(true);
  } catch (error) {
    console.error('Trailer check failed', error.name, error.message.split('\n')[0]);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'trailer-recovery-playback.json'), JSON.stringify({ actualApi: 'http://127.0.0.1:15993', catalog: 'Finite real 36-title sample, DE Netflix 8', results, embedRefererOrigins: [...referers], audioEvidence: 'Browser reports only; audible physical-device playback not verified', nativeDevice: 'Not tested' }, null, 2));
    await browser.close();
  }
})();
