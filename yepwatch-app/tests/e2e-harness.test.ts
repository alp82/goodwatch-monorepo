import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionWords, frameGaps, type Recording } from '../e2e/lib/gates';
import { duringRunnerOutage, explainedByRunner, outagesOf, ReachabilityWatch, unreachable, type Tick } from '../e2e/lib/reachability';
import { serverTimingLine } from '../e2e/lib/server-timing';
import { Blackhole, nextRetry, RETRANSMIT_FIRST_MS, SYN_FIRST_MS } from '../e2e/lib/blackhole';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dropSession, loadSession, originPart, saveSession } from '../e2e/lib/smoke-session';
import { historyLine, readHistory, timingStats } from '../e2e/lib/timing-window.mjs';

const recording = (over: Partial<Recording>): Recording => ({
  startedAt: 0, endedAt: 10_000, states: [], notes: [], words: [], inputs: [], shifts: [], loafs: [],
  frames: { count: 0, over20: [], max: 0 }, ...over,
});

test('the frames gate names the frame that failed, not the page load', () => {
  const rec = recording({
    inputs: [{ t: 2000, type: 'pointerdown', target: '[frame-body] div "Join"', feedbackAt: 2010 }],
    // The page load (outside every interaction window) and the frame that failed, 300 ms after Join.
    frames: { count: 100, over20: [[100, 102], [2333, 33]], max: 102 },
    loafs: [
      { t: 0, duration: 102, blocking: 50, scripts: [] },
      { t: 2290, duration: 50, blocking: 0, scripts: ['event-listener:MessagePort.onmessage 44ms entry.js:q'] },
    ],
  });
  const [failure] = frameGaps(rec, 'Friend', rec.inputs.map((i) => [i.t, i.t + 1200]));
  assert.equal(failure.measured, 33);
  assert.match(failure.detail, /worst 33 ms, 300 ms after pointerdown on \[frame-body\] div "Join"/);
  assert.match(failure.detail, /animation frame 50 ms .*MessagePort\.onmessage 44ms/);
  assert.doesNotMatch(failure.detail, /102/);
});

test('a failed frame without a long animation frame says it has no script attribution', () => {
  const rec = recording({
    inputs: [{ t: 2000, type: 'pointerdown', target: 'Yep', feedbackAt: 2010 }],
    frames: { count: 100, over20: [[2050, 33]], max: 33 },
    loafs: [{ t: 0, duration: 102, blocking: 50, scripts: ['classic-script: entry.js 90ms'] }],
  });
  const [failure] = frameGaps(rec, 'Friend', [[2000, 3200]]);
  assert.match(failure.detail, /no long animation frame .* no script attribution/);
});

test('the server timing log keeps the command the server applied, not its replay', () => {
  const commands = '/api/yepwatch/v1/proposal/rooms/r1/commands';
  const start = JSON.stringify({ commandId: 'c1', sequence: 3, command: { type: 'start', expectedRosterVersion: 1, expectedContextVersion: 1 } });
  const applied = serverTimingLine(commands, start, 200, { receipt: { commandId: 'c1', replayed: false } }, 'write;dur=30, total;dur=90', 5);
  assert.deepEqual(JSON.parse(applied!), { t: 5, kind: 'start', status: 200, commandId: 'c1', serverTiming: 'write;dur=30, total;dur=90' });
  assert.equal(serverTimingLine(commands, start, 200, { receipt: { commandId: 'c1', replayed: true } }, 'total;dur=4'), null);
  // A refusal has no receipt: it is still logged, with its status.
  assert.equal(JSON.parse(serverTimingLine(commands, start, 409, { error: { code: 'conflict' } }, 'total;dur=4', 6)!).status, 409);
  assert.equal(JSON.parse(serverTimingLine('/api/yepwatch/v1/proposal/rooms', '{}', 200, {}, 'total;dur=9', 7)!).kind, 'create');
  assert.equal(serverTimingLine('/api/yepwatch/v1/proposal/account', '{}', 200, {}, 'total;dur=9'), null);
});

test('a moment one run samples 20 times takes its p95 from that run alone', () => {
  const votes = Array.from({ length: 20 }, (_, i) => 100 + i);
  const stats = timingStats({ voteToPeerMs: votes }, [{ samples: { voteToPeerMs: [9999] } }], true);
  assert.deepEqual({ ...stats.voteToPeerMs }, { samples: 20, p50: 109, p95: 118, max: 119, runs: 1, own: 20 });
});

