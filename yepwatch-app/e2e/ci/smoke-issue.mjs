#!/usr/bin/env node
// Production smoke → GitHub issue (label `yepwatch-e2e`), via the gh CLI (GH_TOKEN with issues: write).
//
//   node e2e/ci/smoke-issue.mjs fail <report.json> [--reason "after deploy abc123"]
//       opens "YepWatch production smoke is failing", or reopens it, and comments with the failing gates,
//       measurements and the run link
//   node e2e/ci/smoke-issue.mjs pass <report.json>
//       comments "passing again" and closes the issue if it is open; does nothing otherwise
//
// One issue for the whole smoke: repeated failures become comments, not new issues.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [mode, file] = process.argv.slice(2);
const reason = process.argv.includes('--reason') ? process.argv[process.argv.indexOf('--reason') + 1] : '';
const LABEL = 'yepwatch-e2e';
const TITLE = 'YepWatch production smoke is failing';
const repo = process.env.GITHUB_REPOSITORY ?? 'alp82/goodwatch-monorepo';
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '(local run)';
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

const report = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
function body() {
  const L = [`**${mode === 'fail' ? 'Failed' : 'Passed'}** ${new Date().toISOString()}${reason ? ` (${reason})` : ''} — [run and artifacts](${runUrl})`, ''];
  if (!report) { L.push('No report.json: the smoke did not get far enough to write one (see the run log).'); return L.join('\n'); }
  L.push(`${report.failed}/${report.tests} tests failed, ${report.failures.length} gate failures, ${(report.wallClockMs / 1000).toFixed(0)} s wall clock.`, '');
  if (report.failures.length) {
    L.push('| gate | person | detail | measured | budget |', '|---|---|---|---|---|');
    for (const f of report.failures.slice(0, 20)) L.push(`| ${f.gate} | ${f.person || '-'} | ${String(f.detail).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300)} | ${f.measured ?? ''} | ${f.budget ?? ''} |`);
    L.push('');
  }
  L.push('| moment | samples | p50 | p95 | target (fast 4G, reported) | ceiling (gate) |', '|---|---|---|---|---|---|');
  for (const [m, v] of Object.entries(report.timing ?? {})) L.push(`| ${m} | ${v.samples} | ${v.p50 ?? '-'} | ${v.p95 ?? '-'} | ${v.target ?? '-'} | ${v.ceiling ?? 'not gated'}${v.pass ? '' : ' **FAIL**'} |`);
  return L.join('\n');
}

const found = JSON.parse(gh('issue', 'list', '-R', repo, '--label', LABEL, '--state', 'all', '--search', `"${TITLE}" in:title`, '--json', 'number,state,title', '--limit', '5') || '[]')
  .find((i) => i.title === TITLE);
const tmp = `${process.env.RUNNER_TEMP ?? '/tmp'}/smoke-issue-${process.pid}.md`;
fs.writeFileSync(tmp, body());
if (mode === 'fail') {
  try { gh('label', 'create', LABEL, '-R', repo, '--color', 'B60205', '--description', 'YepWatch E2E smoke/gate failures'); } catch { /* exists */ }
  if (!found) {
    console.log(gh('issue', 'create', '-R', repo, '--title', TITLE, '--label', LABEL, '--body-file', tmp));
  } else {
    if (found.state !== 'OPEN') gh('issue', 'reopen', String(found.number), '-R', repo);
    console.log(gh('issue', 'comment', String(found.number), '-R', repo, '--body-file', tmp));
  }
} else if (mode === 'pass') {
  if (found?.state === 'OPEN') {
    gh('issue', 'comment', String(found.number), '-R', repo, '--body-file', tmp);
    gh('issue', 'close', String(found.number), '-R', repo, '--reason', 'completed');
    console.log(`closed #${found.number}`);
  }
} else {
  console.error('usage: smoke-issue.mjs fail|pass <report.json> [--reason text]');
  process.exit(2);
}
