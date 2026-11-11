#!/usr/bin/env node
// Cache keys for the CI jobs, written to $GITHUB_OUTPUT (or printed). Same inputs the harness itself hashes,
// so a cache hit is exactly the harness's own "nothing changed".
//   native_key   e2e/native/lib/build.mjs nativeKey(): Gradle-level inputs of the release APK
//   playwright   installed @playwright/test version (browser cache)
//   cpu          CPU model + flags digest: emulator snapshots only load on the CPU family that saved them
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../..');
const out = {};
const want = new Set(process.argv.slice(2));
const all = want.size === 0;

if (all || want.has('native_key')) {
  const { nativeKey } = await import('../native/lib/build.mjs');
  out.native_key = nativeKey();
}
if (all || want.has('playwright')) {
  const require = createRequire(path.join(appDir, 'package.json'));
  out.playwright = require('@playwright/test/package.json').version;
}
if (all || want.has('cpu')) {
  const info = fs.existsSync('/proc/cpuinfo') ? fs.readFileSync('/proc/cpuinfo', 'utf8') : '';
  const model = info.match(/^model name\s*:\s*(.*)$/m)?.[1] ?? 'unknown';
  const flags = info.match(/^flags\s*:\s*(.*)$/m)?.[1] ?? '';
  out.cpu = crypto.createHash('sha256').update(`${model}|${flags}`).digest('hex').slice(0, 12);
  out.cpu_model = model.replace(/[^\w .@-]/g, '');
}
const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
