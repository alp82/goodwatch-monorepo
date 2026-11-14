// Turns what a person's page recorded into gate failures. Pure: no Playwright here.
import { BLOCKING_WORDS, CONNECTION_WORDS, COUNTDOWN_WORDS, TRANSIENT_WORDS, budgetsFor } from '../budgets.mjs';

export type GateName = 'journey' | 'flash' | 'layout-shift' | 'timing' | 'frames' | 'errors' | 'a11y' | 'dead-button' | 'duplicates';
export interface GateFailure {
  gate: GateName;
  person: string;
  detail: string;
  measured?: number | string;
  budget?: number | string;
  at?: number;
}
export interface Recording {
  startedAt: number;
  endedAt: number;
  states: { t: number; sig: string }[];
  notes: { t: number; text: string }[];
  words: { t: number; text: string }[];
  inputs: { t: number; type: string; target: string; feedbackAt: number | null }[];
  shifts: { t: number; value: number; sources: unknown[] }[];
  loafs: { t: number; duration: number; blocking: number; scripts: string[] }[];
  frames: { count: number; over20: [number, number][]; max: number };
}

const B = budgetsFor();
// Markers that may legitimately live shorter than the flash budget.
const SHORT_OK = new Set(['match-moment', 'yepwatch-boot']);

/**
 * A marker that appears and disappears within flashMaxMs, with no input from the person while it showed,
 * is a flash: one frame of a room before arrival, an empty deck, a placeholder, a note. (A screen the
 * person leaves quickly by pressing something is not a flash.)
 */
export function flashes(rec: Recording, person: string, allow: string[] = []): GateFailure[] {
  const out: GateFailure[] = [];
  const since = new Map<string, number>();
  const prev = new Set<string>();
  rec.states.forEach((s, i) => {
    const cur = new Set(s.sig ? s.sig.split(' ') : []);
    for (const m of cur) if (!prev.has(m)) since.set(m, s.t);
    for (const m of prev) {
      if (cur.has(m)) continue;
      const from = since.get(m)!;
      const life = s.t - from;
      // States carry their frame's start time (rAF), inputs their event time: a press handled in the very
      // frame that ends the marker can be stamped a few ms after that frame. Its first changed frame says so.
      const touched = rec.inputs.some((x) => x.t >= from - 1 && (x.t <= s.t || x.feedbackAt === s.t));
      if (life < B.flashMaxMs && !touched && !SHORT_OK.has(m) && !allow.includes(m) && i > 0) {
        const before = rec.states.filter((x) => x.t < from).at(-1)?.sig ?? '(start)';
        out.push({ gate: 'flash', person, detail: `"${m}" showed for ${Math.round(life)} ms (${before} → … → ${s.sig || '(nothing)'})`, measured: Math.round(life), budget: `≥ ${B.flashMaxMs} ms or never`, at: from });
      }
    }
    prev.clear();
    for (const m of cur) prev.add(m);
  });
  return out;
}

export function layoutShifts(rec: Recording, person: string): GateFailure[] {
  const shifts = rec.shifts;
  const total = shifts.reduce((a, s) => a + s.value, 0);
  if (total <= B.layoutShiftMax) return [];
  const worst = [...shifts].sort((a, b) => b.value - a.value).slice(0, 3);
  return [{ gate: 'layout-shift', person, detail: `CLS ${total.toFixed(4)} over ${shifts.length} shifts; worst: ${worst.map((w) => `${w.value.toFixed(4)} at ${Math.round(w.t - rec.startedAt)} ms on [${rec.states.filter((x) => x.t <= w.t).at(-1)?.sig ?? ''}] ${JSON.stringify(w.sources).slice(0, 220)}`).join(' | ')}`, measured: Number(total.toFixed(4)), budget: B.layoutShiftMax }];
}

const lines = (text: string) => (text ? text.split(' ¦ ') : []);
const isConnection = (line: string) => CONNECTION_WORDS.some((re) => re.test(line));

/** Blocking words ("Couldn't …", "Refresh to keep choosing") on screen. Connection words have their own gate. */
export function blockingWords(rec: Recording, person: string, allow: RegExp[] = []): GateFailure[] {
  const out: GateFailure[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rec.words.length; i++) {
    const w = rec.words[i];
    const end = rec.words[i + 1]?.t ?? rec.endedAt;
    for (const line of lines(w.text)) {
      if (isConnection(line) || allow.some((re) => re.test(line)) || !BLOCKING_WORDS.some((re) => re.test(line))) continue;
      const key = line.replace(/\d+/g, 'N');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ gate: 'journey', person, detail: `"${line}" visible for ${Math.round(end - w.t)} ms`, measured: Math.round(end - w.t), budget: 'never', at: w.t });
    }
  }
  return out;
}

/**
 * Connection words (owner rule Q24a): none during an outage younger than connectionQuietMs, so none at all
 * for a shorter fault (or without a fault: a hidden tab coming back, a second device, no WebSocket); then at
 * most one line, gone within connectionWordsAfterMs of the fault's end; never a countdown or retry timer.
 * `faults` are the stack-side outages this person lived through, [start, end, quietMs?] in epoch ms; `quietMs` is an
 * outage's own, longer quiet period (a restart the server announced). A brief "Connecting…" while a page first
 * connects (no fault) keeps its own connectingMaxMs budget.
 */
