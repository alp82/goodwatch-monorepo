#!/usr/bin/env node
// The render path budget: reads the Lighthouse reports of a run, takes the median per surface, and compares
// each line with urls/budget.json. `urls` prints the URL list for the Lighthouse run, `check` prints pass or
// fail per line and exits 1 on a failure. The report never prints a URL: the share list path is private.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isSiteFamily, staticOriginFromSetting } from "./static-host.mjs";

// How each line is read. `unit` only formats the value.
export const LINES = {
  html_bytes: { label: "HTML, compressed", unit: "bytes" },
  host_requests: { label: "Site and static host requests", unit: "count" },
  origin_requests: { label: "Requests to the webapp host", unit: "count" },
  static_requests: { label: "Requests to the static hostname", unit: "count" },
  script_count: { label: "Scripts", unit: "count" },
  script_bytes: { label: "Script bytes", unit: "bytes" },
  image_count: { label: "Images before scrolling", unit: "count" },
  image_bytes: { label: "Image bytes before scrolling", unit: "bytes" },
  font_requests: { label: "Font requests", unit: "count" },
  blocking_requests: { label: "Render-blocking requests", unit: "count" },
  third_party_origins: { label: "Third-party origins", unit: "count" },
  total_bytes: { label: "Total bytes", unit: "bytes" },
  lcp_ms: { label: "LCP", unit: "ms" },
  tbt_ms: { label: "TBT", unit: "ms" },
  cls: { label: "CLS", unit: "score" },
  score: { label: "Performance score", unit: "points" },
};

// The lines that Lighthouse's CPU slowdown changes. Bytes, requests, and CLS don't depend on it.
export const SLOWDOWN_LINES = ["lcp_ms", "tbt_ms", "score"];

const isHttp = (url) => /^https?:\/\//.test(url);
const sum = (items, key) => items.reduce((total, item) => total + (item[key] || 0), 0);

/** The LCP element of one report: its tag and, for an image, where it comes from. */
export function lcpElement(lhr) {
  const lists = lhr.audits?.["lcp-breakdown-insight"]?.details?.items ?? [];
  const node = lists.find((item) => item.type === "node");
  if (!node?.snippet) return null;
  const tag = (node.snippet.match(/^<([a-z0-9-]+)/i)?.[1] ?? "").toLowerCase();
  return { tag, snippet: node.snippet };
}

/** The budget lines of one Lighthouse report. */
export function extractMetrics(lhr, { staticOrigin } = {}) {
  const origin = new URL(lhr.finalDisplayedUrl || lhr.requestedUrl).origin;
  const requests = (lhr.audits?.["network-requests"]?.details?.items ?? []).filter((r) => isHttp(r.url));
  staticOrigin = staticOriginFromSetting(staticOrigin) || requests.map((r) => ({ ...r, address: new URL(r.url) }))
    .find((r) => r.resourceType === "Script" && /^\/assets\/[^/]+\.js$/.test(r.address.pathname) && r.address.origin !== origin && isSiteFamily(r.address.origin, origin))?.address.origin;
  const originRequests = requests.filter((r) => new URL(r.url).origin === origin).length;
  const staticRequests = requests.filter((r) => new URL(r.url).origin === staticOrigin && staticOrigin !== origin).length;
  const ofType = (type) => requests.filter((r) => r.resourceType === type);
  const documentRequest = requests.find((r) => r.resourceType === "Document" && r.url === (lhr.mainDocumentUrl || lhr.finalDisplayedUrl));
  const audit = (id) => lhr.audits?.[id]?.numericValue;
  const observed = lhr.audits?.metrics?.details?.items?.[0] ?? {};
  return {
    html_bytes: documentRequest?.transferSize,
    host_requests: originRequests + staticRequests,
    origin_requests: originRequests,
    static_requests: staticRequests,
    script_count: ofType("Script").length,
    script_bytes: sum(ofType("Script"), "transferSize"),
    image_count: ofType("Image").length,
    image_bytes: sum(ofType("Image"), "transferSize"),
    font_requests: ofType("Font").length,
    blocking_requests: (lhr.audits?.["render-blocking-insight"]?.details?.items ?? []).length,
    third_party_origins: new Set(requests.map((r) => new URL(r.url).origin).filter((o) => o !== origin && o !== staticOrigin)).size,
    total_bytes: sum(requests, "transferSize"),
    lcp_ms: audit("largest-contentful-paint"),
    tbt_ms: audit("total-blocking-time"),
    cls: audit("cumulative-layout-shift"),
    score: lhr.categories?.performance?.score == null ? undefined : lhr.categories.performance.score * 100,
    // Not budget lines: they tell whether the measurement itself was sound.
    observed_fcp_ms: observed.observedFirstContentfulPaint,
    benchmark_index: lhr.environment?.benchmarkIndex,
    cpu_slowdown: lhr.configSettings?.throttling?.cpuSlowdownMultiplier,
  };
}