test('a moment sampled once a run borrows from the newest earlier runs, up to 20 samples', () => {
  const history = Array.from({ length: 25 }, (_, i) => ({ samples: { createRoomMs: [i === 24 ? 900 : 300] } }));
  const stats = timingStats({ createRoomMs: [400] }, history, true);
  assert.equal(stats.createRoomMs.samples, 20);
  assert.equal(stats.createRoomMs.runs, 20);
  // One slow run in 20 is the max, not the p95.
  assert.equal(stats.createRoomMs.max, 900);
  assert.equal(stats.createRoomMs.p95, 400);
  // Without a window (local tiers) the one sample is all there is.
  assert.equal(timingStats({ createRoomMs: [400] }, history, false).createRoomMs.samples, 1);
});

test('an earlier run fills only the samples still missing, its newest first', () => {
  const own = Array.from({ length: 19 }, () => 100);
  const stats = timingStats({ voteToPeerMs: own }, [{ samples: { voteToPeerMs: [1000, 1000, ...Array.from({ length: 18 }, () => 100)] } }], true);
  assert.equal(stats.voteToPeerMs.samples, 20);
  assert.equal(stats.voteToPeerMs.p95, 100);
});

test('the history keeps numbers per origin only', () => {
  const line = historyLine('https://yepwatch.com', { createRoomMs: [612.34], voteToPeerMs: [] }, 7);
  assert.deepEqual(JSON.parse(line), { t: 7, origin: 'https://yepwatch.com', samples: { createRoomMs: [612.3] } });
  const text = `${line}\nnot json\n${historyLine('http://127.0.0.1:18480', { createRoomMs: [30] })}\n`;
  assert.equal(readHistory(text, 'https://yepwatch.com').length, 1);
});

// The production smoke of 2026-11-14 05:39 UTC: from 05:39:11.7 to 05:39:23.7 nothing from the runner reached abio
// (abio's proxy served everyone else). The ticks below are what the reachability watch sees in such a drop: a pair of
// probes every 250 ms, those without an answer known only at their 1 s timeout, then both answering again.
const T0 = Date.UTC(2026, 10, 14, 5, 39, 0);
const ticks = (from: number, to: number, target: Tick['target'], reference: boolean): Tick[] =>
  Array.from({ length: Math.ceil((to - from) / 250) }, (_, i) => {
    const t = T0 + from + i * 250;
    return { t, target, done: t + (target === 'none' ? 1000 : 40), reference };
  });

/** The attributed runs, without the stretch each belongs to. */
const parts = (seen: Tick[]) => unreachable(seen).map(({ within: _, ...r }) => r);

test("the runner's own network drop is one runner outage, not YepWatch's", () => {
  const seen = [...ticks(0, 11_700, 'answered', true), ...ticks(11_700, 23_700, 'none', false), ...ticks(23_700, 30_000, 'answered', true)];
  // It ends when YepWatch's answer came back, not when it was asked for; it starts after the last tick answered (the
  // drop came somewhere between that tick and the first that failed).
  assert.deepEqual(parts(seen), [{ start: T0 + 11_500, end: T0 + 23_740, kind: 'runner' }]);
});

test('YepWatch not answering while the reference does, or answering 5xx, is a failure of its own', () => {
  const silent = [...ticks(0, 5000, 'answered', true), ...ticks(5000, 8000, 'none', true), ...ticks(8000, 9000, 'answered', true)];
  assert.deepEqual(parts(silent), [{ start: T0 + 5000, end: T0 + 8040, kind: 'yepwatch', why: 'no answer' }]);
  // A 5xx is YepWatch's even while the reference doesn't answer: it can't hide as the runner's outage.
  const errors = [...ticks(0, 5000, 'answered', true), ...ticks(5000, 8000, 'error', false), ...ticks(8000, 9000, 'answered', true)];
  assert.deepEqual(parts(errors), [{ start: T0 + 5000, end: T0 + 8040, kind: 'yepwatch', why: 'HTTP 5xx' }]);
});

