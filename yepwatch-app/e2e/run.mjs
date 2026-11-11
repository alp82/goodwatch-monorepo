#!/usr/bin/env node
// Runs one E2E tier and writes artifacts/<tier>/report.json (machine-readable) + summary.md (human).
//   node run.mjs gate     each journey once (clean), core journeys under no-WebSocket and rapid taps,
//                         key timings x3, axe. Target < 4 min.
//   node run.mjs full     every journey under all six faults (restart serially), timings x10, 6-person room.
//                         Target < 15 min.
//   node run.mjs smoke [--origin https://yepwatch.com]   guests only, production budgets + fast-4G throttling.
// Extra arguments after `--` go to Playwright (e.g. `node run.mjs gate -- --grep invite`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetsFor } from './budgets.mjs';

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

const PW = path.join(here, '..', 'node_modules', '.bin', 'playwright');
function phase(name, args, env) {
  log(`phase ${name}: playwright ${args.join(' ')}`);
  const report = path.join(out, `raw-${name}.json`);
  const r = spawnSync(PW, ['test', ...args, ...extra], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, CI: '1', E2E_REPORT: report, E2E_OUT: path.join(out, `results-${name}`), ...env },
  });
  if (!fs.existsSync(report)) throw new Error(`phase ${name} produced no report (exit ${r.status})`);
  return JSON.parse(fs.readFileSync(report, 'utf8'));
}

const phases = [];
if (tier === 'smoke') {
  const origin = originArg ?? null;
  if (!origin) {
    const up = spawnSync(process.execPath, [path.join(here, 'stack/up.mjs')], { stdio: 'inherit' });
    if (up.status !== 0) process.exit(up.status ?? 1);
  }
  phases.push(phase('smoke', ['--config', 'playwright.smoke.config.ts'], {
    E2E_TARGET: origin ? 'production' : 'local', ...(origin ? { E2E_ORIGIN: origin } : {}), E2E_WORKERS: '4',
  }));
} else {
  const up = spawnSync(process.execPath, [path.join(here, 'stack/up.mjs'), '--reset'], { stdio: 'inherit' });
  if (up.status !== 0) process.exit(up.status ?? 1);
  if (tier === 'gate') {
    phases.push(phase('gate', ['--project=none', '--project=nows', '--project=rapid', '--grep-invert', 'six people'], {
      E2E_WORKERS: process.env.E2E_WORKERS ?? '10', E2E_TIMING_RUNS: '3', E2E_FAULT_GREP: '@core',
    }));
  } else if (tier === 'full') {
    phases.push(phase('parallel', ['--project=none', '--project=nows', '--project=rapid', '--project=slow', '--project=hidden', '--project=twodevice'], {
      E2E_WORKERS: process.env.E2E_WORKERS ?? '12', E2E_TIMING_RUNS: '10',
    }));
    // Stack-wide restarts disturb every room: alone, one test at a time.
    phases.push(phase('restart', ['--project=restart', '--grep-invert', 'six people|timing run'], { E2E_WORKERS: '1' }));
  } else {
    console.error(`unknown tier ${tier}`);
    process.exit(2);
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
const pct = (vals, p) => { const s = [...vals].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const timing = {};
for (const [moment, list] of samples) {
  // Timing budgets apply to clean runs; fault runs are reported but not judged against them.
  const clean = list.filter((s) => s.fault === 'none' || s.fault === 'smoke' || tier === 'smoke' || moment === 'restartQueuedLandMs');
  const values = clean.map((s) => s.ms);
  const budget = B[moment];
  const p95 = values.length ? pct(values, 95) : null;
  timing[moment] = { samples: values.length, p50: values.length ? pct(values, 50) : null, p95, max: values.length ? Math.max(...values) : null, budget: budget ?? null, pass: budget === undefined || p95 === null || p95 <= budget };
  if (budget !== undefined && p95 !== null && p95 > budget) {
    const worst = [...clean].sort((a, b) => b.ms - a.ms)[0];
    failures.push({ journey: `(all, worst: ${worst.journey})`, fault: worst.fault, gate: 'timing', person: worst.person, detail: `${moment} p95 ${p95} ms over ${values.length} samples (p50 ${timing[moment].p50} ms, max ${timing[moment].max} ms; worst at ${worst.detail ?? ''})`, measured: p95, budget, artifacts: [] });
  }
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
lines.push('## Timing (p95 vs budget, clean runs)', '', '| moment | samples | p50 | p95 | budget | |', '|---|---|---|---|---|---|');
for (const [m, v] of Object.entries(timing)) lines.push(`| ${m} | ${v.samples} | ${v.p50 ?? '-'} | ${v.p95 ?? '-'} | ${v.budget ?? '-'} | ${v.pass ? 'ok' : 'FAIL'} |`);
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
process.exit(failures.length || report.failed ? 1 : 0);
