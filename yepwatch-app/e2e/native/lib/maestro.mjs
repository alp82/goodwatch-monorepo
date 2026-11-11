// Runs the Maestro YAML flows (flows/) on one phone. Maestro starts its own session of the same on-device
// server the Phone driver uses, so the Phone reconnects afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_DIR, mkdirp, runLogged, toolEnv, tools } from './env.mjs';

export async function runFlows(phone, flows, runDir, env = {}) {
  const out = mkdirp(path.join(runDir, 'maestro'));
  const results = []; const failed = [];
  phone.close();
  for (const f of flows) {
    const started = Date.now();
    const code = await runLogged(tools.maestro(), ['--device', phone.serial, 'test', '--no-reinstall-driver', '--test-output-dir', path.join(out, path.basename(f, '.yaml')),
      ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), path.join(NATIVE_DIR, 'flows', f)], { log: path.join(out, `${path.basename(f, '.yaml')}.log`), env: toolEnv() });
    results.push({ flow: f, pass: code === 0, ms: Date.now() - started });
    if (code) failed.push(f);
  }
  await phone.start();
  return { pass: failed.length === 0, failed, results };
}
