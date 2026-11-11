#!/usr/bin/env node
// Interim local stack for the native harness until yepwatch-app/e2e/stack (the shared hermetic stack) lands.
// Synthetic catalog (YEPWATCH_LOCAL_FIXTURES=1), in-memory rooms, throwaway Valkey, loopback-only gateway
// and a static web export for browser peers. Every process starts from `env -i` with an explicit
// allowlist and a preload that refuses non-loopback sockets. No .env file is read.
//
//   node e2e/native/stack/dev-stack.mjs up|down|status
// Writes e2e/native/.cache/dev-stack.json in the same shape the harness reads from e2e/.stack.json.
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { APP_DIR, NATIVE_DIR, REPO_DIR, log, mkdirp, sleep } from '../lib/env.mjs';

const PORTS = { valkey: 19379, api: 19100, gateway: 19200, web: 19300 };
const CACHE = mkdirp(path.join(NATIVE_DIR, '.cache/dev-stack'));
const STATE = path.join(NATIVE_DIR, '.cache/dev-stack.json');
const VALKEY = 'yw-e2e-native-valkey';
const EGRESS = path.join(NATIVE_DIR, 'stack/block-egress.mjs');
const TSX = path.join(APP_DIR, 'node_modules/tsx/dist/loader.mjs');
const WEB_EXPORT = path.join(CACHE, 'web');

const origins = {
  api: `http://127.0.0.1:${PORTS.api}`,
  ws: `ws://127.0.0.1:${PORTS.gateway}`,
  app: `http://127.0.0.1:${PORTS.web}`,
};

function portOpen(port) {
  return new Promise(r => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
}
async function waitPort(port, ms, name) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await portOpen(port)) return; await sleep(150); }
  throw new Error(`${name} did not listen on ${port}; see ${CACHE}/${name}.log`);
}
/** Minimal allowlisted env; refuses anything that isn't loopback. */
function hermetic(extra) {
  const env = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: process.env.HOME, LANG: 'C.UTF-8', NODE_ENV: 'production',
    NODE_OPTIONS: `--import=${EGRESS}`, ...extra };
  for (const [k, v] of Object.entries(env)) {
    if (/ORIGIN|URL|HOST/.test(k) && v && !String(v).split(',').every(x => /^(\w+:\/\/)?(127\.0\.0\.1|localhost)([:/]|$)/.test(x.trim())))
      throw new Error(`Refusing non-loopback ${k}`);
  }
  return env;
}
function start(name, cmd, args, env, cwd) {
  const out = fs.openSync(path.join(CACHE, `${name}.log`), 'w');
  const child = spawn('env', ['-i', ...Object.entries(env).map(([k, v]) => `${k}=${v}`), cmd, ...args], { cwd, stdio: ['ignore', out, out], detached: true });
  child.unref();
  fs.writeFileSync(path.join(CACHE, `${name}.pid`), String(child.pid));
  return child.pid;
}
function secret() { return crypto.randomBytes(32).toString('hex'); }

