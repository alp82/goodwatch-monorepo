// Where the app under test points. Order: YW_E2E_STACK (a stack.json path) -> yepwatch-app/e2e/.stack.json
// (the shared hermetic stack) -> e2e/native/.cache/dev-stack.json (this harness's interim stack) -> env
// (YW_E2E_API / YW_E2E_WS / YW_E2E_APP). Every origin must be loopback; the device reaches it via adb reverse.
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_DIR } from './env.mjs';

function fromFile(file) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (s.origins) return { ...s.origins, capabilities: s.capabilities ?? {}, source: file, raw: s }; // native dev stack
  // Shared stack: one front origin (Caddy) carries the web app, API routes and the realtime upgrade.
  const front = new URL(s.front).origin;
  return { api: front, ws: front.replace(/^http/, 'ws'), app: front, control: s.control, issuer: s.issuer,
    capabilities: { members: Boolean(s.issuer), catalog: 'fixture', faults: Boolean(s.control) }, source: file, raw: s };
}
export function resolveStack() {
  const candidates = [process.env.YW_E2E_STACK, path.join(NATIVE_DIR, '../.stack.json'), path.join(NATIVE_DIR, '.cache/dev-stack.json')].filter(Boolean);
  for (const f of candidates) if (fs.existsSync(f)) return check(fromFile(f));
  if (process.env.YW_E2E_API) return check({ api: process.env.YW_E2E_API, ws: process.env.YW_E2E_WS, app: process.env.YW_E2E_APP, capabilities: {}, source: 'env' });
  throw new Error('No stack: start yepwatch-app/e2e stack (npm --prefix yepwatch-app/e2e run stack:up) or node e2e/native/stack/dev-stack.mjs up');
}
function check(s) {
  for (const k of ['api', 'ws', 'app']) {
    const u = new URL(s[k]);
    if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw new Error(`stack ${k} is not loopback: ${s[k]}`);
  }
  return s;
}
/** Every port the phone needs reversed (front/api/ws plus the fake issuer for sign-in). */
export function stackPorts(s) {
  return [...new Set([s.api, s.ws, s.app, s.issuer].filter(Boolean).map(o => new URL(o.replace(/^ws/, 'http')).port))];
}