export function median(values) {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The median of each line across the runs of one surface. */
export function medianMetrics(runs) {
  const keys = new Set(runs.flatMap((run) => Object.keys(run)));
  return Object.fromEntries([...keys].map((key) => [key, median(runs.map((run) => run[key]))]));
}

/** Whether an LCP element is the one the budget names: the tag, and a text its markup must contain. */
export function lcpMatches(element, expected) {
  if (!element) return false;
  if (expected.tag && element.tag !== expected.tag) return false;
  return !expected.contains || element.snippet.includes(expected.contains);
}

// What a mismatch may print: the tag and the image's origin, never a path.
function describeLcp(element) {
  if (!element) return "not reported";
  const src = element.snippet.match(/\ssrc="([^"]+)"/)?.[1];
  let from = "";
  if (src) from = isHttp(src) ? ` from ${new URL(src).origin}` : " from this host";
  return `<${element.tag}>${from}`;
}

/**
 * Compare one surface with its budget.
 * `measured` is the median per line, `elements` the LCP element of each run.
 * A line passes when the value is within `max` or at least `min`. A line without a measured value fails.
 */
export function compareSurface(measured, elements, surface, targets = {}) {
  const lines = [];
  for (const [key, limit] of Object.entries(surface.budget ?? {})) {
    if (!LINES[key]) throw new Error(`Unknown budget line: ${key}`);
    if ((limit.max == null) === (limit.min == null)) throw new Error(`Budget line ${key} needs either max or min`);
    const value = measured[key];
    const pass = typeof value === "number" && (limit.max != null ? value <= limit.max : value >= limit.min);
    const line = { key, value, pass, ...(limit.max != null ? { max: limit.max } : { min: limit.min }) };
    const target = targets[key];
    if (target != null && typeof value === "number") {
      line.target = target;
      // Positive: how far the value is from the target. Zero: the target is met.
      line.gap = Math.max(0, limit.min != null ? target - value : value - target);
    }
    lines.push(line);
    if (key === "host_requests") {
      for (const infoKey of ["origin_requests", "static_requests"])
        if (!surface.budget[infoKey]) lines.push({ key: infoKey, value: measured[infoKey], info: true });
    }
  }
  if (surface.lcp_element) {
    const matches = elements.filter((element) => lcpMatches(element, surface.lcp_element)).length;
    const pass = elements.length > 0 && matches * 2 > elements.length;
    const odd = elements.find((element) => !lcpMatches(element, surface.lcp_element));
    lines.push({
      key: "lcp_element",
      pass,
      expected: surface.lcp_element,
      value: `${matches} of ${elements.length} runs`,
      ...(odd !== undefined || !elements.length ? { found: describeLcp(odd) } : {}),
    });
  }
  return { pass: lines.every((line) => line.info || line.pass), lines };
}

/** Compare every surface of the budget with the reports of a run. `reports` maps a surface to its reports. */
export function compareRun(budget, reports, { staticOrigin } = {}) {
  const surfaces = {};
  for (const [name, surface] of Object.entries(budget.surfaces)) {
    const runs = reports[name] ?? [];
    if (!runs.length) {
      surfaces[name] = { pass: false, runs: 0, lines: [], measured: {}, error: "no Lighthouse report" };
      continue;
    }
    const measured = medianMetrics(runs.map((run) => extractMetrics(run, { staticOrigin })));
    const result = compareSurface(measured, runs.map(lcpElement), surface, budget.targets);
    // The time lines are calibrated for one CPU slowdown. Reports with another one can't be compared with them.
    const slowdowns = [...new Set(runs.map((run) => extractMetrics(run).cpu_slowdown))];
    const other = budget.cpu_slowdown == null ? [] : slowdowns.filter((value) => value !== budget.cpu_slowdown);
    if (other.length) {
      for (const line of result.lines) if (SLOWDOWN_LINES.includes(line.key)) line.pass = false;
      result.pass = false;
      result.slowdown_mismatch = { expected: budget.cpu_slowdown, found: other.map((value) => value ?? null) };
    }
    surfaces[name] = { ...result, runs: runs.length, measured, slowdowns };
  }
  return { pass: Object.values(surfaces).every((surface) => surface.pass), surfaces };
}

