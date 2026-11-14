#!/usr/bin/env node
// Runs one E2E tier and writes artifacts/<tier>/report.json (machine-readable) + summary.md (human).
//   node run.mjs gate     each journey once (clean), core journeys under no-WebSocket and rapid taps,
//                         key timings x3, axe, then deploys and gateway restarts (realtime.spec). Target < 4 min.
//   node run.mjs full     every journey under all six faults (restart serially), timings x10, 6-person room.
//                         Target < 15 min.
//   node run.mjs smoke [--origin https://yepwatch.com]   guests only, production budgets + fast-4G throttling.
// Extra arguments after `--` go to Playwright (e.g. `node run.mjs gate -- --grep invite`).
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetsFor } from './budgets.mjs';
import { WINDOW_RUNS, historyLine, readHistory, timingStats } from './lib/timing-window.mjs';
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
const SECRETS = [process.env.E2E_SMOKE_MEMBER_PASSWORD].filter((v) => v && v.length >= 4);
let leaked = 0;
function scanSecrets(redact) {
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
    if (tier === 'gate') {
      phases.push(phase('gate', ['--project=none', '--project=nows', '--project=rapid', '--grep-invert', 'six people'], {
        E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '3', E2E_FAULT_GREP: '@core',
      }));
      // Deploys and gateway restarts (web/realtime.spec.ts, ~40 s): stack-wide, so alone and one at a time. Left out
      // when extra Playwright arguments pick tests (a --grep would find none here).
      if (!extra.length) phases.push(phase('restart', ['--project=restart', 'web/realtime.spec.ts'], { E2E_WORKERS: '1' }));
    } else if (tier === 'full') {
      // Each phase starts from an empty room store (~60 rooms each), so one phase's rooms can't affect the next.
      const groups = [['none', 'nows'], ['rapid', 'slow'], ['hidden', 'twodevice']];
      for (const [i, g] of groups.entries()) {
        if (i) reset();
        phases.push(phase(g.join('+'), g.map((f) => `--project=${f}`), { E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '10' }));
      }
      reset();
      // Stack-wide restarts disturb every room: alone, one test at a time.
      phases.push(phase('restart', ['--project=restart', '--grep-invert', 'six people|timing run'], { E2E_WORKERS: '1' }));
    } else {
      throw new RunError(`unknown tier ${tier}`);
    }
  }

  // ---- merge + budgets ------------------------------------------------------------------------------------
  const B = budgetsFor(tier === 'smoke' && originArg ? 'production' : 'local');
  const tests = phases.flatMap((p) => p.tests);
  const failures = [];
  for (const t of tests) {
    for (const g of t.gates) failures.push({ journey: t.journey, fault: t.fault, ...g, artifacts: t.artifacts });
    const journeyError = t.error && !/gate failure\(s\)/.test(t.error.split('\n')[0]);
    if (journeyError && !t.gates.some((g) => g.gate === 'journey'))
      failures.push({ journey: t.journey, fault: t.fault, gate: 'journey', person: '', detail: t.error.split('\n').filter(Boolean).slice(0, 3).join(' · ').slice(0, 400), artifacts: t.artifacts });
    if (t.status === 'timedOut') failures.push({ journey: t.journey, fault: t.fault, gate: 'journey', person: '', detail: `timed out after ${Math.round(t.durationMs / 1000)} s`, artifacts: t.artifacts });
  }
  const samples = new Map();
  for (const t of tests) for (const s of t.timings) {
    if (!samples.has(s.moment)) samples.set(s.moment, []);
    samples.get(s.moment).push({ ...s, journey: t.journey, fault: t.fault });
  }
  // Timing budgets apply to clean runs; fault runs are reported but not judged against them. A sample taken while
  // the runner itself was offline (lib/reachability.ts) measures the runner's network: left out, and listed below.
  const cleanOf = (moment, list) => list.filter((s) => !s.excluded && (s.fault === 'none' || s.fault === 'smoke' || tier === 'smoke' || moment === 'restartQueuedLandMs'));
  const own = Object.fromEntries([...samples].map(([moment, list]) => [moment, cleanOf(moment, list).map((s) => s.ms)]));
  // Smoke: a moment one run samples fewer than 20 times (create and Start: one room per run) takes its p95 over
  // this run plus earlier runs against the same origin (lib/timing-window.mjs). The history holds numbers only.
  const historyOrigin = tier === 'smoke' ? (originArg ?? ORIGINS.front) : null;
  const historyFile = process.env.E2E_SMOKE_HISTORY || path.join(here, 'artifacts', 'smoke-history.jsonl');
  let history = [];
  if (historyOrigin && fs.existsSync(historyFile)) history = readHistory(fs.readFileSync(historyFile, 'utf8'), historyOrigin);
  const stats = timingStats(own, history, Boolean(historyOrigin));
  const timing = {};
  for (const [moment, list] of samples) {
    const clean = cleanOf(moment, list);
    const st = stats[moment];
    const budget = B[moment];
    const pass = budget === undefined || st.p95 === null || st.p95 <= budget;
    timing[moment] = { samples: st.samples, runSamples: st.own, runs: st.runs, p50: st.p50, p95: st.p95, max: st.max, budget: budget ?? null, pass };
    if (!pass) {
      const worst = [...clean].sort((a, b) => b.ms - a.ms)[0];
      const over = st.runs > 1 ? `${st.samples} samples from the last ${st.runs} runs (this run: ${st.own}${worst ? `, worst ${worst.ms} ms` : ''})` : `${st.samples} samples`;
      failures.push({ journey: `(all, worst: ${worst?.journey ?? 'earlier runs'})`, fault: worst?.fault ?? 'smoke', gate: 'timing', person: worst?.person ?? '', detail: `${moment} p95 ${st.p95} ms over ${over} (p50 ${st.p50} ms, max ${st.max} ms${worst ? `; worst this run at ${worst.detail ?? ''}` : ''})`, measured: st.p95, budget, artifacts: [] });
    }
  }
  if (historyOrigin) {
    // Kept per origin, newest WINDOW_RUNS runs each; written whatever the run's outcome (its samples are real).
    const keep = fs.existsSync(historyFile) ? fs.readFileSync(historyFile, 'utf8').split('\n').filter(Boolean) : [];
    const lines = [...keep, historyLine(historyOrigin, own)];
    const byOrigin = new Map();
    for (const line of lines) {
      let o = '';
      try { o = JSON.parse(line).origin ?? ''; } catch { continue; }
      if (!byOrigin.has(o)) byOrigin.set(o, []);
      byOrigin.get(o).push(line);
    }
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    fs.writeFileSync(historyFile, `${[...byOrigin.values()].flatMap((l) => l.slice(-WINDOW_RUNS)).join('\n')}\n`);
  }
  const wallClockMs = Date.now() - t0;
  const report = {
    tier, startedAt: new Date(t0).toISOString(), wallClockMs, target: B.target,
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
  lines.push('## Timing (p95 vs budget, clean runs)', '', '| moment | samples | runs | p50 | p95 | budget | |', '|---|---|---|---|---|---|---|');
  for (const [m, v] of Object.entries(timing)) lines.push(`| ${m} | ${v.samples}${v.runs > 1 ? ` (${v.runSamples} this run)` : ''} | ${v.runs} | ${v.p50 ?? '-'} | ${v.p95 ?? '-'} | ${v.budget ?? '-'} | ${v.pass ? 'ok' : 'FAIL'} |`);
  if (historyOrigin) lines.push('', `Moments with fewer than 20 samples in this run take their p95 over the newest earlier runs against this origin as well (up to ${WINDOW_RUNS} runs or 20 samples): ${path.relative(here, historyFile)}.`);
  const stretches = tests.flatMap((t) => (t.reachability?.stretches ?? []).map((s) => ({ ...s, journey: t.journey })));
  const excused = tests.flatMap((t) => t.reachability?.excused ?? []);
  const excluded = [...samples.values()].flat().filter((s) => s.excluded);
  if (stretches.length || excluded.length || excused.length) {
    const clock = (t) => new Date(t).toISOString().slice(11, 23);
    lines.push('', '## Runner network', '', 'Stretches in which YepWatch did not answer the runner. `runner`: the reference did not answer either (the runner was offline; judged as an outage, overlapping samples and transport errors left out). `yepwatch`: the reference answered, or YepWatch answered 5xx (a failure).', '');
    for (const s of stretches) lines.push(`- ${s.kind}${s.why ? ` (${s.why})` : ''}: ${clock(s.start)}–${clock(s.end)} UTC (${Math.round(s.end - s.start)} ms) in ${s.journey}`);
    for (const s of excluded) lines.push(`- left out: ${s.moment} ${s.ms} ms (${s.person}, ${s.detail ?? ''}): ${s.excluded}`);
    for (const e of excused) lines.push(`- error left out: ${e}`);
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
  // Playwright's own line can say "passed": budgets are judged here, across the run's samples, after it ends.
  for (const [m, v] of Object.entries(timing)) if (!v.pass) log(`FAIL ${m}: p95 ${v.p95} ms over budget ${v.budget} ms (${v.samples} samples)`);
  for (const t of tests) for (const s of t.reachability?.stretches ?? []) if (s.kind === 'runner') log(`runner offline ${Math.round(s.end - s.start)} ms from ${new Date(s.start).toISOString().slice(11, 23)} UTC: judged as an outage, overlapping samples left out (summary.md)`);
  if (failures.length || report.failed) log(`FAILED: ${report.failed} test(s), ${failures.length} gate failure(s)`);
  return failures.length || report.failed ? 1 : 0;
}
