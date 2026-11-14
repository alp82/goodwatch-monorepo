#!/usr/bin/env node
// Runs one E2E tier and writes artifacts/<tier>/report.json (machine-readable) + summary.md (human).
//   node run.mjs ci       what CI runs on every push (yepwatch-gate.yml): each journey once on the clean stack
//                         (no fault projects, no deploy/restart phase), axe. Shard with `-- --shard=1/3`.
//   node run.mjs gate     each journey once (clean), core journeys under no-WebSocket and rapid taps, axe, then
//                         deploys and gateway restarts (realtime.spec). Target < 4 min.
//   node run.mjs full     every journey under all six faults (restart serially), 6-person room. Target < 15 min.
//   node run.mjs smoke [--origin https://yepwatch.com]   one room: two guests and a GoodWatch member.
//   node run.mjs speed    on demand, on the owner's machine (GPU, otherwise idle): the clean journeys one at a time,
//                         timings x3, each moment's p95 vs its target (budgets.mjs) and frame pacing (no frame over
//                         frameMaxMs while something animates). Never part of CI. `-- --grep voting` narrows it.
// Only `speed` judges speed; every other tier judges behaviour (journey, errors, flash, words, axe).
// Extra arguments after `--` go to Playwright (e.g. `node run.mjs gate -- --grep invite`).
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { targets } from './budgets.mjs';
import { ORIGINS } from './stack/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const tier = argv[0] ?? 'gate';
const dash = argv.indexOf('--');
const extra = dash >= 0 ? argv.slice(dash + 1) : [];
const own = dash >= 0 ? argv.slice(1, dash) : argv.slice(1);
const originArg = own.includes('--origin') ? own[own.indexOf('--origin') + 1] : null;
const out = path.join(here, 'artifacts', tier);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (m) => console.log(`[e2e ${tier} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
// Written into `out` only after the credential scan finished clean; CI publishes and uploads only with it.
const SANITIZED = path.join(out, '.sanitized');
// Errors carry fixed messages: raw exception text (a JSON parse error quotes the report) could hold a secret.
class RunError extends Error {}

const PW = path.join(here, '..', 'node_modules', '.bin', 'playwright');
function phase(name, args, env) {
  log(`phase ${name}: playwright ${args.join(' ')}`);
  const report = path.join(out, `raw-${name}.json`);
  const r = spawnSync(PW, ['test', ...args, ...extra], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, CI: '1', E2E_REPORT: report, E2E_OUT: path.join(out, `results-${name}`), ...env },
  });
  if (!fs.existsSync(report)) throw new RunError(`phase ${name} produced no report (exit ${r.status})`);
  try {
    return JSON.parse(fs.readFileSync(report, 'utf8'));
  } catch {
    throw new RunError(`phase ${name} wrote a report that can't be read`);
  }
}

