// Gate collectors that aren't about timing: logcat errors, accessibility, frame pacing, stuck states.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { toolEnv, tools } from './env.mjs';
import { PACKAGE } from './build.mjs';

// ---------- logcat ----------
const ERROR_PATTERNS = [
  { kind: 'js-error', re: /ReactNativeJS.*\b(E|W)\b.*?(Error|TypeError|ReferenceError|Unhandled|Possible unhandled promise rejection|Warning: )/ },
  { kind: 'js-error', re: / E ReactNativeJS: / },
  { kind: 'js-fatal', re: /JavascriptException|ReactNativeJS.*Fatal|com\.facebook\.react\.common\.JavascriptException/ },
  { kind: 'native-crash', re: /FATAL EXCEPTION|Fatal signal \d+|AndroidRuntime.*Process: dev\.yepwatch\.e2e/ },
  { kind: 'anr', re: /ANR in dev\.yepwatch\.e2e|Application Not Responding: dev\.yepwatch\.e2e/ },
  { kind: 'redbox', re: /RedBox|LogBox.*error/i },
];
export class Logcat {
  constructor(phone) { this.phone = phone; this.lines = []; this.findings = []; this.pid = null; }
  start() {
    this.phone.adb('logcat', '-c');
    this.proc = spawn(tools.adb, ['-s', this.phone.serial, 'logcat', '-v', 'epoch', '*:W', 'ReactNativeJS:V', 'ActivityManager:I'], { env: toolEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    this.proc.stdout.on('data', d => {
      buf += d; const parts = buf.split('\n'); buf = parts.pop();
      for (const l of parts) this.consume(l);
    });
    return this;
  }
  consume(line) {
    if (!/ReactNativeJS|dev\.yepwatch\.e2e|AndroidRuntime|DEBUG|libc/.test(line)) return;
    this.lines.push(line);
    for (const p of ERROR_PATTERNS) if (p.re.test(line)) {
      // The app's own quiet retry logs and Maestro's instrumentation are not app errors.
      if (/dev\.mobile\.maestro/.test(line)) return;
      this.findings.push({ kind: p.kind, at: Number(line.trim().split(/\s+/)[0]) * 1000, scenario: this.scenario, line: line.slice(0, 400) });
      return;
    }
  }
  mark(scenario) { this.scenario = scenario; }
  stop(file) { this.proc?.kill(); if (file) fs.writeFileSync(file, this.lines.join('\n')); return this.findings; }
}

// ---------- accessibility ----------
/** The node's visible rect ends on an edge of its nearest scrolling ancestor (else the screen). */
function clippedByViewport(nodes, n) {
  let i = nodes.indexOf(n), depth = n.depth, view = nodes[0]?.bounds;
  while (--i >= 0) {
    if (nodes[i].depth >= depth) continue;
    depth = nodes[i].depth;
    if (nodes[i].scrollable) { view = nodes[i].bounds; break; }
  }
  if (!view) return false;
  const [l, t, r, b] = n.bounds;
  return t <= view[1] + 1 || b >= view[3] - 1 || l <= view[0] + 1 || r >= view[2] - 1;
}

/** dp = px * 160 / dpi; Pixel 8 emulator is 420 dpi. */
export function a11yAudit(nodes, { screen, density = 420, minDp = 48 } = {}) {
  const minPx = Math.round(minDp * density / 160);
  const out = [];
  const interactive = nodes.filter(n => n.visible && n.enabled && (n.clickable || n.checkable || /EditText|Switch|CheckBox|Button/.test(n.cls)) && n.w > 0 && n.h > 0);
  for (const n of interactive) {
    const kids = nodes.slice(nodes.indexOf(n) + 1).filter(c => c.depth > n.depth);
    const end = nodes.slice(nodes.indexOf(n) + 1).findIndex(c => c.depth <= n.depth);
    const subtree = end < 0 ? kids : kids.slice(0, end);
    const name = n.desc || n.text || subtree.map(c => c.desc || c.text).filter(Boolean).join(' ');
    const what = `${n.cls.split('.').pop()} "${name || '?'}" ${n.bounds.join(',')}`;
    if (!name) out.push({ screen, rule: 'label', element: what });
    // Bounds are the visible part. A target cut by the edge of its scroll view (or the screen) is partly
    // scrolled out, not small: its size can't be read here; scroll it into view to audit it.
    if ((n.w < minPx || n.h < minPx) && !clippedByViewport(nodes, n)) out.push({ screen, rule: 'target-size', element: what, dp: `${Math.round(n.w * 160 / density)}x${Math.round(n.h * 160 / density)}` });
  }
  return out;
}

// ---------- frame pacing ----------
export function gfxReset(phone) { phone.sh(`dumpsys gfxinfo ${PACKAGE} reset`); }
/** Frames since the last reset from dumpsys gfxinfo framestats (ns timestamps -> ms durations). */
export function gfxFrames(phone) {
  const out = phone.sh(`dumpsys gfxinfo ${PACKAGE} framestats`);
  const lines = out.split('\n');
  const start = lines.findIndex(l => l.startsWith('---PROFILEDATA---'));
  if (start < 0) return { frames: [], summary: {} };
  const header = lines[start + 1].split(',');
  const col = name => header.indexOf(name);
  const frames = [];
  for (let i = start + 2; i < lines.length && !lines[i].startsWith('---PROFILEDATA---'); i++) {
    const c = lines[i].split(',');
    if (c.length < header.length - 1 || c[col('Flags')] !== '0') continue; // flags != 0: not a normal frame
    const ms = (Number(c[col('FrameCompleted')]) - Number(c[col('IntendedVsync')])) / 1e6;
    if (ms > 0 && ms < 5000) frames.push(+ms.toFixed(1));
  }
  const janky = out.match(/Janky frames: (\d+) \(([\d.]+)%\)/);
  const p = q => { const s = [...frames].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
  return { frames, summary: { count: frames.length, over20: frames.filter(f => f > 20).length, max: Math.max(0, ...frames), p50: p(0.5), p95: p(0.95), janky: janky ? `${janky[1]} (${janky[2]}%)` : null } };
}

// ---------- stuck / blocking words ----------
export const BLOCKING = [/Trying again/i, /Try again in \d/i, /Not connected/i, /Reconnecting/i, /Couldn[’']t/i, /Refresh to keep choosing/i,
  /Something went wrong/i, /Opening the room/i, /Your choice is awaiting confirmation/i, /Retry in \d/i];
export function blockingWords(nodes) {
  return [...new Set(nodes.flatMap(n => [n.desc, n.text]).filter(t => t && BLOCKING.some(r => r.test(t))))];
}
