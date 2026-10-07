// Run with: node --test scripts/budget.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { compareRun, compareSurface, extractMetrics, formatReport, lcpElement, lcpMatches, median, medianMetrics, urlLines } from "./budget.mjs";

const request = (url, resourceType, transferSize) => ({ url, resourceType, transferSize, finished: true, statusCode: 200 });

/** A Lighthouse report with the parts the budget reads. */
function report({ lcp = 3000, tbt = 300, cls = 0, score = 0.7, slowdown = 2.7, extra = [], snippet = '<img fetchpriority="high" src="https://images.example/t/w780/a.jpg">' } = {}) {
  return {
    finalDisplayedUrl: "https://site.example/movie/1",
    mainDocumentUrl: "https://site.example/movie/1",
    environment: { benchmarkIndex: 1100 },
    configSettings: { throttling: { cpuSlowdownMultiplier: slowdown } },
    categories: { performance: { score } },
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "total-blocking-time": { numericValue: tbt },
      "cumulative-layout-shift": { numericValue: cls },
      metrics: { details: { items: [{ observedFirstContentfulPaint: 400 }] } },
      "render-blocking-insight": { details: { items: [{ url: "https://site.example/assets/app.css" }] } },
      "lcp-breakdown-insight": { details: { items: [{ type: "table", items: [] }, { type: "node", snippet }] } },
      "network-requests": {
        details: {
          items: [
            request("https://site.example/movie/1", "Document", 50_000),
            request("https://site.example/assets/app.css", "Stylesheet", 30_000),
            request("https://site.example/assets/a.js", "Script", 40_000),
            request("https://site.example/assets/b.js", "Script", 60_000),
            request("https://site.example/assets/brand.woff2", "Font", 34_000),
            request("https://images.example/t/w780/a.jpg", "Image", 31_000),
            request("data:image/svg+xml,abc", "Image", 0),
            ...extra,
          ],
        },
      },
    },
  };
}

test("extractMetrics reads requests, bytes, and timings from a report", () => {
  const m = extractMetrics(report());
  assert.equal(m.html_bytes, 50_000);
  assert.equal(m.host_requests, 5);
  assert.equal(m.script_count, 2);
  assert.equal(m.script_bytes, 100_000);
  assert.equal(m.image_count, 1, "a data URI is not a request");
  assert.equal(m.image_bytes, 31_000);
  assert.equal(m.font_requests, 1);
  assert.equal(m.blocking_requests, 1);
  assert.equal(m.third_party_origins, 1);
  assert.equal(m.total_bytes, 245_000);
  assert.equal(m.lcp_ms, 3000);
  assert.equal(m.score, 70);
  assert.equal(m.observed_fcp_ms, 400);
});

test("median handles odd and even counts and skips missing values", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([5, undefined, Number.NaN]), 5);
  assert.equal(median([]), undefined);
  assert.deepEqual(medianMetrics([{ a: 1, b: 10 }, { a: 3, b: 30 }, { a: 2 }]), { a: 2, b: 20 });
});

test("a line passes at its limit and fails beyond it", () => {
  const surface = { budget: { lcp_ms: { max: 3000 }, score: { min: 70 }, script_count: { max: 2 } } };
  const at = compareSurface({ lcp_ms: 3000, score: 70, script_count: 2 }, [], surface);
  assert.equal(at.pass, true);
  const beyond = compareSurface({ lcp_ms: 3001, score: 69.9, script_count: 3 }, [], surface);
  assert.deepEqual(beyond.lines.map((line) => line.pass), [false, false, false]);
  assert.equal(beyond.pass, false);
});

test("a line without a measured value fails", () => {
  const result = compareSurface({}, [], { budget: { html_bytes: { max: 1 } } });
  assert.equal(result.lines[0].pass, false);
});

test("an unknown line and a line without a limit are errors, not passes", () => {
  assert.throws(() => compareSurface({}, [], { budget: { lcp: { max: 1 } } }), /Unknown budget line/);
  assert.throws(() => compareSurface({ lcp_ms: 1 }, [], { budget: { lcp_ms: {} } }), /max or min/);
  assert.throws(() => compareSurface({ lcp_ms: 1 }, [], { budget: { lcp_ms: { max: 1, min: 1 } } }), /max or min/);
});

test("the gap to the target is the distance that is left, in the line's direction", () => {
  const surface = { budget: { lcp_ms: { max: 5000 }, score: { min: 60 }, cls: { max: 0.05 } } };
  const { lines } = compareSurface({ lcp_ms: 4000, score: 65, cls: 0 }, [], surface, { lcp_ms: 2500, score: 90, cls: 0.1 });
  assert.deepEqual(lines.map((line) => line.gap), [1500, 25, 0]);
});

