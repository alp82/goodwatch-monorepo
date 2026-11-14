#!/usr/bin/env node
// CI wrapper for the Android share of the deploy gate (`npm run e2e:gate:android` in e2e/).
//
//   node e2e/ci/native-gate.mjs [--mode=subset|gate|full] [--frames=report|gate]
//
// --mode=subset (default, the deploy gate, owner decision Q28): cold start, then one mixed room with the
// Android app as host and a browser friend (create/join, Start, vote to a match) on ONE emulator. The
// two-phone `gate` and the `full` run stay local / pre-OTA (ota-gate.mjs).
//
// 1. Overlaps the three slow preparations instead of running them one after another:
//    shared stack up (Crate/Valkey/Caddy + bundles + web export), release APK for the stack's origins
//    (cached base APK + JS repack), and the emulator(s) booted from the cached snapshot.
//    With --prepare it does only the stack and the APK and writes the outcome to <file>; CI starts that in
//    the background right after node_modules are restored, so the bundling overlaps the emulator, system
//    image and AVD cache downloads. A later --after-prepare=<file> boots the emulator while it waits for it.
//    --pulled=<status file> makes --prepare first wait for the background image pull's exit status (0 = all
//    pulled). Both sides are bounded below the job timeout: a failed pull or a preparation past PREPARE_MS
//    writes a failed outcome, and the waiter gives up after WAIT_MS or as soon as the preparer died silently.
// 2. Runs `e2e/native/run.mjs <mode>` unchanged (it finds the APK cached and the emulators booted).
// 3. Re-judges its result.json. Every gate stays a gate except frame pacing when --frames=report (CI default):
//    GitHub's runners have no GPU, so the emulator renders with SwiftShader and gfxinfo frame times measure
//    the software renderer, not the app. Frame numbers are still collected, printed and kept in the report;
//    the local and pre-OTA runs (`ota-gate.mjs`, real GPU) keep enforcing them.
//
// Writes e2e/native/.cache/runs/<gate-…>/result.json (as run.mjs does) plus ci-summary.md next to it, and
// appends the summary to $GITHUB_STEP_SUMMARY when present.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(here, '..');
const nativeDir = path.join(e2eDir, 'native');
const frames = (process.argv.find((a) => a.startsWith('--frames=')) ?? '--frames=report').slice(9);
if (!['report', 'gate'].includes(frames)) throw new Error(`--frames must be report or gate, got ${frames}`);
const mode = (process.argv.find((a) => a.startsWith('--mode=')) ?? '--mode=subset').slice(7);
if (!['subset', 'gate', 'full'].includes(mode)) throw new Error(`--mode must be subset, gate or full, got ${mode}`);
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const prepareOut = arg('prepare');
const afterPrepare = arg('after-prepare');
const pulled = arg('pulled');
// Deadlines inside the CI job's 12 min (yepwatch-gate.yml android-gate): checkout and caches take ~1-3 min
// before the gate step, the journeys ~2 min after it.
const PULL_MS = 4 * 60000;
// CI gives a cold release build (no APK base cache) longer: YW_E2E_PREPARE_MS (yepwatch-gate.yml).
const PREPARE_MS = Number(process.env.YW_E2E_PREPARE_MS || 7 * 60000);
const WAIT_MS = PREPARE_MS + 30000;
const t0 = Date.now();
const log = (m) => console.log(`[native-gate ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const phases = {};
const timed = async (name, fn) => { const s = Date.now(); try { return await fn(); } finally { phases[name] = Date.now() - s; log(`${name} done in ${((Date.now() - s) / 1000).toFixed(1)} s`); } };

const { ORIGINS } = await import('../stack/config.mjs');
const { ensureApk } = await import('../native/lib/build.mjs');
const { boot } = await import('../native/lib/device.mjs');
const { RUNS_DIR } = await import('../native/lib/env.mjs');
// The same origins lib/stack.mjs derives from .stack.json once the stack is up (one Caddy front).
const front = new URL(ORIGINS.front).origin;
const origins = { api: front, ws: front.replace(/^http/, 'ws'), app: front };

const children = new Set();
function stackUp() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(e2eDir, 'stack/up.mjs'), '--reset'], { stdio: 'inherit' });
    children.add(child);
    child.on('exit', () => children.delete(child));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`stack up failed (${code})`))));
  });
}

let prepError = null;
let apkInfo = null;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
/** Waits for the background pull's exit status file; throws on a failed pull or none within PULL_MS. */
const awaitPull = async (file) => {
  const s = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - s > PULL_MS) throw new Error(`stack images not pulled after ${PULL_MS / 60000} min (no ${file})`);
    await sleepMs(250);
  }
  const status = fs.readFileSync(file, 'utf8').trim();
  if (status !== '0') throw new Error(`pulling the stack images failed (status ${status}; see pull.log)`);
  log(`stack images pulled after ${((Date.now() - s) / 1000).toFixed(1)} s of waiting`);
};
const hostPrep = async () => {
  if (pulled) await timed('pull', () => awaitPull(pulled));
  await Promise.all([
    timed('stack', stackUp),
    timed('apk', async () => { apkInfo = await ensureApk(origins); log(`apk ${JSON.stringify(apkInfo)}`); }),
  ]);
};
/** Waits for a --prepare run's outcome file (written once, at its end). */
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const awaitPrepared = async (file) => {
  const s = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - s > WAIT_MS) throw new Error(`no ${file} after ${WAIT_MS / 60000} min`);
    const pid = fs.existsSync(`${file}.pid`) ? Number(fs.readFileSync(`${file}.pid`, 'utf8')) : null;
    if (pid && !alive(pid) && !fs.existsSync(file)) throw new Error(`the background preparation (pid ${pid}) exited without writing ${file}`);
    await sleepMs(250);
  }
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(phases, p.phases, { prepareWait: Date.now() - s });
  apkInfo = p.apk;
  if (!p.ok) throw new Error(`background preparation failed: ${p.error}`);
  log(`background preparation was ready after ${((Date.now() - s) / 1000).toFixed(1)} s of waiting`);
};

if (prepareOut) {
  fs.rmSync(prepareOut, { force: true });
  fs.writeFileSync(`${prepareOut}.pid`, String(process.pid));
  let deadline;
  const overdue = new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error(`preparation not done after ${PREPARE_MS / 60000} min`)), PREPARE_MS); });
  await Promise.race([hostPrep(), overdue]).catch((e) => { prepError = e; });
  clearTimeout(deadline);
  if (prepError) for (const child of children) child.kill('SIGTERM');
  const out = { ok: !prepError, error: prepError ? String(prepError.stack ?? prepError) : null, phases, apk: apkInfo, ms: Date.now() - t0 };
  fs.writeFileSync(`${prepareOut}.tmp`, JSON.stringify(out, null, 2));
  fs.renameSync(`${prepareOut}.tmp`, prepareOut);
  log(prepError ? `preparation failed: ${out.error}` : `prepared in ${(out.ms / 1000).toFixed(1)} s`);
  process.exit(prepError ? 1 : 0);
}

await Promise.all([
  afterPrepare ? awaitPrepared(afterPrepare) : hostPrep(),
  timed('boot', async () => log(`emulators ${JSON.stringify(await boot(mode === 'subset' ? 1 : 2))}`)),
]).catch((e) => { prepError = e; });
if (prepError) { log(`preparation failed: ${prepError.stack ?? prepError}`); process.exit(1); }

const before = new Set(fs.existsSync(RUNS_DIR) ? fs.readdirSync(RUNS_DIR) : []);
const run = await timed('gate', async () => spawnSync(process.execPath, [path.join(nativeDir, 'run.mjs'), mode], { cwd: nativeDir, stdio: 'inherit', env: process.env }));
const dir = fs.readdirSync(RUNS_DIR).filter((d) => d.startsWith(`${mode}-`) && !before.has(d)).sort().pop();
if (!dir) { log(`run.mjs left no result (exit ${run.status})`); process.exit(1); }
const file = path.join(RUNS_DIR, dir, 'result.json');
const result = JSON.parse(fs.readFileSync(file, 'utf8'));

// ---- re-judge ----------------------------------------------------------------------------------------------
const s = result.summary ?? {};
const gating = Object.entries(s).filter(([k]) => k !== 'scenarios' && !(k === 'frames' && frames === 'report'));
const pass = !result.fatal && result.scenarios.every((x) => x.pass) && gating.every(([, v]) => v === 0);
result.ci = { mode, frames, pass, wallMs: Date.now() - t0, prepPhases: phases, apk: apkInfo, runnerPass: result.pass };
fs.writeFileSync(file, JSON.stringify(result, null, 2));

const g = result.gates;
const lines = [
  `## Android gate (${mode}): ${pass ? 'PASS' : 'FAIL'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  '',
  `Preparation (overlapped): stack ${(phases.stack / 1000).toFixed(0)} s, APK ${(phases.apk / 1000).toFixed(0)} s, emulators ${(phases.boot / 1000).toFixed(0)} s${phases.prepareWait != null ? ` (waited ${(phases.prepareWait / 1000).toFixed(0)} s for the background stack + APK)` : ''}; journeys ${(phases.gate / 1000).toFixed(0)} s. APK: ${apkInfo?.gradle ? 'Gradle build (native change)' : apkInfo?.repack ? 'cached base + JS repack' : 'cached'}.`,
  '',
  `Scenarios ${s.scenarios}; timing ${s.timingFails}, flash ${s.flash}, errors ${s.errors}, a11y ${s.a11y}, stuck ${s.stuck}, journey ${s.journey} failure(s).`,
  `Frame pacing: ${s.frames} over budget — ${frames === 'report' ? '**reported, not gating on CI** (no GPU: SwiftShader frame times). Enforced by ota-gate.mjs on real hardware.' : 'gating.'}`,
];
if (result.fatal) lines.push('', '```', String(result.fatal).slice(0, 1500), '```');
const bad = [...g.timing.filter((x) => !x.pass && !x.informational).map((x) => `timing: ${x.name} ${x.ms ?? '-'} ms (budget ${x.budgetMs})${x.error ? ` ${x.error}` : ''}`),
  ...g.flash.map((x) => `flash: ${x.name}`), ...g.errors.map((x) => `error: ${x.phone} ${JSON.stringify(x).slice(0, 200)}`),
  ...g.a11y.map((x) => `a11y: ${JSON.stringify(x).slice(0, 200)}`), ...g.stuck.map((x) => `stuck: ${x.where} ${x.words.join(' | ')}`),
  ...g.journey.map((x) => `journey: ${x.name}: ${x.detail}`), ...result.scenarios.filter((x) => !x.pass).map((x) => `scenario ${x.name}: ${x.error}`)];
if (bad.length) lines.push('', ...bad.slice(0, 40).map((b) => `- ${b}`));
const fr = g.frames.map((x) => `- frames ${x.name}: ${JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'name')))}`);
if (fr.length) lines.push('', '<details><summary>Frame pacing numbers</summary>', '', ...fr, '', '</details>');
const md = `${lines.join('\n')}\n`;
fs.writeFileSync(path.join(RUNS_DIR, dir, 'ci-summary.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
log(`result ${file}`);
process.exit(pass ? 0 : 1);
