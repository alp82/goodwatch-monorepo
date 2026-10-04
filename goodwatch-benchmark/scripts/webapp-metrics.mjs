// Turns two webapp-probe snapshots and the probe's samples into rates, latency estimates, and CPU per thread.
import { readFile } from "node:fs/promises";

const read = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};
// A snapshot holds sections that start with "@@ <name>". Each sample line is `name{labels} value`.
function parse(text) {
  const out = { ts: null, containers: null, webapp: new Map(), qdrant: new Map() };
  let section = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("@@ ")) {
      const [, name, value] = line.split(" ");
      section = name;
      if (name === "ts") out.ts = Number(value);
      if (name === "containers") out.containers = Number(value);
      continue;
    }
    if (!line || line.startsWith("#") || !(out[section] instanceof Map)) continue;
    const match = line.match(/^([a-zA-Z_:][\w:]*)(?:\{(.*)\})? (\S+)$/);
    if (!match) continue;
    const labels = Object.fromEntries([...(match[2] || "").matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2]]));
    out[section].set(`${match[1]}{${match[2] || ""}}`, { name: match[1], labels, value: Number(match[3]) });
  }
  return out;
}
// Counter increase between two snapshots. A restart resets counters, so a lower value counts from zero.
function deltas(before, after, name) {
  const rows = [];
  for (const [key, sample] of after) {
    if (sample.name !== name) continue;
    const old = before.get(key)?.value ?? 0;
    const delta = sample.value >= old ? sample.value - old : sample.value;
    if (delta > 0) rows.push({ labels: sample.labels, delta });
  }
  return rows;
}
const group = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    const k = key(row.labels);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
};
// The same estimate as PromQL's histogram_quantile: linear inside the bucket that holds the rank.
function quantile(buckets, q) {
  const sorted = [...buckets].sort((a, b) => a.le - b.le);
  const total = sorted.at(-1)?.count || 0;
  if (!total) return null;
  const rank = q * total;
  let lowerEdge = 0,
    lowerCount = 0;
  for (const bucket of sorted) {
    if (bucket.count >= rank) {
      if (bucket.le === Infinity) return lowerEdge * 1000;
      const share = bucket.count === lowerCount ? 0 : (rank - lowerCount) / (bucket.count - lowerCount);
      return (lowerEdge + (bucket.le - lowerEdge) * share) * 1000;
    }
    lowerEdge = bucket.le;
    lowerCount = bucket.count;
  }
  return null;
}
function histogram(before, after, name, key) {
  const result = {};
  for (const [k, rows] of group(deltas(before, after, `${name}_bucket`), key)) {
    const byEdge = new Map();
    for (const row of rows) {
      const le = row.labels.le === "+Inf" ? Infinity : Number(row.labels.le);
      byEdge.set(le, (byEdge.get(le) || 0) + row.delta);
    }
    const buckets = [...byEdge].map(([le, count]) => ({ le, count }));
    const count = byEdge.get(Infinity) || 0;
    if (!count) continue;
    result[k] = {
      count,
      p50_ms: quantile(buckets, 0.5),
      p95_ms: quantile(buckets, 0.95),
      p99_ms: quantile(buckets, 0.99),
      share_under_300_ms: (byEdge.get(0.3) || 0) / count,
    };
  }
  return result;
}
const stats = (values) => {
  const v = values.filter(Number.isFinite);
  return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) } : { avg: null, max: null };
};