test('5xx and silence mixed are one YepWatch failure, judged as a whole', () => {
  // A 503, then a timeout, then a 503, every 250 ms for 3 s, the reference answering throughout.
  const mixed = [...ticks(0, 1000, 'answered', true), ...Array.from({ length: 12 }, (_, i): Tick => {
    const t = T0 + 1000 + i * 250;
    return i % 2 ? { t, target: 'none', done: t + 1000, reference: true } : { t, target: 'error', done: t + 30, reference: true };
  }), ...ticks(4000, 5000, 'answered', true)];
  assert.deepEqual(parts(mixed), [{ start: T0 + 1000, end: T0 + 4040, kind: 'yepwatch', why: 'HTTP 5xx' }]);
});

test('a stretch ends at the earliest answer that came, not at the first one asked for', () => {
  // A timeout sent at 0; an answer sent at 250 that came at 1200; one sent at 500 that came at 540.
  const seen: Tick[] = [
    { t: T0, target: 'none', done: T0 + 1000, reference: true },
    { t: T0 + 250, target: 'answered', done: T0 + 1200, reference: true },
    { t: T0 + 500, target: 'answered', done: T0 + 540, reference: true },
  ];
  assert.deepEqual(parts(seen), []);
  // Answers that only came after the next failure was asked for don't end the stretch.
  const late: Tick[] = [
    { t: T0, target: 'none', done: T0 + 1000, reference: true },
    { t: T0 + 250, target: 'answered', done: T0 + 1300, reference: true },
    { t: T0 + 500, target: 'none', done: T0 + 1500, reference: true },
    { t: T0 + 750, target: 'none', done: T0 + 1750, reference: true },
    { t: T0 + 1000, target: 'answered', done: T0 + 1040, reference: true },
  ];
  assert.deepEqual(parts(late), [{ start: T0, end: T0 + 1040, kind: 'yepwatch', why: 'no answer' }]);
});

test("a flickering reference can't turn a long YepWatch silence into the runner's outage", () => {
  // YepWatch silent for 10 s; the reference misses one probe in six.
  const seen = [...ticks(0, 1000, 'answered', true), ...Array.from({ length: 40 }, (_, i): Tick => {
    const t = T0 + 1000 + i * 250;
    return { t, target: 'none', done: t + 1000, reference: i % 6 !== 5 };
  }), ...ticks(11_000, 12_000, 'answered', true)];
  const found = unreachable(seen);
  // Only a stretch's edges may become the runner's (at most RECOVERY_GRACE_MS each); the middle stays YepWatch's.
  assert.ok(found.filter((s) => s.kind === 'runner').every((s) => s.end - s.start <= 2000 + 250));
  assert.ok(found.filter((s) => s.kind === 'yepwatch').reduce((ms, s) => ms + s.end - s.start, 0) >= 6000);
});

test("5xx between the runner's own drops still count, as a whole", () => {
  // A 503, then a timeout with the reference silent too, alternating every 250 ms for 5 s.
  const seen = [...ticks(0, 1000, 'answered', true), ...Array.from({ length: 20 }, (_, i): Tick => {
    const t = T0 + 1000 + i * 250;
    return i % 2 ? { t, target: 'none', done: t + 1000, reference: false } : { t, target: 'error', done: t + 30, reference: false };
  }), ...ticks(6000, 7000, 'answered', true)];
  const own = unreachable(seen).filter((s) => s.kind === 'yepwatch');
  assert.equal(own.length, 10);
  assert.ok(own.every((s) => s.why === 'HTTP 5xx'));
});

