#!/usr/bin/env node
// Brings the E2E stack up (or confirms a warm one) and writes e2e/.stack.json with every origin.
//   node e2e/stack/up.mjs [--reset] [--rebuild]
// Components: Valkey (cluster) + Crate in Docker, fakes + API + gateway under the supervisor, Caddy in Docker
// serving the web export with the production route table. All loopback, ports 18379-18490.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, CONTAINERS, E2E_DIR, ORIGINS, PORTS, REPO_DIR, STATE_FILE } from './config.mjs';
import { buildApi, buildGateway, buildWeb } from './build.mjs';
import { caddyUp, crateUp, portOpen, valkeyUp, waitFor, running } from './docker.mjs';
import { cleanEnv } from './safe-env.mjs';

const t0 = Date.now();
const args = new Set(process.argv.slice(2));
const log = (m) => console.log(`[stack ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
if (args.has('--rebuild')) for (const f of fs.readdirSync(CACHE_DIR, { withFileTypes: true })) if (f.name.endsWith('.hash')) fs.rmSync(path.join(CACHE_DIR, f.name));

function caddyfile() {
  const source = fs.readFileSync(path.join(REPO_DIR, 'yepwatch-realtime/release/Caddyfile'), 'utf8');
  const out = source
    .replace(/^:8080 \{/m, `:${PORTS.front} {\n  bind 127.0.0.1`)
    .replaceAll('gateway:4311', `127.0.0.1:${PORTS.gatewayProxy}`)
    .replaceAll('api:3000', `127.0.0.1:${PORTS.apiProxy}`);
  if (out.includes(':8080') || out.includes('api:3000') || out.includes('gateway:4311')) throw new Error('Caddyfile rewrite incomplete');
  const file = path.join(CACHE_DIR, 'Caddyfile');
  fs.writeFileSync(file, out);
  return file;
}

async function controlStatus() {
  try {
    const r = await fetch(`${ORIGINS.control}/status`, { signal: AbortSignal.timeout(2000) });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

const [api, gateway] = await Promise.all([buildApi(log), Promise.resolve(buildGateway(log))]);
const web = buildWeb(log);
await Promise.all([valkeyUp(), crateUp()]);
log('valkey + crate up');

let status = await controlStatus();
const stale = api.built || gateway.built;
if (status && stale) {
  log('bundles changed: restarting supervisor');
  await fetch(`${ORIGINS.control}/shutdown`, { method: 'POST' }).catch(() => {});
  await waitFor(async () => !(await portOpen(PORTS.control)), 'supervisor exit', 15000);
  status = null;
}
if (!status) {
  for (const port of [PORTS.control, PORTS.api, PORTS.gateway, PORTS.apiProxy, PORTS.gatewayProxy, PORTS.issuer, PORTS.search, PORTS.images])
    if (await portOpen(port)) throw new Error(`port ${port} is held by a process that isn't this stack's supervisor; refusing to start`);
  // Store tables must exist before the API's readiness probe passes.
  const { spawnSync } = await import('node:child_process');
  const { SECRETS, WEBAPP_DIR, API_BUNDLE_DIR } = await import('./config.mjs');
  const env = cleanEnv({
    E2E_PUBLIC_ORIGIN: ORIGINS.front, E2E_CRATE_ORIGIN: ORIGINS.crate, E2E_ISSUER_ORIGIN: ORIGINS.issuer, E2E_IMAGES_ORIGIN: ORIGINS.images,
    YEPWATCH_SEARCH_URL: `${ORIGINS.search}/api/combined-search`, E2E_VALKEY_PORT: String(PORTS.valkey), E2E_ROOM_SECRET: SECRETS.room,
    E2E_KEY_ID: SECRETS.keyId, E2E_CLIENT_ID: SECRETS.clientId, E2E_GATEWAY_SECRET: SECRETS.gateway, E2E_API_PORT: String(PORTS.api),
  });
  const p = spawnSync(process.execPath, [path.join(API_BUNDLE_DIR, 'api.mjs'), args.has('--reset') ? 'reset' : 'provision'], { cwd: WEBAPP_DIR, env, encoding: 'utf8' });
  if (p.status !== 0) throw new Error(`provision failed: ${p.stderr || p.stdout}`);
  for (const f of ['supervisor.ready', 'supervisor.failed']) fs.rmSync(path.join(CACHE_DIR, f), { force: true });
  const out = fs.openSync(path.join(CACHE_DIR, 'supervisor.out'), 'a');
  const child = spawn(process.execPath, [path.join(E2E_DIR, 'stack/supervisor.mjs')], { detached: true, stdio: ['ignore', out, out], env: cleanEnv({}) });
  child.unref();
  await waitFor(() => fs.existsSync(path.join(CACHE_DIR, 'supervisor.ready')) || fs.existsSync(path.join(CACHE_DIR, 'supervisor.failed')), 'supervisor', 60000, 100);
  if (fs.existsSync(path.join(CACHE_DIR, 'supervisor.failed'))) throw new Error(`supervisor failed: ${fs.readFileSync(path.join(CACHE_DIR, 'supervisor.failed'), 'utf8')}`);
  log('supervisor up (fakes, api, gateway)');
} else {
  if (args.has('--reset')) await fetch(`${ORIGINS.control}/reset`, { method: 'POST' });
  // Clear any stack-wide faults a previous run left behind.
  await fetch(`${ORIGINS.control}/faults`, { method: 'POST', body: JSON.stringify({ wsBlocked: false, latencyMs: 0 }) });
  for (const name of ['fakes', 'api', 'gateway']) if (!status.children[name]?.healthy) await fetch(`${ORIGINS.control}/start/${name}`, { method: 'POST' });
  log('supervisor reused');
}

const caddyState = path.join(CACHE_DIR, 'caddy.web');
if (!running(CONTAINERS.caddy) || fs.readFileSync(caddyState, { encoding: 'utf8', flag: 'a+' }) !== web.out) {
  await caddyUp(caddyfile(), web.out);
  fs.writeFileSync(caddyState, web.out);
  log('caddy up');
}
await waitFor(async () => (await fetch(`${ORIGINS.front}/api/yepwatch/v1/proposal/health/ready`)).ok, 'api through caddy', 30000, 100);

const state = {
  front: ORIGINS.front,
  ws: `${ORIGINS.ws}/api/yepwatch/v1/proposal/realtime`,
  api: `${ORIGINS.front}/api/yepwatch/v1/proposal`,
  control: ORIGINS.control,
  issuer: ORIGINS.issuer,
  search: ORIGINS.search,
  images: ORIGINS.images,
  crate: ORIGINS.crate,
  valkey: `redis://127.0.0.1:${PORTS.valkey}`,
  webExport: web.out,
  logs: path.join(CACHE_DIR, 'logs'),
  startedAt: new Date().toISOString(),
  upMs: Date.now() - t0,
};
fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
log(`ready in ${state.upMs} ms → ${STATE_FILE}`);
console.log(JSON.stringify(state));
