import test from 'node:test';
import assert from 'node:assert/strict';
import { frameGaps, type Recording } from '../e2e/lib/gates';
import { serverTimingLine } from '../e2e/lib/server-timing';
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
