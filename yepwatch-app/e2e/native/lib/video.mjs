// Frame-accurate transition timing and flash detection from the emulator's own screen recorder.
//
// Method: `adb emu screenrecord start --fps 60` records the emulator display on the host (the guest
// is not involved), so recording doesn't load the phone. Frames are decoded at 135x300 grayscale.
// - Resolution: one frame = 16.7 ms at 60 fps. Every number we report has +/- 17 ms quantisation.
//   Recorder frame drops show up as PTS gaps and are reported per measurement (`maxGapMs`).
// - Touch anchor: "show touches" is on in the harness snapshot, so a tap paints a dot in the frame it
//   lands; the anchor is the first frame where a small box around the tap point changes.
// - Host anchor (cold start, links, other phone): host clock when the command was issued, mapped onto
//   the video timeline by the host time the recording started (console round trip ~1-10 ms).
// - Arrival: first frame after the anchor from which the target region matches its settled look
//   (mean abs diff below threshold for 3 consecutive frames).
// - Flash: within the transition window we flag (a) near-uniform frames (blank/black/flat screens),
//   (b) one-to-two-frame spikes that revert (X -> Y -> X), and (c) stable intermediate plateaus that look
//   like neither the start nor the end screen. Plateau frames are saved as PNGs for review.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mkdirp, run, sleep, tools } from './env.mjs';

export const W = 135, H = 300, SCALE = 1080 / W; // device px per analysed px
const STATUS_ROWS = Math.ceil(80 / SCALE);

export async function startRecording(phone, file) {
  mkdirp(path.dirname(file));
  fs.rmSync(file, { force: true });
  const before = Date.now();
  run(tools.adb, ['-s', phone.serial, 'emu', 'screenrecord', 'start', '--fps', '60', '--size', '540x1200', '--bit-rate', '8M', file]);
  const after = Date.now();
  return { phone, file, t0: (before + after) / 2, t0Err: (after - before) / 2 };
}
export async function stopRecording(rec) {
  run(tools.adb, ['-s', rec.phone.serial, 'emu', 'screenrecord', 'stop']);
  for (let i = 0; i < 50; i++) { // the recorder finalises the file asynchronously
    try { if (fs.statSync(rec.file).size > 0) { await sleep(400); break; } } catch { /* not yet */ }
    await sleep(100);
  }
  return decode(rec);
}

export function decode(rec) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', rec.file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const pts = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=pts_time,best_effort_timestamp_time', '-of', 'csv=p=0', rec.file], { encoding: 'utf8' })
    .trim().split('\n').map(l => Number(l.split(',').find(x => x && x !== 'N/A')) * 1000);
  const n = Math.floor(raw.length / (W * H));
  const frames = Array.from({ length: n }, (_, i) => ({ i, t: pts[i] ?? i * 1000 / 60, px: raw.subarray(i * W * H, (i + 1) * W * H) }));
  return { ...rec, frames };
}

const clampRoi = r => {
  const [x1, y1, x2, y2] = r.map(v => Math.round(v / SCALE));
  return [Math.max(0, x1), Math.max(STATUS_ROWS, y1), Math.min(W, Math.max(x1 + 1, x2)), Math.min(H, Math.max(y1 + 1, y2))];
};
export function diff(a, b, roi = [0, 0, 1080, 2400]) {
  const [x1, y1, x2, y2] = clampRoi(roi); let s = 0, c = 0;
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) { s += Math.abs(a.px[y * W + x] - b.px[y * W + x]); c++; }
  return c ? s / c : 0;
}
function flatness(f) { // std dev of the frame below the status bar
  let s = 0, s2 = 0, c = 0;
  for (let i = STATUS_ROWS * W; i < W * H; i++) { const v = f.px[i]; s += v; s2 += v * v; c++; }
  const m = s / c; return Math.sqrt(Math.max(0, s2 / c - m * m));
}

/** Frame index where a tap landed (show-touches dot), searching from host-time hint. */
export function touchFrame(video, tap, hintMs = null) {
  const box = [tap.x - 40, tap.y - 40, tap.x + 40, tap.y + 40];
  const start = hintMs == null ? 1 : Math.max(1, frameAt(video, hintMs - 250));
  for (let i = start; i < video.frames.length; i++) if (diff(video.frames[i], video.frames[i - 1], box) > 12) return i;
  return -1;
}
export function frameAt(video, hostMs) {
  const rel = hostMs - video.t0;
  const i = video.frames.findIndex(f => f.t >= rel);
  return i < 0 ? video.frames.length - 1 : i;
}
/** First frame >= from where `roi` matches the final frame's roi for `hold` frames. */
export function arrivalFrame(video, roi, from, { thr = 6, hold = 3 } = {}) {
  const f = video.frames, last = f[f.length - 1];
  for (let i = Math.max(0, from); i < f.length - hold; i++) {
    let ok = true;
    for (let k = 0; k < hold && ok; k++) ok = diff(f[i + k], last, roi) < thr;
    if (ok) return i;
  }
  return -1;
}

