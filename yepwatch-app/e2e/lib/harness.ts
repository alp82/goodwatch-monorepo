// Playwright fixtures for multi-person YepWatch journeys with gate collectors on every page.
//
//   test('…', async ({ room }) => {
//     const host = await room.person('Alp');                       // phone 390×844
//     const desk = await room.person('Dee', { device: 'desktop' }); // 1440×900
//     await host.open('/');
//     await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
//     await room.point('room');                                     // fault hook (restart, offline, hide, …)
//   });
//
// At teardown every person's page recording goes through the gates (lib/gates.ts); any failure fails the test.
// Timing samples are attached for the reporter, which applies the p95 budgets across the run.
import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo, type CDPSession } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetsFor } from '../budgets.mjs';
import { parseFrame, sharedSchema } from '../../src/core/continuous/wire';
import { audit } from './a11y';
import { blockingWords, connectionWords, deadButtons, flashes, frameGaps, layoutShifts, type GateFailure, type Recording } from './gates';

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORDER = path.join(here, 'recorder.page.js');
// The local stack's origins (e2e/stack/up.mjs). Smoke runs against a real origin need none of it.
const slot = Number(process.env.E2E_SLOT || 0);
const stackFile = path.join(here, '..', slot ? `.stack-s${slot}.json` : '.stack.json');
const STACK = (fs.existsSync(stackFile) ? JSON.parse(fs.readFileSync(stackFile, 'utf8')) : {}) as Record<string, string>;
export const ORIGIN = process.env.E2E_ORIGIN ?? STACK.front;
export const CONTROL = STACK.control;
export const ISSUER = STACK.issuer;
const B = budgetsFor();

export type Fault = 'none' | 'nows' | 'slow' | 'hidden' | 'restart' | 'twodevice' | 'rapid';
export type Spec = { visible?: string[]; any?: string[]; hidden?: string[]; text?: string; label?: { text: string; exact?: boolean }; textChanged?: { id: string; from: string }; cardChanged?: { from: string } };
export interface Sample { moment: string; ms: number; person: string; detail?: string }
type Shared = { roomId: string; phase: string; ideas: { text: string; on: boolean; authorId: string; attributes: unknown[] }[]; participants: { participantId: string; nickname: string }[]; matches?: unknown[]; generation: number; [k: string]: unknown };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  // Small phones: iPhone SE (1st gen) and a common small Android screen.
  se: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  android: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
} as const;
export type Device = keyof typeof DEVICES;

export class Person {
  readonly recordings: Recording[] = [];
  /** Page-clock windows (epoch ms) when the harness itself ran in the page (axe audits). */
  readonly harnessBusy: [number, number][] = [];
  readonly failures: GateFailure[] = [];
  readonly samples: Sample[] = [];
  latest: Shared | null = null;
  own: { participantId: string; votes?: { candidateId: string; value: boolean | null }[]; [k: string]: unknown } | null = null;
  private waiterSeq = 0;
  private expectedStatus: RegExp[] = [];
  private cdp: CDPSession | null = null;
  readonly frames = { received: 0, invalid: 0 };
  readonly commandLog: { t: number; status: number; path: string }[] = [];
  /** False for a person who types real credentials: no trace, and no failure aria snapshot of a password form. */
  traced = true;
  /**
   * Every request this person's pages made, as origin + path only (never a query: OAuth codes and states travel
   * there) with its timing and outcome. Kept for failure messages, so an untraced person's stall still names the
   * request it hung on.
   */
  readonly requests: { method: string; url: string; document: boolean; t: number; end?: number; status?: number; error?: string }[] = [];

  constructor(readonly room: Room, readonly name: string, readonly context: BrowserContext, public page: Page, readonly device: Device) {
    this.watch(page);
  }

