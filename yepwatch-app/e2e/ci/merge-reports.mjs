#!/usr/bin/env node
// Merges the web CI shards' report.json files (artifacts/<tier>/report.json of each CI shard) into one
// verdict: every gate failure from every shard, wall clock per shard. No speed (README "Speed and smoothness,
// on demand"). Writes merged report.json + summary.md and appends to $GITHUB_STEP_SUMMARY.
//
//   node e2e/ci/merge-reports.mjs <dir-with-shard-reports> [--out <dir>] [--expect <shards>]
//
// --expect N fails the merge when fewer than N shard reports arrived (a shard that crashed before writing one).
import fs from 'node:fs';
import path from 'node:path';

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

const tests = shards.flatMap((s) => s.results);
const failures = shards.flatMap((s) => s.failures);
const failed = tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');
if (shards.length < expect) failures.push({ journey: '(shards)', fault: '-', gate: 'journey', person: '', detail: `only ${shards.length} of ${expect} shard reports arrived: a shard crashed before reporting (see its job log)` });
const pass = failures.length === 0 && failed.length === 0;
const merged = {
  tier: shards[0]?.tier ?? 'ci', shards: shards.map((s) => ({ file: path.relative(root, s.file), tests: s.tests, failed: s.failed, wallClockMs: s.wallClockMs })),
  wallClockMaxMs: Math.max(...shards.map((s) => s.wallClockMs)), tests: tests.length, failed: failed.length, pass, failures,
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'merged-report.json'), JSON.stringify(merged, null, 1));

const L = [`## Web E2E: ${pass ? 'PASS' : 'FAIL'} — ${failed.length}/${tests.length} tests failed, ${failures.length} gate failures, ${shards.length} shards (slowest ${(merged.wallClockMaxMs / 1000).toFixed(0)} s)`, ''];
const byGate = new Map();
for (const f of failures) { if (!byGate.has(f.gate)) byGate.set(f.gate, []); byGate.get(f.gate).push(f); }
for (const [gate, list] of byGate) {
  L.push('', `### ${gate} (${list.length})`, '');
  for (const f of list.slice(0, 25)) L.push(`- ${f.journey} [${f.fault}] **${f.person || '-'}**: ${String(f.detail).slice(0, 300)}`);
  if (list.length > 25) L.push(`- … ${list.length - 25} more in merged-report.json`);
}
L.push('', `Shards: ${merged.shards.map((s) => `${(s.wallClockMs / 1000).toFixed(0)} s`).join(', ')}`);
const md = `${L.join('\n')}\n`;
fs.writeFileSync(path.join(out, 'merged-summary.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
process.exit(pass ? 0 : 1);
