// Run with: node --test scripts/tap-report.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSummary, formatReport, median, parseLines, spread, summarize } from "./tap-report.mjs";

const tap = (over = {}) => ({
  type: "measurement",
  run: 1,
  page: "movie",
  control: "cast_next",
  mode: "early",
  status: "effect",
  effect_ms: 100,
  frame_ms: 110,
  tap_at_ms: 900,
  fcp_ms: 700,
  ready_ms: 2000,
  ready_at_tap: false,
  console_errors: [],
  react_errors: [],
  requests_with_body: [],
  blocked_requests: [],
  ...over,
});

test("median and spread ignore missing values", () => {
  assert.equal(median([3, null, 1, undefined, 2]), 2);
  assert.equal(median([4, 1]), 2.5);
  assert.equal(median([]), null);
  assert.deepEqual(spread([5, null, 1, 3]), { median: 3, min: 1, max: 5, count: 3 });
  assert.deepEqual(spread([null]), { median: null, min: null, max: null, count: 0 });
});

test("parseLines keeps the header and the measurements, and skips a line that was cut off", () => {
  const text = [JSON.stringify({ type: "header", planned: 3 }), JSON.stringify(tap()), '{"type":"measurement","run":2,"pa'].join("\n");
  const parsed = parseLines(text);
  assert.equal(parsed.header.planned, 3);
  assert.equal(parsed.measurements.length, 1);
});

test("a row counts taps with an effect and lost taps, and keeps other outcomes apart", () => {
  const [row] = summarize([
    tap({ effect_ms: 300 }),
    tap({ run: 2, effect_ms: 100 }),
    tap({ run: 3, status: "lost", effect_ms: null, late_effect_ms: 7000, click_on_target: true }),
    tap({ run: 4, status: "missed", effect_ms: null, detail: "The tap hit a link" }),
    tap({ run: 5, effect_ms: 200 }),
    tap({ run: 6, status: "lost", effect_ms: null, click_on_target: false, detail: 'The click landed on a "Dune"' }),
  ]);
  assert.equal(row.runs, 6);
  assert.equal(row.taps, 5);
  assert.equal(row.effect, 3);
  assert.equal(row.lost, 2);
  assert.equal(row.lost_click_elsewhere, 1);
  assert.deepEqual(row.other, { missed: 1 });
  assert.deepEqual(row.effect_ms, { median: 200, min: 100, max: 300, count: 3 });
  assert.deepEqual(row.late_effect_ms_all, [7000]);
  assert.deepEqual(row.details, ["missed: The tap hit a link", 'lost: The click landed on a "Dune"']);
});

test("rows are separate per page, mode, and control", () => {
  const rows = summarize([tap(), tap({ mode: "scroll" }), tap({ page: "show" }), tap({ control: "related_tab" }), tap({ run: 2 })]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].runs, 2);
});

test("the summary totals the taps and tallies console messages per measurement", () => {
  const summary = buildSummary(
    {
      header: { started_at: "2026-10-06T20:00:00.000Z", planned: 3, config: { runs: 3, cpu: 4, network: "none", timeout_ms: 5000 }, control_names: { cast_next: "Cast row: next arrow" } },
      measurements: [
        tap({ react_errors: [421], console_errors: ["Minified React error #421", "Minified React error #421"] }),
        tap({ run: 2, status: "lost", effect_ms: null, react_errors: [421], console_errors: ["Minified React error #421"] }),
        tap({ run: 3, status: "absent", effect_ms: null, blocked_requests: ["POST /api/poster-impressions"] }),
      ],
    },
    { run_id: "run-1", target_url: "https://site.example", tap: { where: "generator" } },
  );
  assert.deepEqual(summary.totals, { taps: 2, effect: 1, lost: 1, other: 1 });
  assert.deepEqual(summary.react_errors, [{ code: 421, measurements: 2 }]);
  assert.deepEqual(summary.console_errors, [{ message: "Minified React error #421", measurements: 2 }]);
  assert.deepEqual(summary.blocked_requests, ["POST /api/poster-impressions"]);
  const report = formatReport(summary);
  assert.match(report, /1 of 2 taps had their effect\. Lost taps: 1\./);
  assert.match(report, /\| cast_next \| 1 of 2 \| 1 of 2 \| 0 \| 1 absent \| 100 \| 100 to 100 \| 900 \| 2,000 \|/);
  assert.match(report, /React errors: #421 in 2 measurements/);
});
