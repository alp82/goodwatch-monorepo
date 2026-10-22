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
    for (let i = 1; i < 3; i++) {
      await pages[i].getByRole('button', { name: 'Ready to watch', exact: true }).click();
      await pages[i].getByText('You’re ready. Waiting for the host.', { exact: true }).waitFor();
    }
    await expect(host.getByRole('button', { name: 'Start choosing', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'Start choosing', exact: true }).click();
    for (const p of pages) await p.getByRole('button', { name: 'Yep', exact: true }).waitFor();
    const cookies = await contexts[0].cookies();
    const roomUrl = host.url();
    await host.close();
    const recorded = [];
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: 'no-preference',
        recordVideo: { dir: path.join(out, 'videos'), size: viewport },
      });
      await context.addCookies(cookies);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const observed = [];
      page.on('websocket', (socket) =>
        socket.on('framereceived', (event) => {
          try {
            const frame = JSON.parse(String(event.payload));
            if (frame.type === 'activity') observed.push(frame);
          } catch {}
        })
      );
      await page.goto(roomUrl);
      await page.getByRole('button', { name: 'Yep', exact: true }).waitFor();
      const peer = pages[1];
      const box = await peer.getByTestId('poster').boundingBox();
      await peer.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
      await peer.mouse.down();
      await peer.mouse.move(box.x + box.width * 0.5 + 30, box.y + box.height * 0.4, { steps: 5 });
      const cue = viewport.width > 900 ? 'peer-cursor' : 'peer-touch';
      await expect
        .poll(async () =>
          page
            .getByTestId(cue)
            .evaluateAll((nodes) =>
              nodes.some((node) => Number(getComputedStyle(node).opacity) > 0.1)
            )
        )
        .toBe(true);
      await new Promise((r) => setTimeout(r, 450));
      await peer.mouse.up();
      await peer.getByRole('button', { name: 'Yep', exact: true }).click();
      await new Promise((r) => setTimeout(r, 600));
      const trailerPeer = pages[2];
      for (
        let n = 0;
        n < 7 &&
        !(await trailerPeer.getByRole('button', { name: 'Watch trailer', exact: true }).count());
        n++
      ) {
        await trailerPeer.getByRole('button', { name: 'Nope', exact: true }).click();
      }
      await trailerPeer.getByRole('button', { name: 'Watch trailer', exact: true }).click();
      await expect.poll(() => observed.some((frame) => frame.view === 'trailer')).toBe(true);
      await new Promise((r) => setTimeout(r, 1800));
      await page.screenshot({ path: path.join(out, `activity-${viewport.width}.png`) });
      await trailerPeer.getByRole('button', { name: 'Close panel', exact: true }).last().click();
      await new Promise((r) => setTimeout(r, 600));
      const video = page.video();
      await page.close();
      const source = await video.path();
      await context.close();
      const target = path.join(out, `authenticated-activity-${viewport.width}.webm`);
      fs.renameSync(source, target);
      for (const frame of observed) {
        const allowed = [
          'type',
          'sessionId',
          'sequence',
          'view',
          'gesture',
          'beat',
          'roomId',
          'participantId',
          'serverTime',
          'expiresAt',
        ];
        if (Object.keys(frame).some((key) => !allowed.includes(key)))
          throw new Error('Activity exposed an unexpected field');
      }
      recorded.push({
        viewport,
        file: path.basename(target),
        activityFrames: observed.length,
        source: 'Another independently authenticated browser participant using actual visible UI',
        cueVerified: cue,
        trailerViewObserved: true,
      });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(
      path.join(out, 'authenticated-activity.json'),
      JSON.stringify(
        {
          recorded,
          errors,
          catalog:
            'Finite real catalog, actual HTTP15993 + gateway4322 + isolated durable Crate; no fixture interception',
        },
        null,
        2
      )
    );
    console.log(JSON.stringify(recorded));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