  // ---- collectors -------------------------------------------------------------------------------------
  watch(page: Page) {
    const fail = (detail: string) => this.failures.push({ gate: 'errors', person: this.name, detail, at: Date.now() });
    const ledger = new WeakMap<object, Person['requests'][number]>();
    page.on('request', (r) => {
      let url: string;
      try {
        const u = new URL(r.url());
        if (!/^https?:$/.test(u.protocol)) return;
        url = `${u.origin}${u.pathname}`;
      } catch {
        return;
      }
      const entry = { method: r.method(), url, document: r.isNavigationRequest() && r.frame() === page.mainFrame(), t: Date.now() };
      ledger.set(r, entry);
      this.requests.push(entry);
      if (this.requests.length > 400) this.requests.splice(0, this.requests.length - 400);
    });
    page.on('requestfinished', async (r) => {
      const e = ledger.get(r);
      if (!e) return;
      e.end = Date.now();
      e.status = (await r.response().catch(() => null))?.status();
    });
    page.on('requestfailed', (r) => {
      const e = ledger.get(r);
      if (!e) return;
      e.end = Date.now();
      e.error = r.failure()?.errorText ?? 'failed';
    });
    page.on('console', (m) => {
      const type = m.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = m.text();
      // The browser's own "Failed to load resource" line duplicates the request gate below.
      if (/^Failed to load resource/.test(text)) return;
      if (this.room.faultAllowsNetworkErrors() && /WebSocket|net::|ERR_|Failed to fetch|NetworkError/i.test(text)) return;
      fail(`console.${type}: ${text.slice(0, 300)}`);
    });
    page.on('pageerror', (e) => fail(`uncaught: ${e.message.slice(0, 300)}`));
    page.on('requestfailed', (r) => {
      const err = r.failure()?.errorText ?? '';
      if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(err)) return; // navigation/unmount cancellations
      if (this.room.faultAllowsNetworkErrors()) return;
      if (!r.url().startsWith(ORIGIN) && !(STACK.images && r.url().startsWith(STACK.images))) return;
      fail(`request failed: ${r.method()} ${new URL(r.url()).pathname} ${err}`);
    });
    page.on('response', async (r) => {
      const url = r.url();
      if (!url.startsWith(ORIGIN)) return;
      const p = new URL(url).pathname;
      const status = r.status();
      if (r.request().method() === 'POST' && p.includes('/proposal/')) this.commandLog.push({ t: Date.now(), status, path: p });
      const json = (r.headers()['content-type'] ?? '').includes('json');
      const body = json ? await r.json().catch(() => null) : null;
      if (status >= 400 && !this.expectedStatus.some((re) => re.test(`${status} ${p}`)) && !(this.room.faultAllowsNetworkErrors() && status >= 500))
        fail(`HTTP ${status} ${r.request().method()} ${p}${body?.error ? ` (${body.error.code}: ${String(body.error.message).slice(0, 80)})` : ''}`);
      if (!json) return;
      const snapshot = body?.snapshot ?? body;
      if (snapshot?.shared) {
        const parsed = sharedSchema.safeParse(snapshot.shared);
        if (!parsed.success) fail(`schema: ${p} shared failed the app's sharedSchema: ${parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
        if (!this.latest || snapshot.shared.revision >= (this.latest.revision as number) || snapshot.shared.roomId !== this.latest.roomId) this.latest = snapshot.shared;
        if (snapshot.own) this.own = snapshot.own;
      }
    });
    page.on('websocket', (ws) => {
      ws.on('framereceived', (f) => {
        this.frames.received++;
        const payload = typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8');
        const parsed = parseFrame(payload);
        if (!parsed) {
          this.frames.invalid++;
          fail(`websocket frame rejected by the app's parseFrame: ${payload.slice(0, 200)}`);
          return;
        }
        if ((parsed.type === 'room.updated' || parsed.type === 'room.snapshot') && (!this.latest || parsed.snapshot.revision >= (this.latest.revision as number))) this.latest = parsed.snapshot as unknown as Shared;
      });
      ws.on('socketerror', (e) => { if (!this.room.faultAllowsNetworkErrors()) fail(`websocket error: ${e}`); });
    });
  }
  /** Statuses this journey provokes on purpose, e.g. /^404 .*\/invites\/preview/. */
  expectStatus(re: RegExp) { this.expectedStatus.push(re); }

  async harvest() {
    const rec = await this.page.evaluate(() => {
      const r = (window as unknown as { __yw?: Recording & { startedAt: number } }).__yw;
      if (!r) return null;
      return JSON.parse(JSON.stringify({ ...r, waiters: undefined, results: undefined, endedAt: performance.timeOrigin + performance.now() }));
    }).catch(() => null);
    if (rec) this.recordings.push(rec);
  }

  // ---- navigation -------------------------------------------------------------------------------------
  /** Navigate; by default wait until the startup word has dissolved (the page is usable and at rest). */
  async open(pathOrUrl = '/', { settle = true } = {}) {
    if (this.page.url() !== 'about:blank') await this.harvest();
    await this.page.goto(pathOrUrl.startsWith('http') ? pathOrUrl : `${ORIGIN}${pathOrUrl}`);
    if (settle) await this.settle();
  }
  async settle(timeout = 15000) {
    // A screen is up and the startup word is gone (goto resolves before React has rendered anything).
    await this.page.waitForFunction(() => {
      const sig = (window as unknown as { __yw?: { signature(): string } }).__yw?.signature() ?? '';
      return !sig.includes('yepwatch-boot') && /landing|home-rooms|mood-page|room-setup|waiting|voting|matches|proposal|tonight|join-screen|room-status/.test(sig);
    }, undefined, { timeout, polling: 50 }).catch(async () => this.journeyFailure(`no screen came up after the startup word (now: ${await this.signature()}; ${this.network()})`));
    // A person looks at the page before pressing: a press within its first 250 ms would make the page
    // itself count as a flash (between the startup and the next screen), which no person would see.
    await sleep(300);
  }
  async reload() {
    await this.harvest();
    await this.page.reload();
  }
  button(name: string | RegExp, exact = true) {
    return this.page.getByRole('button', { name, exact: typeof name === 'string' ? exact : undefined }).filter({ visible: true });
  }
  testId(id: string) { return this.page.getByTestId(id).filter({ visible: true }); }

  // ---- actions with timing ----------------------------------------------------------------------------
  private specs = new Map<string, Spec>();
  private async arm(spec: Spec) {
    const key = `w${++this.waiterSeq}`;
    this.specs.set(key, spec);
    await this.page.evaluate(([k, s]) => (window as unknown as { __yw: { arm(k: string, s: unknown): void } }).__yw.arm(k, s), [key, spec] as const).catch(() => undefined);
    return key;
  }
  /** Polls the page for a waiter's result; re-arms it when the document changed underneath (navigation). */
  private async result(key: string, timeout: number): Promise<{ at: number; armedAt: number } | null> {
    const end = Date.now() + timeout;
    for (;;) {
      const r = await this.page.evaluate((k) => {
        const yw = (window as unknown as { __yw?: { results: Record<string, unknown>; waiters: Record<string, unknown> } }).__yw;
        if (!yw) return 'missing';
        return yw.results[k] ?? (yw.waiters[k] ? null : 'missing');
      }, key).catch(() => 'missing' as const);
      if (r && r !== 'missing') return r as { at: number; armedAt: number };
      if (r === 'missing') await this.page.evaluate(([k, s]) => (window as unknown as { __yw?: { arm(k: string, s: unknown): void } }).__yw?.arm(k, s), [key, this.specs.get(key)] as const).catch(() => undefined);
      if (Date.now() > end) return null;
      await sleep(25);
    }
  }
  private async inputAfter(armedAt: number) {
    return this.page.evaluate((a) => (window as unknown as { __yw: Recording }).__yw.inputs.find((i) => i.t >= a - 1) ?? null, armedAt);
  }
  record(moment: string, ms: number, detail?: string) {
    this.samples.push({ moment, ms: Math.round(ms * 10) / 10, person: this.name, detail });
  }
  /**
   * The requests that explain a stall, for a failure message: still open after 1 s, failed or answered >= 400 in
   * the last `windowMs`, and the latest main-frame document. Origin + path only.
   */
  network(windowMs = 35000) {
    const now = Date.now();
    const recent = this.requests.filter((r) => r.t >= now - windowMs);
    const doc = [...recent].reverse().find((r) => r.document);
    const line = (r: Person['requests'][number]) => `${r.method} ${r.url} ${r.end === undefined ? `open ${((now - r.t) / 1000).toFixed(1)} s` : `${r.error ?? r.status ?? '?'} in ${r.end - r.t} ms`} (${((now - r.t) / 1000).toFixed(1)} s ago)`;
    const notable = recent.filter((r) => r !== doc && ((r.end === undefined && now - r.t > 1000) || r.error || (r.status ?? 0) >= 400));
    const parts = [...(doc ? [`document ${line(doc)}`] : []), ...notable.slice(-5).map(line)];
    return parts.length ? `network: ${parts.join('; ')}` : 'network: nothing open or failed';
  }
  journeyFailure(detail: string) {
    this.failures.push({ gate: 'journey', person: this.name, detail, at: Date.now() });
    throw new Error(`[${this.name}] ${detail}`);
  }

  /**
   * Press a control. With `expect`, waits (page-side, frame by frame) for that state and records the time
   * from the input event to its first frame as `moment`. Every press also records tap feedback.
   * Under the rapid-taps fault a non-repeatable press becomes a triple tap.
   */
  async tap(target: Locator, opts: { expect?: Spec; moment?: string; repeatable?: boolean; timeout?: number; key?: string; observers?: [Person, Spec, string][]; soft?: boolean } = {}) {
    await target.waitFor({ state: 'visible', timeout: opts.timeout ?? 10000 }).catch(() => this.journeyFailure(`control not visible: ${target}`));
    const keys = opts.expect ? await this.arm(opts.expect) : await this.arm({});
    const observerKeys = await Promise.all((opts.observers ?? []).map(async ([p, s]) => p.arm(s)));
    const rapid = this.room.fault === 'rapid' && !opts.repeatable;
    if (opts.key) await target.press(opts.key);
    else if (rapid) await target.click({ clickCount: 3, delay: 0 }).catch((e) => this.journeyFailure(`could not press ${target}: ${String(e).split('\n')[0]}`));
    else await target.click().catch((e) => this.journeyFailure(`could not press ${target}: ${String(e).split('\n')[0]}`));
    const armed = await this.page.evaluate((k) => (window as unknown as { __yw: { results: Record<string, { armedAt: number }> } }).__yw.results[k]?.armedAt ?? null, keys).catch(() => null);
    void armed;
    let elapsed: number | null = null;
    if (opts.expect) {
      const r = await this.result(keys, opts.timeout ?? 15000);
      if (!r && opts.soft) return undefined; // soft: the expected state never came; the caller decides
      if (!r) this.journeyFailure(`after pressing ${target}: expected ${JSON.stringify(opts.expect)} never showed (now: ${await this.signature()})`);
      const input = await this.inputAfter(r!.armedAt);
      if (input && opts.moment) {
        elapsed = r!.at - input.t;
        this.record(opts.moment, elapsed, String(target));
      }
      if (input?.feedbackAt) this.record('tapFeedbackMs', input.feedbackAt - input.t, String(target));
      for (const [i, [p, , moment]] of (opts.observers ?? []).entries()) {
        const o = await p.result(observerKeys[i], opts.timeout ?? 15000);
        if (!o && opts.soft) continue;
        if (!o) p.journeyFailure(`after ${this.name} pressed ${target}: ${moment} never showed for ${p.name} (now: ${await p.signature()})`);
        if (input) p.record(moment, o!.at - input.t, `${this.name}: ${target}`);
      }
    } else {
      await sleep(60);
      const input = await this.page.evaluate(() => (window as unknown as { __yw: Recording }).__yw.inputs.at(-1) ?? null).catch(() => null);
      if (input?.feedbackAt) this.record('tapFeedbackMs', input.feedbackAt - input.t, String(target));
    }
    return elapsed;
  }

  /** A full-page round trip (GoodWatch sign-in): press, leave the app, come back to it and settle. */
  async roundTrip(target: Locator) {
    await target.waitFor({ state: 'visible' }).catch(() => this.journeyFailure(`control not visible: ${target}`));
    const origin = new URL(this.page.url()).origin;
    await this.harvest();
    await Promise.all([
      this.page.waitForURL((u) => u.origin !== origin || u.pathname.includes('/callback'), { timeout: 15000 }),
      target.click(),
    ]).catch((e) => this.journeyFailure(`pressing ${target} did not leave for GoodWatch: ${String(e).split('\n')[0]}`));
    await this.page.waitForURL((u) => u.origin === origin && !u.pathname.includes('/callback'), { timeout: 20000, waitUntil: 'load' })
      .catch(() => this.journeyFailure(`did not come back from GoodWatch (at ${this.page.url()})`));
    await this.settle();
  }
  /** Browser Back, recorded as an input so the screen it closes isn't taken for a flash. */
  async back() {
    await this.page.evaluate(() => (window as unknown as { __yw: Recording }).__yw.inputs.push({ t: performance.timeOrigin + performance.now(), type: 'history-back', target: 'browser Back', feedbackAt: performance.timeOrigin + performance.now() }));
    await this.page.goBack();
  }

  async fill(target: Locator, text: string) {
    await target.waitFor({ state: 'visible' }).catch(() => this.journeyFailure(`field not visible: ${target}`));
    await target.fill(text);
  }

  /** Wait until the page shows `spec` (frame-exact, page-side). */
  async see(spec: Spec, timeout = 15000, what = '') {
    const key = await this.arm(spec);
    const r = await this.result(key, timeout);
    if (!r) this.journeyFailure(`${what || 'expected state'} ${JSON.stringify(spec)} not shown within ${timeout} ms (now: ${await this.signature()})`);
    return r!.at;
  }
  async signature() {
    return this.page.evaluate(() => (window as unknown as { __yw: { signature(): string } }).__yw.signature()).catch(() => '(no page)');
  }
  /** First time (epoch ms) the recorded screen state contained all `markers`, since document start. */
  async firstShown(markers: string[], timeout = 15000) {
    await this.see({ visible: markers }, timeout);
    return this.page.evaluate((m) => {
      const r = (window as unknown as { __yw: Recording }).__yw;
      const s = r.states.find((x) => m.every((k) => x.sig.split(' ').includes(k)));
      return { at: s?.t ?? null, origin: performance.timeOrigin };
    }, markers);
  }

  async audit(label: string) {
    if (process.env.E2E_AXE === '0') return;
    await sleep(350); // let entrance animations settle: audit the resting screen
    const pageNow = () => this.page.evaluate(() => performance.timeOrigin + performance.now()).catch(() => null);
    const from = await pageNow();
    const failures = await audit(this.page, this.name, label).catch((e) => [{ gate: 'a11y' as const, person: this.name, detail: `axe could not run on ${label}: ${String(e).slice(0, 200)}` }]);
    const to = await pageNow();
    // axe runs in the page's main thread: the frames it holds up are the harness's, not the app's.
    if (from !== null && to !== null) this.harnessBusy.push([from, to]);
    this.failures.push(...failures);
  }

  async cdpSession() {
    this.cdp ??= await this.context.newCDPSession(this.page);
    return this.cdp;
  }
  me() {
    return this.latest?.participants.find((p) => p.participantId === this.own?.participantId);
  }
}

