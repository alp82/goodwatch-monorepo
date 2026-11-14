// Mixed rooms: an Android phone with a browser peer driven by Playwright, both against the same stack.
// The verbs here (createRoom, join, start, yep, openMatches, propose, agree, waitTonight) are the driver
// API exported from e2e/native/driver.mjs for the web harness's fixtures.
import path from 'node:path';
import { createRequire } from 'node:module';
import { APP_DIR, NATIVE_DIR, sleep } from './env.mjs';
import { gfxFrames, gfxReset } from './gates.mjs';
import { startTrace, tracing } from './trace.mjs';
import { createRoom, fillAndSubmit, freshStart, inviteCode, inviteUrl, joinFromJoinScreen, measure, pickNetflix, posterTitle, roiOf, tapAction, toStart } from './journey.mjs';

const require = createRequire(path.join(APP_DIR, 'package.json'));
// The web harness's page recorder: its visible() predicate (viewport, opacity and visibility through every
// ancestor) is the one the browser friend's timing uses, so an entrance animating from opacity 0 is not "shown".
const RECORDER = path.join(NATIVE_DIR, '..', 'lib', 'recorder.page.js');

export class WebPeer {
  static async open({ origin, name = 'Webby', headless = true }) {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    await context.addInitScript({ path: RECORDER });
    const page = await context.newPage();
    const peer = new WebPeer(browser, page, origin, name);
    page.on('pageerror', e => peer.errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') peer.errors.push(`console: ${m.text()}`); });
    return peer;
  }
  constructor(browser, page, origin, name) { Object.assign(this, { browser, page, origin, name, errors: [] }); }
  button(name) { return this.page.getByRole('button', { name, exact: typeof name === 'string' }); }
  async createRoom(mood = 'something funny') {
    const p = this.page;
    await p.goto(this.origin);
    await this.button('New room').click();
    await p.getByLabel('Mood').fill(mood); await p.getByLabel('Mood').press('Enter');
    await p.getByTestId('room-setup').waitFor();
    await p.getByLabel('Your name').fill(this.name); await p.getByLabel('Your name').press('Enter');
    await this.button(/^Streaming services/).click();
    await p.getByRole('checkbox', { name: 'Netflix' }).click();
    await this.button('Done').click();
    const text = await p.getByTestId('share-row').innerText();
    return text.match(/\/r\/([A-Z0-9]+)/)[1];
  }
  async join(url) {
    const p = this.page;
    await p.goto(url);
    // As a person does: the join page once it shows (the startup cover gone). A name typed into the page
    // still building under the cover is lost when it shows, and Join stays disabled.
    await p.getByTestId('join-screen').waitFor({ state: 'visible', timeout: 15000 });
    await p.getByTestId('yepwatch-boot').waitFor({ state: 'detached', timeout: 15000 });
    await p.getByLabel('Your name').fill(this.name);
    await this.button('Join').click();
    await p.getByTestId('services-sheet').waitFor();
    await p.getByRole('checkbox', { name: 'Netflix' }).click();
    await this.button('Done').click();
    await p.getByTestId('waiting').waitFor();
  }
  async start() { await this.button('Start').click(); await this.page.getByTestId('voting').waitFor({ timeout: 15000 }); }
  async waitVoting() { await this.page.getByTestId('voting').waitFor({ timeout: 15000 }); }
  async yep() { await this.button('Yep').click(); }
  async openMatches() { await this.button(/^\d+ match(es)?$/).click(); await this.page.getByTestId('matches').waitFor(); }
  async propose() { await this.button('Propose this').first().click(); }
  async agree() { await this.button('Agree').click(); }
  async waitTonight() { await this.page.getByTestId('tonight').first().waitFor({ timeout: 20000 }); }
  /** The current card's title from its accessible label (as e2e/web/flows.ts cardTitle). */
  card() {
    return this.page.evaluate(() => {
      for (const el of document.querySelectorAll('[aria-label$=". Swipe or use the choice buttons."]')) {
        if (el.closest('[data-testid="poster"]') || el.querySelector('[data-testid="poster"]')) return el.getAttribute('aria-label').replace(/\. Swipe or use the choice buttons\.$/, '');
      }
      return '';
    });
  }
  /**
   * A real pointer click on a button. Resolves with the pointerdown's event time on the page's epoch clock
   * (performance.timeOrigin + timeStamp), the anchor the web harness uses for every tap (lib/recorder.page.js).
   * Browser and emulator recorder share the host's clock.
   */
  async clickAt(name) {
    const box = await this.button(name).boundingBox();
    if (!box) throw new Error(`browser: no ${name} button`);
    await this.page.evaluate(() => {
      window.__ywDown = null;
      window.addEventListener('pointerdown', (e) => { window.__ywDown = performance.timeOrigin + e.timeStamp; }, { capture: true, once: true });
    });
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const at = await this.page.evaluate(() => window.__ywDown);
    if (!at) throw new Error(`browser: the click on ${name} produced no pointerdown`);
    return at;
  }
  /**
   * Starts watching (every animation frame, from inside the page) for all these test ids to show, by the
   * recorder's visible() (lib/recorder.page.js); resolves with the epoch time.
   */
  async watchVisible(testIds, timeoutMs = 10000) {
    await this.page.evaluate(({ testIds, timeoutMs }) => {
      window.__ywSeen = null;
      const visible = window.__yw?.visible;
      if (!visible) throw new Error('browser: the page recorder is not installed');
      const end = performance.now() + timeoutMs;
      const tick = () => {
        const shown = testIds.every((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible));
        if (shown) { window.__ywSeen = performance.timeOrigin + performance.now(); return; }
        if (performance.now() < end) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { testIds, timeoutMs });
    return async () => {
      await this.page.waitForFunction(() => window.__ywSeen !== null, null, { timeout: timeoutMs }).catch(() => {});
      return this.page.evaluate(() => window.__ywSeen);
    };
  }
  async close() { await this.browser.close(); }
}

/** Android host, browser guest: invite from the phone's share row, browser joins, both decide. */
export async function mixedHostAndroid({ phone: A, stack, runDir, timing, journeyFail }) {
  await freshStart(A);
  const code = await createRoom(A, { name: 'Ann', mood: 'twist ending' });
  const web = await WebPeer.open({ origin: stack.app, name: 'Webby' });
  try {
    await web.join(`${stack.app}/r/${code}`);
    await A.waitFor('2 people, people', { timeout: 8000 });
    await A.tap('Start');
    await A.waitFor('poster', { timeout: 10000 }); await web.waitVoting();
    await web.yep(); await sleep(500);
    const yep = await A.find('Yep');
    // The browser sees the match: measured on the phone side only (the browser has its own gates).
    await A.tapXY(yep.cx, yep.cy);
    await web.page.getByRole('button', { name: /^\d+ match(es)?$/ }).waitFor({ timeout: 5000 });
    await A.tap(/^\d+ match(es)?$/); await A.tap('Propose this');
    await web.agree().catch(async () => { await web.openMatches(); await web.agree(); });
    await A.waitFor('tonight-poster', { timeout: 10000 }); await web.waitTonight();
    if (web.errors.length) journeyFail('mixed web errors', web.errors.slice(0, 5).join(' | '));
  } finally { await web.close(); }
}

/** Browser host, Android guest: the phone opens the browser's invitation (local origin app link). */
export async function mixedHostWeb({ phone: Bp, stack, runDir, timing, journeyFail }) {
  const web = await WebPeer.open({ origin: stack.app, name: 'Webhost' });
  try {
    const code = await web.createRoom('space adventure');
    Bp.home(); await sleep(500);
    Bp.openLink(`${stack.app}/r/${code}`);
    await joinFromJoinScreen(Bp, 'Bob');
    const start = web.button('Start');
    const r = await measure({ actor: Bp, phones: [Bp], file: path.join(runDir, 'video', 'mixed-web-start.webm'), targets: { B: roiOf(Bp, 'poster', 10000) },
      action: async () => { const hostMs = Date.now(); await start.click(); return { anchor: 'host', hostMs }; } });
    timing('browser host Start -> first card on Android guest', 200, r.B, { informational: true, note: 'anchor = Playwright click call on the host' });
    await Bp.tap('Yep'); await sleep(400); await web.yep();
    await Bp.waitFor(/^\d+ match(es)?$/, { timeout: 5000 });
    await web.openMatches(); await web.propose();
    await Bp.tap('Agree', { timeout: 8000 });
    await Bp.waitFor('tonight-poster', { timeout: 10000 }); await web.waitTonight();
    if (web.errors.length) journeyFail('mixed web errors', web.errors.slice(0, 5).join(' | '));
  } finally { await web.close(); }
}
export { inviteUrl, tapAction };

/**
 * The deploy gate's Android room (owner decision Q28): an Android app phone hosts, a browser phone joins
 * through the invitation link, the host starts, both vote until there is a match. Gates on the phone: the
 * timing of every step the phone performs or receives (video, see video.mjs), flash in each of those
 * transitions, a11y of each screen on the way, no blocking words. The browser's console and page errors
 * count as errors. The browser's own timing, flash and a11y gates are the web gate's (same app, same stack).
 */
export async function mixedGateRoom({ phone: A, stack, runDir, B, timing, audit, notStuck, journeyFail, errors, frames }) {
  const vid = name => path.join(runDir, 'video', `${name}.webm`);
  const opening = WebPeer.open({ origin: stack.app, name: 'Webby' }); // Chromium starts while the phone creates the room
  opening.catch(() => {});
  let web = null;
  try {
    await toStart(A);
    const tile = await A.find('New room', { timeout: 15000 });
    const traced = tracing('new-room') ? await startTrace(A, 'new-room', path.join(runDir, 'video')) : null;
    const nr = await measure({ actor: A, phones: [A], file: vid('new-room'), action: tapAction(A, tile), targets: { A: roiOf(A, 'Mood') } });
    if (traced) await traced();
    timing('New room -> Mood page', B.newRoomMs, nr.A);
    await audit(A, 'mood page');
    await A.tap('cheer me up');
    const create = await A.find('Create room');
    const cr = await measure({ actor: A, phones: [A], file: vid('create-room'), action: tapAction(A, create), targets: { A: roiOf(A, 'share-row', 10000) } });
    timing('Create room -> room page', B.createRoomMs, cr.A);
    await notStuck(A, 'room page after create');
    await audit(A, 'room page (host, before start)');
    // Services first: once a friend with services is in, the row shows theirs ("Netflix, change").
    await A.tap(/^Streaming services/);
    await A.waitFor('services-sheet');
    await audit(A, 'services sheet');
    await pickNetflix(A);
    // The friend joins through the share row's link while the host types a name.
    const code = await inviteCode(A);
    const joining = opening.then(async (w) => { web = w; await w.join(`${stack.app}/r/${code}`); });
    joining.catch(() => {});
    await fillAndSubmit(A, 'Your name', 'Ann');
    await joining;
    await A.waitFor('2 people, people', { timeout: 5000 });

    // Start on the phone: the phone's first card from its video; the browser's voting page from inside the
    // page (first animation frame it is shown), both against the touch frame on the host clock.
    const start = await A.find('Start');
    const browserVoting = await web.watchVisible(['voting', 'poster'], 10000);
    const st = await measure({ actor: A, phones: [A], file: vid('start'), targets: { A: roiOf(A, 'poster', 10000) }, action: tapAction(A, start) });
    timing('Start -> first card (Android host)', B.startToFirstCardMs, st.A);
    const seen = await browserVoting();
    if (!seen) journeyFail('browser never reached voting', 'the browser friend did not show voting within 10 s of Start');
    else if (st.A?.ok) {
      const ms = Math.round(seen - st.A.anchorMs);
      timing('Start on Android -> voting in the browser friend', B.startToPeerVotingMs, { ok: true, ms, settledMs: ms, file: st.A.file, resolutionMs: 17, clockErrMs: st.A.clockErrMs });
    }
    await audit(A, 'voting');

    // Vote to a match: the phone says Yep to its next cards, the browser skips to one of them, then the
    // browser's Yep makes the match. Measured: that browser Yep -> the match on the phone.
    await A.waitFor('poster', { timeout: 8000 });
    const yeps = new Set();
    // Frame pacing while the phone votes (its Yep effects animate): the subset's frame gate has samples.
    gfxReset(A);
    for (let i = 0; i < 4; i++) {
      const t = await posterTitle(A);
      if (!t) { journeyFail('empty deck', `no card on the phone at vote ${i + 1}`, A); break; }
      yeps.add(t); await A.tap('Yep');
      const end = Date.now() + 3000; while (Date.now() < end && (await posterTitle(A)) === t) await sleep(60);
    }
    const gfx = gfxFrames(A);
    const sampled = (gfx.summary.count ?? 0) > 0;
    frames.push({ name: 'voting Yeps (Android host)', budgetMs: B.native.frameMaxMs, ...gfx.summary, pass: sampled && gfx.summary.over20 === 0, ...(sampled ? {} : { error: 'no frames sampled' }) });
    for (let i = 0; i < 12 && !yeps.has(await web.card()); i++) {
      const t = await web.card(); await web.button('Nope').click();
      const end = Date.now() + 3000; while (Date.now() < end && (await web.card()) === t) await sleep(40);
    }
    if (!yeps.has(await web.card())) throw new Error(`decks never overlapped: the phone said Yep to ${[...yeps].join(', ')}; browser on "${await web.card()}"`);
    await sleep(600);
    const vt = await measure({ actor: A, phones: [A], file: vid('vote-to-peer'), targets: { A: async () => (await A.waitFor(/^\d+ match(es)?$/, { timeout: 5000 })).bounds },
      action: async () => ({ anchor: 'host', hostMs: await web.clickAt('Yep') }) });
    timing('Yep in the browser -> match shows on Android', B.voteToPeerMs, vt.A);
    await audit(A, 'voting with a match');
    await notStuck(A, 'voting after the match');
  } finally {
    if (!web) web = await opening.catch(() => null);
    if (web) { for (const e of web.errors) errors.push({ phone: 'browser', kind: 'browser', line: e }); await web.close(); }
  }
}
