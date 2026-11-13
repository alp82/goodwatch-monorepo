// Disposable loopback containers: Valkey (cluster mode, one node owning all slots), Crate (single node) and
// Caddy (the production Caddyfile with loopback upstreams). Reused when already running.
import { execFileSync, spawnSync } from 'node:child_process';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { CONTAINERS, IMAGES, PORTS, SECRETS } from './config.mjs';

const docker = (args, opts = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
export const running = (name) => {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === 'true';
};
export const exists = (name) => spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0;

export function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.setTimeout(500, () => { s.destroy(); resolve(false); });
  });
}
export async function waitFor(check, label, timeoutMs = 60000, everyMs = 200) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { if (await check()) return; } catch { /* not yet */ }
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

/** Refuse to use a port held by something that isn't ours. */
async function claim(port, name) {
  if (running(name)) return true;
  if (exists(name)) docker(['rm', '-f', name]);
  if (await portOpen(port)) throw new Error(`port ${port} is in use by another process; not ours (${name}), refusing`);
  return false;
}

export async function valkeyUp() {
  const name = CONTAINERS.valkey;
  if (!(await claim(PORTS.valkey, name))) {
    docker(['run', '-d', '--rm', '--name', name, '--label', 'yw-e2e=1', '--network', 'host', IMAGES.valkey, 'valkey-server',
      '--port', String(PORTS.valkey), '--bind', '127.0.0.1', '--cluster-enabled', 'yes', '--cluster-announce-ip', '127.0.0.1',
      '--save', '', '--appendonly', 'no']);
    await waitFor(() => docker(['exec', name, 'valkey-cli', '-p', String(PORTS.valkey), 'ping']) === 'PONG', 'valkey', 20000);
  }
  const info = docker(['exec', name, 'valkey-cli', '-p', String(PORTS.valkey), 'cluster', 'info']);
  if (!/cluster_state:ok/.test(info)) {
    if (/cluster_slots_assigned:0/.test(info)) docker(['exec', name, 'valkey-cli', '-p', String(PORTS.valkey), 'cluster', 'addslotsrange', '0', '16383']);
    await waitFor(() => /cluster_state:ok/.test(docker(['exec', name, 'valkey-cli', '-p', String(PORTS.valkey), 'cluster', 'info'])), 'valkey cluster ok', 20000);
  }
}

/** The rooms Valkey as production runs it: standalone, noeviction, AOF, password derived from the room key. */
export async function roomsUp() {
  const name = CONTAINERS.rooms;
  if (await claim(PORTS.rooms, name)) return;
  const password = createHash('sha256').update(`yepwatch-rooms-valkey:${SECRETS.room}`).digest('hex');
  docker(['run', '-d', '--rm', '--name', name, '--label', 'yw-e2e=1', '--network', 'host', IMAGES.rooms, 'valkey-server',
    '--port', String(PORTS.rooms), '--bind', '127.0.0.1', '--requirepass', password, '--appendonly', 'yes',
    '--appendfsync', 'everysec', '--save', '', '--maxmemory', '256mb', '--maxmemory-policy', 'noeviction']);
  await waitFor(() => /PONG/.test(docker(['exec', name, 'valkey-cli', '-p', String(PORTS.rooms), '--no-auth-warning', '-a', password, 'ping'])), 'rooms valkey', 20000);
}

export async function crateUp() {
  const name = CONTAINERS.crate;
  if (!(await claim(PORTS.crateHttp, name))) {
    docker(['run', '-d', '--rm', '--name', name, '--label', 'yw-e2e=1', '--network', 'host', '-e', 'CRATE_HEAP_SIZE=1g', IMAGES.crate,
      '-Cnetwork.host=127.0.0.1', '-Cdiscovery.type=single-node', `-Chttp.port=${PORTS.crateHttp}`,
      `-Ctransport.tcp.port=${PORTS.crateTransport}`, `-Cpsql.port=${PORTS.cratePsql}`, '-Ccluster.name=yw-e2e',
      '-Cstats.enabled=false', '-Cudc.enabled=false']);
  }
  await waitFor(async () => {
    const r = await fetch(`http://127.0.0.1:${PORTS.crateHttp}/_sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"stmt":"SELECT 1"}' });
    return r.ok;
  }, 'crate', 90000, 300);
}

export async function caddyUp(caddyfile, webDir) {
  const name = CONTAINERS.caddy;
  // The web export changes with the app source: always recreate so it serves the current export.
  if (exists(name)) docker(['rm', '-f', name]);
  if (await portOpen(PORTS.front)) throw new Error(`port ${PORTS.front} is in use by another process; refusing`);
  docker(['run', '-d', '--rm', '--name', name, '--label', 'yw-e2e=1', '--network', 'host', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${caddyfile}:/etc/caddy/Caddyfile:ro`, '-v', `${webDir}:/srv:ro`, '-e', 'XDG_DATA_HOME=/tmp', '-e', 'XDG_CONFIG_HOME=/tmp',
    IMAGES.caddy, 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']);
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORTS.front}/`)).ok, 'caddy', 20000, 100);
}

export function containersDown() {
  for (const name of Object.values(CONTAINERS)) if (exists(name)) docker(['rm', '-f', name]);
}
