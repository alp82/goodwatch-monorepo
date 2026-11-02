/**
 * Room redesign, real end to end: host + two friends in separate browser contexts against a local
 * proposal API and gateway (no fixture routes). Start the stack first (loopback only):
 *   API      goodwatch-webapp: YEPWATCH_LOCAL_FIXTURES=1 ... vite-node app/server/yepwatch/proposal-local-server.ts
 *   Gateway  yepwatch-realtime: YEPWATCH_PROPOSAL=1 ... node dist/main.js
 *   App      expo export with EXPO_PUBLIC_API_ORIGIN / EXPO_PUBLIC_WS_ORIGIN, then scripts/serve.cjs
 * Usage: YEPWATCH_E2E_ORIGIN=http://127.0.0.1:8199 node scripts/room-redesign-multiplayer.cjs
 */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.YEPWATCH_E2E_ORIGIN ?? 'http://127.0.0.1:8199';
const out = path.resolve(__dirname, '../artifacts/room-redesign/e2e');
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const problems = [];
  const snapshots = new Map();
  const frames = new Map();
  async function person(name, locale = 'de-DE') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale });
    const page = await context.newPage();
    page.name = name;
    page.on('pageerror', (e) => problems.push(`${name} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name} console: ${m.text()}`); });
    page.on('websocket', (ws) => ws.on('framereceived', (f) => {
      try { const t = JSON.parse(String(f.payload)).type; if (t === 'room.updated' || t === 'room.snapshot') frames.set(name, (frames.get(name) ?? 0) + 1); } catch { /* binary */ }
    }));
    page.on('response', async (r) => {
      if (!r.url().includes('/proposal/')) return;
      let body = null;
      try { body = await r.json(); } catch { /* not json */ }
      if (r.status() >= 400) problems.push(`${name} ${r.status()} ${new URL(r.url()).pathname} ${body?.error?.code ?? ''} ${body?.error?.message ?? ''}`);
      const s = body?.snapshot ?? body;
      if (s?.shared && s?.own) snapshots.set(name, s);
    });
    return page;
  }
  const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
  const shot = (page, file) => page.screenshot({ path: path.join(out, `${file}.png`) });
  const me = (name) => { const s = snapshots.get(name); return s?.shared.participants.find((p) => p.participantId === s.own.participantId); };
  const step = async (label, fn) => { log('▶', label); await fn(); };
  async function vote(page, yes, times) {
    for (let i = 0; i < times; i++) {
      const card = await page.getByTestId('poster').innerText().catch(() => '');
      await button(page, yes ? 'Yep' : 'Nope').click();
      await expect.poll(async () => page.getByTestId('poster').innerText().catch(() => ''), { timeout: 10000 }).not.toBe(card);
    }
  }

  try {
    const host = await person('Alp');
    const mia = await person('Mia');
    const sam = await person('Sam', 'en-US');
    let invite;

    await step('host creates a room (guest, no name) and lands on Mood', async () => {
      await host.goto(origin);
      await button(host, 'Create a room').click();
      await expect(host.getByLabel('Mood')).toBeVisible();
      await expect.poll(() => me('Alp')?.nickname).toBe('');
      await shot(host, '01-host-mood');
      await host.getByLabel('Mood').fill('something funny');
      await host.getByLabel('Mood').press('Enter');
      await expect(host.getByTestId('room-setup')).toBeVisible();
      await expect.poll(() => snapshots.get('Alp')?.shared.ideas.map((i) => [i.text, i.on])).toEqual([['something funny', true]]);
      await expect.poll(() => snapshots.get('Alp')?.shared.screens[0]?.country).toBe('DE');
    });

    await step('host names themselves and picks Netflix', async () => {
      await host.getByLabel('Your name').fill('Alp');
      await host.getByLabel('Your name').press('Enter');
      await expect.poll(() => me('Alp')?.nickname).toBe('Alp');
      await button(host, 'Streaming services, add').click();
      await host.getByRole('checkbox', { name: 'Netflix' }).click();
      await button(host, 'Done').click();
      await expect(host.getByTestId('room-setup')).toBeVisible();
      await expect.poll(() => me('Alp')?.serviceIds).toEqual([8, 1796]);
      await expect(button(host, 'Start')).toBeEnabled();
      const path = (await host.getByTestId('room-link').innerText()).match(/\/r\/\S+/)?.[0];
      if (!path) throw new Error('No invitation link on the room page');
      invite = `${origin}${path}`;
      await shot(host, '02-host-room');
    });

    for (const [page, service] of [[mia, 'Disney+'], [sam, 'HBO Max']]) {
      await step(`${page.name} joins via the link and picks ${service}`, async () => {
        await page.goto(invite);
        await page.getByLabel('Your name').fill(page.name);
        await button(page, 'Join').click();
        await expect(page.getByTestId('services-page')).toBeVisible();
        await page.getByRole('checkbox', { name: service }).click();
        await button(page, 'Done').click();
        await expect(page.getByTestId('waiting')).toBeVisible();
        await expect(page.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
      });
    }
    await shot(sam, '03-friend-waiting');

    await step('Mia suggests an idea; it arrives off, NEW for the host', async () => {
      await button(mia, 'Suggest an idea').click();
      await mia.getByLabel('Mood').fill('space adventure');
      await mia.getByLabel('Mood').press('Enter');
      await expect(mia.getByTestId('waiting')).toBeVisible();
      await expect(button(mia, 'space adventure, edit')).toBeVisible();
      await expect(host.getByText('NEW', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(host.getByRole('switch', { name: 'Use space adventure' })).toHaveAttribute('aria-checked', 'false');
      await expect(sam.getByRole('switch', { name: 'Use space adventure' })).toBeDisabled();
    });

    await step('per-person services merge on the host’s Streaming page', async () => {
      await expect(button(host, /^Netflix, Disney\+ \+1, change$/)).toBeVisible({ timeout: 10000 });
      await button(host, /^Netflix, Disney\+ \+1, change$/).click();
      await expect(host.getByTestId('streaming-page')).toBeVisible();
      for (const s of ['Netflix', 'Disney+', 'HBO Max']) await expect(host.getByRole('switch', { name: `Use ${s}` })).toHaveAttribute('aria-checked', 'true');
      await shot(host, '04-host-streaming');
      await button(host, 'Done').click();
      await expect(host.getByTestId('room-setup')).toBeVisible();
    });

    await step('host starts; everyone votes', async () => {
      await button(host, 'Start').click();
      for (const p of [host, mia, sam]) await expect(p.getByTestId('voting')).toBeVisible({ timeout: 15000 });
      await shot(mia, '05-friend-voting');
    });

    await step('host switches Mia’s idea on mid-vote (no restart)', async () => {
      const generation = snapshots.get('Alp').shared.generation;
      await vote(host, false, 1);
      await button(host, 'something funny, 1 new').click();
      await expect(host.getByTestId('room-page')).toBeVisible();
      await host.getByRole('switch', { name: 'Use space adventure' }).click();
      await expect(host.getByRole('switch', { name: 'Use space adventure' })).toHaveAttribute('aria-checked', 'true');
      await expect(host.getByText('NEW', { exact: true })).toHaveCount(0);
      await shot(host, '06-host-room-page-mid-vote');
      await button(host, 'Back').first().click();
      await expect(host.getByTestId('voting')).toBeVisible();
      await expect(button(host, 'something funny +1')).toBeVisible();
      expect(snapshots.get('Alp').shared.generation).toBe(generation);
      expect(snapshots.get('Alp').own.votes.filter((v) => v.value !== null)).toHaveLength(1);
    });

    await step('host switches HBO Max off mid-vote', async () => {
      await button(host, 'something funny +1').click();
      await button(host, /^Netflix, Disney\+.*change$/).click();
      await host.getByRole('switch', { name: 'Use HBO Max' }).click();
      await expect.poll(() => snapshots.get('Alp')?.shared.disabledServiceIds.includes(1899)).toBe(true); // a tile can group several ids
      await expect(sam.getByText('Off', { exact: true })).toHaveCount(0); // Sam is voting, not on the page
      await button(host, 'Done').click();
      await button(host, 'Back').first().click();
      await expect(host.getByTestId('voting')).toBeVisible();
      const shared = snapshots.get('Alp').shared;
      const services = new Set(shared.screens[0].serviceIds);
      expect(services.has(1899)).toBe(false);
    });

    await step('everyone says Yep to the same card: a match', async () => {
      // Each person's next unanswered card: find one all three still have open, and say Yep there.
      for (let round = 0; round < 12 && !(snapshots.get('Alp')?.shared.matches.length); round++) {
        for (const p of [host, mia, sam]) await vote(p, true, 1);
        for (const p of [host, mia, sam]) await p.waitForTimeout(300);
      }
      await expect.poll(() => snapshots.get('Alp')?.shared.matches.length ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
    });

    await step('host proposes; friends see it full screen and agree; Tonight', async () => {
      await button(host, /^\d+ match(es)?$/).click();
      await expect(host.getByTestId('matches')).toBeVisible();
      await shot(host, '07-host-matches');
      await button(host, 'Propose this').first().click();
      for (const p of [mia, sam]) await expect(p.getByTestId('proposal').filter({ visible: true })).toBeVisible({ timeout: 15000 });
      await expect(mia.getByText('SOMEONE PROPOSES', { exact: true })).toBeVisible();
      await expect(mia.getByText(/Alp/)).toHaveCount(0);
      await shot(mia, '08-friend-proposal');
      await button(mia, 'Agree').click();
      await expect(mia.getByText('You agree', { exact: true })).toBeVisible();
      await button(sam, 'Agree').click();
      for (const p of [host, mia, sam]) await expect(p.getByTestId('tonight')).toBeVisible({ timeout: 20000 });
      await expect(host.getByRole('link', { name: /^(Watch|Find) on / }).first()).toBeVisible();
      console.log('tonight link:', await host.getByRole('link', { name: /^(Watch|Find) on / }).first().getAttribute('aria-label'), await host.getByRole('link', { name: /^(Watch|Find) on / }).first().getAttribute('href'));
      await expect(mia.getByText('Alp can start again', { exact: true })).toBeVisible();
      await shot(host, '09-host-tonight');
    });

    await step('host starts again: back to the room page, Start begins round 2', async () => {
      await button(host, 'Start again').click();
      await expect(host.getByTestId('room-setup')).toBeVisible();
      await expect.poll(() => snapshots.get('Alp')?.shared.ideas.map((i) => [i.text, i.on])).toEqual([['something funny', true], ['space adventure', true]]);
      await button(host, 'Start').click();
      for (const p of [host, mia, sam]) await expect(p.getByTestId('voting')).toBeVisible({ timeout: 15000 });
      await shot(host, '10-host-round-2');
    });
    log('✔ flow complete; live room frames per person:', JSON.stringify(Object.fromEntries(frames)));
    if ([...['Alp', 'Mia', 'Sam']].some((n) => !frames.get(n))) problems.push('FAILED: a person got no live room frames (gateway)');
  } catch (e) {
    problems.unshift(`FAILED: ${e.message.split('\n').slice(0, 6).join(' | ')}`);
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const p of pages) await p.screenshot({ path: path.join(out, `failure-${p.name}.png`) }).catch(() => undefined);
  } finally {
    await browser.close();
    if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log(' -', p); }
    process.exitCode = problems.some((p) => p.startsWith('FAILED')) ? 1 : 0;
  }
})();
