// Long-running stack supervisor (started detached by up.mjs). Owns the Node children (fakes, API, gateway),
// the fault proxies in front of API and gateway, and a control API for fault injection on 127.0.0.1:18490:
//   GET  /status                       children + fault state
//   POST /restart/{api|gateway|fakes}  ?downMs=0&signal=SIGTERM|SIGKILL  stop, wait downMs, start, wait healthy
//   POST /stop/{name}  POST /start/{name}
//   POST /faults  {"wsBlocked":bool,"wsStall":n,"latencyMs":n,"apiLatencyMs":n,"gatewayLatencyMs":n}  (stack-wide)
//                 wsStall: the next n WebSocket handshakes get no answer at all (a connection lost on the way)
//   POST /reset                        drop + re-provision the room store (API restarted around it)
//   POST /shutdown
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { API_BUNDLE_DIR, CACHE_DIR, GATEWAY_BUNDLE, ORIGINS, PORTS, REALTIME_DIR, SECRETS, WEBAPP_DIR } from './config.mjs';
import { assertSafe, cleanEnv } from './safe-env.mjs';

const LOGS = path.join(CACHE_DIR, 'logs');
fs.mkdirSync(LOGS, { recursive: true });
const log = (...a) => fs.appendFileSync(path.join(LOGS, 'supervisor.log'), `${new Date().toISOString()} ${a.join(' ')}\n`);

const apiEnv = {
  E2E_PUBLIC_ORIGIN: ORIGINS.front,
  E2E_CRATE_ORIGIN: ORIGINS.crate,
  E2E_ISSUER_ORIGIN: ORIGINS.issuer,
  E2E_IMAGES_ORIGIN: ORIGINS.images,
  YEPWATCH_SEARCH_URL: `${ORIGINS.search}/api/combined-search`,
  YEPWATCH_SEARCH_SECRET: SECRETS.search,
  E2E_VALKEY_PORT: String(PORTS.valkey),
  E2E_ROOMS_VALKEY_PORT: String(PORTS.rooms),
  E2E_ROOM_SECRET: SECRETS.room,
  E2E_KEY_ID: SECRETS.keyId,
  E2E_CLIENT_ID: SECRETS.clientId,
  E2E_GATEWAY_SECRET: SECRETS.gateway,
  E2E_API_PORT: String(PORTS.api),
  NODE_ENV: 'production',
};
const SPECS = {
  fakes: {
    cwd: path.dirname(new URL(import.meta.url).pathname),
    args: ['fakes.mjs'],
    env: { E2E_ISSUER_PORT: String(PORTS.issuer), E2E_SEARCH_PORT: String(PORTS.search), E2E_IMAGES_PORT: String(PORTS.images), YEPWATCH_SEARCH_SECRET: SECRETS.search },
    health: `${ORIGINS.issuer}/healthz`,
  },
  api: {
    cwd: WEBAPP_DIR,
    args: [path.join(API_BUNDLE_DIR, 'api.mjs'), 'serve'],
    env: apiEnv,
    health: `${ORIGINS.api}/api/yepwatch/v1/proposal/health/ready`,
    proxy: 'api',
  },
  gateway: {
    cwd: REALTIME_DIR,
    args: [GATEWAY_BUNDLE],
    env: {
      YEPWATCH_PROPOSAL: '1',
      YEPWATCH_REALTIME_HOST: '127.0.0.1',
      YEPWATCH_REALTIME_PORT: String(PORTS.gateway),
      YEPWATCH_ALLOWED_ORIGINS: ORIGINS.front,
      YEPWATCH_API_ORIGIN: ORIGINS.api,
      YEPWATCH_GATEWAY_SECRET: SECRETS.gateway,
      YEPWATCH_VALKEY_NODES: JSON.stringify([{ host: '127.0.0.1', port: PORTS.valkey }]),
      NODE_ENV: 'production',
    },
    health: `${ORIGINS.gateway}/api/yepwatch/v1/proposal/realtime/health`,
    proxy: 'gateway',
  },
};