test("transport errors while the runner was offline are the runner's; HTTP errors never are", () => {
  const stretches = unreachable([...ticks(0, 11_700, 'answered', true), ...ticks(11_700, 23_700, 'none', false), ...ticks(23_700, 30_000, 'answered', true)]);
  const at = T0 + 15_000;
  assert.ok(explainedByRunner({ gate: 'errors', detail: 'websocket error: socket closed (never opened)', at }, stretches));
  assert.ok(explainedByRunner({ gate: 'errors', detail: 'request failed: POST /api/yepwatch/v1/proposal/rooms/r/realtime-ticket net::ERR_TIMED_OUT', at: T0 + 25_000 }, stretches));
  assert.ok(explainedByRunner({ gate: 'errors', detail: "console.error: WebSocket connection to 'wss://yepwatch.com/…' failed", at }, stretches));
  assert.equal(explainedByRunner({ gate: 'errors', detail: 'HTTP 503 POST /api/yepwatch/v1/proposal/rooms', at }, stretches), undefined);
  assert.equal(explainedByRunner({ gate: 'errors', detail: 'uncaught: TypeError: x is undefined', at }, stretches), undefined);
  // A WebSocket handshake answered with an HTTP status is YepWatch's answer, however it is worded.
  assert.equal(explainedByRunner({ gate: 'errors', detail: 'websocket error: Service Unavailable: 503 (never opened, failed 40 ms after its dial)', at }, stretches), undefined);
  assert.equal(explainedByRunner({ gate: 'errors', detail: "console.error: WebSocket connection to 'wss://yepwatch.com/api/yepwatch/v1/proposal/realtime' failed: Error during WebSocket handshake: Unexpected response code: 503", at }, stretches), undefined);
  // The harness appends when and on which screen a socket failed; those numbers are no HTTP status.
  assert.ok(explainedByRunner({ gate: 'errors', detail: 'websocket error: net::ERR_CONNECTION_RESET (opened 120 ms after its dial, failed 3510 ms later; screen: room-setup)', at }, stretches));
  // Nor are numbers in a request's path.
  assert.ok(explainedByRunner({ gate: 'errors', detail: 'request failed: POST /api/yepwatch/v1/proposal/rooms/yW-200-503x/commands net::ERR_NETWORK_CHANGED', at }, stretches));
  // Long after the network came back, a failed request is YepWatch's again.
  assert.equal(explainedByRunner({ gate: 'errors', detail: 'request failed: GET /api/x net::ERR_FAILED', at: T0 + 40_000 }, stretches), undefined);
});

test('one slow probe among answers is no stretch', () => {
  // Its timeout is known 1 s later, but the next probe answered 290 ms after it was sent.
  const seen = [...ticks(0, 2000, 'answered', true), { t: T0 + 2000, target: 'none' as const, done: T0 + 3000, reference: true }, ...ticks(2250, 4000, 'answered', true)];
  assert.deepEqual(parts(seen), []);
});

test('YepWatch answering a moment after the runner is back belongs to the runner outage', () => {
  // New TCP and TLS to abio after the drop: the reference answers 1.25 s before YepWatch does.
  const seen = [...ticks(0, 2000, 'answered', true), ...ticks(2000, 10_000, 'none', false), ...ticks(10_000, 11_250, 'none', true), ...ticks(11_250, 12_000, 'answered', true)];
  assert.deepEqual(parts(seen), [{ start: T0 + 1750, end: T0 + 11_290, kind: 'runner' }]);
  // Much later than that, YepWatch's own part is a failure again.
  const late = [...ticks(0, 2000, 'answered', true), ...ticks(2000, 10_000, 'none', false), ...ticks(10_000, 14_000, 'none', true), ...ticks(14_000, 15_000, 'answered', true)];
  assert.deepEqual(parts(late).map((s) => s.kind), ['runner', 'yepwatch']);
});

test('a stretch still open at the end lasts until its last failure was known, nothing invented', () => {
  // A 5xx answered in 30 ms, then the watch stopped.
  assert.deepEqual(parts([...ticks(0, 1000, 'answered', true), { t: T0 + 1000, target: 'error', done: T0 + 1030, reference: true }]), []);
});

test("a sample spanning the runner's outage is found, one beside it is not", () => {
  const stretches = unreachable([...ticks(0, 11_700, 'answered', true), ...ticks(11_700, 23_700, 'none', false), ...ticks(23_700, 30_000, 'answered', true)]);
  // The friend's invitation: navigation at 05:39:11.7, join page at 05:39:23.73 (12 029 ms).
  assert.ok(duringRunnerOutage(T0 + 11_700, T0 + 23_729, stretches));
  assert.equal(duringRunnerOutage(T0 + 25_000, T0 + 25_700, stretches), undefined);
});

test("connection words are judged against the runner's outage, not as words without one", () => {
  const outage: [number, number] = [T0 + 11_700, T0 + 23_700];
  // The host's line that day: 05:39:18.2 to 05:39:27.1, 3.4 s after the drop ended (budget 1 s): late, not "without an outage".
  const words = (end: number) => recording({ startedAt: T0, endedAt: T0 + 40_000, words: [{ t: T0 + 18_200, text: 'Reconnecting…' }, { t: end, text: '' }] });
  const [late, ...rest] = connectionWords(words(T0 + 27_100), 'Smoke host', [outage]);
  assert.equal(rest.length, 0);
  assert.match(late.detail, /still visible 3400 ms after the outage ended/);
  assert.deepEqual(connectionWords(words(T0 + 27_100), 'Smoke host', []).map((f) => f.detail), ['"Reconnecting…" visible for 8900 ms without an outage of 3000 ms']);
  // Gone within a second of the network's return: no failure.
  assert.deepEqual(connectionWords(words(T0 + 24_500), 'Smoke host', [outage]), []);
});

