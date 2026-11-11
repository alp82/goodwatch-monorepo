// Mixed rooms: an Android phone with a browser peer driven by Playwright, both against the same stack.
// The verbs here (createRoom, join, start, yep, openMatches, propose, agree, waitTonight) are the driver
// API exported from e2e/native/driver.mjs for the web harness's fixtures.
import path from 'node:path';
import { createRequire } from 'node:module';
import { APP_DIR, sleep } from './env.mjs';
import { createRoom, freshStart, inviteUrl, joinFromJoinScreen, measure, roiOf, tapAction } from './journey.mjs';

const require = createRequire(path.join(APP_DIR, 'package.json'));

export class WebPeer {
  static async open({ origin, name = 'Webby', headless = true }) {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
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
