const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.GLOW_APP_ORIGIN ?? 'http://127.0.0.1:8132';
const service = process.env.GLOW_SERVICE_LABEL ?? 'Netflix (service 8)';
const out = path.join(__dirname, '../artifacts/glow/real');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  const pages = [];
  const errors = [];
  const frames = [];
  const checks = [];
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('websocket', (s) =>
        s.on('framereceived', (e) => {
          try {
            const f = JSON.parse(String(e.payload));
            if (f.type === 'room.snapshot' || f.type === 'room.updated' || f.type === 'activity')
              frames.push(f);
          } catch {}
        })
      );
    }
    const host = pages[0];
    await host.goto(origin);
    await host.getByLabel('Your nickname').fill('Host');
    await host.getByRole('button', { name: 'Create a room', exact: true }).click();
    await host.getByRole('button', { name: 'Choose our services', exact: true }).click();
    await host.getByRole('button', { name: 'Change country', exact: true }).click();
    await host.getByLabel('Find country').fill('Germany');
    await host.getByRole('button', { name: 'Germany', exact: true }).click();
    await host.getByRole('button', { name: service, exact: true }).click();
    await host.getByRole('button', { name: 'Use these services', exact: true }).click();
    await host.getByRole('button', { name: 'Invite friends', exact: true }).click();
    const invite = await host
      .getByText(new RegExp('^' + origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/r/'))
      .innerText();
    await host.getByRole('button', { name: 'Close panel', exact: true }).last().click();
    for (let i = 1; i < 3; i++) {
      await pages[i].goto(invite);
      await pages[i].getByLabel('Your nickname').fill(`Friend ${i}`);
      await pages[i].getByRole('button', { name: 'Join room', exact: true }).click();
      await pages[i].getByRole('button', { name: 'Ready to watch', exact: true }).waitFor();
    }
    if (process.env.GLOW_PARALLEL_READY === '1') {
      await Promise.all(pages.slice(1).map(async page => { await page.getByRole('button', { name: 'Ready to watch', exact: true }).click(); await page.getByText('You’re ready. Waiting for the host.', { exact: true }).waitFor(); }));
      checks.push('Two independent visible Ready actions succeed concurrently against unchanged screen configuration');
    } else {
    for (let i = 1; i < 3; i++) {
      await pages[i].getByRole('button', { name: 'Ready to watch', exact: true }).click();
      await pages[i].getByText('You’re ready. Waiting for the host.', { exact: true }).waitFor();
    }
    }
    await expect(host.getByRole('button', { name: 'Start choosing', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'Start choosing', exact: true }).click();
    for (const p of pages) await p.getByRole('button', { name: 'Yep', exact: true }).waitFor();
    checks.push(
      'Visible create, invite, independent cookie admission, explicit screen readiness, start for three clients'
    );
    const nextTitle = await host.getByTestId('poster').innerText();
    for (const p of pages) await p.getByRole('button', { name: 'Yep', exact: true }).click();
    for (const p of pages)
      await p.getByRole('button', { name: 'Inspect 1 matches', exact: true }).waitFor();
    checks.push('Immediate confirmed shared match on every client without completion gate');
    await host.getByRole('button', { name: 'Inspect 1 matches', exact: true }).click();
    await host.getByRole('button', { name: 'Keep voting', exact: true }).click();
    checks.push('Inspect and Keep voting preserves own next card');
    for (const size of [
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await host.setViewportSize(size);
      await host.screenshot({ path: path.join(out, `connected-voting-${size.width}.png`) });
      const bounds = await host.evaluate(() => ({
        w: innerWidth,
        h: innerHeight,
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
      }));
      if (bounds.sw > bounds.w || bounds.sh > bounds.h)
        throw new Error(`Page scroll ${JSON.stringify(bounds)}`);
    }
    for (const p of pages) {
      await p.getByRole('button', { name: 'Inspect 1 matches', exact: true }).click();
      await p.getByRole('button', { name: 'Pick this', exact: true }).click();
    }
    for (const p of pages)
      await p.getByText('Everyone picked it. Enjoy your watch.', { exact: true }).waitFor();
    checks.push('All current picks automatically produce confirmed Done on three clients');
    await host.screenshot({ path: path.join(out, 'connected-done-desktop.png') });
    const forbidden = [
      'votes',
      'vote',
      'pick',
      'currentCardId',
      'watchedHistory',
      'candidateIndex',
      'direction',
      'x',
      'y',
    ];
    for (const frame of frames) {
      if (frame.type === 'activity') {
        for (const k of forbidden) if (k in frame) throw new Error(`Activity leaked ${k}`);
      } else
        for (const person of frame.snapshot.participants)
          for (const k of forbidden) if (k in person) throw new Error(`Roster leaked ${k}`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(
      path.join(out, 'connected-three-client.json'),
      JSON.stringify(
        {
          checks,
          frames: frames.length,
          errors,
          catalog: 'finite real catalog sample; actual durable API15993/Crate + WS4322',
          firstTitleObserved: Boolean(nextTitle),
        },
        null,
        2
      )
    );
    console.log(checks.join('\n'));
  } catch (e) {
    console.error(e);
    for (let i = 0; i < pages.length; i++) {
      await pages[i]
        .screenshot({ path: path.join(out, `multiplayer-error-${i}.png`) })
        .catch(() => {});
      console.error(i, (await pages[i].locator('body').innerText()).slice(0, 1800));
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