const children = {};
const restarts = { api: 0, gateway: 0, fakes: 0 };
const faults = { wsBlocked: false, wsStall: 0, apiLatencyMs: 0, gatewayLatencyMs: 0 };

// ---- fault proxies -----------------------------------------------------------------------------------
// While a child is down its proxy stops listening, so Caddy sees a refused dial and holds/retries the
// request (lb_try_duration) exactly as it does in front of a restarting production container.
const proxies = {
  api: { listen: PORTS.apiProxy, target: PORTS.api, server: null, sockets: new Set() },
  gateway: { listen: PORTS.gatewayProxy, target: PORTS.gateway, server: null, sockets: new Set() },
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function pipeWithLatency(from, to, latency) {
  let chain = Promise.resolve();
  from.on('data', (chunk) => {
    const ms = latency();
    if (!ms) { chain = chain.then(() => { if (!to.destroyed) to.write(chunk); }); return; }
    from.pause();
    chain = chain.then(() => delay(ms)).then(() => { if (!to.destroyed) to.write(chunk); from.resume(); });
  });
  from.on('end', () => chain.then(() => to.end()));
}
function openProxy(name) {
  const p = proxies[name];
  if (p.server) return Promise.resolve();
  const latency = () => (name === 'api' ? faults.apiLatencyMs : faults.gatewayLatencyMs);
  p.server = net.createServer((client) => {
    p.sockets.add(client);
    client.once('data', (first) => {
      if (name === 'gateway' && faults.wsBlocked && /^upgrade:\s*websocket/im.test(first.toString('latin1'))) {
        client.end('HTTP/1.1 503 Service Unavailable\r\ncontent-length: 0\r\nconnection: close\r\n\r\n');
        return;
      }
      // A handshake that hangs: never forwarded, never answered, never closed from this side (the browser's
      // WebSocket stays CONNECTING until the app gives up on it).
      if (name === 'gateway' && faults.wsStall > 0 && /^upgrade:\s*websocket/im.test(first.toString('latin1'))) {
        faults.wsStall--;
        return;
      }
      const upstream = net.connect({ host: '127.0.0.1', port: p.target });
      // No Nagle on either leg: a request's body (or a WebSocket frame) written after its headers would
      // otherwise wait for the peer's delayed ACK (~40 ms). Caddy and the services set TCP_NODELAY in production.
      client.setNoDelay(true);
      upstream.setNoDelay(true);
      p.sockets.add(upstream);
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
      upstream.on('close', () => { client.destroy(); p.sockets.delete(upstream); });
      client.on('close', () => { upstream.destroy(); p.sockets.delete(client); });
      const ms = latency();
      (ms ? delay(ms) : Promise.resolve()).then(() => { if (!upstream.destroyed) upstream.write(first); });
      pipeWithLatency(client, upstream, latency);
      pipeWithLatency(upstream, client, latency);
    });
    client.on('error', () => {});
  });
  return new Promise((resolve, reject) => {
    p.server.once('error', reject);
    p.server.listen(p.listen, '127.0.0.1', resolve);
  });
}
function closeProxy(name) {
  const p = proxies[name];
  if (!p.server) return;
  p.server.close();
  p.server = null;
  for (const s of p.sockets) s.destroy();
  p.sockets.clear();
}

// ---- children ------------------------------------------------------------------------------------------
async function healthy(name) {
  try {
    const r = await fetch(SPECS[name].health, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}
async function start(name) {
  if (children[name] && children[name].exitCode === null) return;
  const spec = SPECS[name];
  const env = assertSafe(cleanEnv(spec.env), name);
  const out = fs.openSync(path.join(LOGS, `${name}.log`), 'a');
  const child = spawn(process.execPath, spec.args, { cwd: spec.cwd, env, stdio: ['ignore', out, out] });
  fs.closeSync(out);
  children[name] = child;
  child.on('exit', (code, signal) => log(name, 'exited', code, signal));
  const end = Date.now() + 30000;
  while (!(await healthy(name))) {
    if (child.exitCode !== null) throw new Error(`${name} exited during start (see ${LOGS}/${name}.log)`);
    if (Date.now() > end) throw new Error(`${name} not healthy after 30 s`);
    await delay(50);
  }
  if (spec.proxy) await openProxy(spec.proxy);
  log(name, 'started pid', child.pid);
}
async function stop(name, signal = 'SIGTERM') {
  const spec = SPECS[name];
  if (spec.proxy) closeProxy(spec.proxy);
  const child = children[name];
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((r) => child.once('exit', r));
  child.kill(signal);
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}

async function reset() {
  await stop('gateway');
  await stop('api');
  const env = assertSafe(cleanEnv(apiEnv), 'reset');
  await new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(API_BUNDLE_DIR, 'api.mjs'), 'reset'], { cwd: WEBAPP_DIR, env, stdio: 'ignore' });
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`reset exited ${code}`))));
  });
  await start('api');
  await start('gateway');
}