/**
 * Runs a watch for `ms` against a fake network: `answer(url, n)` gives the nth call's status (null: hang until aborted;
 * a negative status: that status with a body that breaks).
 */
async function watchFor(ms: number, answer: (url: string, n: number) => number | null | Promise<number | null>) {
  const real = globalThis.fetch;
  const calls = new Map<string, number>();
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const n = (calls.get(url) ?? 0) + 1;
    calls.set(url, n);
    const s = await answer(url, n);
    if (s === null) return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true }));
    if (s < 0) return new Response(new ReadableStream({ start: (c) => c.error(new Error('body broke')) }), { status: -s });
    return new Response('', { status: s });
  }) as typeof fetch;
  try {
    const watch = new ReachabilityWatch('https://yepwatch.test', 'https://reference.test/');
    await new Promise((r) => setTimeout(r, ms));
    const t = Date.now();
    const stretches = await watch.stop();
    return { stretches, stopMs: Date.now() - t, calls };
  } finally {
    globalThis.fetch = real;
  }
}
const isTarget = (url: string) => url.startsWith('https://yepwatch.test/');

test('the watch keeps its pace while a probe hangs, so one hung probe is no failure', async () => {
  const { stretches, calls, stopMs } = await watchFor(1600, (url, n) => (isTarget(url) && n === 2 ? null : 200));
  assert.deepEqual(stretches, []);
  // Probes kept going every 250 ms while the second one waited for its timeout.
  assert.ok((calls.get('https://yepwatch.test/api/yepwatch/v1/proposal/health/ready') ?? 0) >= 6);
  // Stopping waits for the probes still out, never longer than their timeout.
  assert.ok(stopMs <= 1100);
});

test('the watch sees YepWatch silent while the reference answers, and the runner offline when neither does', async () => {
  const silent = await watchFor(1800, (url) => (isTarget(url) ? null : 200));
  assert.deepEqual(silent.stretches.map((s) => [s.kind, s.why]), [['yepwatch', 'no answer']]);
  const offline = await watchFor(1800, () => null);
  assert.deepEqual(offline.stretches.map((s) => s.kind), ['runner']);
  const errors = await watchFor(1800, (url) => (isTarget(url) ? 503 : null));
  assert.deepEqual(errors.stretches.map((s) => [s.kind, s.why]), [['yepwatch', 'HTTP 5xx']]);
});

test("a 5xx whose body breaks is still YepWatch's 5xx, not the runner offline", async () => {
  const broken = await watchFor(1800, (url) => (isTarget(url) ? -503 : null));
  assert.deepEqual(broken.stretches.map((s) => [s.kind, s.why]), [['yepwatch', 'HTTP 5xx']]);
  // A reference whose headers came is an answer, whatever its body did.
  const reference = await watchFor(1800, (url) => (isTarget(url) ? null : -200));
  assert.deepEqual(reference.stretches.map((s) => [s.kind, s.why]), [['yepwatch', 'no answer']]);
});

test("the room's words are judged against the whole stretch, however its parts were attributed", () => {
  // YepWatch silent from 1 s to 11 s; the reference answers once, at 6 s, so the stretch is runner / YepWatch / runner.
  const seen = [...ticks(0, 1000, 'answered', true), ...Array.from({ length: 40 }, (_, i): Tick => {
    const t = T0 + 1000 + i * 250;
    return { t, target: 'none', done: t + 1000, reference: t === T0 + 6000 };
  }), ...ticks(11_000, 12_000, 'answered', true)];
  const outages = outagesOf(unreachable(seen));
  assert.deepEqual(outages, [[T0 + 750, T0 + 11_040]]);
  // "Reconnecting…" from 4.5 s to 11.5 s: gone within a second of YepWatch answering again.
  const rec = recording({ startedAt: T0, endedAt: T0 + 20_000, words: [{ t: T0 + 4500, text: 'Reconnecting…' }, { t: T0 + 11_500, text: '' }] });
  assert.deepEqual(connectionWords(rec, 'Smoke host', outages), []);
});

