// The recorder (lib/recorder.page.js) on synthetic pages: what the gates catch from its recordings. No stack, no app.
// Each change is made either in a task or in a rAF callback that runs after the recorder's (an app animation loop),
// and the page notes its own frame times, so the tests also pin when a state is stamped: at the recorder's first
// animation frame after the change.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockingWords, connectionWords, deadButtons, flashes, frameGaps, layoutShifts, type Recording } from '../lib/gates';

const RECORDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'recorder.page.js');
const ORIGIN = 'http://recorder.test';

const PAGE = `<!doctype html><html><head><meta name="viewport" content="width=390"><style>
  body { margin: 0; font: 16px sans-serif; } .box { width: 200px; height: 80px; } .off { transform: translateX(-2000px); }
  .none { display: none; } .clear { opacity: 0; }
</style></head><body><div id="root"><div data-testid="waiting" class="box">Waiting</div></div><script>
  // Frame times as the page's own rAF callbacks see them (the recorder's callback runs first in each frame).
  window.frameTimes = [];
  const tick = (ts) => { frameTimes.push(performance.timeOrigin + ts); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(frameTimes.length)));
  // Runs fn in this frame's rAF phase ('raf', after the recorder's callback) or in a task after it ('task').
  // Resolves with the index in frameTimes of the first frame whose recorder callback runs after the change.
  window.change = async (mode, fn) => {
    const k = await nextFrame();
    if (mode === 'raf') { fn(); return k; }
    await new Promise((r) => setTimeout(r, 0));
    fn();
    return frameTimes.length;
  };
  window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
</script></body></html>`;

async function open(page: Page) {
  await page.context().addInitScript({ path: RECORDER });
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({ body: PAGE, contentType: 'text/html' }));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (window as unknown as { __yw?: { states: unknown[] } }).__yw?.states.length);
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(300));
}
async function harvest(page: Page): Promise<Recording> {
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(400));
  return page.evaluate(() => {
    const r = (window as unknown as { __yw: Recording }).__yw;
    return JSON.parse(JSON.stringify({ ...r, waiters: undefined, results: undefined, endedAt: performance.timeOrigin + performance.now() }));
  });
}
const frameTime = (page: Page, i: number) => page.evaluate((k) => (window as unknown as { frameTimes: number[] }).frameTimes[k], i);

// eslint-disable-next-line no-empty-pattern -- Playwright reads fixtures from the destructuring pattern
test.beforeEach(({}, info) => test.skip(info.project.name !== 'none', 'no stack, no fault: runs once'));

// One frame of "finding-more" between two "waiting" frames, made visible five ways.
const ONE_FRAME: Record<string, { setup: string; show: string; hide: string }> = {
  inserted: { setup: '', show: `root.append(el('<div data-testid="finding-more" class="box">Finding more</div>'))`, hide: `document.querySelector('[data-testid=finding-more]').remove()` },
  opacity: { setup: `root.append(el('<div data-testid="finding-more" class="box clear">Finding more</div>'))`, show: `document.querySelector('[data-testid=finding-more]').classList.remove('clear')`, hide: `document.querySelector('[data-testid=finding-more]').classList.add('clear')` },
  'ancestor opacity': { setup: `root.append(el('<div id="wrap" style="opacity:0"><div data-testid="finding-more" class="box">Finding more</div></div>'))`, show: `wrap.style.opacity = '1'`, hide: `wrap.style.opacity = '0'` },
  'ancestor display': { setup: `root.append(el('<div id="wrap" class="none"><div data-testid="finding-more" class="box">Finding more</div></div>'))`, show: `wrap.classList.remove('none')`, hide: `wrap.classList.add('none')` },
  'moved on screen': { setup: `root.append(el('<div data-testid="finding-more" class="box off">Finding more</div>'))`, show: `document.querySelector('[data-testid=finding-more]').classList.remove('off')`, hide: `document.querySelector('[data-testid=finding-more]').classList.add('off')` },
};