const number = (value) => Math.round(value).toLocaleString("en-US");
export function formatValue(key, value) {
  if (typeof value !== "number") return value ?? "not measured";
  const unit = LINES[key]?.unit;
  if (unit === "bytes") return `${(value / 1024).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
  if (unit === "ms") return `${number(value)} ms`;
  if (unit === "score") return value.toFixed(3);
  return number(value);
}

function lineCells(line) {
  if (line.key === "lcp_element") {
    const expected = [line.expected.tag && `<${line.expected.tag}>`, line.expected.contains && `"${line.expected.contains}"`].filter(Boolean).join(" with ");
    return ["LCP element", line.found ? `${line.value}, found ${line.found}` : line.value, expected, "", ""];
  }
  const limit = line.info ? "" : line.max != null ? `max ${formatValue(line.key, line.max)}` : `min ${formatValue(line.key, line.min)}`;
  const target = line.target == null ? "" : formatValue(line.key, line.target);
  const gap = line.target == null ? "" : line.gap > 0 ? formatValue(line.key, line.gap) : "met";
  return [LINES[line.key].label, formatValue(line.key, line.value), limit, target, gap];
}

/** The report as text for the terminal, or as Markdown tables. */
export function formatReport(result, { markdown = false } = {}) {
  const out = [];
  for (const [name, surface] of Object.entries(result.surfaces)) {
    const info = surface.error
      ? surface.error
      : `median of ${surface.runs}, observed FCP ${formatValue("lcp_ms", surface.measured.observed_fcp_ms)}, CPU benchmark ${number(surface.measured.benchmark_index ?? 0)}, CPU slowdown ${(surface.slowdowns ?? []).map((value) => value ?? "not reported").join(" and ")}${
          surface.slowdown_mismatch ? ` where the budget is calibrated for ${surface.slowdown_mismatch.expected}, so LCP, TBT, and the score aren't comparable` : ""
        }`;
    if (markdown) {
      out.push(`### ${name}`, "", `${surface.pass ? "Pass" : "Fail"}: ${info}.`, "");
      if (surface.lines.length) out.push("| Line | Measured | Budget | Target | Gap to target | Result |", "| --- | --- | --- | --- | --- | --- |");
      for (const line of surface.lines) out.push(`| ${lineCells(line).join(" | ")} | ${line.info ? "Info" : line.pass ? "Pass" : "Fail"} |`);
      out.push("");
    } else {
      out.push(`${name}: ${surface.pass ? "pass" : "FAIL"} (${info})`);
      for (const line of surface.lines) {
        const [label, value, limit, target, gap] = lineCells(line);
        out.push(`  ${line.info ? "info" : line.pass ? "pass" : "FAIL"}  ${label.padEnd(30)} ${String(value).padStart(12)}  ${limit.padEnd(16)}${target ? ` target ${target}, gap ${gap}` : ""}`);
      }
    }
  }
  const failed = Object.entries(result.surfaces).filter(([, surface]) => !surface.pass).map(([name]) => name);
  out.push(result.pass ? "Budget: pass" : `Budget: FAIL (${failed.join(", ")})`);
  return out.join("\n");
}

/** The `label url` lines for the Lighthouse run. A path may name a setting, such as ${SHARE_LIST_PATH}. */
export function urlLines(budget, baseUrl, env) {
  return Object.entries(budget.surfaces).map(([name, surface]) => {
    const path = surface.path.replace(/\$\{([A-Z_]+)\}/g, (_, key) => {
      if (!env[key]) throw new Error(`Surface ${name} needs ${key}. Set it in config.env.`);
      return env[key];
    });
    return `${name} ${baseUrl.replace(/\/$/, "")}${path}`;
  });
}

function readReports(runDir, names) {
  const reports = {};
  for (const name of names) {
    const dir = `${runDir}/lighthouse/${name}`;
    if (!existsSync(dir)) continue;
    reports[name] = readdirSync(dir)
      .filter((file) => /^run-.*\.json$/.test(file))
      .sort()
      .map((file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")))
      .filter((lhr) => lhr.categories?.performance?.score != null);
  }
  return reports;
}

function main([command, ...args]) {
  if (command === "urls") {
    const budget = JSON.parse(readFileSync(args[0], "utf8"));
    console.log(urlLines(budget, args[1], process.env).join("\n"));
    return 0;
  }
  if (command === "check") {
    const [runDir, budgetFile] = args;
    const budget = JSON.parse(readFileSync(budgetFile, "utf8"));
    const result = compareRun(budget, readReports(runDir, Object.keys(budget.surfaces)), { staticOrigin: staticOriginFromSetting(process.env.BENCH_STATIC_HOST) });
    writeFileSync(`${runDir}/budget.json`, `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(`${runDir}/budget.md`, `${formatReport(result, { markdown: true })}\n`);
    console.log(formatReport(result));
    return result.pass ? 0 : 1;
  }
  console.error("Usage: budget.mjs urls BUDGET_FILE BASE_URL | check RUN_DIR BUDGET_FILE");
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