test("the LCP element line passes when most runs show the expected element", () => {
  const expected = { tag: "img", contains: "images.example/t/w780/" };
  const good = lcpElement(report());
  const text = lcpElement(report({ snippet: '<h1 class="title">' }));
  assert.equal(lcpMatches(good, expected), true);
  assert.equal(lcpMatches(text, expected), false);
  assert.equal(lcpMatches(null, expected), false);
  const surface = { lcp_element: expected };
  assert.equal(compareSurface({}, [good, good, text], surface).pass, true);
  const failed = compareSurface({}, [good, text, text], surface);
  assert.equal(failed.pass, false);
  assert.equal(failed.lines[0].found, "<h1>");
  assert.equal(compareSurface({}, [], surface).pass, false);
});

const budget = {
  targets: { lcp_ms: 2500 },
  surfaces: {
    movie: { path: "/movie/1", lcp_element: { tag: "img" }, budget: { lcp_ms: { max: 3500 }, script_count: { max: 2 }, font_requests: { max: 1 } } },
    list: { path: "${SHARE_LIST_PATH}", budget: { lcp_ms: { max: 3500 } } },
  },
};

test("compareRun takes the median of the runs and fails a surface without reports", () => {
  const runs = [report({ lcp: 3400 }), report({ lcp: 9000 }), report({ lcp: 3000 })];
  const result = compareRun(budget, { movie: runs });
  assert.equal(result.surfaces.movie.pass, true);
  assert.equal(result.surfaces.movie.measured.lcp_ms, 3400);
  assert.equal(result.surfaces.list.pass, false);
  assert.equal(result.pass, false);
});

test("a regression fails its line: one more script, a second font, a slower LCP", () => {
  const third = request("https://site.example/assets/c.js", "Script", 1);
  const font = request("https://site.example/assets/other.woff2", "Font", 1);
  const runs = [1, 2, 3].map(() => report({ lcp: 3600, extra: [third, font] }));
  const { surfaces } = compareRun({ ...budget, surfaces: { movie: budget.surfaces.movie } }, { movie: runs });
  assert.deepEqual(Object.fromEntries(surfaces.movie.lines.map((line) => [line.key, line.pass])), { lcp_ms: false, script_count: false, font_requests: false, lcp_element: true });
});

test("reports with another CPU slowdown than the budget's fail the time lines only", () => {
  const surfaces = { movie: { path: "/movie/1", budget: { lcp_ms: { max: 3500 }, tbt_ms: { max: 400 }, score: { min: 60 }, script_count: { max: 2 }, cls: { max: 0.01 } } } };
  const same = compareRun({ cpu_slowdown: 2.7, surfaces }, { movie: [report(), report()] });
  assert.equal(same.pass, true);
  assert.equal(same.surfaces.movie.measured.cpu_slowdown, 2.7);
  // One report of the old setting among them is enough: the median would mix two scales.
  const mixed = compareRun({ cpu_slowdown: 2.7, surfaces }, { movie: [report(), report({ slowdown: 4 }), report()] });
  assert.equal(mixed.pass, false);
  assert.deepEqual(Object.fromEntries(mixed.surfaces.movie.lines.map((line) => [line.key, line.pass])), { lcp_ms: false, tbt_ms: false, score: false, script_count: true, cls: true });
  assert.deepEqual(mixed.surfaces.movie.slowdown_mismatch, { expected: 2.7, found: [4] });
  assert.match(formatReport(mixed), /CPU slowdown 2\.7 and 4 where the budget is calibrated for 2\.7/);
  // A budget file without the setting compares as before.
  assert.equal(compareRun({ surfaces }, { movie: [report({ slowdown: 4 })] }).pass, true);
});

test("the report names each line and never prints a URL", () => {
  const result = compareRun(budget, { movie: [report()], list: [report({ lcp: 9000, snippet: '<img src="https://site.example/u/someone/lists/1.png">' })] });
  for (const markdown of [false, true]) {
    const text = formatReport(result, { markdown });
    assert.match(text, /LCP/);
    assert.match(text, /Budget: FAIL \(list\)/);
    assert.doesNotMatch(text, /someone|https?:\/\/site/);
  }
});

test("urlLines fills the share list path from the environment and refuses to run without it", () => {
  assert.deepEqual(urlLines(budget, "https://site.example/", { SHARE_LIST_PATH: "/u/x/lists/1" }), ["movie https://site.example/movie/1", "list https://site.example/u/x/lists/1"]);
  assert.throws(() => urlLines(budget, "https://site.example", {}), /needs SHARE_LIST_PATH/);
});
