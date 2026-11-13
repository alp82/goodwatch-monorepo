// Stubs and probes for test-yepwatch-front.sh. No dependencies (Node 24: fetch and WebSocket are global).
//   node test-yepwatch-front.mjs api            YepWatch api stand-in on :3000, answers with what it received
//                                               (its port opens READY_AFTER_MS after start, like the real api's)
//   node test-yepwatch-front.mjs gateway        WebSocket echo on :4311, pings every 20 s like the real gateway
//   node test-yepwatch-front.mjs check          one request of each kind, prints JSON
//   node test-yepwatch-front.mjs loop SECONDS   GET page, GET health, POST preview every 200 ms, prints a summary
//                                               (ORIGIN, KINDS, INTERVAL_MS, EXPECT_POST, STOP_FILE: see
//                                               verify-yepwatch-front-deploy.sh)
//   node test-yepwatch-front.mjs ws SECONDS     one WebSocket that echoes every second and reconnects, prints a summary
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const ORIGIN = process.env.ORIGIN ?? 'https://yepwatch.com';
const REALTIME = '/api/yepwatch/v1/proposal/realtime';
const [mode, arg] = process.argv.slice(2);
const seconds = Number(arg ?? 10);
const BODY = JSON.stringify({ code: 'not-a-code' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const print = (value) => console.log(JSON.stringify(value));

if (mode === 'api') {
  // Like the real api (proposal-release-main.ts): the port opens only once it is initialized (READY_AFTER_MS).
  const server = http.createServer((req, res) => {
    let size = 0;
    req.on('data', (chunk) => { size += chunk.length; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ method: req.method, path: req.url, size, xff: req.headers['x-forwarded-for'] ?? null }));
    });
  });
  setTimeout(() => server.listen(3000), Number(process.env.READY_AFTER_MS ?? 0));
  process.on('SIGTERM', () => process.exit(0));
}

if (mode === 'gateway') {
  const sockets = new Set();
  const frame = (opcode, payload) => {
    const body = Buffer.from(payload);
    const head = body.length < 126 ? Buffer.from([0x80 | opcode, body.length]) : Buffer.from([0x80 | opcode, 126, body.length >> 8, body.length & 255]);
    return Buffer.concat([head, body]);
  };
  const server = http.createServer((req, res) => { res.statusCode = 426; res.end(); });
  server.on('upgrade', (req, socket) => {
    const accept = crypto.createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) { // Client frames are masked; payloads here are small.
        if (buffer.length < 2) return;
        const opcode = buffer[0] & 15;
        let length = buffer[1] & 127, offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (buffer.length < offset + 4 + length) return;
        const mask = buffer.subarray(offset, offset + 4);
        const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length).map((byte, i) => byte ^ mask[i % 4]));
        buffer = buffer.subarray(offset + 4 + length);
        if (opcode === 1) socket.write(frame(1, payload));
        else if (opcode === 8) { socket.end(frame(8, payload)); }
      }
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
  });
  setInterval(() => { for (const socket of sockets) socket.write(frame(9, 'hb')); }, 20_000);
  server.listen(4311);
  process.on('SIGTERM', () => { for (const socket of sockets) socket.end(frame(8, Buffer.from([0x03, 0xe9]))); setTimeout(() => process.exit(0), 100); });
}

async function request(kind) {
  const started = performance.now();
  const options = kind === 'post'
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: BODY }
    : {};
  const path = { page: '/', health: '/api/yepwatch/v1/proposal/health/ready', post: '/api/yepwatch/v1/proposal/invites/preview' }[kind];
  try {
    const res = await fetch(ORIGIN + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(40_000) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { kind, status: res.status, ms: Math.round(performance.now() - started), json, location: res.headers.get('location') };
  } catch (error) {
    return { kind, status: 0, ms: Math.round(performance.now() - started), error: String(error.cause?.code ?? error.name) };
  }
}

if (mode === 'check') {
  const results = {};
  for (const kind of ['page', 'health', 'post']) results[kind] = await request(kind);
  const insecure = await fetch(ORIGIN.replace('https:', 'http:') + '/x', { redirect: 'manual' }).catch((error) => ({ status: 0, error }));
  results.redirect = { status: insecure.status, location: insecure.headers?.get('location') ?? null };
  print(results);
}

if (mode === 'loop') {
  const results = [];
  const end = Date.now() + seconds * 1000;
  const pending = [];
  // KINDS=page,health keeps a production run to GETs; STOP_FILE ends the loop early once it exists.
  const kinds = (process.env.KINDS ?? 'page,health,post').split(',');
  const stop = () => process.env.STOP_FILE && fs.existsSync(process.env.STOP_FILE);
  while (Date.now() < end && !stop()) {
    for (const kind of kinds) pending.push(request(kind).then((r) => results.push({ ...r, at: Date.now() })));
    await sleep(Number(process.env.INTERVAL_MS ?? 200));
  }
  await Promise.all(pending);
  const statuses = {};
  for (const r of results) statuses[`${r.kind} ${r.status}${r.error ? ` ${r.error}` : ''}`] = (statuses[`${r.kind} ${r.status}${r.error ? ` ${r.error}` : ''}`] ?? 0) + 1;
  // EXPECT_POST=4xx: production answers the invalid code with the api's JSON 404; anything else is a failure.
  const postOk = (r) => (process.env.EXPECT_POST === '4xx'
    ? r.status === 404 && typeof r.json?.error?.code === 'string' // the api's own answer to an unknown code
    : r.status === 200 && r.json?.size === BODY.length);
  const bad = results.filter((r) => (r.kind === 'post' ? !postOk(r) : r.status !== 200));
  const xff = [...new Set(results.map((r) => r.json?.xff).filter(Boolean))];
  print({ requests: results.length, failed: bad.length, statuses, maxMs: Math.max(...results.map((r) => r.ms)), xff, lastXff: results.filter((r) => r.json?.xff).sort((a, b) => a.at - b.at).at(-1)?.json.xff ?? null, firstFailures: bad.slice(0, 5), failures: bad.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, status: r.status, ms: r.ms, error: r.error })) });
}

if (mode === 'ws') {
  const url = ORIGIN.replace('https:', 'wss:') + REALTIME;
  const end = Date.now() + seconds * 1000;
  const stats = { opens: 0, reconnects: 0, failedAttempts: 0, echoes: 0, maxEchoGapMs: 0, maxOpenMs: 0, closes: [] };
  let lastEcho = Date.now();
  while (Date.now() < end) {
    const started = Date.now();
    const outcome = await new Promise((resolve) => {
      const ws = new WebSocket(url);
      let opened = false, n = 0, timer;
      ws.onopen = () => {
        opened = true; stats.opens += 1; stats.maxOpenMs = Math.max(stats.maxOpenMs, Date.now() - started);
        timer = setInterval(() => { if (Date.now() >= end) { ws.close(1000); return; } ws.send(`echo-${n++}`); }, 1000);
      };
      ws.onmessage = () => { stats.echoes += 1; stats.maxEchoGapMs = Math.max(stats.maxEchoGapMs, Date.now() - lastEcho); lastEcho = Date.now(); };
      ws.onclose = (event) => { clearInterval(timer); resolve({ opened, code: event.code }); };
      ws.onerror = () => {};
    });
    if (!outcome.opened) stats.failedAttempts += 1;
    if (Date.now() < end) {
      stats.closes.push(outcome.code);
      if (outcome.opened) stats.reconnects += 1;
      await sleep(250);
    }
  }
  print(stats);
}