export type Outage = [number, number] | [number, number, number];
export function connectionWords(rec: Recording, person: string, faults: Outage[]): GateFailure[] {
  const out: GateFailure[] = [];
  const seen = new Set<string>();
  const fail = (key: string, f: GateFailure) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };
  for (let i = 0; i < rec.words.length; i++) {
    const w = rec.words[i];
    const conn = lines(w.text).filter(isConnection);
    if (!conn.length) continue;
    const start = w.t;
    const end = rec.words[i + 1]?.t ?? rec.endedAt;
    const ms = Math.round(end - start);
    const shown = conn.join(' | ');
    const countdown = conn.find((l) => COUNTDOWN_WORDS.some((re) => re.test(l)));
    if (countdown) fail(`countdown ${countdown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `countdown/retry words "${countdown}" visible for ${ms} ms`, measured: ms, budget: 'never', at: start });
    if (conn.length > 1) fail(`lines ${shown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `${conn.length} connection lines at once: "${shown}"`, measured: conn.length, budget: 1, at: start });
    const fault = faults.find(([a, b]) => start <= b + B.connectionWordsAfterMs && end >= a);
    if (!fault) {
      if (conn.length === 1 && TRANSIENT_WORDS.some((re) => re.test(conn[0])) && ms <= B.connectingMaxMs) continue;
      fail(`nofault ${shown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `"${shown}" visible for ${ms} ms without an outage of ${B.connectionQuietMs} ms`, measured: ms, budget: 'never', at: start });
      continue;
    }
    const [a, b] = fault;
    const quiet = Math.max(B.connectionQuietMs, fault[2] ?? 0);
    const length = Math.round(b - a);
    if (length < quiet)
      fail(`short ${shown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `"${shown}" visible for ${ms} ms during a ${length} ms outage (quiet under ${quiet} ms)`, measured: ms, budget: 'never', at: start });
    else if (start < a + quiet)
      fail(`early ${shown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `"${shown}" showed ${Math.round(start - a)} ms into the outage`, measured: Math.round(start - a), budget: `≥ ${quiet} ms`, at: start });
    else if (end > b + B.connectionWordsAfterMs)
      fail(`late ${shown.replace(/\d+/g, 'N')}`, { gate: 'journey', person, detail: `"${shown}" still visible ${Math.round(end - b)} ms after the outage ended`, measured: Math.round(end - b), budget: B.connectionWordsAfterMs, at: start });
  }
  return out;
}

export function frameGaps(rec: Recording, person: string, windows: [number, number][], harness: [number, number][] = []): GateFailure[] {
  // Only frames inside interaction windows (an input + 1.2 s): idle pages may legitimately skip frames.
  // A frame the harness held up (an axe audit running in the page) isn't the app's.
  const bad = rec.frames.over20.filter(([t, gap]) => gap > B.frameMaxMs && windows.some(([a, b]) => t >= a && t <= b)
    && !harness.some(([a, b]) => t - gap < b && t > a));
  if (!bad.length) return [];
  // Named: the worst frame that failed (the first of equals), what was pressed before it, and the scripts of
  // the long animation frame that overlaps it. Not the recording's longest animation frame, which is usually
  // the page load outside every interaction window.
  const [t, worst] = bad.reduce((a, b) => (b[1] > a[1] ? b : a));
  return [{ gate: 'frames', person, detail: `${bad.length} frames over ${B.frameMaxMs} ms during interactions (worst ${worst} ms, ${describeFrame(rec, t, worst)})`, measured: worst, budget: B.frameMaxMs, at: t }];
}

/** Where a slow frame (ending at `t` after `gap` ms) sits: after which press, and which scripts ran in it. */
export function describeFrame(rec: Pick<Recording, 'inputs' | 'loafs'>, t: number, gap: number) {
  const input = rec.inputs.filter((i) => i.t <= t).at(-1);
  const after = input ? `${Math.round(t - gap - input.t)} ms after ${input.type} on ${input.target}` : 'before any press';
  // Long animation frames are only reported from 50 ms; a shorter one has no script attribution.
  const overlap = (l: Recording['loafs'][number]) => Math.min(t, l.t + l.duration) - Math.max(t - gap, l.t);
  const loaf = rec.loafs.filter((l) => overlap(l) > 0).sort((a, b) => overlap(b) - overlap(a) || b.duration - a.duration)[0];
  if (!loaf) return `${after}; no long animation frame (≥ 50 ms) overlaps it, so no script attribution`;
  return `${after}; its animation frame ${loaf.duration} ms (blocking ${loaf.blocking} ms): ${loaf.scripts.length ? loaf.scripts.join(', ') : 'no script attributed (rendering/style/layout)'}`;
}

export function deadButtons(rec: Recording, person: string): GateFailure[] {
  return rec.inputs
    .filter((i) => i.type === 'pointerdown' && !i.feedbackAt && rec.endedAt - i.t > B.deadButtonMs)
    .map((i) => ({ gate: 'dead-button' as const, person, detail: `no visible change after pressing ${i.target}`, measured: 'none', budget: `${B.deadButtonMs} ms`, at: i.t }));
}

export function percentile(values: number[], p = 95) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
