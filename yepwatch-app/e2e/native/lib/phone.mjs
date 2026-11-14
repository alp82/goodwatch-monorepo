// A fast Android UI driver for gate scenarios. It talks gRPC (plain HTTP/2) to Maestro's on-device
// server (dev.mobile.maestro.test), the same server Maestro flows use, so the harness and the YAML
// flows see the same hierarchy (~190 ms per read). Taps go through `input tap` (see tapXY).
// Maestro's own CLI waits for the app to "settle" before and after every command, which this app never
// does (its hierarchy changes ~10x/s while idle), costing 8-9 s per step; gates can't afford that.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import http2 from 'node:http2';
import path from 'node:path';
import { HOME, log, mkdirp, run, sleep, toolEnv, tools } from './env.mjs';
import { PACKAGE } from './build.mjs';

const MAESTRO_APKS = path.join(HOME, 'tools/maestro-apks');
export function maestroApks() {
  if (!fs.existsSync(path.join(MAESTRO_APKS, 'maestro-server.apk'))) {
    mkdirp(MAESTRO_APKS);
    const jar = path.join(HOME, 'tools/maestro/lib/maestro-client.jar');
    run('unzip', ['-o', '-q', jar, 'maestro-app.apk', 'maestro-server.apk', '-d', MAESTRO_APKS]);
  }
  return ['maestro-app.apk', 'maestro-server.apk'].map(f => path.join(MAESTRO_APKS, f));
}

// --- protobuf (just enough) ---
function varint(n) { const out = []; do { let b = n & 0x7f; n = Math.floor(n / 128); if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); }
function fieldStr(no, s) { const b = Buffer.from(s); return Buffer.concat([varint((no << 3) | 2), varint(b.length), b]); }
function readField1(buf) {
  // grpc frame (5 bytes) + message; returns field 1 (bytes or varint).
  let p = 5; if (buf.length <= p) return null;
  const tag = buf[p++];
  let v = 0, shift = 0; for (;;) { const b = buf[p++]; v += (b & 0x7f) * 2 ** shift; if (!(b & 0x80)) break; shift += 7; }
  return (tag & 7) === 2 ? buf.subarray(p, p + v) : v;
}

// --- hierarchy ---
const ATTR = /([\w-]+)="([^"]*)"/g;
const unescape = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c))).replace(/&amp;/g, '&');
export function parseHierarchy(xml) {
  const nodes = []; let depth = 0;
  for (const m of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
    if (m[1]) { depth--; continue; }
    const a = {}; for (const [, k, v] of m[2].matchAll(ATTR)) a[k] = unescape(v);
    const b = (a.bounds ?? '[0,0][0,0]').match(/\d+/g).map(Number);
    nodes.push({ depth, text: a.text ?? '', desc: a['content-desc'] ?? '', id: a['resource-id'] ?? '', cls: a.class ?? '', pkg: a.package ?? '',
      clickable: a.clickable === 'true', checkable: a.checkable === 'true', checked: a.checked === 'true', enabled: a.enabled !== 'false',
      focusable: a.focusable === 'true', scrollable: a.scrollable === 'true', visible: a['visible-to-user'] !== 'false', bounds: b,
      cx: Math.round((b[0] + b[2]) / 2), cy: Math.round((b[1] + b[3]) / 2), w: b[2] - b[0], h: b[3] - b[1] });
    if (!m[3]) depth++;
  }
  return nodes;
}
/** sel: string (exact content-desc, then exact text, then resource-id) | RegExp (desc or text) | { desc, text, id } */
export function match(n, sel) {
  if (typeof sel === 'string') return n.desc === sel || n.text === sel || n.id === sel;
  if (sel instanceof RegExp) return sel.test(n.desc) || sel.test(n.text);
  return Object.entries(sel).every(([k, v]) => k === 'index' || (v instanceof RegExp ? v.test(n[k] ?? '') : n[k] === v));
}
const label = sel => (typeof sel === 'string' || sel instanceof RegExp ? String(sel) : JSON.stringify(sel));

