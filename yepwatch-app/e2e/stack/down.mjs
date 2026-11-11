#!/usr/bin/env node
// Stops the E2E stack. Default: stop the supervisor's Node children and Caddy, keep Valkey + Crate warm.
//   node e2e/stack/down.mjs          stop supervisor + caddy
//   node e2e/stack/down.mjs --all    also remove the Valkey and Crate containers
import fs from 'node:fs';
import { CONTAINERS, ORIGINS, PORTS, STATE_FILE } from './config.mjs';
import { containersDown, exists, portOpen, waitFor } from './docker.mjs';
import { execFileSync } from 'node:child_process';

try {
  await fetch(`${ORIGINS.control}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(15000) });
  await waitFor(async () => !(await portOpen(PORTS.control)), 'supervisor exit', 15000);
  console.log('[stack] supervisor stopped');
} catch {
  console.log('[stack] no supervisor running');
}
if (process.argv.includes('--all')) {
  containersDown();
  console.log('[stack] containers removed');
} else if (exists(CONTAINERS.caddy)) {
  execFileSync('docker', ['rm', '-f', CONTAINERS.caddy], { stdio: 'ignore' });
  console.log('[stack] caddy stopped (valkey + crate kept warm; --all removes them)');
}
fs.rmSync(STATE_FILE, { force: true });