test('a probe timing out as the watch stops is no outage: it probes on until YepWatch answers', async () => {
  // The third probe hangs; the watch is stopped right after it was sent.
  const { stretches } = await watchFor(600, (url, n) => (isTarget(url) && n === 3 ? null : 200));
  assert.deepEqual(stretches, []);
});

test('a probe sent while the watch stops and then timing out is followed up, not taken as an outage', async () => {
  // The second probe's reference answers late (450 ms) and stop comes 100 ms after it was sent; the third probe hangs.
  const { stretches } = await watchFor(350, async (url, n) => {
    if (!isTarget(url) && n === 2) await new Promise((r) => setTimeout(r, 450));
    return isTarget(url) && n === 3 ? null : 200;
  });
  assert.deepEqual(stretches, []);
  // When YepWatch really stays away through the follow-up, it is reported.
  const away = await watchFor(350, (url, n) => (isTarget(url) && n >= 2 ? null : 200));
  assert.deepEqual(away.stretches.map((s) => s.kind), ['yepwatch']);
});

test('following up on a failure at teardown keeps the probe pace, however fast the failures come back', async () => {
  // YepWatch answers 503 at once, the reference 200 at once, from the second probe on: the follow-up runs its 2 s.
  const { stretches, calls } = await watchFor(300, (url, n) => (isTarget(url) && n >= 2 ? 503 : 200));
  assert.deepEqual(stretches.map((s) => [s.kind, s.why]), [['yepwatch', 'HTTP 5xx']]);
  // 300 ms of regular probes and 2 s of follow-up at 250 ms: about 11 pairs, never a flood.
  assert.ok((calls.get('https://yepwatch.test/api/yepwatch/v1/proposal/health/ready') ?? 0) <= 14);
});

test('the black hole resends as TCP does: after the first wait, then each wait doubled', () => {
  assert.equal(nextRetry(0, 0, SYN_FIRST_MS), 1000);
  assert.equal(nextRetry(0, 1001, SYN_FIRST_MS), 3000);
  assert.equal(nextRetry(0, 3001, SYN_FIRST_MS), 7000);
  assert.equal(nextRetry(0, 12000, RETRANSMIT_FIRST_MS), 12600);
  assert.equal(nextRetry(5000, 12000, RETRANSMIT_FIRST_MS), 17600);
});

/** One SOCKS5 CONNECT through the hole to `port`, by name as Chromium sends it; resolves with the socket once connected. */
function socks(proxy: number, port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const s = net.connect(proxy, '127.0.0.1');
    s.once('error', reject);
    s.write(Buffer.from([5, 1, 0]));
    let stage = 0;
    s.on('data', function onData(b) {
      if (stage === 0 && b[0] === 5 && b[1] === 0) {
        stage = 1;
        const host = Buffer.from('127.0.0.1');
        s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, host.length]), host, Buffer.from([port >> 8, port & 255])]));
      } else if (stage === 1) {
        s.off('data', onData);
        assert.equal(b[1], 0, 'connected');
        resolve(s);
      }
    });
  });
}

test('the black hole holds bytes both ways and new connections while open, and lets them through after', async () => {
  const echo = net.createServer((c) => c.on('data', (b) => c.write(b)));
  await new Promise<void>((r) => echo.listen(0, '127.0.0.1', r));
  const port = (echo.address() as net.AddressInfo).port;
  const hole = new Blackhole();
  await hole.listen();
  try {
    const s = await socks(hole.port, port);
    const got: string[] = [];
    s.on('data', (b) => got.push(b.toString()));
    const echoed = new Promise((r) => s.once('data', r));
    s.write('a');
    await echoed;
    assert.deepEqual(got, ['a'], 'straight through while closed');
    hole.drop();
    s.write('b');
    const arrived = new Promise<number>((r) => s.once('data', () => r(Date.now())));
    let late = false;
    const pending = socks(hole.port, port).then((c) => { late = true; return c; });
    await new Promise((r) => setTimeout(r, 300));
    assert.deepEqual(got, ['a'], 'nothing gets through, nothing fails');
    assert.equal(late, false, 'a new connection waits for its SYN retry');
    hole.restore();
    const restoredAt = Date.now();
    // Held until the hole closed, then delivered (its exact retransmission time: nextRetry, tested above).
    const at = await arrived;
    assert.ok(at >= restoredAt, 'the held byte arrives only after the restore');
    assert.deepEqual(got.join(''), 'ab');
    const c = await pending;
    assert.ok(late);
    c.destroy();
    s.destroy();
  } finally {
    await hole.close();
    await new Promise<void>((r) => echo.close(() => r()));
  }
});