export class Phone {
  constructor(serial, index = 0, name = serial) {
    // Host port for the driver's adb forward, unique per emulator (5570 -> 19500, 5572 -> 19501, 5574 -> 19502 …)
    // so harnesses on different emulators never re-point each other's forward.
    const emu = Number(serial.match(/^emulator-(\d+)$/)?.[1]);
    this.serial = serial; this.name = name; this.port = emu ? 19500 + (emu - 5570) / 2 : 19500 + index; this.client = null; this.steps = [];
  }
  adb(...args) { return run(tools.adb, ['-s', this.serial, ...args], { timeout: 60000 }); }
  sh(cmd) { return this.adb('shell', cmd); }

  async start() {
    const pk = this.sh('pm list packages dev.mobile.maestro');
    if (!pk.includes('dev.mobile.maestro.test')) for (const apk of maestroApks()) this.adb('install', '-r', '-g', apk);
    this.adb('forward', `tcp:${this.port}`, 'tcp:7001');
    if (await this.ping()) return this;
    const child = spawn(tools.adb, ['-s', this.serial, 'shell', "am instrument -w -m -e debug false -e class 'dev.mobile.maestro.MaestroDriverService#grpcServer' dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner"],
      { env: toolEnv(), stdio: 'ignore', detached: true });
    child.unref();
    for (let i = 0; i < 60; i++) { await sleep(250); if (await this.ping()) return this; }
    throw new Error(`${this.name}: Maestro device server did not start`);
  }
  async ping() { try { await this.call('deviceInfo', Buffer.alloc(0), 1500); return true; } catch { this.client?.close(); this.client = null; return false; } }
  call(method, body = Buffer.alloc(0), timeoutMs = 10000) {
    if (!this.client || this.client.closed || this.client.destroyed) { this.client = http2.connect(`http://127.0.0.1:${this.port}`); this.client.on('error', () => {}); }
    return new Promise((resolve, reject) => {
      const frame = Buffer.alloc(5 + body.length); frame.writeUInt32BE(body.length, 1); body.copy(frame, 5);
      const s = this.client.request({ ':method': 'POST', ':path': `/maestro_android.MaestroDriver/${method}`, 'content-type': 'application/grpc', te: 'trailers' });
      const chunks = []; let status = null;
      const timer = setTimeout(() => { s.close(); reject(new Error(`${method} timed out`)); }, timeoutMs);
      s.on('trailers', t => { status = t['grpc-status'] ?? '0'; });
      s.on('response', h => { if (h['grpc-status']) status = h['grpc-status']; });
      s.on('data', d => chunks.push(d));
      s.on('end', () => { clearTimeout(timer); status === '0' ? resolve(Buffer.concat(chunks)) : reject(new Error(`${method} grpc-status ${status ?? 'missing (no server)'}`)); });
      s.on('error', e => { clearTimeout(timer); reject(e); });
      s.end(frame);
    });
  }
  close() { this.client?.close(); this.client = null; }

