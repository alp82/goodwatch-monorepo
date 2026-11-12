#!/usr/bin/env node
// Checks run.mjs's credential scan on the paths that end a run early, with a synthetic secret (never the real
// smoke password). Each case copies run.mjs into a temp tree whose playwright is a fake that writes a malformed
// report and artifacts holding the secret, runs `run.mjs smoke --origin …`, and checks that the secret is in no
// output and no artifact left behind, and that `.sanitized` exists only when the scan finished clean.
//   node ci/check-artifact-sanitize.mjs [path/to/run.mjs]   exit 0 = all cases pass
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2e = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runMjs = path.resolve(process.argv[2] ?? path.join(e2e, 'run.mjs'));
const SECRET = `synthetic-${Math.random().toString(36).slice(2)}-pw`;

const FAKE_PW = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const secret = process.env.E2E_SMOKE_MEMBER_PASSWORD;
const out = process.env.E2E_OUT;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'error-context.md'), 'typed: ' + secret + '\\n');
fs.writeFileSync(path.join(out, 'shot.png'), Buffer.concat([Buffer.from([0x89, 0x50]), Buffer.from(secret)]));
if (process.env.FAKE_LOCKED) {
  const f = path.join(out, 'locked.txt');
  fs.writeFileSync(f, secret);
  fs.chmodSync(f, 0);
}
// Malformed: the parser's error message quotes this text.
fs.writeFileSync(process.env.E2E_REPORT, '{"tests": [{"error": "' + secret + '"');
process.exit(1);
`;

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yw-sanitize-'));
  const dir = path.join(root, 'e2e');
  fs.mkdirSync(path.join(dir, 'stack'), { recursive: true });
  fs.copyFileSync(runMjs, path.join(dir, 'run.mjs'));
  fs.copyFileSync(path.join(e2e, 'budgets.mjs'), path.join(dir, 'budgets.mjs'));
  fs.copyFileSync(path.join(e2e, 'stack', 'config.mjs'), path.join(dir, 'stack', 'config.mjs'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const bin = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'playwright'), FAKE_PW, { mode: 0o755 });
  return { root, dir, art: path.join(dir, 'artifacts', 'smoke') };
}

function filesHolding(dir) {
  if (!fs.existsSync(dir)) return [];
  const all = fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => path.join(d.parentPath, d.name));
  return all.filter((f) => {
    try {
      fs.chmodSync(f, 0o600);
      return fs.readFileSync(f).includes(SECRET);
    } catch {
      return true;
    }
  });
}

const cases = [
  { name: 'malformed report', env: {}, expectMarker: true },
  { name: 'malformed report + unreadable artifact (scan cannot finish)', env: { FAKE_LOCKED: '1' }, expectMarker: false, expectDeleted: true },
];
let failed = 0;
for (const c of cases) {
  const { root, dir, art } = tree();
  const r = spawnSync(process.execPath, [path.join(dir, 'run.mjs'), 'smoke', '--origin', 'https://example.invalid'], {
    cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, E2E_SMOKE_MEMBER_PASSWORD: SECRET, ...c.env },
  });
  const outputLeak = `${r.stdout}${r.stderr}`.includes(SECRET);
  const holding = filesHolding(art);
  const marker = fs.existsSync(path.join(art, '.sanitized'));
  const deleted = !fs.existsSync(art);
  const problems = [];
  if (outputLeak) problems.push('secret in run output');
  if (holding.length) problems.push(`${holding.length} artifact(s) still hold the secret`);
  if (marker !== c.expectMarker) problems.push(`.sanitized ${marker ? 'present' : 'missing'}`);
  if (c.expectDeleted && !deleted) problems.push('artifacts directory not deleted');
  if (r.status === 0) problems.push('run exited 0');
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${c.name}: exit ${r.status}, ${holding.length} file(s) holding secret, marker ${marker}, dir ${deleted ? 'deleted' : 'kept'}${problems.length ? ` — ${problems.join('; ')}` : ''}`);
  if (problems.length) failed++;
  fs.rmSync(root, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
