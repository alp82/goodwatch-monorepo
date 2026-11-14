#!/usr/bin/env node
// Merges the web CI shards' report.json files (artifacts/<tier>/report.json of each CI shard) into one
// verdict: every gate failure from every shard, timing p95 recomputed over all samples (reported against the
// local targets, gated only on the hermetic ceilings, budgets.mjs), wall clock per shard. Writes merged
// report.json + summary.md and appends to $GITHUB_STEP_SUMMARY.
//
//   node e2e/ci/merge-reports.mjs <dir-with-shard-reports> [--out <dir>] [--expect <shards>]
//
// --expect N fails the merge when fewer than N shard reports arrived (a shard that crashed before writing one).
// Frame pacing is never a gate here: a frames failure (only `run.mjs frames` makes them) is listed as information.
import fs from 'node:fs';
import path from 'node:path';
import { budgetsFor, ceilingsFor } from '../budgets.mjs';

const args = process.argv.slice(2);
const root = args.find((a, i) => !a.startsWith('--') && !['--out', '--expect'].includes(args[i - 1]));
const expect = args.includes('--expect') ? Number(args[args.indexOf('--expect') + 1]) : 0;
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : root;
if (!root) { console.error('usage: merge-reports.mjs <dir> [--out dir] [--expect shards]'); process.exit(2); }

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'report.json') files.push(p);
  }
})(root);
if (!files.length) { console.error(`no report.json under ${root}`); process.exit(1); }
const shards = files.map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(f, 'utf8')) }));
const B = budgetsFor('local');
const C = ceilingsFor('local');

const tests = shards.flatMap((s) => s.results);
const failures = [];
const info = [];
for (const s of shards) for (const f of s.failures) {
  if (f.gate === 'timing') continue; // recomputed below over all shards
  (f.gate === 'frames' ? info : failures).push(f);
}
const pct = (vals, p) => { const v = [...vals].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const timing = {};
const samples = new Map();
for (const t of tests) for (const x of t.timings ?? []) {
  if (!(t.fault === 'none' || x.moment === 'restartQueuedLandMs')) continue;
  if (!samples.has(x.moment)) samples.set(x.moment, []);
  samples.get(x.moment).push({ ...x, journey: t.journey });
}
for (const [moment, list] of samples) {
  const ms = list.map((x) => x.ms);
  const p95 = pct(ms, 95);
  const target = B[moment];
  const ceiling = C[moment];
  timing[moment] = { samples: ms.length, p50: pct(ms, 50), p95, max: Math.max(...ms), target: target ?? null, onTarget: target === undefined || p95 <= target, ceiling: ceiling ?? null, pass: ceiling === undefined || p95 <= ceiling };
  if (ceiling !== undefined && p95 > ceiling) {
    const worst = [...list].sort((a, b) => b.ms - a.ms)[0];
    failures.push({ journey: `(all shards, worst: ${worst.journey})`, fault: 'none', gate: 'timing', person: worst.person, detail: `${moment} p95 ${p95} ms over ${ms.length} samples is past its ceiling (p50 ${timing[moment].p50} ms, max ${timing[moment].max} ms)`, measured: p95, budget: ceiling });
  }
}
const failed = tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');
if (shards.length < expect) failures.push({ journey: '(shards)', fault: '-', gate: 'journey', person: '', detail: `only ${shards.length} of ${expect} shard reports arrived: a shard crashed before reporting (see its job log)` });
const pass = failures.length === 0 && failed.length === 0;
const merged = {
  tier: shards[0]?.tier ?? 'ci', shards: shards.map((s) => ({ file: path.relative(root, s.file), tests: s.tests, failed: s.failed, wallClockMs: s.wallClockMs })),
  wallClockMaxMs: Math.max(...shards.map((s) => s.wallClockMs)), tests: tests.length, failed: failed.length, pass, timing, failures, informational: info,
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'merged-report.json'), JSON.stringify(merged, null, 1));

const L = [`## Web E2E: ${pass ? 'PASS' : 'FAIL'} — ${failed.length}/${tests.length} tests failed, ${failures.length} gate failures, ${shards.length} shards (slowest ${(merged.wallClockMaxMs / 1000).toFixed(0)} s)`, ''];
L.push('| moment | samples | p50 | p95 | target (reported) | | ceiling | gate |', '|---|---|---|---|---|---|---|---|');
for (const [m, v] of Object.entries(timing)) L.push(`| ${m} | ${v.samples} | ${v.p50} | ${v.p95} | ${v.target ?? '-'} | ${v.target === null ? '' : v.onTarget ? 'on target' : 'over target'} | ${v.ceiling ?? '-'} | ${v.ceiling === null ? 'reported' : v.pass ? 'ok' : 'FAIL'} |`);
const byGate = new Map();
for (const f of failures) { if (!byGate.has(f.gate)) byGate.set(f.gate, []); byGate.get(f.gate).push(f); }
for (const [gate, list] of byGate) {
  L.push('', `### ${gate} (${list.length})`, '');
  for (const f of list.slice(0, 25)) L.push(`- ${f.journey} [${f.fault}] **${f.person || '-'}**: ${String(f.detail).slice(0, 300)}`);
  if (list.length > 25) L.push(`- … ${list.length - 25} more in merged-report.json`);
}
if (info.length) L.push('', `### frames (${info.length}, information only)`, '', ...info.slice(0, 10).map((f) => `- ${f.journey}: ${String(f.detail).slice(0, 200)}`));
L.push('', `Shards: ${merged.shards.map((s) => `${(s.wallClockMs / 1000).toFixed(0)} s`).join(', ')}`);
const md = `${L.join('\n')}\n`;
fs.writeFileSync(path.join(out, 'merged-summary.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
process.exit(pass ? 0 : 1);