const control = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGINS.control);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  try {
    const [, verb, name] = url.pathname.split('/');
    if (verb === 'status') {
      const status = {};
      for (const n of Object.keys(SPECS)) status[n] = { pid: children[n]?.pid ?? null, running: children[n]?.exitCode === null, healthy: await healthy(n), restarts: restarts[n] };
      return send(200, { children: status, faults, proxies: { api: !!proxies.api.server, gateway: !!proxies.gateway.server } });
    }
    if (req.method !== 'POST') return send(405, { error: 'POST' });
    if (verb === 'restart' && SPECS[name]) {
      const t0 = Date.now();
      await stop(name, url.searchParams.get('signal') ?? 'SIGTERM');
      await delay(Number(url.searchParams.get('downMs') ?? 0));
      await start(name);
      restarts[name]++;
      return send(200, { restarted: name, ms: Date.now() - t0 });
    }
    if (verb === 'stop' && SPECS[name]) { await stop(name, url.searchParams.get('signal') ?? 'SIGTERM'); return send(200, { stopped: name }); }
    if (verb === 'start' && SPECS[name]) { await start(name); return send(200, { started: name }); }
    if (verb === 'faults') {
      let body = '';
      for await (const c of req) body += c;
      const f = JSON.parse(body || '{}');
      if ('wsBlocked' in f) faults.wsBlocked = !!f.wsBlocked;
      if ('wsStall' in f) faults.wsStall = Math.max(0, Number(f.wsStall) || 0);
      if ('latencyMs' in f) faults.apiLatencyMs = faults.gatewayLatencyMs = Number(f.latencyMs) || 0;
      if ('apiLatencyMs' in f) faults.apiLatencyMs = Number(f.apiLatencyMs) || 0;
      if ('gatewayLatencyMs' in f) faults.gatewayLatencyMs = Number(f.gatewayLatencyMs) || 0;
      // Dropping existing sockets makes a WS block take effect for already-open sockets too.
      if (f.wsBlocked) { for (const s of proxies.gateway.sockets) s.destroy(); proxies.gateway.sockets.clear(); }
      return send(200, { faults });
    }
    if (verb === 'reset') { await reset(); return send(200, { reset: true }); }
    if (verb === 'shutdown') {
      send(200, { shutdown: true });
      for (const n of ['gateway', 'api', 'fakes']) await stop(n);
      process.exit(0);
    }
    send(404, { error: 'unknown' });
  } catch (e) {
    send(500, { error: String(e?.message ?? e) });
  }
});

process.on('uncaughtException', (e) => log('uncaught', e?.stack ?? e));
for (const s of ['SIGTERM', 'SIGINT']) process.once(s, async () => { for (const n of ['gateway', 'api', 'fakes']) await stop(n); process.exit(0); });

await new Promise((r) => control.listen(PORTS.control, '127.0.0.1', r));
try {
  await start('fakes');
  await start('api');
  await start('gateway');
  log('stack ready');
  fs.writeFileSync(path.join(CACHE_DIR, 'supervisor.ready'), String(process.pid));
} catch (e) {
  log('start failed', e.message);
  fs.writeFileSync(path.join(CACHE_DIR, 'supervisor.failed'), e.message);
}