test('the smoke member session is kept private, for its member and origin only, and only while it outlives a run', async () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'smoke-session-'));
  const file = path.join(dir, 'nested', 'session.json');
  const before = process.env.E2E_SMOKE_MEMBER_SESSION;
  process.env.E2E_SMOKE_MEMBER_SESSION = file;
  try {
    const now = 1_800_000_000_000;
    const cookie = (name: string, domain: string, expires: number) => ({ name, value: `${name}-value-0123456789abcdef`, domain, path: '/', expires, httpOnly: true, secure: true, sameSite: 'Lax' as const });
    const state = {
      cookies: [cookie('yw', 'yepwatch.com', now / 1000 + 86400), cookie('gw', 'goodwatch.app', now / 1000 + 86400), cookie('old', '.yepwatch.com', now / 1000 + 60)],
      origins: [{ origin: 'https://yepwatch.com', localStorage: [{ name: 'k', value: 'v' }] }, { origin: 'https://goodwatch.app', localStorage: [] }],
    };
    assert.deepEqual(originPart(state, 'https://yepwatch.com').cookies.map((c) => c.name), ['yw', 'old'], 'never GoodWatch’s cookies');
    assert.equal(await saveSession({ storageState: async () => state } as never, 'https://yepwatch.com', 'Member@Example.com', now), true);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    const kept = loadSession('https://yepwatch.com', 'member@example.com', now);
    assert.deepEqual(kept?.state.cookies.map((c) => c.name), ['yw'], 'a cookie expiring within the run is left out');
    assert.deepEqual(kept?.state.origins.map((o) => o.origin), ['https://yepwatch.com']);
    assert.equal(loadSession('https://yepwatch.com', 'other@example.com', now), null, 'another member');
    assert.equal(loadSession('https://staging.yepwatch.com', 'member@example.com', now), null, 'another origin');
    assert.equal(loadSession('https://yepwatch.com', 'member@example.com', now + 2 * 86400_000), null, 'expired');
    fs.chmodSync(file, 0o644);
    assert.equal(loadSession('https://yepwatch.com', 'member@example.com', now), null, 'readable by others: not used');
    dropSession();
    assert.equal(fs.existsSync(file), false);
  } finally {
    if (before === undefined) delete process.env.E2E_SMOKE_MEMBER_SESSION;
    else process.env.E2E_SMOKE_MEMBER_SESSION = before;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the black hole opens behind a WebSocket upgrade request however its bytes are split', async () => {
  const sink = net.createServer((c) => c.resume());
  await new Promise<void>((r) => sink.listen(0, '127.0.0.1', r));
  const port = (sink.address() as net.AddressInfo).port;
  const hole = new Blackhole();
  await hole.listen();
  try {
    const plain = await socks(hole.port, port);
    hole.dropAfterUpgrade();
    const opened = async (timeout: number) => {
      const end = Date.now() + timeout;
      while (!hole.open && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
      return hole.open;
    };
    plain.write('GET /x HTTP/1.1\r\nHost: a\r\n\r\n');
    // A plain request's bytes reach the server (the sink sees the connection's data) without opening the hole.
    assert.equal(await opened(200), false, 'a plain request leaves it closed');
    const ws = await socks(hole.port, port);
    const parts = ['GET /api/yepwatch/v1/proposal/realtime HTTP/1.1\r\nHost: a\r\nUpgr', 'ade: websocket\r\nConnection: Upgrade\r', '\n\r\n'];
    for (const part of parts.slice(0, -1)) {
      await new Promise<void>((r) => ws.write(part, () => r()));
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(hole.open, false, 'not before the header block is complete');
    }
    ws.write(parts.at(-1)!);
    assert.equal(await opened(5000), true);
    plain.destroy();
    ws.destroy();
  } finally {
    await hole.close();
    await new Promise<void>((r) => sink.close(() => r()));
  }
});
