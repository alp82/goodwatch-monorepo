/**
 * Multiplayer smoke, real end to end (no fixture routes): a host and two friends in separate browser contexts.
 * First visit → setup (name + Taste cards) → New couch → couch setup (idea, Movies and shows, services, Invite)
 * → friends join (Mia by the invitation link, Sam by code from his own start page after setup) → Mia's wish →
 * Start → Tonight (first-round how-to skipped) → idea and service switched mid-vote → everyone Yep to a match
 * → Matches: everyone's I'm in → Watch → decided (watch links) → Start again → round 2.
 * At the end the taste profiles the run made are deleted (DELETE /proposal/profile with each browser's secret).
 * Runs against the local E2E stack (front origin in e2e/.stack-s<N>.json) or production.
 * Usage: YEPWATCH_E2E_ORIGIN=https://yepwatch.com node scripts/room-redesign-multiplayer.cjs
 */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.YEPWATCH_E2E_ORIGIN ?? 'http://127.0.0.1:8199';
const out = path.resolve(__dirname, '../artifacts/room-redesign/e2e');
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const PROFILE_SECRET_KEY = 'yepwatch.v3.taste-secret';
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const problems = [];
  const shared = new Map();
  const own = new Map();
  const frames = new Map();
  const timings = [];
  let current = '';
  const keep = (name, s) => {
    const prev = shared.get(name);
    if (!prev || s.roomId !== prev.roomId || (s.revision ?? 0) >= (prev.revision ?? 0)) shared.set(name, s);
  };
  async function person(name, locale = 'de-DE') {
    const context = await browser.newContext({ ...PHONE, reducedMotion: 'reduce', locale });
    const page = await context.newPage();
    page.name = name;
    page.on('pageerror', (e) => problems.push(`${name} pageerror (${current}): ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name} console (${current}): ${m.text()}`); });
    page.on('websocket', (ws) => ws.on('framereceived', (f) => {
      try {
        const m = JSON.parse(String(f.payload));
        if (m.type === 'room.updated' || m.type === 'room.snapshot') {
          frames.set(name, (frames.get(name) ?? 0) + 1);
          if (m.snapshot?.roomId) keep(name, m.snapshot);
        }
      } catch { /* binary */ }
    }));
    page.on('response', async (r) => {
      if (!r.url().includes('/proposal/')) return;
      let body = null;
      try { body = await r.json(); } catch { /* not json */ }
      if (r.status() >= 400) problems.push(`${name} ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname} (${current}) ${body?.error?.code ?? ''} ${body?.error?.message ?? ''}`);
      const s = body?.snapshot ?? body;
      if (s?.shared?.roomId) keep(name, s.shared);
      if (s?.own) own.set(name, s.own);
    });
    return page;
  }
  const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true });
  const testId = (page, id) => page.getByTestId(id).filter({ visible: true });
  const shot = (page, file) => page.screenshot({ path: path.join(out, `${file}.png`) });
  const me = (name) => shared.get(name)?.participants.find((p) => p.participantId === own.get(name)?.participantId);
  const step = async (label, fn) => {
    current = label;
    log('▶', label);
    const t = Date.now();
    await fn();
    timings.push([label, Date.now() - t]);
  };
  /** The current card's title, from its accessible label ("<title>. Swipe or use the choice buttons."). */
  const cardTitle = (page) => page.evaluate(() => {
    for (const card of document.querySelectorAll('[data-testid="poster"]')) {
      if (card.offsetParent === null) continue;
      const sel = '[aria-label$="Swipe or use the choice buttons."]';
      const label = (card.closest(sel) ?? card.querySelector(sel))?.getAttribute('aria-label');
      if (label) return label.replace(/\. Swipe or use the choice buttons\.$/, '');
    }
    return '';
  });
  async function vote(page, yes) {
    await page.waitForTimeout(300); // a person's pace, not a double press
    const before = await cardTitle(page);
    await button(page, yes ? 'Yep' : 'Nope').click();
    await expect.poll(() => cardTitle(page), { timeout: 10000, message: `${page.name}: next card after ${yes ? 'Yep' : 'Nope'} on "${before}"` }).not.toBe(before);
  }
  /** First visit: the statement tile, the name, five Taste cards, That's enough, back on the start page. */
  async function setUp(page) {
    await expect(testId(page, 'landing').or(testId(page, 'home-rooms')).first()).toBeVisible({ timeout: 20000 });
    await button(page, 'Start with you').click();
    await expect(testId(page, 'first-run')).toBeVisible();
    await page.getByLabel('Your name').filter({ visible: true }).fill(page.name);
    await button(page, 'Continue').click();
    await expect(page.getByText('What do you like?').first()).toBeVisible();
    await expect(page.getByText(/^1 of \d+$/).first()).toBeVisible({ timeout: 20000 });
    for (let i = 0; i < 5; i++) {
      await button(page, 'Loved it').first().click();
      await expect(page.getByText(new RegExp(`^${i + 2} of \\d+$`)).first()).toBeVisible({ timeout: 10000 });
    }
    await button(page, 'That’s enough').click();
    await expect(testId(page, 'home-rooms')).toBeVisible({ timeout: 15000 });
  }
  async function pickServices(page, services) {
    await expect(testId(page, 'services-sheet')).toBeVisible({ timeout: 10000 });
    for (const s of services) await page.getByRole('checkbox', { name: s, exact: true }).filter({ visible: true }).click();
    await button(page, 'Done').click();
    await expect(testId(page, 'services-sheet')).toHaveCount(0);
  }
  async function addIdea(page, text) {
    await page.getByLabel('Describe what you want to watch').filter({ visible: true }).fill(text);
    await button(page, /^(Add|Replace)$/).click();
  }
  const ideas = (name) => shared.get(name)?.ideas.map((i) => [i.text, i.on]);
  const people = () => [host, mia, sam];
  let host, mia, sam;

  try {
    host = await person('Alp');
    mia = await person('Mia');
    sam = await person('Sam', 'en-US');
    let invite;

    await step('host: first visit → setup (name + 5 Taste cards) → start page', async () => {
      await host.goto(origin);
      await expect(testId(host, 'landing')).toBeVisible({ timeout: 20000 });
      await shot(host, '01-host-start-first-visit');
      await setUp(host);
      await shot(host, '02-host-start-set-up');
    });

    await step('host: New couch → couch setup; idea, Movies and shows', async () => {
      await button(host, 'New couch').click();
      await expect(testId(host, 'room-setup')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => me('Alp')?.nickname).toBe('Alp');
      await expect.poll(() => shared.get('Alp')?.screens?.[0]?.country).toMatch(/^[A-Z]{2}$/);
      await addIdea(host, 'something funny');
      await expect.poll(() => ideas('Alp')).toEqual([['something funny', true]]);
      const both = host.getByRole('radio', { name: 'Movies and shows', exact: true }).filter({ visible: true });
      await both.click();
      await expect(both).toBeChecked();
    });

    await step('host picks Netflix and copies the invitation from Invite', async () => {
      await button(host, 'Streaming services, add').click();
      await pickServices(host, ['Netflix']);
      await expect.poll(() => me('Alp')?.serviceIds?.length ?? 0).toBeGreaterThan(0);
      await button(host, 'Invite friends, show QR code and link').click();
      const qr = host.getByRole('img', { name: /^QR code for / }).filter({ visible: true });
      await expect(qr).toBeVisible();
      await shot(host, '03-host-invite');
      const link = (await qr.getAttribute('aria-label')).match(/\/r\/[A-Za-z0-9._-]+/)?.[0];
      if (!link) throw new Error('No invitation link in Invite');
      invite = new URL(link, host.url()).href;
      await host.keyboard.press('Escape');
      await expect(testId(host, 'invite-sheet').or(testId(host, 'invite-surface'))).toHaveCount(0);
      await expect(button(host, /^Start( with \d+| on my own)$/)).toBeEnabled();
      await shot(host, '04-host-couch-setup');
    });

    await step('Mia joins via the invitation link and picks Disney+', async () => {
      await mia.goto(invite);
      await expect(testId(mia, 'join-screen').or(testId(mia, 'invite-head')).first()).toBeVisible({ timeout: 20000 });
      await expect(mia.getByText('something funny').first()).toBeVisible();
      await mia.getByLabel('Your name').filter({ visible: true }).fill('Mia');
      await button(mia, 'Join').click();
      await pickServices(mia, ['Disney+']);
      await expect(testId(mia, 'waiting')).toBeVisible();
      await expect(mia.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
    });

    await step('Sam: first visit → setup → joins by code from the start page, picks HBO Max', async () => {
      await sam.goto(origin);
      await setUp(sam);
      await sam.getByLabel('Code or invitation link').fill(new URL(invite).pathname.split('/').pop());
      await button(sam, 'Join as Sam').click();
      await pickServices(sam, ['HBO Max']);
      await expect(testId(sam, 'waiting')).toBeVisible();
      await expect.poll(() => shared.get('Alp')?.participants.length, { timeout: 10000 }).toBe(3);
      await shot(sam, '05-friend-waiting');
    });

    await step('Mia adds a wish; it arrives on in the host’s ideas', async () => {
      await addIdea(mia, 'space adventure');
      const wish = host.getByRole('switch', { name: /^space adventure\. Mia’s wish/ }).filter({ visible: true });
      await expect(wish).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
      await expect(sam.getByTestId('waiting').getByRole('switch')).toHaveCount(0);
      await expect.poll(() => ideas('Alp')?.length).toBe(2);
    });

    await step('everyone’s services merge on the host’s Streaming row', async () => {
      const row = button(host, /^Netflix.*, change$/);
      await expect(row).toBeVisible({ timeout: 10000 });
      await row.click();
      await expect(testId(host, 'streaming-sheet')).toBeVisible();
      for (const s of ['Netflix', 'Disney+', 'HBO Max']) await expect(host.getByRole('switch', { name: `Use ${s}` }).filter({ visible: true })).toHaveAttribute('aria-checked', 'true');
      await shot(host, '06-host-streaming');
      await button(host, 'Done').click();
      await expect(testId(host, 'streaming-sheet')).toHaveCount(0);
    });

    await step('host taps Start with 3; everyone gets Tonight; the how-to is skipped', async () => {
      const t = Date.now();
      await button(host, 'Start with 3').click();
      for (const p of people()) await expect(testId(p, 'poster').first()).toBeVisible({ timeout: 20000 });
      log(`  start → cards on all three phones: ${Date.now() - t} ms`);
      await expect(host.getByText('Would you watch this tonight?').first()).toBeVisible();
      await shot(mia, '07-friend-tonight-howto');
      for (const p of people()) {
        const skip = button(p, 'Skip the how-to');
        if (await skip.count()) await skip.click();
        await expect(button(p, 'Skip the how-to')).toHaveCount(0);
      }
    });

    await step('host switches Mia’s wish off and on mid-vote (no restart)', async () => {
      const generation = shared.get('Alp').generation;
      await vote(host, false);
      await button(host, /, switch couch$/).click();
      await button(host, /, Couch page$/).click();
      await expect(testId(host, 'room-sheet')).toBeVisible();
      const sw = testId(host, 'room-sheet').getByRole('switch', { name: 'Use space adventure', exact: true });
      await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await expect.poll(() => shared.get('Alp')?.ideas.find((i) => i.text === 'space adventure')?.on).toBe(false);
      await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await expect.poll(() => shared.get('Alp')?.ideas.find((i) => i.text === 'space adventure')?.on).toBe(true);
      await shot(host, '08-host-couch-page-mid-vote');
      await button(host, 'Close').click();
      await expect(testId(host, 'poster').first()).toBeVisible();
      expect(shared.get('Alp').generation).toBe(generation);
    });

    await step('host switches HBO Max off mid-vote', async () => {
      await button(host, /, switch couch$/).click();
      await button(host, /, Couch page$/).click();
      await testId(host, 'room-sheet').getByRole('button', { name: /^Netflix.*, change$/ }).click();
      await expect(testId(host, 'streaming-sheet')).toBeVisible();
      await host.getByRole('switch', { name: 'Use HBO Max' }).filter({ visible: true }).click();
      await expect.poll(() => shared.get('Alp')?.disabledServiceIds?.length ?? 0).toBeGreaterThan(0);
      await button(host, 'Done').click();
      await expect(testId(host, 'streaming-sheet')).toHaveCount(0);
      if (await testId(host, 'room-sheet').count()) await button(host, 'Close').click();
      await expect(testId(host, 'poster').first()).toBeVisible();
    });

    await step('everyone says Yep: a match', async () => {
      for (let round = 0; round < 15 && !(shared.get('Alp')?.matches?.length); round++) {
        for (const p of people()) await vote(p, true);
        await host.waitForTimeout(400);
      }
      await expect.poll(() => shared.get('Alp')?.matches?.length ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
    });

    await step('Matches: everyone’s I’m in → Watch → decided with watch links', async () => {
      for (const p of people()) {
        await button(p, /^\d+ match(es)?$/).click();
        await expect(testId(p, 'matches')).toBeVisible({ timeout: 10000 });
      }
      await expect(host.getByText('What are we watching now?').first()).toBeVisible();
      await shot(host, '09-host-matches');
      const imIn = (p) => p.getByRole('checkbox', { name: /^I’m in for / }).filter({ visible: true }).first();
      await imIn(host).click();
      await expect(mia.getByRole('checkbox', { name: /, 1 of 3 in$/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
      // Never says who is in ("Fits Alp's idea" is the idea's credit, not an I'm in).
      await expect(mia.getByText(/Alp(’s| is) in\b/)).toHaveCount(0);
      await expect(mia.getByRole('checkbox', { name: /Alp/ })).toHaveCount(0);
      await imIn(mia).click();
      await expect(sam.getByRole('checkbox', { name: /, 2 of 3 in$/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
      await imIn(sam).click();
      for (const p of people()) await expect(p.getByText(/^Everyone’s in on /).first()).toBeVisible({ timeout: 10000 });
      await shot(mia, '10-friend-everyone-in');
      const t = Date.now();
      await button(mia, /^Watch /).first().click();
      for (const p of people()) await expect(testId(p, 'tonight')).toBeVisible({ timeout: 20000 });
      log(`  Watch → decided on all three phones: ${Date.now() - t} ms`);
      await expect.poll(() => shared.get('Alp')?.phase).toBe('decided');
      const link = host.getByRole('link', { name: /^(Watch|Find) on / }).filter({ visible: true }).first();
      await expect(link).toBeVisible();
      log('  watch link:', await link.getAttribute('aria-label'), (await link.getAttribute('href'))?.slice(0, 100));
      await expect(mia.getByText('Alp can start again', { exact: true })).toBeVisible();
      await shot(host, '11-host-decided');
    });

    await step('host starts again: couch setup, Start begins round 2', async () => {
      await button(host, 'Start again').click();
      await expect(testId(host, 'room-setup')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => ideas('Alp')).toEqual([['something funny', true], ['space adventure', true]]);
      await host.waitForTimeout(300);
      await button(host, 'Start with 3').click();
      for (const p of people()) await expect(testId(p, 'poster').first()).toBeVisible({ timeout: 20000 });
      await expect.poll(() => shared.get('Alp')?.generation ?? 0).toBeGreaterThanOrEqual(1);
      await shot(host, '12-host-round-2');
    });
    log('✔ flow complete; live room frames per person:', JSON.stringify(Object.fromEntries(frames)));
    if (['Alp', 'Mia', 'Sam'].some((n) => !frames.get(n))) problems.push('FAILED: a person got no live room frames (gateway)');
  } catch (e) {
    problems.unshift(`FAILED at "${current}": ${e.message.split('\n').slice(0, 6).join(' | ')}`);
    for (const p of [host, mia, sam].filter(Boolean)) await p.screenshot({ path: path.join(out, `failure-${p.name}.png`) }).catch(() => undefined);
  } finally {
    // The taste profiles this run made: the app's own reset path (DELETE /proposal/profile with the browser's secret).
    for (const p of [host, mia, sam].filter(Boolean)) {
      const status = await p.evaluate(async (key) => {
        const secret = localStorage.getItem(key);
        if (!secret) return 'no profile';
        const r = await fetch('/api/yepwatch/v1/proposal/profile', { method: 'DELETE', headers: { 'x-yepwatch-profile': secret } });
        return String(r.status);
      }, PROFILE_SECRET_KEY).catch((e) => `error ${e.message}`);
      log(`profile delete (${p.name}): ${status}`);
      if (!/^(204|200|404|no profile)$/.test(status)) problems.push(`${p.name}: profile delete answered ${status}`);
    }
    await browser.close();
    log('timings (ms):', timings.map(([l, ms]) => `\n  ${String(ms).padStart(6)}  ${l}`).join(''), `\n  total ${Date.now() - t0}`);
    log('screenshots:', out);
    if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log(' -', p); }
    process.exitCode = problems.some((p) => p.startsWith('FAILED')) ? 1 : 0;
  }
})();
