// Production smoke only: was the runner's own network up? A smoke judges YepWatch from one machine. When that
// machine's connection drops (a home line, a CI runner's network), every phone on it stalls at once and the gates
// would blame YepWatch for it: on 2026-11-14 a 12 s drop between the runner and abio showed as "Reconnecting…
// without an outage" and a 12 s invitation, while abio's proxy served everyone else.
//
// While a production smoke runs, the runner process (not the browsers, not throttled) asks YepWatch's readiness route
// and an IPv4 reference outside YepWatch's hosting at the same moments, every PROBE_EVERY_MS, whether or not earlier
// probes are still waiting (each gives up after PROBE_TIMEOUT_MS). A stretch in which YepWatch didn't answer is
//  - 'runner' when the reference didn't answer either: the runner was offline. The gates treat it as an outage
//    (connection words are judged against it) and leave timing samples that overlap it out of the budgets;
//  - 'yepwatch' when the reference answered, or when YepWatch answered with a 5xx (whatever the reference did):
//    YepWatch failed a working network. A failure of its own.

export const PROBE_EVERY_MS = 250;
export const PROBE_TIMEOUT_MS = 1000;
/** A 'yepwatch' stretch shorter than this is no failure (one slow answer is the timing gates' business). */
export const MIN_UNREACHABLE_MS = 1000;
/**
 * After the runner's network comes back, YepWatch may answer a little later than the reference (a new TCP and TLS
 * handshake to a host whose old connection died), or time out a moment before it: a stretch without an answer from
 * YepWatch right next to the runner's outage and no longer than this is part of that outage. A 5xx never is.
 */
export const RECOVERY_GRACE_MS = 2000;
/** When the watch stops on a failure, it keeps probing this long for an answer (a timeout at teardown is no outage). */
export const STOP_FOLLOW_UP_MS = 2000;

/**
 * One moment's pair of probes, sent together at `t` (epoch ms). `target`: YepWatch answered (below 500), answered with
 * a 5xx, or didn't answer in time; `done`: when that was known. `reference`: whether the reference answered in time.
 */
export interface Tick {
  t: number;
  target: 'answered' | 'error' | 'none';
  done: number;
  reference: boolean;
}
export interface Unreachable {
  start: number;
  end: number;
  kind: 'runner' | 'yepwatch';
  /** For 'yepwatch': 'no answer' (the reference answered) or 'HTTP 5xx'. */
  why?: string;
  /**
   * The whole stretch this run belongs to, [start, end] in epoch ms: one outage for the room's connection words,
   * however its parts were attributed.
   */
  within: [number, number];
}

interface Run {
  start: number;
  end: number;
  runner: boolean;
  /** A YepWatch run that saw a 5xx (never part of the runner's outage). */
  error: boolean;
}

/**
 * The stretches in which YepWatch didn't answer, from ticks in any order. A stretch starts when the first tick that
 * failed was sent and ends at the earliest answer among the ticks that answered next (when it came, not when it was
 * asked for); answers that came only after the next failure was sent don't end it. A stretch still open ends when its
 * last failure was known. Inside it, the runner's outage (no answer from either) and YepWatch's failures (no answer
 * while the reference answered, or a 5xx, in any mix) are separate runs:
 *  - a runner outage that opens a stretch starts up to one probe interval earlier (the drop came between two ticks);
 *  - YepWatch silent at a stretch's edge right next to the runner's outage, for at most RECOVERY_GRACE_MS and without
 *    a 5xx, is part of that outage (never in its middle: a reference that flickers can't stretch it);
 *  - YepWatch's runs count once their total in the stretch reaches MIN_UNREACHABLE_MS.
 * Pure.
 */