async function exportWeb() {
  const stamp = path.join(CACHE, 'web.stamp');
  const key = crypto.createHash('sha1').update(JSON.stringify(origins)).update(execFileSync('git', ['-C', APP_DIR, 'rev-parse', 'HEAD:yepwatch-app/src'], { encoding: 'utf8' })).update(execFileSync('git', ['-C', APP_DIR, 'status', '--porcelain', 'src'], { encoding: 'utf8' })).digest('hex');
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === key && fs.existsSync(path.join(WEB_EXPORT, 'index.html'))) return;
  log('dev-stack: exporting web app for browser peers');
  const env = hermetic({ EXPO_PUBLIC_API_ORIGIN: origins.api, EXPO_PUBLIC_WS_ORIGIN: origins.ws, EXPO_PUBLIC_APP_ORIGIN: origins.app,
    EXPO_PUBLIC_ENABLE_FIXTURES: 'false', EXPO_PUBLIC_GUEST_ONLY: 'false', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', CI: '1' });
  delete env.NODE_OPTIONS;
  execFileSync('env', ['-i', ...Object.entries(env).map(([k, v]) => `${k}=${v}`), path.join(APP_DIR, 'node_modules/.bin/expo'), 'export', '--platform', 'web', '--output-dir', WEB_EXPORT, '--clear'],
    { cwd: APP_DIR, stdio: ['ignore', fs.openSync(path.join(CACHE, 'web-export.log'), 'w'), 'inherit'] });
  fs.writeFileSync(stamp, key);
}

async function up() {
  for (const [name, port] of Object.entries(PORTS)) if (await portOpen(port)) throw new Error(`port ${port} (${name}) busy: run "down" or check its owner`);
  await exportWeb();
  execFileSync('docker', ['run', '-d', '--rm', '--name', VALKEY, '--network', 'host', 'valkey/valkey:8.1', 'valkey-server', '--port', String(PORTS.valkey),
    '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  await waitPort(PORTS.valkey, 10000, 'valkey');
  const gatewaySecret = secret();
  start('api', process.execPath, ['--import', TSX, 'app/server/yepwatch/proposal-local-server.ts'], hermetic({
    YEPWATCH_LOCAL_FIXTURES: '1', YEPWATCH_SECRET: secret(), YEPWATCH_GATEWAY_SECRET: gatewaySecret,
    YEPWATCH_REVISION_REDIS_URL: `redis://127.0.0.1:${PORTS.valkey}`, YEPWATCH_ALLOWED_ORIGINS: origins.app, YEPWATCH_LOCAL_PORT: String(PORTS.api),
  }), path.join(REPO_DIR, 'goodwatch-webapp'));
  await waitPort(PORTS.api, 30000, 'api');
  const rt = path.join(REPO_DIR, 'yepwatch-realtime');
  if (!fs.existsSync(path.join(rt, 'dist/main.js'))) execFileSync('npm', ['run', 'build'], { cwd: rt, stdio: 'ignore' });
  start('gateway', process.execPath, ['dist/main.js'], hermetic({
    YEPWATCH_PROPOSAL: '1', YEPWATCH_REALTIME_HOST: '127.0.0.1', YEPWATCH_REALTIME_PORT: String(PORTS.gateway), YEPWATCH_API_ORIGIN: origins.api,
    // React Native sends its endpoint as Origin; browsers send the web app's.
    YEPWATCH_ALLOWED_ORIGINS: `http://127.0.0.1:${PORTS.gateway},${origins.app}`, YEPWATCH_VALKEY_URL: `redis://127.0.0.1:${PORTS.valkey}`,
    YEPWATCH_GATEWAY_SECRET: gatewaySecret,
  }), rt);
  await waitPort(PORTS.gateway, 15000, 'gateway');
  start('web', process.execPath, [path.join(APP_DIR, 'scripts/serve.cjs')], hermetic({ EXPORT_DIR: path.relative(APP_DIR, WEB_EXPORT), PORT: String(PORTS.web) }), APP_DIR);
  await waitPort(PORTS.web, 10000, 'web');
  fs.writeFileSync(STATE, JSON.stringify({ kind: 'native-dev-stack', origins, ports: PORTS, capabilities: { members: false, catalog: 'synthetic' }, startedAt: new Date().toISOString() }, null, 2));
  log('dev-stack up', JSON.stringify(origins));
}

function ownedPid(name) {
  const f = path.join(CACHE, `${name}.pid`);
  if (!fs.existsSync(f)) return null;
  const pid = Number(fs.readFileSync(f, 'utf8'));
  try { process.kill(pid, 0); } catch { return null; }
  // The pid we spawned is `env` exec'ing node; same pid. Confirm it's still a node process from this checkout.
  const exe = fs.readlinkSync(`/proc/${pid}/exe`);
  const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
  return exe.includes('node') && cwd.startsWith(REPO_DIR) ? pid : null;
}
async function down() {
  for (const name of ['web', 'gateway', 'api']) {
    const pid = ownedPid(name);
    if (pid) { process.kill(pid, 'SIGTERM'); log('stopped', name, pid); }
    fs.rmSync(path.join(CACHE, `${name}.pid`), { force: true });
  }
  try { execFileSync('docker', ['rm', '-f', VALKEY], { stdio: 'ignore' }); } catch { /* not running */ }
  fs.rmSync(STATE, { force: true });
}
async function status() {
  for (const [name, port] of Object.entries(PORTS)) console.log(name.padEnd(8), port, (await portOpen(port)) ? 'listening' : 'down');
}

const cmd = process.argv[2] ?? 'status';
await ({ up, down, status }[cmd] ?? (() => { throw new Error('usage: up|down|status'); }))();
