// Timing p95s for a run, and for smoke a rolling window of runs where one run can't hold enough samples.
// Pure (no fs): run.mjs reads and appends the history file.
//
// A nearest-rank p95 needs at least 20 samples to be anything but the maximum (the 19th of 20 leaves the
// slowest out). The production smoke makes one room per run, so it creates once and starts once: those
// moments take their p95 over this run plus the newest earlier runs against the same origin, until 20
// samples or 20 runs. Moments a run samples 20 times (vote → peer) use the run alone.

export const RUN_P95_MIN = 20;
export const WINDOW_RUNS = 20;

/** @param {number[]} vals @param {number} p */
export const pct = (vals, p) => {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

/**
 * @param {Record<string, number[]>} run this run's clean samples per moment
 * @param {{ samples?: Record<string, number[]> }[]} history earlier runs, oldest first
 * @param {boolean} windowed whether moments short of RUN_P95_MIN samples may borrow from earlier runs (smoke only)
 * @returns {Record<string, { samples: number, p50: number | null, p95: number | null, max: number | null, runs: number, own: number }>}
 *   `runs`: how many runs the values came from; `own`: this run's samples
 */
export function timingStats(run, history = [], windowed = false) {
  const out = {};
  for (const [moment, own] of Object.entries(run)) {
    let values = [...own];
    let runs = 1;
    if (windowed && own.length < RUN_P95_MIN) {
      for (let i = history.length - 1; i >= 0 && values.length < RUN_P95_MIN && runs < WINDOW_RUNS; i--) {
        const earlier = history[i].samples?.[moment];
        if (!Array.isArray(earlier) || !earlier.length) continue;
        values = values.concat(earlier.filter((v) => typeof v === 'number' && Number.isFinite(v)));
        runs++;
      }
    }
    out[moment] = values.length
      ? { samples: values.length, p50: pct(values, 50), p95: pct(values, 95), max: Math.max(...values), runs, own: own.length }
      : { samples: 0, p50: null, p95: null, max: null, runs, own: 0 };
  }
  return out;
}

/**
 * Earlier runs against `origin`, oldest first, from history file lines (bad lines skipped).
 * @param {string} text
 * @param {string} origin
 * @returns {{ t: number, origin: string, samples: Record<string, number[]> }[]}
 */
export function readHistory(text, origin) {
  return text.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const r = JSON.parse(line);
      return r && r.origin === origin && r.samples && typeof r.samples === 'object' ? [r] : [];
    } catch {
      return [];
    }
  });
}

/**
 * The history line for this run: numbers only (no locators, names or details), the newest WINDOW_RUNS kept by the caller.
 * @param {string} origin
 * @param {Record<string, number[]>} run
 */
export function historyLine(origin, run, t = Date.now()) {
  const samples = Object.fromEntries(Object.entries(run).filter(([, v]) => v.length).map(([k, v]) => [k, v.map((x) => Math.round(x * 10) / 10)]));
  return JSON.stringify({ t, origin, samples });
}