export async function webappSummary(dir, meta, benchmarkRequests) {
  const [first, last, sampleText] = await Promise.all([
    read(`${dir}/webapp/before.txt`),
    read(`${dir}/webapp/after.txt`),
    read(`${dir}/webapp/samples.jsonl`),
  ]);
  if (!first || !last) return null;
  const a = parse(first),
    b = parse(last);
  if (!a.ts || !b.ts || !b.webapp.size) return null;
  const seconds = b.ts - a.ts;
  const gauge = (snapshot, name) => [...snapshot.webapp.values()].find((s) => s.name === name);
  const responses = deltas(a.webapp, b.webapp, "goodwatch_http_responses_total");
  const total = responses.reduce((sum, r) => sum + r.delta, 0);
  const byRoute = [...group(responses, (l) => `${l.route} ${l.status_class}`)]
    .map(([key, rows]) => ({
      route: key.split(" ")[0],
      status_class: key.split(" ")[1],
      rps: rows.reduce((sum, r) => sum + r.delta, 0) / seconds,
    }))
    .sort((x, y) => y.rps - x.rps);
  const rate = (test) => responses.filter((r) => test(r.labels)).reduce((sum, r) => sum + r.delta, 0) / seconds;
  const full = histogram(a.webapp, b.webapp, "goodwatch_http_request_duration_seconds", (l) =>
    l.audience === "anon" && l.status_class === "2xx" ? l.route : null,
  );
  const headers = histogram(a.webapp, b.webapp, "goodwatch_http_response_headers_seconds", (l) =>
    l.audience === "anon" ? l.route : null,
  );
  const routes = Object.fromEntries(
    Object.entries(full)
      .sort((x, y) => y[1].count - x[1].count)
      .map(([route, h]) => [
        route,
        {
          requests: h.count,
          rps: h.count / seconds,
          full_ms: { p50: h.p50_ms, p95: h.p95_ms, p99: h.p99_ms },
          headers_ms: headers[route] ? { p50: headers[route].p50_ms, p95: headers[route].p95_ms } : null,
          share_under_300_ms: h.share_under_300_ms,
        },
      ]),
  );
  const missTime = histogram(a.webapp, b.webapp, "goodwatch_data_cache_miss_duration_seconds", (l) => l.cache);
  const caches = {};
  for (const [cache, rows] of group(deltas(a.webapp, b.webapp, "goodwatch_data_cache_requests_total"), (l) => l.cache)) {
    const count = (result) => rows.filter((r) => r.labels.result === result).reduce((sum, r) => sum + r.delta, 0);
    const lookups = rows.filter((r) => r.labels.result !== "bypass").reduce((sum, r) => sum + r.delta, 0);
    if (!lookups) continue;
    caches[cache] = {
      lookups,
      lookups_per_s: lookups / seconds,
      hit: count("hit"),
      miss: count("miss"),
      other: lookups - count("hit") - count("miss"),
      miss_ratio: 1 - count("hit") / lookups,
      miss_ms: missTime[cache] ? { p50: missTime[cache].p50_ms, p95: missTime[cache].p95_ms } : null,
    };
  }
  // Qdrant reports a sum and a count per endpoint, so only the average is available.
  const qdrant = {};
  for (const kind of ["rest", "grpc"]) {
    const sums = deltas(a.qdrant, b.qdrant, `${kind}_responses_duration_seconds_sum`);
    for (const row of deltas(a.qdrant, b.qdrant, `${kind}_responses_duration_seconds_count`)) {
      const same = (l) => l.endpoint === row.labels.endpoint && l.status === row.labels.status && l.method === row.labels.method;
      const sum = sums.find((s) => same(s.labels))?.delta ?? 0;
      qdrant[`${kind} ${row.labels.method ? `${row.labels.method} ` : ""}${row.labels.endpoint} ${row.labels.status}`] = {
        calls: row.delta,
        calls_per_s: row.delta / seconds,
        avg_ms: (sum / row.delta) * 1000,
      };
    }
  }
  // CPU per thread name, in percent of one core, between consecutive samples inside the run.
  const start = Date.parse(meta.started_at) / 1000,
    end = Date.parse(meta.ended_at) / 1000;
  let tick = 100;
  const samples = [];
  for (const line of (sampleText || "").split("\n").filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      if (row.type === "header") tick = row.clk_tck || 100;
      else if (!(Number.isFinite(start) && Number.isFinite(end)) || (row.ts >= start - 1 && row.ts <= end + 1)) samples.push(row);
    } catch {
      // An interrupted sampler can leave a partial last line.
    }
  }
  const threads = {},
    series = { proxy: [], accepts: [], main_by_time: [] };
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].ts - samples[i - 1].ts;
    if (!(dt > 0)) continue;
    for (const [name, ticks] of Object.entries(samples[i].threads || {})) {
      const pct = (100 * (ticks - (samples[i - 1].threads?.[name] ?? ticks))) / tick / dt;
      (threads[name] ||= []).push(pct);
      if (name === "main") series.main_by_time.push({ t_s: Math.round(samples[i].ts - (start || samples[0].ts)), cpu_pct: Math.round(pct) });
    }
    series.proxy.push((100 * (samples[i].proxy_ticks - samples[i - 1].proxy_ticks)) / tick / dt);
    series.accepts.push((samples[i].proxy_accepts - samples[i - 1].proxy_accepts) / dt);
  }
  const uptimeBefore = gauge(a, "goodwatch_process_uptime_seconds")?.value ?? null,
    uptimeAfter = gauge(b, "goodwatch_process_uptime_seconds")?.value ?? null;
  return {
    window_s: seconds,
    commit: [...b.webapp.values()].find((s) => s.name === "goodwatch_build_info")?.labels.commit ?? null,
    restarted: uptimeBefore != null && uptimeAfter != null ? uptimeAfter < uptimeBefore : null,
    containers: { before: a.containers, after: b.containers },
    total_rps: total / seconds,
    benchmark_rps: benchmarkRequests == null ? null : benchmarkRequests / seconds,
    // Everything the webapp finished minus what k6 sent. A request that k6 gave up on can count on one side only.
    background_rps: benchmarkRequests == null ? null : (total - benchmarkRequests) / seconds,
    crawler_loop_rps: rate((l) => (l.route === "/person/:personKey" && l.status_class === "3xx") || l.route === "/browser-check"),
    server_error_rps: rate((l) => l.status_class === "5xx"),
    by_route_status: byRoute.slice(0, 15),
    routes,
    caches,
    qdrant,
    in_flight: stats(samples.map((s) => s.in_flight)),
    resident_memory_mb: (gauge(b, "goodwatch_process_resident_memory_bytes")?.value ?? NaN) / 1024 ** 2 || null,
    loop_delay_ms: {
      p99_max: stats(samples.map((s) => s.loop_delay_p99_s * 1000)).max,
      max: stats(samples.map((s) => s.loop_delay_max_s * 1000)).max,
    },
    thread_cpu_pct: Object.fromEntries(
      Object.entries(threads)
        .map(([name, values]) => [name, stats(values)])
        .filter(([, s]) => s.max > 0.5)
        .sort((x, y) => y[1].avg - x[1].avg),
    ),
    main_thread_by_time: series.main_by_time,
    proxy_cpu_pct: stats(series.proxy),
    proxy_accepts_per_s: stats(series.accepts),
  };
}