// ---- credentials never leave in artifacts ----------------------------------------------------------------
// CI uploads artifacts/<tier>. The smoke member's password can't be in them: the member is never traced or
// recorded, Playwright's failure aria snapshot is off (PLAYWRIGHT_NO_COPY_PROMPT, playwright/lib/index.js
// _takePageSnapshot), credential steps throw sanitized errors and the reporter redacts. This is the last check,
// and it runs however the run ends: any artifact still holding it is redacted (text) or deleted (binary, or a
// zip that can't be read), and the run fails. A second pass must then find nothing; if it does, or either pass
// can't finish, the whole artifacts directory is deleted. Only file paths are printed, never the password.
// Locally the smoke member comes from ~/.config/yepwatch/smoke-member.json ({ "email", "password" }) when the env
// pair isn't set (CI sets it from secrets). It goes on into the Playwright run through the same env, so the
// reporter's redaction and the scan below cover it exactly as in CI. Nothing about it is printed.
if (tier === 'smoke' && !process.env.E2E_SMOKE_MEMBER_EMAIL && !process.env.E2E_SMOKE_MEMBER_PASSWORD) {
  const file = path.join(os.homedir(), '.config', 'yepwatch', 'smoke-member.json');
  if (fs.existsSync(file)) {
    let member = null;
    try {
      member = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      member = null;
    }
    if (typeof member?.email !== 'string' || !member.email || typeof member?.password !== 'string' || !member.password) {
      console.error(`[e2e] ${file} needs string "email" and "password" fields`);
      process.exit(1);
    }
    process.env.E2E_SMOKE_MEMBER_EMAIL = member.email;
    process.env.E2E_SMOKE_MEMBER_PASSWORD = member.password;
    log(`smoke member from ${file.replace(os.homedir(), '~')}`);
  }
}
/** The kept smoke member session's cookie values (lib/smoke-session.ts), read at scan time: a run may renew them. */
function sessionSecrets() {
  try {
    const file = process.env.E2E_SMOKE_MEMBER_SESSION || path.join(os.homedir(), '.config', 'yepwatch', 'smoke-member-session.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).state.cookies.map((c) => c.value).filter((v) => typeof v === 'string' && v.length >= 16);
  } catch {
    return [];
  }
}
let leaked = 0;
function scanSecrets(redact) {
  const SECRETS = [process.env.E2E_SMOKE_MEMBER_PASSWORD, ...(tier === 'smoke' ? sessionSecrets() : [])].filter((v) => v && v.length >= 4);
  if (!SECRETS.length || !fs.existsSync(out)) return 0;
  const needles = SECRETS.flatMap((v) => [...new Set([v, JSON.stringify(v).slice(1, -1), encodeURIComponent(v)])]).map((v) => Buffer.from(v));
  const holds = (buf) => needles.some((n) => buf.includes(n));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  let hits = 0;
  for (const file of walk(out)) {
    const buf = fs.readFileSync(file);
    let hit = holds(buf);
    if (!hit && /\.zip$/i.test(file)) {
      // Traces are deflated: look inside. Unreadable → treated as holding it.
      const r = spawnSync('unzip', ['-p', file], { maxBuffer: 1 << 30 });
      hit = r.status !== 0 || !r.stdout || holds(r.stdout);
    }
    if (!hit) continue;
    hits++;
    if (!redact) continue;
    const text = /\.(json|md|txt|log|html|yml|yaml)$/i.test(file);
    if (text) {
      let body = buf.toString('utf8');
      for (const n of needles) body = body.split(n.toString('utf8')).join('[redacted]');
      fs.writeFileSync(file, body);
    } else fs.rmSync(file, { force: true });
    console.error(`[e2e] an artifact held a smoke credential and was ${text ? 'redacted' : 'deleted'}: ${path.relative(here, file)}`);
  }
  return hits;
}
function sanitize() {
  try {
    fs.rmSync(SANITIZED, { force: true });
    leaked += scanSecrets(true);
    if (scanSecrets(false)) throw new RunError('verify pass found a credential');
    if (fs.existsSync(out)) fs.writeFileSync(SANITIZED, '');
    return true;
  } catch {
    console.error('[e2e] the artifact credential scan could not finish clean: deleting all artifacts');
    try {
      fs.rmSync(out, { recursive: true, force: true });
    } catch {
      console.error('[e2e] could not delete the artifacts directory');
    }
    return false;
  }
}

let exitCode = 1;
try {
  exitCode = runTier();
} catch (e) {
  console.error(`[e2e] ${e instanceof RunError ? e.message : 'run failed with an unexpected error (details withheld: they could hold a credential)'}`);
  exitCode = 1;
} finally {
  if (!sanitize()) exitCode = 1;
  if (leaked) {
    console.error(`[e2e] ${leaked} artifact(s) held a smoke credential: failing the run`);
    exitCode = 1;
  }
}
process.exit(exitCode);

function runTier() {
  const phases = [];
  function reset() {
    const r = spawnSync('curl', ['-s', '-X', 'POST', `${ORIGINS.control}/reset`], { encoding: 'utf8' });
    log(`store reset: ${r.stdout.trim()}`);
  }
  if (tier === 'smoke') {
    const origin = originArg ?? null;
    if (!origin) {
      const up = spawnSync(process.execPath, [path.join(here, 'stack/up.mjs')], { stdio: 'inherit' });
      if (up.status !== 0) throw new RunError(`stack up failed (exit ${up.status})`);
    }
    phases.push(phase('smoke', ['--config', 'playwright.smoke.config.ts'], {
      E2E_TARGET: origin ? 'production' : 'local', ...(origin ? { E2E_ORIGIN: origin } : {}), E2E_WORKERS: '4',
      // No failure aria snapshot in error-context.md: it would hold the member's typed form values.
      PLAYWRIGHT_NO_COPY_PROMPT: '1',
    }));
  } else {
    const up = spawnSync(process.execPath, [path.join(here, 'stack/up.mjs'), '--reset'], { stdio: 'inherit' });
    if (up.status !== 0) throw new RunError(`stack up failed (exit ${up.status})`);
    if (tier === 'ci') {
      phases.push(phase('ci', ['--project=none', '--grep-invert', 'six people'], {
        E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '1',
      }));
    } else if (tier === 'speed') {
      phases.push(phase('speed', ['--project=none', '--grep-invert', 'six people'], {
        E2E_WORKERS: process.env.E2E_WORKERS ?? '1', E2E_TIMING_RUNS: '3', E2E_FRAMES: 'gate',
      }));
    } else if (tier === 'gate') {
      phases.push(phase('gate', ['--project=none', '--project=nows', '--project=rapid', '--grep-invert', 'six people'], {
        E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '1', E2E_FAULT_GREP: '@core',
      }));
      // Deploys and gateway restarts (web/realtime.spec.ts, ~40 s): stack-wide, so alone and one at a time. Left out
      // when extra Playwright arguments pick tests (a --grep would find none here).
      if (!extra.length) phases.push(phase('restart', ['--project=restart', 'web/realtime.spec.ts'], { E2E_WORKERS: '1' }));
    } else if (tier === 'full') {
      // Each phase starts from an empty room store (~60 rooms each), so one phase's rooms can't affect the next.
      const groups = [['none', 'nows'], ['rapid', 'slow'], ['hidden', 'twodevice']];
      for (const [i, g] of groups.entries()) {
        if (i) reset();
        phases.push(phase(g.join('+'), g.map((f) => `--project=${f}`), { E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '1' }));
      }
      reset();
      // Stack-wide restarts disturb every room: alone, one test at a time.
      phases.push(phase('restart', ['--project=restart', '--grep-invert', 'six people|timing run'], { E2E_WORKERS: '1' }));
    } else {
      throw new RunError(`unknown tier ${tier}`);
    }
  }

  // ---- merge ---------------------------------------------------------------------------------------------
  const tests = phases.flatMap((p) => p.tests);
  const failures = [];
  for (const t of tests) {
    for (const g of t.gates) failures.push({ journey: t.journey, fault: t.fault, ...g, artifacts: t.artifacts });
    const journeyError = t.error && !/gate failure\(s\)/.test(t.error.split('\n')[0]);
    if (journeyError && !t.gates.some((g) => g.gate === 'journey'))
      failures.push({ journey: t.journey, fault: t.fault, gate: 'journey', person: '', detail: t.error.split('\n').filter(Boolean).slice(0, 3).join(' · ').slice(0, 400), artifacts: t.artifacts });
    if (t.status === 'timedOut') failures.push({ journey: t.journey, fault: t.fault, gate: 'journey', person: '', detail: `timed out after ${Math.round(t.durationMs / 1000)} s`, artifacts: t.artifacts });
  }
  // Speed (the `speed` tier only): each moment's p95 over the run's samples against its target.
  const timing = {};
  if (tier === 'speed') {
    const samples = new Map();
    for (const t of tests) for (const s of t.timings) samples.set(s.moment, [...(samples.get(s.moment) ?? []), s.ms]);
    const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
    for (const [moment, list] of samples) {
      const ms = [...list].sort((a, b) => a - b);
      const target = targets[moment] ?? null;
      const p95 = pct(ms, 95);
      timing[moment] = { samples: ms.length, p50: pct(ms, 50), p95, max: ms.at(-1), target, onTarget: target === null || p95 <= target };
      if (!timing[moment].onTarget) failures.push({ journey: '(all)', fault: 'none', gate: 'speed', person: '', detail: `${moment} p95 ${p95} ms over its ${target} ms target (${ms.length} samples, p50 ${timing[moment].p50} ms, max ${ms.at(-1)} ms)`, artifacts: [] });
    }
  }
  const wallClockMs = Date.now() - t0;
  const report = {
    tier, startedAt: new Date(t0).toISOString(), wallClockMs,
    tests: tests.length, passed: tests.filter((t) => t.status === 'passed').length, failed: tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped').length,
    timing, failures, results: tests,
  };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));

  // ---- human summary --------------------------------------------------------------------------------------
  const byGate = new Map();
  for (const f of failures) {
    if (!byGate.has(f.gate)) byGate.set(f.gate, []);
    byGate.get(f.gate).push(f);
  }
  const lines = [`# YepWatch E2E ${tier}: ${report.failed}/${report.tests} tests failed, ${failures.length} gate failures, ${(wallClockMs / 1000).toFixed(0)} s wall clock`, ''];
  if (tier === 'speed') {
    lines.push('## Speed (p95 vs target, budgets.mjs)', '', '| moment | samples | p50 | p95 | max | target | |', '|---|---|---|---|---|---|---|');
    for (const [m, v] of Object.entries(timing)) lines.push(`| ${m} | ${v.samples} | ${v.p50} | ${v.p95} | ${v.max} | ${v.target ?? '-'} | ${v.target === null ? '' : v.onTarget ? 'ok' : 'OVER'} |`);
  }
  const stretches = tests.flatMap((t) => (t.reachability?.stretches ?? []).map((s) => ({ ...s, journey: t.journey })));
  const excused = tests.flatMap((t) => t.reachability?.excused ?? []);
  if (stretches.length || excused.length) {
    const clock = (t) => new Date(t).toISOString().slice(11, 23);
    lines.push('', '## Runner network', '', 'Stretches in which YepWatch did not answer the runner. `runner`: the reference did not answer either (the runner was offline; judged as an outage, overlapping transport errors left out). `yepwatch (HTTP 5xx)`: a failure. `yepwatch (no answer)`: the reference answered but YepWatch held the probe past 1 s (a deploy holds requests): reported only, and no outage for the room’s words.', '');
    for (const s of stretches) lines.push(`- ${s.kind}${s.why ? ` (${s.why})` : ''}: ${clock(s.start)}–${clock(s.end)} UTC (${Math.round(s.end - s.start)} ms) in ${s.journey}`);
    for (const e of excused) lines.push(/reported, not gated/.test(e) ? `- ${e}` : `- error left out: ${e}`);
  }
  for (const [gate, list] of byGate) {
    lines.push('', `## ${gate} (${list.length})`, '');
    // Same detail across journeys/faults → one line with counts.
    const groups = new Map();
    for (const f of list) {
      const key = `${f.detail.replace(/[A-Za-z0-9_-]{32}/g, '<room>').replace(/"[^"]*\d+"/g, '"…"').replace(/\d+(\.\d+)? ms/g, 'N ms')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    for (const [, g] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      const f = g[0];
      const where = [...new Set(g.map((x) => `${x.journey} [${x.fault}]`))];
      lines.push(`- **${f.person || '-'}**: ${f.detail}${f.measured !== undefined ? ` — measured ${f.measured}, budget ${f.budget}` : ''}`);
      lines.push(`  - ${g.length}× in: ${where.slice(0, 4).join('; ')}${where.length > 4 ? `; +${where.length - 4} more` : ''}`);
      const art = f.artifacts?.find((a) => /trace|\.zip/.test(a));
      if (art) lines.push(`  - trace: ${path.relative(here, art)}`);
    }
  }
  fs.writeFileSync(path.join(out, 'summary.md'), `${lines.join('\n')}\n`);
  log(`done in ${(wallClockMs / 1000).toFixed(0)} s → ${path.relative(process.cwd(), path.join(out, 'summary.md'))}, report.json`);
  // Playwright's own line can say "passed": speed is judged here, across the run's samples, after it ends.
  for (const [m, v] of Object.entries(timing)) log(`${v.onTarget ? 'ok  ' : 'OVER'} ${m}: p95 ${v.p95} ms${v.target === null ? '' : ` (target ${v.target})`}, ${v.samples} samples`);
  for (const t of tests) for (const s of t.reachability?.stretches ?? []) if (s.kind === 'runner') log(`runner offline ${Math.round(s.end - s.start)} ms from ${new Date(s.start).toISOString().slice(11, 23)} UTC: judged as an outage (summary.md)`);
  if (failures.length || report.failed) log(`FAILED: ${report.failed} test(s), ${failures.length} gate failure(s)`);
  return failures.length || report.failed ? 1 : 0;
}
