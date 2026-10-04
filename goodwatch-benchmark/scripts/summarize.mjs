import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { webappSummary } from "./webapp-metrics.mjs";

async function json(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
async function files(path) {
  try {
    return await readdir(path);
  } catch (e) {
    if (["ENOENT", "ENOTDIR"].includes(e.code)) return [];
    throw e;
  }
}
const avgMax = (values) =>
  values.length
    ? { avg: values.reduce((a, b) => a + b, 0) / values.length, max: Math.max(...values) }
    : { avg: null, max: null };
const median = (values) => {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null;
};
export const fmt = (value) =>
  value == null
    ? "n/a"
    : typeof value === "number"
      ? Number(value.toFixed(3)).toString()
      : String(value)
          .replace(/\|/g, "\\|")
          .replace(/[\r\n]/g, " ");
const table = (heads, rows) =>
  `| ${heads.join(" | ")} |\n| ${heads.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.map(fmt).join(" | ")} |`).join("\n")}\n`;
export async function summarize(directory) {
  const dir = resolve(directory);
  const meta = await json(`${dir}/meta.json`, {}),
    raw = await json(`${dir}/k6-summary.json`, meta.kind === "load" ? {} : null);
  const summary = {
    schema: 1,
    run_id: meta.run_id || basename(dir),
    kind: meta.kind || (raw ? "load" : "lighthouse"),
    label: meta.label || "",
    meta,
    load: null,
    hosts: {},
    lighthouse: {},
  };
  if (raw) {
    const values = (name, selector) => raw.metrics?.[selector ? `${name}{${selector}}` : name]?.values || {};
    const latency = (name, selector, full = false) => {
      const v = values(name, selector);
      return {
        p50: v.med ?? null,
        p95: v["p(95)"] ?? null,
        p99: v["p(99)"] ?? null,
        ...(full ? { avg: v.avg ?? null, max: v.max ?? null } : {}),
      };
    };
    const seconds = raw.state?.testRunDurationMs / 1000 || 0;
    const stats = (selector) => ({
      requests: values("http_reqs", selector).count ?? 0,
      rps: values("http_reqs", selector).rate ?? 0,
      error_rate: values("http_req_failed", selector).rate ?? null,
      latency_ms: latency("http_req_duration", selector, true),
      ttfb_ms: latency("http_req_waiting", selector),
      status: Object.fromEntries(
        ["2xx", "3xx", "4xx", "5xx", "0"].map((s) => [s, values(`status_${s}`, selector).count ?? 0]),
      ),
      response_bytes_avg: values("response_bytes", selector).avg ?? null,
    });
    const failed = Object.entries(raw.metrics || {}).flatMap(([name, metric]) =>
      Object.entries(metric.thresholds || {})
        .filter(([, v]) => v.ok === false)
        .map(([condition]) => `${name}: ${condition}`),
    );
    summary.load = {
      aborted: meta.k6_exit_code === 99,
      abort_reason: meta.k6_exit_code === 99 ? failed.join("; ") || "k6 threshold failure (details unavailable)" : null,
      duration_s: seconds,
      ...stats("phase:main"),
      dropped_iterations: values("dropped_iterations").count ?? 0,
      routes: {},
      steps: [],
    };
    for (const route of raw.plan?.routes || []) summary.load.routes[route] = stats(`phase:main,route:${route}`);
    for (const step of raw.plan?.steps || []) {
      const s = stats(`phase:main,step:${step.name}`);
      summary.load.steps.push({
        name: step.name,
        target_rps: step.rate,
        ...s,
        // An aborted run ends inside a step, so divide by the time the step really ran.
        rps:
          s.requests / Math.max(1, Math.min(step.end_s, meta.k6_exit_code === 99 ? seconds : Infinity) - step.start_s),
      });
    }
  }
  const start = Date.parse(meta.started_at) / 1000,
    end = Date.parse(meta.ended_at) / 1000;
  for (const file of (await files(`${dir}/host-metrics`)).filter((f) => f.endsWith(".jsonl")).sort()) {
    const text = await readFile(`${dir}/host-metrics/${file}`, "utf8");
    let header = {},
      samples = [];
    for (const line of text.split("\n").filter(Boolean)) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        console.warn(`Skipping incomplete metric line in ${file}`);
        continue;
      }
      if (row.type === "header") header = row;
      else if (!(Number.isFinite(start) && Number.isFinite(end)) || (row.ts >= start && row.ts <= end))
        samples.push(row);
    }
    const host = header.host || samples[0]?.host || basename(file, ".jsonl");
    const role = meta.metric_hosts?.find((h) => h.file === file || h.host === host)?.role || "data";
    const result = { role, nproc: header.nproc ?? samples[0]?.nproc ?? null, samples: samples.length, containers: {} };
    const getters = {
      cpu_busy_pct: (s) => s.cpu_busy_pct,
      iowait_pct: (s) => s.iowait_pct,
      steal_pct: (s) => s.steal_pct,
      load1: (s) => s.load1,
      mem_used_pct: (s) => (s.mem_total_kb ? 100 * (1 - s.mem_available_kb / s.mem_total_kb) : null),
      net_rx_mbps: (s) => (s.net_rx_bytes_s * 8) / 1e6,
      net_tx_mbps: (s) => (s.net_tx_bytes_s * 8) / 1e6,
      tcp_estab: (s) => s.tcp_estab,
    };
    for (const [key, get] of Object.entries(getters)) result[key] = avgMax(samples.map(get).filter(Number.isFinite));
    const names = [...new Set(samples.flatMap((s) => (s.containers || []).map((c) => c.name)))];
    for (const name of names) {
      const rows = samples.flatMap((s) => (s.containers || []).filter((c) => c.name === name));
      result.containers[name] = {
        cpu_pct: avgMax(rows.map((c) => c.cpu_pct).filter(Number.isFinite)),
        mem_mb: avgMax(rows.map((c) => c.mem_bytes / 1024 ** 2).filter(Number.isFinite)),
      };
    }
    summary.hosts[host] = result;
  }
  const webapp = raw ? await webappSummary(dir, meta, raw.metrics?.http_reqs?.values.count ?? null) : null;
  if (webapp) summary.webapp = webapp;
  for (const label of await files(`${dir}/lighthouse`)) {
    const runs = [];
    let url = "";
    for (const file of (await files(`${dir}/lighthouse/${label}`)).filter((f) => /^run-.*\.json$/.test(f)).sort()) {
      let report;
      try {
        report = await json(`${dir}/lighthouse/${label}/${file}`);
      } catch (error) {
        console.warn(`Skipping invalid Lighthouse report ${label}/${file}: ${error.message}`);
        continue;
      }
      if (!report || report.runtimeError || !Number.isFinite(report.categories?.performance?.score)) continue;
      url = report.finalDisplayedUrl || report.finalUrl || report.requestedUrl;
      const audits = report.audits || {},
        value = (id) => audits[id]?.numericValue ?? null;
      const network = audits["network-requests"]?.details?.items;
      const bytes = { script: 0, stylesheet: 0, image: 0, font: 0, document: 0, other: 0 };
      const resources = audits["resource-summary"]?.details?.items;
      const rows = resources || network || [];
      for (const item of rows) {
        const type = String(item.resourceType).toLowerCase();
        // These two rows of resource-summary repeat bytes that the other rows already count.
        if (type === "total" || type === "third-party") continue;
        bytes[type in bytes ? type : "other"] += Number(item.transferSize) || 0;
      }
      runs.push({
        performance_score: report.categories.performance.score * 100,
        fcp_ms: value("first-contentful-paint"),
        lcp_ms: value("largest-contentful-paint"),
        tbt_ms: value("total-blocking-time"),
        cls: value("cumulative-layout-shift"),
        speed_index_ms: value("speed-index"),
        ttfb_ms: value("server-response-time"),
        total_bytes: value("total-byte-weight"),
        requests: network ? network.length : null,
        bytes_by_type: bytes,
      });
    }
    if (!runs.length) continue;
    const med = Object.fromEntries(
      Object.keys(runs[0])
        .filter((k) => k !== "bytes_by_type")
        .map((key) => [key, median(runs.map((r) => r[key]))]),
    );
    med.bytes_by_type = Object.fromEntries(
      Object.keys(runs[0].bytes_by_type).map((key) => [key, median(runs.map((r) => r.bytes_by_type[key]))]),
    );
    summary.lighthouse[label] = { url, runs: runs.length, median: med, all_runs: runs };
  }
  let md = `# ${fmt(summary.run_id)}\n\n${meta.smoke ? "**Smoke run. Not a baseline.**\n\n" : ""}`;
  md += `Label: ${fmt(summary.label)}. Time: ${fmt(meta.started_at)}. Target: ${fmt(meta.target_url)}. Path: ${fmt(meta.path)}. ${summary.kind === "load" ? `Cache: ${fmt(meta.cache_mode)}. ` : ""}URL set: ${fmt(meta.url_set)}. Git: ${fmt(meta.git_commit)}${meta.git_dirty ? " (dirty)" : ""}.\n\n${meta.rate_plan || raw?.plan?.steps ? `Rate plan: ${(meta.rate_plan || raw.plan.steps).map((s) => `${s.rate} req/s for ${s.end_s - s.start_s} s`).join(", then ")}.\n\n` : ""}`;
  if (summary.load) {
    const l = summary.load;
    if (l.aborted) md += `**Aborted:** ${fmt(l.abort_reason)}\n\n`;
    if (meta.k6_exit_code && meta.k6_exit_code !== 99) md += `**k6 failed:** exit ${meta.k6_exit_code}.\n\n`;
    md += `${fmt(l.requests)} requests; ${fmt(l.rps)} req/s; ${fmt(l.error_rate == null ? null : l.error_rate * 100)}% errors; p95 ${fmt(l.latency_ms.p95)} ms; ${fmt(l.dropped_iterations)} dropped iterations.\n\n`;
    md +=
      "## Routes\n\n" +
      table(
        [
          "Route",
          "Requests",
          "Req/s",
          "Error %",
          "p50 ms",
          "p95 ms",
          "p99 ms",
          "TTFB p50 ms",
          "TTFB p95 ms",
          "TTFB p99 ms",
          "Statuses (2xx/3xx/4xx/5xx/0)",
        ],
        Object.entries(l.routes).map(([r, s]) => [
          r,
          s.requests,
          s.rps,
          s.error_rate == null ? null : s.error_rate * 100,
          s.latency_ms.p50,
          s.latency_ms.p95,
          s.latency_ms.p99,
          s.ttfb_ms.p50,
          s.ttfb_ms.p95,
          s.ttfb_ms.p99,
          ["2xx", "3xx", "4xx", "5xx", "0"].map((k) => s.status[k]).join("/"),
        ]),
      );
    md +=
      "\n## Steps\n\n" +
      table(
        ["Step", "Target req/s", "Requests", "Req/s", "Error %", "p50 ms", "p95 ms", "p99 ms", "TTFB p50 ms", "TTFB p95 ms"],
        l.steps.map((s) => [
          s.name,
          s.target_rps,
          s.requests,
          s.rps,
          s.error_rate == null ? null : s.error_rate * 100,
          s.latency_ms.p50,
          s.latency_ms.p95,
          s.latency_ms.p99,
          s.ttfb_ms.p50,
          s.ttfb_ms.p95,
        ]),
      );
  }
  if (Object.keys(summary.hosts).length)
    md +=
      "\n## Hosts\n\n" +
      table(
        [
          "Host",
          "Role",
          "Cores",
          "Samples",
          "CPU avg %",
          "CPU max %",
          "Load avg",
          "Load max",
          "Memory avg %",
          "RX Mbps avg",
          "TX Mbps avg",
          "TX Mbps max",
          "TCP established max",
        ],
        Object.entries(summary.hosts).map(([h, s]) => [
          h,
          s.role,
          s.nproc,
          s.samples,
          s.cpu_busy_pct.avg,
          s.cpu_busy_pct.max,
          s.load1.avg,
          s.load1.max,
          s.mem_used_pct.avg,
          s.net_rx_mbps.avg,
          s.net_tx_mbps.avg,
          s.net_tx_mbps.max,
          s.tcp_estab.max,
        ]),
      );
  const containers = Object.entries(summary.hosts).flatMap(([h, s]) =>
    Object.entries(s.containers).map(([name, c]) => [
      h,
      name,
      c.cpu_pct.avg,
      c.cpu_pct.max,
      c.mem_mb.avg,
      c.mem_mb.max,
    ]),
  );
  if (containers.length)
    md +=
      "\n## Containers\n\nCPU is in percent of one core.\n\n" +
      table(["Host", "Container", "CPU avg %", "CPU max %", "Memory avg MB", "Memory max MB"], containers);
  if (webapp) {
    const w = webapp;
    md += `\n## Webapp process\n\nFrom the webapp's own counters over ${fmt(w.window_s)} s, commit ${fmt(w.commit)}${w.restarted ? ", **restarted during the run**" : ""}. The times exclude the proxy, TLS, and the network.\n\n`;
    md += `Finished ${fmt(w.total_rps)} req/s in total: ${fmt(w.benchmark_rps)} from the benchmark and ${fmt(w.background_rps)} of background traffic, of which ${fmt(w.crawler_loop_rps)} are the crawler loop. Server errors: ${fmt(w.server_error_rps)} per second. Requests in flight: ${fmt(w.in_flight.avg)} on average, ${fmt(w.in_flight.max)} at most. Event loop delay: ${fmt(w.loop_delay_ms.max)} ms at most.\n\n`;
    md +=
      "CPU in percent of one core:\n\n" +
      table(
        ["Part", "Avg %", "Max %"],
        [
          ...Object.entries(w.thread_cpu_pct).map(([name, s]) => [`webapp ${name}`, s.avg, s.max]),
          ["proxy", w.proxy_cpu_pct.avg, w.proxy_cpu_pct.max],
        ],
      );
    md += `\nThe proxy accepted ${fmt(w.proxy_accepts_per_s.avg)} connections per second on average, ${fmt(w.proxy_accepts_per_s.max)} at most.\n\n`;
    md += table(
      ["Route pattern (anonymous, 2xx)", "Requests", "Req/s", "p50 ms", "p95 ms", "p99 ms", "Headers p50 ms", "Headers p95 ms", "Under 300 ms %"],
      Object.entries(w.routes).map(([route, r]) => [
        route,
        r.requests,
        r.rps,
        r.full_ms.p50,
        r.full_ms.p95,
        r.full_ms.p99,
        r.headers_ms?.p50 ?? null,
        r.headers_ms?.p95 ?? null,
        r.share_under_300_ms * 100,
      ]),
    );
    if (Object.keys(w.caches).length)
      md +=
        "\n" +
        table(
          ["Data cache", "Lookups", "Hits", "Misses", "Miss %", "Miss p50 ms", "Miss p95 ms"],
          Object.entries(w.caches).map(([cache, c]) => [cache, c.lookups, c.hit, c.miss, c.miss_ratio * 100, c.miss_ms?.p50 ?? null, c.miss_ms?.p95 ?? null]),
        );
    if (Object.keys(w.qdrant).length)
      md +=
        "\n" +
        table(
          ["Qdrant endpoint and status", "Calls", "Calls/s", "Avg ms"],
          Object.entries(w.qdrant).map(([endpoint, q]) => [endpoint, q.calls, q.calls_per_s, q.avg_ms]),
        );
  }
  if (Object.keys(summary.lighthouse).length)
    md +=
      "\n## Lighthouse (mobile, median)\n\n" +
      table(
        [
          "Label",
          "Runs",
          "Score",
          "FCP ms",
          "LCP ms",
          "TBT ms",
          "CLS",
          "Speed index ms",
          "Server response ms",
          "Bytes",
          "Requests",
        ],
        Object.entries(summary.lighthouse).map(([label, s]) => [
          label,
          s.runs,
          s.median.performance_score,
          s.median.fcp_ms,
          s.median.lcp_ms,
          s.median.tbt_ms,
          s.median.cls,
          s.median.speed_index_ms,
          s.median.ttfb_ms,
          s.median.total_bytes,
          s.median.requests,
        ]),
      );
  await writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2) + "\n");
  await writeFile(`${dir}/summary.md`, md);
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error("Usage: summarize.mjs <run-dir>");
    process.exitCode = 1;
  } else
    summarize(process.argv[2]).catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