/** Flash analysis over [from, to]. Returns findings; saves plateau frames as PNG next to the video. */
export function flashes(video, from, to, { allowIntermediate = 1, saveDir } = {}) {
  const f = video.frames; const out = { blank: [], spikes: [], plateaus: [] };
  const first = f[Math.max(0, from - 1)], last = f[f.length - 1];
  to = Math.min(to, f.length - 1);
  for (let i = from; i <= to; i++) {
    if (flatness(f[i]) < 4 && flatness(first) >= 4 && flatness(last) >= 4) out.blank.push(i);
    if (i >= 1 && i + 2 < f.length) {
      const jump = diff(f[i], f[i - 1]);
      if (jump > 10 && (diff(f[i + 1], f[i - 1]) < jump / 4 || diff(f[i + 2], f[i - 1]) < jump / 4)) out.spikes.push({ i, jump: +jump.toFixed(1) });
    }
  }
  // plateaus: runs of >= 3 frames with small frame-to-frame change.
  let runStart = from;
  for (let i = from + 1; i <= to + 1; i++) {
    const still = i <= to && diff(f[i], f[i - 1]) < 1.5;
    if (!still) {
      if (i - runStart >= 3) {
        const mid = f[Math.floor((runStart + i - 1) / 2)];
        const dStart = diff(mid, first), dEnd = diff(mid, last);
        if (dStart > 8 && dEnd > 8) out.plateaus.push({ from: runStart, to: i - 1, ms: +(f[i - 1].t - f[runStart].t).toFixed(0), dStart: +dStart.toFixed(1), dEnd: +dEnd.toFixed(1) });
      }
      runStart = i;
    }
  }
  if (saveDir) {
    mkdirp(saveDir);
    for (const p of out.plateaus) savePng(video, Math.floor((p.from + p.to) / 2), path.join(saveDir, `plateau-${p.from}.png`));
    for (const s of out.spikes) savePng(video, s.i, path.join(saveDir, `spike-${s.i}.png`));
    for (const b of out.blank.slice(0, 3)) savePng(video, b, path.join(saveDir, `blank-${b}.png`));
  }
  out.failed = out.blank.length > 0 || out.spikes.length > 0 || out.plateaus.length > allowIntermediate;
  return out;
}
export function savePng(video, index, file) {
  const t = (video.frames[index]?.t ?? 0) / 1000;
  try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', video.file, '-frames:v', '1', file]); } catch { /* best effort */ }
}
export function maxGap(video, from, to) {
  let g = 0; for (let i = Math.max(1, from); i <= Math.min(to, video.frames.length - 1); i++) g = Math.max(g, video.frames[i].t - video.frames[i - 1].t);
  return +g.toFixed(1);
}

/**
 * Measure one action seen on one or more phones. Every phone involved is recorded.
 * action(): returns { anchor: 'touch', tap: {x,y}, hostMs } (tap on `actor`) or { anchor: 'host', hostMs }.
 * targets: { [phoneName]: async () => roi } - the settled element to wait for on that phone.
 */
/**
 * `appWindowMs` (launches): ms after the anchor at which the launched activity drew its first frame
 * (`am start -W` TotalTime). Flash analysis starts there: what plays before it is the system's app-open
 * transition over the launcher, not the app. Timing still counts from the anchor. The app's first frame
 * (its splash) is then the start look, so launches pass `allowIntermediate: 0`: any screen between the
 * splash and the target counts.
 */
export async function measure({ actor, targets, file, action, settleMs = 1200, allowIntermediate = 1, phones, appWindowMs }) {
  const recs = new Map();
  for (const p of phones) recs.set(p.name, await startRecording(p, file.replace(/\.webm$/, `-${p.name}.webm`)));
  await sleep(350);
  let act, rois = {};
  try {
    act = await action();
    for (const [name, fn] of Object.entries(targets)) rois[name] = await fn();
    await sleep(settleMs);
  } finally {
    for (const [name, r] of recs) recs.set(name, await stopRecording(r));
  }
  const actorVideo = recs.get(actor.name);
  let anchorMs;
  if (act.anchor === 'touch') {
    const i = touchFrame(actorVideo, act.tap, act.hostMs);
    if (i < 0) return Object.fromEntries(Object.keys(targets).map(n => [n, { ok: false, error: 'tap not visible in recording', file: actorVideo.file }]));
    anchorMs = actorVideo.t0 + actorVideo.frames[i].t;
  } else anchorMs = act.hostMs;
  const out = {};
  for (const [name, roi] of Object.entries(rois)) {
    const video = recs.get(name);
    const from = frameAt(video, anchorMs);
    const arr = arrivalFrame(video, roi, from);
    if (arr < 0) { out[name] = { ok: false, error: 'target never settled in recording', file: video.file }; continue; }
    const settledMs = video.t0 + video.frames[arr].t - anchorMs;
    // First visible response in the target region (an entrance animation's first frame).
    const base = video.frames[Math.max(0, from - 1)];
    let fc = arr; for (let i = from; i <= arr; i++) if (diff(video.frames[i], base, roi) > 8) { fc = i; break; }
    const ms = video.t0 + video.frames[fc].t - anchorMs;
    const windowMs = appWindowMs?.();
    const flashFrom = Number.isFinite(windowMs) ? Math.min(arr, Math.max(from, frameAt(video, anchorMs + windowMs))) : from;
    const fl = flashes(video, flashFrom, arr + 20, { allowIntermediate, saveDir: video.file.replace(/\.webm$/, '-frames') });
    out[name] = { ok: true, ms: +ms.toFixed(0), settledMs: +settledMs.toFixed(0), anchorFrame: frameAt(video, anchorMs), firstFrame: fc, settledFrame: arr, resolutionMs: 17, clockErrMs: +(video.t0Err + (video === actorVideo || act.anchor === 'host' ? 0 : actorVideo.t0Err)).toFixed(0),
      maxGapMs: maxGap(video, from, arr), flash: fl, file: video.file };
  }
  return out;
}
