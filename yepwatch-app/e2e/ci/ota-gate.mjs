#!/usr/bin/env node
// Pre-OTA gate. Run it from a clean checkout of exactly what the OTA will publish; it refuses unless every
// selected run passes, and records the verdict for that commit.
//
//   node e2e/ci/ota-gate.mjs [--ios] [--no-android] [--check]
//
//   web full tier      node e2e/run.mjs full             (< 15 min; every journey under all faults)
//   Android full       node e2e/native/run.mjs full      (~6 min; incl. frame pacing on the real GPU)  --no-android skips
//   iOS (--ios)        EAS Workflows: e2e/native/ci/eas-maestro-ios.yml (simulator build + Maestro, ~25-35 min,
//                      started first so it runs while the local tiers do)
//   --check            only verifies a passing verdict exists for HEAD with a clean tree (for OTA scripts)
//
// Verdict: e2e/.cache/ota-gate.json { commit, pass, ios, at, runs }. Publish only when `--check` exits 0.
// Afterwards trigger the production smoke: gh workflow run yepwatch-smoke.yml -f reason="after OTA <message>"
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(here, '..');
const appDir = path.resolve(e2eDir, '..');
const args = new Set(process.argv.slice(2));
const verdictFile = path.join(e2eDir, '.cache', 'ota-gate.json');
const git = (...a) => spawnSync('git', a, { cwd: appDir, encoding: 'utf8' }).stdout.trim();
const head = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--', '.', ':!e2e/artifacts', ':!e2e/.cache*', ':!e2e/.stack*');
const t0 = Date.now();
const log = (m) => console.log(`[ota-gate ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

if (args.has('--check')) {
  const v = fs.existsSync(verdictFile) ? JSON.parse(fs.readFileSync(verdictFile, 'utf8')) : null;
  const problems = [];
  if (!v) problems.push('no verdict: run node e2e/ci/ota-gate.mjs first');
  else {
    if (v.commit !== head) problems.push(`verdict is for ${v.commit.slice(0, 9)}, HEAD is ${head.slice(0, 9)}`);
    if (!v.pass) problems.push('the last gate run failed');
    if (args.has('--ios') && !v.ios) problems.push('the verdict has no iOS run (rerun with --ios)');
  }
  if (dirty) problems.push('the working tree has uncommitted changes under yepwatch-app');
  if (problems.length) { console.error(`OTA gate: refuse\n- ${problems.join('\n- ')}`); process.exit(1); }
  console.log(`OTA gate: pass for ${head.slice(0, 9)} (${v.at}${v.ios ? ', incl. iOS' : ''})`);
  process.exit(0);
}

if (dirty) { console.error(`OTA gate: commit first; an OTA must publish exactly what was tested.\n${dirty}`); process.exit(1); }

const runs = {};
function run(name, cmd, argv, cwd) {
  return new Promise((resolve) => {
    log(`${name}: ${cmd} ${argv.join(' ')}`);
    const s = Date.now();
    const child = spawn(cmd, argv, { cwd, stdio: 'inherit', env: process.env });
    child.on('exit', (code) => { runs[name] = { pass: code === 0, exit: code, ms: Date.now() - s }; log(`${name}: ${code === 0 ? 'PASS' : `FAIL (${code})`} in ${((Date.now() - s) / 1000).toFixed(0)} s`); resolve(code === 0); });
    child.on('error', (e) => { runs[name] = { pass: false, error: e.message }; resolve(false); });
  });
}

// ---- iOS on EAS: start first, collect last ----------------------------------------------------------------
const eas = (argv) => spawnSync('npx', ['--yes', 'eas-cli@latest', ...argv], { cwd: appDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let iosRun = null;
if (args.has('--ios')) {
  // No --ref: EAS uploads the project directory, which is clean (checked above), so it is exactly HEAD, and
  // HEAD need not be pushed yet.
  const r = eas(['workflow:run', 'e2e/native/ci/eas-maestro-ios.yml', '--non-interactive', '--json']);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* not JSON */ }
  const id = parsed?.id ?? parsed?.workflowRunId ?? parsed?.workflowRun?.id ?? r.stdout.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0];
  if (r.status !== 0 || !id) { console.error(`could not start the iOS workflow:\n${r.stdout}\n${r.stderr}`); process.exit(1); }
  iosRun = id;
  log(`iOS workflow started: ${id}${parsed?.url ? ` ${parsed.url}` : ''}`);
}

// ---- local tiers, one after the other (they share the stack; the full tier resets its store) ---------------
const webOk = await run('web-full', process.execPath, [path.join(e2eDir, 'run.mjs'), 'full'], e2eDir);
const androidOk = args.has('--no-android') ? true : await run('android-full', process.execPath, [path.join(e2eDir, 'native/run.mjs'), 'full'], path.join(e2eDir, 'native'));

let iosOk = true;
if (iosRun) {
  log('waiting for the iOS workflow');
  const s = Date.now();
  const r = eas(['workflow:status', iosRun, '--wait', '--non-interactive', '--json']);
  let status = '';
  try { const j = JSON.parse(r.stdout); status = String(j.status ?? j.workflowRun?.status ?? ''); } catch { status = r.stdout.match(/\b(SUCCESS|FAILURE|CANCELED)\b/)?.[1] ?? ''; }
  // `eas workflow:status` exit codes are undocumented: trust only an explicit SUCCESS.
  iosOk = status.toUpperCase() === 'SUCCESS';
  runs['ios-eas'] = { pass: iosOk, status: status || `unknown (exit ${r.status})`, id: iosRun, ms: Date.now() - s };
  log(`iOS workflow ${iosRun}: ${status || 'unknown'}`);
  if (!iosOk) console.error(r.stdout.slice(-2000), r.stderr.slice(-2000));
}

const pass = webOk && androidOk && iosOk;
fs.mkdirSync(path.dirname(verdictFile), { recursive: true });
fs.writeFileSync(verdictFile, `${JSON.stringify({ commit: head, pass, ios: Boolean(iosRun) && iosOk, android: !args.has('--no-android'), at: new Date().toISOString(), runs }, null, 2)}\n`);
log(`${pass ? 'PASS' : 'REFUSE'}: ${JSON.stringify(runs)}`);
if (pass) log('publish the OTA, then: gh workflow run yepwatch-smoke.yml -f reason="after OTA <message>"');
process.exit(pass ? 0 : 1);