export function unreachable(ticks: Tick[]): Unreachable[] {
  const sorted = [...ticks].sort((a, b) => a.t - b.t);
  const blocks: { failed: boolean; ticks: Tick[] }[] = [];
  for (const k of sorted) {
    const failed = k.target !== 'answered';
    const last = blocks.at(-1);
    if (last && last.failed === failed) last.ticks.push(k);
    else blocks.push({ failed, ticks: [k] });
  }
  const stretches: { ticks: Tick[]; end: number; onset: number }[] = [];
  let open: { ticks: Tick[]; onset: number } | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.failed) {
      // The last tick YepWatch answered before this one was sent: the drop came after it.
      const before = blocks[i - 1]?.ticks.at(-1)?.t ?? -Infinity;
      open ??= { ticks: [], onset: Math.max(before, b.ticks[0].t - PROBE_EVERY_MS) };
      open.ticks.push(...b.ticks);
      continue;
    }
    if (!open) continue;
    const recovered = Math.min(...b.ticks.map((k) => k.done));
    const next = blocks[i + 1];
    if (next && next.ticks[0].t < recovered) continue;
    stretches.push({ ...open, end: recovered });
    open = null;
  }
  if (open) stretches.push({ ...open, end: Math.max(...open.ticks.map((k) => k.done)) });

  const out: Unreachable[] = [];
  for (const s of stretches) {
    let runs: Run[] = [];
    for (const k of s.ticks) {
      const runner = k.target === 'none' && !k.reference;
      const last = runs.at(-1);
      if (last && last.runner === runner) {
        if (k.target === 'error') last.error = true;
        continue;
      }
      if (last) last.end = k.t;
      runs.push({ start: k.t, end: s.end, runner, error: k.target === 'error' });
    }
    const edge = (r: Run | undefined) => !!r && !r.runner && !r.error && r.end - r.start <= RECOVERY_GRACE_MS;
    if (runs.length > 1 && edge(runs[0]) && runs[1].runner) runs = [{ ...runs[1], start: runs[0].start }, ...runs.slice(2)];
    if (runs.length > 1 && edge(runs.at(-1)) && runs.at(-2)!.runner) runs = [...runs.slice(0, -2), { ...runs.at(-2)!, end: runs.at(-1)!.end }];
    if (runs[0]?.runner) runs[0] = { ...runs[0], start: Math.min(runs[0].start, s.onset) };
    const own = runs.filter((r) => !r.runner);
    const counts = own.reduce((ms, r) => ms + (r.end - r.start), 0) >= MIN_UNREACHABLE_MS;
    const within: [number, number] = [runs[0].start, s.end];
    for (const r of runs) {
      if (r.runner) out.push({ start: r.start, end: r.end, kind: 'runner', within });
      else if (counts) out.push({ start: r.start, end: r.end, kind: 'yepwatch', why: r.error ? 'HTTP 5xx' : 'no answer', within });
    }
  }
  return out;
}

/** A request or socket that fails as the runner's network comes back can fail this long after the outage's end. */
export const TRANSPORT_SETTLE_MS = 3000;
const TRANSPORT = /^(request failed: |websocket error: )|^console\.(error|warning): .*(WebSocket|net::|ERR_|Failed to fetch|NetworkError)/i;
// A handshake YepWatch answered with an HTTP status is an answer, not a dead network ("websocket error: Service
// Unavailable: 503", Chromium's "Unexpected response code: 503").
const ANSWERED = /response code|:\s*[1-5]\d\d\b|Service Unavailable|Bad Gateway|Gateway Time-?out|Internal Server Error|Forbidden|Unauthorized|Not Found|Too Many Requests/i;
/**
 * The runner outage that explains an errors-gate failure: a failed request, a socket error or the browser's network
 * console line, at a moment the runner was offline (or within TRANSPORT_SETTLE_MS after). HTTP statuses (a request's
 * or a WebSocket handshake's) and app errors are never explained this way.
 */