for (const mode of ['raf', 'task'] as const) {
  for (const [how, s] of Object.entries(ONE_FRAME)) {
    test(`a one-frame flash (${how}, changed in ${mode === 'raf' ? 'an app rAF callback' : 'a task'}) fails the flash gate, stamped at the next recorder frame`, async ({ page }) => {
      await open(page);
      if (s.setup) await page.evaluate(`(() => { ${s.setup} })()`);
      await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(300));
      // Both changes in one evaluation, so the marker is up for exactly one frame whatever the host's pace.
      const [shownAt, hiddenAt] = await page.evaluate(`(async () => [await change('${mode}', () => { ${s.show} }), await change('${mode}', () => { ${s.hide} })])()`) as [number, number];
      expect(hiddenAt).toBe(shownAt + 1);
      const rec = await harvest(page);
      const f = flashes(rec, 'p');
      expect(f.map((x) => x.detail)).toEqual([expect.stringContaining('"finding-more" showed for')]);
      const on = rec.states.find((x) => x.sig.includes('finding-more'))!;
      const off = rec.states[rec.states.indexOf(on) + 1];
      expect(on.t).toBe(await frameTime(page, shownAt));
      expect(off.t).toBe(await frameTime(page, hiddenAt));
      expect(off.sig).toBe('waiting');
    });
  }
}

test('a state that stays 20 frames is no flash', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('raf', () => root.append(el('<div data-testid="finding-more" class="box">Finding more</div>')))`);
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(350));
  await page.evaluate(`change('task', () => document.querySelector('[data-testid=finding-more]').remove())`);
  const rec = await harvest(page);
  expect(flashes(rec, 'p')).toEqual([]);
  expect(rec.states.map((x) => x.sig)).toEqual(['waiting', 'waiting finding-more', 'waiting']);
});

test('a block pushed down without input fails the layout shift gate', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('task', () => root.prepend(el('<div style="height:120px">Banner</div>')))`);
  const rec = await harvest(page);
  expect(layoutShifts(rec, 'p').map((x) => x.gate)).toEqual(['layout-shift']);
});

// Connection and blocking words: what the words gates make of each line.
const WORDS: { name: string; html: string; showMs: number; expect: RegExp[] }[] = [
  { name: 'a reconnecting line without an outage', html: '<p>Reconnecting…</p>', showMs: 1500, expect: [/"Reconnecting…" visible for \d+ ms without an outage/] },
  { name: 'a brief connecting line', html: '<p>Connecting…</p>', showMs: 300, expect: [] },
  { name: 'a reconnecting line for one frame', html: '<p>Reconnecting…</p>', showMs: 0, expect: [/"Reconnecting…" visible for \d+ ms without an outage/] },
  { name: 'two connection lines', html: '<div><p>Reconnecting…</p><p>Not connected</p></div>', showMs: 600, expect: [/2 connection lines at once/, /without an outage/] },
  { name: 'a countdown', html: '<p>Not connected. Retry in 3 s</p>', showMs: 600, expect: [/countdown\/retry words "Not connected. Retry in 3 s"/, /without an outage/] },
  { name: 'a capitalized line', html: '<p style="text-transform:capitalize">reconnecting…</p>', showMs: 600, expect: [/"Reconnecting…" visible for \d+ ms without an outage/] },
  { name: 'a line with runs of whitespace', html: '<p>Not   connected.\n   Try again in 3</p>', showMs: 600, expect: [/countdown\/retry words "Not connected. Try again in 3"/, /without an outage/] },
  { name: 'a line with a hidden part', html: '<p>Not<span hidden>x</span> connected</p>', showMs: 600, expect: [/"Not connected" visible for \d+ ms without an outage/] },
  { name: 'a hidden line', html: '<p style="display:none">Reconnecting…</p>', showMs: 600, expect: [] },
  { name: 'a blocking line', html: '<p>Couldn’t reach YepWatch</p>', showMs: 600, expect: [/"Couldn’t reach YepWatch" visible for \d+ ms/] },
];
for (const w of WORDS) {
  test(`words: ${w.name}`, async ({ page }) => {
    await open(page);
    await page.evaluate(`change('task', () => root.append(el(${JSON.stringify(`<div id="words">${w.html}</div>`)})))`);
    if (w.showMs) await page.evaluate((ms) => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(ms), w.showMs);
    await page.evaluate(`change('task', () => words.remove())`);
    const rec = await harvest(page);
    const found = [...connectionWords(rec, 'p', []), ...blockingWords(rec, 'p')].map((x) => x.detail);
    expect(found.length).toBe(w.expect.length);
    for (const re of w.expect) expect(found.some((d) => re.test(d)), `${re} in ${JSON.stringify(found)}`).toBe(true);
  });
}