let restartCount = 0;
export class Room {
  readonly people: Person[] = [];
  private points = 0;
  restartLog: { at: number; back: number; service: string }[] = [];
  private offlineWindows: [number, number][] = [];
  constructor(readonly browser: Browser, readonly info: TestInfo, readonly fault: Fault) {}

  faultAllowsNetworkErrors() {
    return this.fault === 'restart' || this.fault === 'slow' || this.fault === 'nows' || this.fault === 'hidden';
  }

  /** `trace: false` keeps this person out of Playwright tracing and E2E_VIDEO: a trace stores typed values, request
   * bodies and cookies, so a person who signs in with real credentials (the production smoke member) is never traced
   * or recorded. */
  async person(name: string, opts: { device?: Device; member?: string; locale?: string; context?: BrowserContext; trace?: boolean } = {}) {
    const device = opts.device ?? 'phone';
    const context = opts.context ?? await this.browser.newContext({
      ...DEVICES[device],
      locale: opts.locale ?? 'de-DE',
      timezoneId: 'Europe/Berlin',
      // Never recorded when untraced: the video would show the sign-in pages and account of real credentials.
      recordVideo: process.env.E2E_VIDEO === '1' && opts.trace !== false ? { dir: this.info.outputPath(`video-${name}`), size: DEVICES[device].viewport } : undefined,
    });
    if (!opts.context) {
      await context.addInitScript({ path: RECORDER });
      if (process.env.E2E_TRACE !== '0' && opts.trace !== false) await context.tracing.start({ screenshots: true, snapshots: true, title: `${this.info.title} — ${name}` }).catch(() => {});
      // Signed in to (local) GoodWatch: its authorize step comes straight back, as for a returning member.
      if (opts.member) await context.addCookies([{ name: 'gw_e2e_member', value: encodeURIComponent(opts.member), domain: '127.0.0.1', path: '/api/auth/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
      // Hidden-tab fault: a controllable page clock so "minutes away" takes seconds (time still flows).
      if (this.fault === 'hidden') await context.clock.install();
      if (this.fault === 'nows') {
        // A browser/network that never opens a WebSocket: the realtime handshake is refused.
        await context.route(/\/api\/yepwatch\/v1\/proposal\/realtime/, (r) => r.abort('connectionrefused'));
      }
    }
    const page = await context.newPage();
    const p = new Person(this, name, context, page, device);
    if (opts.trace === false) p.traced = false;
    if (this.fault === 'nows') {
      const cdp = await p.cdpSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.setBlockedURLs', { urls: ['*/api/yepwatch/v1/proposal/realtime*'] });
    }
    if (this.fault === 'slow') {
      const cdp = await p.cdpSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, ...B.network.slow });
    }
    if (process.env.E2E_TARGET === 'production') {
      const cdp = await p.cdpSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, ...B.network.production });
    }
    this.people.push(p);
    return p;
  }

  /**
   * A fault hook between journey steps. `label` says where the journey is: 'room' (a room exists),
   * 'voting' (mid-vote), 'decide' (matches/proposal), or anything else. Each fault acts once, at its spot.
   */
  async point(label: string, actors: Person[] = this.people) {
    this.points++;
    const n = this.points;
    const primary = actors[0];
    if (!primary) return;
    switch (this.fault) {
      case 'restart': {
        if (label !== 'voting' && !(n === 1 && label === 'room')) return;
        // Alternates across the whole (serial) restart phase: API, gateway, API, …
        const service = restartCount++ % 2 ? 'gateway' : 'api';
        const at = Date.now();
        // Not awaited: the journey keeps going while the server is down (votes queue meanwhile).
        const done = fetch(`${CONTROL}/restart/${service}?downMs=1500`, { method: 'POST' }).then(() => this.restartLog.push({ at, back: Date.now(), service }));
        this.pending.push(done);
        await sleep(200);
        return;
      }
      case 'slow': {
        if (label !== 'voting' && !(n === 1 && label === 'room')) return;
        const start = Date.now();
        // Playwright's own offline switch (navigator.onLine, offline/online events, requests fail). Toggling
        // `offline` through our CDP session instead crashed Chromium's network service when a request went
        // out the moment it came back (FATAL dangling raw_ptr), wiping the context's cookie jar: the next
        // room request then carried no room cookie and got a 401 no real browser would see.
        const contexts = [...new Set(actors.map((p) => p.context))];
        for (const c of contexts) await c.setOffline(true);
        await sleep(4000);
        for (const c of contexts) await c.setOffline(false);
        for (const p of actors) await (await p.cdpSession()).send('Network.emulateNetworkConditions', { offline: false, ...B.network.slow });
        this.offlineWindows.push([start, Date.now()]);
        return;
      }
      case 'hidden': {
        if (this.points > 1) return;
        // Tab hidden "for minutes": visibilitychange + lifecycle freeze, and the page clock jumps 5 minutes.
        for (const p of actors) {
          await p.page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('pagehide'));
          });
          const cdp = await p.cdpSession();
          await cdp.send('Page.enable').catch(() => {});
          await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => {});
        }
        await sleep(3000);
        for (const p of actors) {
          const cdp = await p.cdpSession();
          await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
          await p.context.clock.fastForward('05:00').catch(() => {});
          await p.page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
            window.dispatchEvent(new Event('pageshow'));
            document.dispatchEvent(new Event('visibilitychange'));
          });
        }
        return;
      }
      case 'twodevice': {
        // Same person, second tab (shares the browser's room cookie), then the first device reloads mid-vote.
        if (!this.twin && (label === 'room' || label === 'voting')) {
          const main = (await primary.signature()).split(' ').find((m) => ['voting', 'room-setup', 'waiting', 'matches', 'tonight', 'proposal'].includes(m));
          const twin = await this.person(`${primary.name} (2nd device)`, { context: primary.context, device: primary.device });
          await twin.open(primary.page.url(), { settle: false });
          await twin.see({ visible: [main ?? 'room-setup'] }, 15000, `the same person's second device shows the room (${main})`);
          this.twin = twin;
          return;
        }
        if (this.twin && label === 'voting' && !this.reloaded) {
          this.reloaded = true;
          const sig = await primary.signature();
          await primary.reload();
          const main = sig.split(' ').find((m) => ['voting', 'room-setup', 'waiting', 'matches', 'tonight', 'proposal'].includes(m));
          if (main) await primary.see({ visible: [main] }, 15000, `after reload the same screen (${main})`);
        }
        return;
      }
      default:
        return;
    }
  }
  /** An outage a journey makes itself (e.g. a request held past the app's wait), [start, end] in epoch ms. */
  noteOutage(start: number, end: number) { this.offlineWindows.push([start, end]); }
  /** Stack-side outages so far, [start, end] in epoch ms: server restarts and offline spells. */
  outages(): [number, number][] {
    return [...this.restartLog.map((r) => [r.at, r.back] as [number, number]), ...this.offlineWindows];
  }
  twin: Person | null = null;
  private reloaded = false;
  readonly pending: Promise<unknown>[] = [];

  async finish() {
    await Promise.allSettled(this.pending);
    const failures: GateFailure[] = [];
    const samples: Sample[] = [];
    for (const p of this.people) {
      if (!p.page.isClosed()) await p.harvest();
      for (const rec of p.recordings) {
        failures.push(...flashes(rec, p.name), ...layoutShifts(rec, p.name), ...blockingWords(rec, p.name), ...connectionWords(rec, p.name, this.outages()), ...deadButtons(rec, p.name));
        if (this.fault !== 'hidden' && this.fault !== 'slow') failures.push(...frameGaps(rec, p.name, rec.inputs.map((i) => [i.t, i.t + 1200]), p.harnessBusy));
      }
      failures.push(...p.failures.filter((f) => !failures.includes(f)));
      samples.push(...p.samples);
    }
    // Restart: queued actions must land within budget after the server returns.
    for (const r of this.restartLog) {
      const landed = this.people.flatMap((p) => p.commandLog).filter((c) => c.t >= r.back && c.status < 300 && /\/commands$/.test(c.path)).sort((a, b) => a.t - b.t)[0];
      if (landed) samples.push({ moment: 'restartQueuedLandMs', ms: landed.t - r.back, person: '(room)', detail: `${r.service} restart` });
    }
    const dedup = new Map<string, GateFailure>();
    for (const f of failures) dedup.set(`${f.gate}|${f.person}|${f.detail}`, f);
    const unique = [...dedup.values()];
    await this.info.attach('gates', { body: JSON.stringify(unique, null, 1), contentType: 'application/json' });
    await this.info.attach('timings', { body: JSON.stringify(samples), contentType: 'application/json' });
    if (unique.length || this.info.status !== this.info.expectedStatus) {
      for (const p of this.people) {
        if (p.page.isClosed()) continue;
        const secret = !p.traced && await p.page.locator('input[type=password]').count().catch(() => 1) > 0;
        const aria = secret ? '(withheld: a password form is on screen)' : await p.page.locator('body').ariaSnapshot({ timeout: 3000 }).catch(() => '(unavailable)');
        await this.info.attach(`screen ${p.name}`, { body: `[${await p.signature()}] ${p.page.url()}\n${aria}`, contentType: 'text/plain' });
        await this.info.attach(`screenshot ${p.name}`, { body: await p.page.screenshot().catch(() => Buffer.from('')), contentType: 'image/png' });
      }
    }
    const traced = new Set<BrowserContext>();
    for (const p of this.people) {
      if (traced.has(p.context)) continue;
      traced.add(p.context);
      const keep = unique.length > 0 || this.info.status !== this.info.expectedStatus || process.env.E2E_TRACE === 'keep';
      if (process.env.E2E_TRACE !== '0') {
        const file = this.info.outputPath(`trace-${p.name.replace(/\W+/g, '_')}.zip`);
        await p.context.tracing.stop(keep ? { path: file } : undefined).catch(() => {});
        if (keep && fs.existsSync(file)) await this.info.attach(`trace ${p.name}`, { path: file, contentType: 'application/zip' });
      }
      await p.context.close().catch(() => {});
    }
    if (unique.length) {
      const lines = unique.slice(0, 12).map((f) => `  [${f.gate}] ${f.person}: ${f.detail}${f.measured !== undefined ? ` (measured ${f.measured}, budget ${f.budget})` : ''}`);
      throw new Error(`${unique.length} gate failure(s):\n${lines.join('\n')}${unique.length > 12 ? '\n  …' : ''}`);
    }
  }
}

export const test = base.extend<{ room: Room }, { fault: Fault }>({
  fault: ['none', { option: true, scope: 'worker' }],
  room: async ({ browser, fault }, use, info) => {
    const room = new Room(browser, info, fault);
    await use(room);
    await room.finish();
  },
});
export { expect };

/** Polls a value computed in Node (e.g. from snapshots) until it equals `want`. */
export async function eventually<T>(read: () => T | Promise<T>, want: (v: T) => boolean, what: string, person: Person, timeout = 10000) {
  const end = Date.now() + timeout;
  let v = await read();
  while (!want(v)) {
    if (Date.now() > end) person.journeyFailure(`${what}: still ${JSON.stringify(v)?.slice(0, 200)} after ${timeout} ms`);
    await sleep(50);
    v = await read();
  }
  return v;
}

export async function control(pathname: string, body?: unknown) {
  const r = await fetch(`${CONTROL}${pathname}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
export async function issuer(pathname: string, body?: unknown) {
  const r = await fetch(`${ISSUER}${pathname}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