export function explainedByRunner(f: { gate: string; detail: string; at?: number }, stretches: Unreachable[]): Unreachable | undefined {
  if (f.gate !== 'errors' || f.at === undefined || !TRANSPORT.test(f.detail) || ANSWERED.test(f.detail.replace(/\s\(.*$/, ''))) return undefined;
  return stretches.find((s) => s.kind === 'runner' && f.at! >= s.start && f.at! <= s.end + TRANSPORT_SETTLE_MS);
}

/** The outages for the room's connection words: each stretch once, whole (its parts may be attributed differently). */
export function outagesOf(stretches: Unreachable[]): [number, number][] {
  const seen = new Map<string, [number, number]>();
  for (const s of stretches) seen.set(s.within.join(), s.within);
  return [...seen.values()];
}

/** Whether [from, to] (epoch ms) overlaps any of the runner's own outages. */
export function duringRunnerOutage(from: number, to: number, stretches: Unreachable[]): Unreachable | undefined {
  return stretches.find((s) => s.kind === 'runner' && from <= s.end && to >= s.start);
}

/**
 * The status of an answer within PROBE_TIMEOUT_MS, or null without one, and when it was known (its headers came).
 * The body is read afterwards so the connection goes back to the pool; a body that breaks or stalls (bounded by the
 * same timeout) leaves the status as it came.
 */
async function status(url: string): Promise<{ status: number | null; at: number }> {
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, { signal, cache: 'no-store', redirect: 'manual' });
  } catch {
    return { status: null, at: Date.now() };
  }
  const at = Date.now();
  await r.arrayBuffer().catch(() => {});
  return { status: r.status, at };
}

/** Probes `origin`'s readiness route and the reference in pairs until stopped. */
export class ReachabilityWatch {
  private readonly ticks: Tick[] = [];
  private readonly inFlight = new Set<Promise<void>>();
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly tick: () => Promise<Tick>;
  private stopped?: Promise<Unreachable[]>;
  /** The probe sent last, and when. */
  private last?: Promise<Tick>;
  private lastSentAt = 0;
  constructor(
    origin: string,
    // An IPv4 literal: no DNS, and the same address family as yepwatch.com (an A record only), so a runner whose IPv4
    // path is down (DS-Lite, a CGNAT) counts as offline even while its IPv6 works.
    reference = process.env.E2E_SMOKE_REFERENCE_URL || 'https://1.1.1.1/cdn-cgi/trace',
  ) {
    const target = new URL('/api/yepwatch/v1/proposal/health/ready', origin).href;
    this.tick = () => {
      const t = Date.now();
      const probe = Promise.all([status(target), status(reference)]).then(([s, ref]) => {
        // Readiness answers 200 while YepWatch serves; a 5xx is an answer that says it doesn't.
        const k: Tick = { t, target: s.status === null ? 'none' : s.status >= 500 ? 'error' : 'answered', done: s.at, reference: ref.status !== null };
        this.ticks.push(k);
        return k;
      });
      const settled = probe.then(() => {});
      this.inFlight.add(settled);
      void settled.finally(() => this.inFlight.delete(settled));
      this.last = probe;
      this.lastSentAt = t;
      return probe;
    };
    void this.tick();
    this.timer = setInterval(() => void this.tick(), PROBE_EVERY_MS);
  }
  /**
   * Stops probing and returns the stretches seen. It keeps the same pace until the probe sent last has answered (or
   * STOP_FOLLOW_UP_MS ran out): a single timeout at teardown is told from YepWatch really being away, and no probe is
   * left unexamined. Then it waits for the probes still out (each at most PROBE_TIMEOUT_MS). Idempotent.
   */
  stop(): Promise<Unreachable[]> {
    this.stopped ??= (async () => {
      clearInterval(this.timer);
      const until = Date.now() + STOP_FOLLOW_UP_MS;
      const sleep = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, ms)));
      for (;;) {
        const last = this.last!;
        const k = await Promise.race([last, sleep(this.lastSentAt + PROBE_EVERY_MS - Date.now())]);
        if (k && k.target === 'answered') break;
        if (Date.now() >= until) {
          await last;
          break;
        }
        // The last one failed, or is still out a probe interval after it was sent: send the next at the regular pace
        // (never sooner, however fast a failure came back).
        if (k) await sleep(this.lastSentAt + PROBE_EVERY_MS - Date.now());
        void this.tick();
      }
      await Promise.all([...this.inFlight]);
      return unreachable(this.ticks);
    })();
    return this.stopped;
  }
}
