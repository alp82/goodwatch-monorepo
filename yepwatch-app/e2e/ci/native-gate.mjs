#!/usr/bin/env node
// CI wrapper for the Android share of the deploy gate (`e2e:native:gate`).
//
//   node e2e/ci/native-gate.mjs [--frames=report|gate]
//
// 1. Overlaps the three slow preparations instead of running them one after another:
//    shared stack up (Crate/Valkey/Caddy + bundles), release APK for the stack's origins (cached base APK +
//    JS repack), and two emulators booted from the cached snapshot.
// 2. Runs `e2e/native/run.mjs gate` unchanged (it finds the APK cached and the emulators booted).
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

function stackUp() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(e2eDir, 'stack/up.mjs'), '--reset'], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`stack up failed (${code})`))));
  });
}

let prepError = null;
await Promise.all([
  timed('stack', stackUp),
  timed('apk', async () => log(`apk ${JSON.stringify(await ensureApk(origins))}`)),
  timed('boot', async () => log(`emulators ${JSON.stringify(await boot(2))}`)),
]).catch((e) => { prepError = e; });
if (prepError) { log(`preparation failed: ${prepError.stack ?? prepError}`); process.exit(1); }

const before = new Set(fs.existsSync(RUNS_DIR) ? fs.readdirSync(RUNS_DIR) : []);
const run = await timed('gate', async () => spawnSync(process.execPath, [path.join(nativeDir, 'run.mjs'), 'gate'], { cwd: nativeDir, stdio: 'inherit', env: process.env }));
const dir = fs.readdirSync(RUNS_DIR).filter((d) => d.startsWith('gate-') && !before.has(d)).sort().pop();
if (!dir) { log(`run.mjs left no result (exit ${run.status})`); process.exit(1); }
const file = path.join(RUNS_DIR, dir, 'result.json');
const result = JSON.parse(fs.readFileSync(file, 'utf8'));

// ---- re-judge ----------------------------------------------------------------------------------------------
const s = result.summary ?? {};
const gating = Object.entries(s).filter(([k]) => k !== 'scenarios' && !(k === 'frames' && frames === 'report'));
const pass = !result.fatal && result.scenarios.every((x) => x.pass) && gating.every(([, v]) => v === 0);
result.ci = { frames, pass, wallMs: Date.now() - t0, prepPhases: phases, runnerPass: result.pass };
fs.writeFileSync(file, JSON.stringify(result, null, 2));

const g = result.gates;
const lines = [
  `## Android gate: ${pass ? 'PASS' : 'FAIL'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  '',
  `Preparation (overlapped): stack ${(phases.stack / 1000).toFixed(0)} s, APK ${(phases.apk / 1000).toFixed(0)} s, emulators ${(phases.boot / 1000).toFixed(0)} s; journeys ${(phases.gate / 1000).toFixed(0)} s.`,
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