  async xml() {
    for (let i = 0; ; i++) { // the server answers empty while UiAutomation (re)connects
      // On GitHub's software-rendered emulator a read can take 9-10 s while the app is busy (measured 2026-11-14);
      // the old 10 s deadline threw such reads away just before they answered.
      const f = readField1(await this.call('viewHierarchy', undefined, 15000));
      if (f && f.length) return f.toString();
      if (i >= 20) throw new Error(`${this.name}: empty hierarchy`);
      await sleep(100);
    }
  }
  /** App nodes only (plus system dialogs when asked). */
  async nodes({ all = false } = {}) {
    const n = parseHierarchy(await this.xml());
    return all ? n : n.filter(x => x.pkg === PACKAGE);
  }
  async has(sel) { return (await this.nodes()).some(n => match(n, sel)); }
  /**
   * The app's nodes, or null when the hierarchy read itself stalled. On a software-rendered emulator (GitHub's) a
   * read during a cold start can hang past the 10 s call timeout while the app's first frame builds; a wait with
   * time left reads again instead of failing.
   */
  async nodesOrNull(end) {
    try { return await this.nodes(); } catch (e) {
      if (!/viewHierarchy timed out|empty hierarchy/.test(String(e?.message)) || Date.now() >= end) throw e;
      return null;
    }
  }
  async find(sel, { timeout = 10000, enabled = true } = {}) {
    const end = Date.now() + timeout; let last = [];
    while (Date.now() < end) {
      const read = await this.nodesOrNull(end);
      if (!read) continue;
      last = read;
      const hits = last.filter(n => match(n, sel) && n.visible && n.w > 0 && n.h > 0 && (!enabled || n.enabled));
      // Prefer the actionable element over its text child.
      hits.sort((a, b) => (b.clickable - a.clickable) || (b.checkable - a.checkable));
      const pick = hits[typeof sel === 'object' && !(sel instanceof RegExp) && sel.index ? sel.index : 0];
      if (pick) return pick;
      await sleep(80);
    }
    const err = new Error(`${this.name}: not found within ${timeout} ms: ${label(sel)}`);
    err.screen = last.filter(n => n.desc || n.text).slice(0, 60).map(n => n.desc || n.text);
    throw err;
  }
  async waitFor(sel, opts) { return this.find(sel, { enabled: false, ...opts }); }
  async waitGone(sel, { timeout = 10000 } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const read = await this.nodesOrNull(end); if (read && !read.some(n => match(n, sel))) return; await sleep(80); }
    throw new Error(`${this.name}: still visible after ${timeout} ms: ${label(sel)}`);
  }
  /**
   * A tap the way a finger lands: `input tap` injects down+up through InputManager and returns once delivered.
   * Not Maestro's gRPC tap: UiAutomator injects every touch with waitForAnimations, which waits up to 5 s before
   * the down and 5 s after the up for window animations to end. Android 15 can leave one running for good: when
   * the app takes longer than 2 s to attach its transferred splash screen (a cold start on GitHub's
   * software-rendered emulator), the removed starting window keeps its `starting_reveal` animation, so every
   * later Maestro tap took 10 s and hit the call deadline ("tap timed out"). Maestro's own key input skips that
   * wait for the same reason (maestro-android InputInjector).
   */
  async tapXY(x, y) {
    // Asynchronous, so un-awaited taps (rapid-taps) still go out 40 ms apart.
    await new Promise((resolve, reject) => execFile(tools.adb, ['-s', this.serial, 'shell', 'input', 'tap', String(x), String(y)], { env: toolEnv(), timeout: 30000 },
      (e) => (e ? reject(new Error(`${this.name}: input tap ${x},${y} failed: ${e.message.split('\n')[0]}`)) : resolve())));
    this.lastTap = { x, y, at: Date.now() };
  }
  async tap(sel, opts) { const n = await this.find(sel, opts); await this.tapXY(n.cx, n.cy); return n; }
  async type(text) { await this.call('inputText', fieldStr(1, text)); }
  async fill(sel, text) { await this.tap(sel); await sleep(150); await this.type(text); }
  key(code) { this.sh(`input keyevent ${code}`); }
  back() { this.key('KEYCODE_BACK'); }
  home() { this.key('KEYCODE_HOME'); }
  async swipe(x1, y1, x2, y2, ms = 200) { this.sh(`input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`); }
  screenshot(file) { mkdirp(path.dirname(file)); fs.writeFileSync(file, run(tools.adb, ['-s', this.serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer' })); return file; }

  // --- app lifecycle ---
  forceStop() { this.sh(`am force-stop ${PACKAGE}`); }
  /** Cold start; returns am start -W TotalTime (ms to first frame drawn by the activity). */
  launch() {
    const out = this.sh(`am start -W -n ${PACKAGE}/.MainActivity`);
    return { totalTime: Number(out.match(/TotalTime: (\d+)/)?.[1] ?? NaN), launchState: out.match(/LaunchState: (\w+)/)?.[1] };
  }
  openLink(url) {
    const out = this.sh(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${url}'`);
    return { totalTime: Number(out.match(/TotalTime: (\d+)/)?.[1] ?? NaN), launchState: out.match(/LaunchState: (\w+)/)?.[1], activity: out.match(/Activity: (\S+)/)?.[1] };
  }
  foreground() { return this.sh('dumpsys activity activities | grep -m1 -E "topResumedActivity|mResumedActivity"').trim(); }
}

export async function phones(serials) {
  const out = [];
  for (const [i, s] of serials.entries()) out.push(await new Phone(s, i, i === 0 ? 'A' : 'B').start());
  return out;
}
export { log };