// The press starts 40 ms of main-thread work in its next animation frame, as the app's press does (its handler
// renders). A block inside the input handler alone, on a page with nothing else to draw, doesn't show in rAF times:
// Chrome runs the late frame with its planned time and a catch-up frame right after. The journeys' synthetic 40 ms
// press task (both kinds) fails the frames gate on every press in the app.
test('40 ms of work in the frame after a press fails the frames gate; the press gets its feedback frame', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'Yep';
    b.style.cssText = 'width:120px;height:60px';
    b.addEventListener('pointerdown', () => {
      b.textContent = 'Yep!';
      requestAnimationFrame(() => { const end = performance.now() + 40; while (performance.now() < end); });
    });
    document.getElementById('root')!.append(b);
  });
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(300));
  await page.getByRole('button', { name: 'Yep' }).click();
  const rec = await harvest(page);
  const gaps = frameGaps(rec, 'p', rec.inputs.map((i) => [i.t, i.t + 1200]));
  expect(gaps.map((x) => x.gate)).toEqual(['frames']);
  expect(Number(gaps[0].measured)).toBeGreaterThan(30); // at least one whole frame dropped
  expect(rec.inputs.find((i) => i.type === 'pointerdown')?.feedbackAt).toBeGreaterThan(0);
  expect(deadButtons(rec, 'p')).toEqual([]);
});

test('a press that changes nothing is a dead button', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { const b = document.createElement('button'); b.textContent = 'Nope'; b.style.cssText = 'width:120px;height:60px'; document.getElementById('root')!.append(b); });
  await page.getByRole('button', { name: 'Nope' }).click();
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(1100));
  const rec = await harvest(page);
  expect(deadButtons(rec, 'p').map((x) => x.gate)).toEqual(['dead-button']);
});

for (const mode of ['raf', 'task'] as const) {
  test(`an armed waiter resolves at the frame its state is stamped (changed in ${mode === 'raf' ? 'an app rAF callback' : 'a task'})`, async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as unknown as { __yw: { arm(k: string, s: unknown): void } }).__yw.arm('m', { visible: ['matches'] }));
    await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(100));
    const at = await page.evaluate(`change('${mode}', () => root.append(el('<div data-testid="matches" class="box">Matches</div>')))`) as number;
    await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(100));
    const result = await page.evaluate(() => (window as unknown as { __yw: { results: Record<string, { at: number }> } }).__yw.results.m);
    expect(result.at).toBe(await frameTime(page, at));
    const rec = await harvest(page);
    expect(rec.states.find((x) => x.sig.includes('matches'))?.t).toBe(result.at);
  });
}

test('the room note is recorded as shown', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('task', () => root.append(el('<p data-testid="room-note">Alex   is   choosing</p>')))`);
  const rec = await harvest(page);
  expect(rec.notes.map((n) => n.text)).toEqual(['Alex is choosing']);
});

test('of two room notes the first in document order is recorded, also when one is put before the other', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('task', () => root.append(el('<p data-testid="room-note">First</p>')))`);
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(100));
  await page.evaluate(`change('task', () => root.prepend(el('<p data-testid="room-note">Second, put first</p>')))`);
  const rec = await harvest(page);
  expect(rec.notes.map((n) => n.text)).toEqual(['First', 'Second, put first']);
});

test('a marker moved into a shadow root no longer counts, as for a document query', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('task', () => root.append(el('<div data-testid="finding-more" class="box">Finding more</div>')))`);
  await page.evaluate(() => (window as unknown as { sleep(ms: number): Promise<void> }).sleep(300));
  await page.evaluate(`change('task', () => { const host = el('<div id="host"></div>'); root.append(host); host.attachShadow({ mode: 'open' }).append(document.querySelector('[data-testid=finding-more]')); })`);
  const rec = await harvest(page);
  expect(rec.states.map((x) => x.sig)).toEqual(['waiting', 'waiting finding-more', 'waiting']);
});

// Replacing the root is a change of the document, outside the watched root: neither this recorder nor the one before
// it notices it alone. The harness's own signature() (settle, failure messages) reads the new tree and from then on
// the recorder watches it.
test('a replaced root element is read by signature() and watched from then on', async ({ page }) => {
  await open(page);
  await page.evaluate(`change('task', () => { const html = document.createElement('html'); html.innerHTML = '<body><div data-testid="matches" class="box">Matches</div></body>'; document.replaceChild(html, document.documentElement); })`);
  expect(await page.evaluate(() => (window as unknown as { __yw: { signature(): string } }).__yw.signature())).toBe('matches');
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  await page.evaluate(() => { const b = document.createElement('div'); b.setAttribute('data-testid', 'finding-more'); b.className = 'box'; b.style.cssText = 'width:200px;height:80px'; b.textContent = 'Finding more'; document.body.append(b); });
  const rec = await harvest(page);
  expect(rec.states.map((x) => x.sig)).toEqual(['waiting', 'matches', 'matches finding-more']);
});
