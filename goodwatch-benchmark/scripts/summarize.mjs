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
  const urlSet = await json(`${dir}/urls.json`, {});
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
      // 503 answers with `GW-Page-Cache: busy`, which are also in the 5xx count.
      page_cache_busy: values("status_busy", selector).count ?? 0,
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
    // The page-view scenario: one iteration is one visitor, and a browser visitor sends a whole page view.
    const pageViews = raw.plan?.config?.scenario === "page-view";
    const kinds = ["document", "asset", "api", "side", "single"];
    const views = (selector, time) => ({
      visits: values("visits", selector).count ?? 0,
      visits_per_s: (values("visits", selector).count ?? 0) / time,
      page_views: values("page_views", selector).count ?? 0,
      page_views_per_s: (values("page_views", selector).count ?? 0) / time,
      page_view_error_rate: values("page_view_failed", selector).rate ?? null,
      page_view_ms: latency("page_view_duration", selector),
      tls_handshakes: values("tls_handshakes", selector).count ?? 0,
      tls_handshakes_per_s: (values("tls_handshakes", selector).count ?? 0) / time,
      tls_handshake_ms: latency("tls_handshake_duration", selector),
    });
    const hostStats = (selector, time) => Object.fromEntries(["site", "static"].map((host) => {
      const tags = `${selector},host:${host}`;
      const measured = stats(tags);
      return [host, { ...measured, rps: measured.requests / time, tls_handshakes: values("tls_handshakes", tags).count ?? 0 }];
    }));
    if (pageViews) {
      summary.load.page_view = {
        ...(urlSet.per_visit ? {
          files: urlSet.files,
          page_names: urlSet.page_names,
          static_url: urlSet.static_url,
          hosts: {
            ...Object.fromEntries(Object.entries(hostStats("phase:main", Math.max(1, seconds))).map(([host, measured]) => [host, { ...measured, per_visit: urlSet.per_visit[host] }])),
            other: { per_visit: urlSet.per_visit.other },
          },
          origin_share: {
            requests: urlSet.per_visit.site.requests / (urlSet.per_visit.site.requests + urlSet.per_visit.static.requests || 1),
            transfer_bytes: urlSet.per_visit.site.transfer_bytes / (urlSet.per_visit.site.transfer_bytes + urlSet.per_visit.static.transfer_bytes || 1),
          },
        } : {}),
        connections: raw.plan.config.connections,
        cache_identity: raw.plan.config.cache_identity,
        side_share: raw.plan.config.side_share,
        pages: raw.plan.pages,
        not_warm: raw.plan.not_warm,
        ...views("phase:main", Math.max(1, seconds)),
        // With SLICE_SECONDS: the first request of a visit and the whole page view, per slice of the run.
        slices: Object.keys(raw.metrics || {})
          .map((key) => key.match(/^visits\{slice:(t\d+)\}$/)?.[1])
          .filter(Boolean)
          .sort()
          .map((name, index) => ({
            start_s: index * raw.plan.config.slice_seconds,
            visits: values("visits", `slice:${name}`).count ?? 0,
            page_view_error_rate: values("page_view_failed", `slice:${name}`).rate ?? null,
            first_request_ms: latency("first_request_duration", `slice:${name}`, true),
            page_view_ms: latency("page_view_duration", `slice:${name}`, true),
          })),
        routes: Object.fromEntries(
          (raw.plan.routes || []).map((route) => [
            route,
            { page_views: values("page_views", `phase:main,route:${route}`).count ?? 0, page_view_ms: latency("page_view_duration", `phase:main,route:${route}`) },
          ]),
        ),
      };
    }
    for (const step of raw.plan?.steps || []) {
      const s = stats(`phase:main,step:${step.name}`);
      // An aborted run ends inside a step, so divide by the time the step really ran.
      const ran = Math.max(1, Math.min(step.end_s, meta.k6_exit_code === 99 ? seconds : Infinity) - step.start_s);
      summary.load.steps.push({
        name: step.name,
        target_rps: step.rate,
        ...s,
        rps: s.requests / ran,
        ...(pageViews
          ? {
              ...views(`phase:main,step:${step.name}`, ran),
              ...(urlSet.per_visit ? { hosts: hostStats(`phase:main,step:${step.name}`, ran) } : {}),
              kinds: Object.fromEntries(
                kinds.map((kind) => {
                  const selector = `phase:main,step:${step.name},kind:${kind}`;
                  return [kind, { requests: values("http_reqs", selector).count ?? 0, error_rate: values("http_req_failed", selector).rate ?? null, latency_ms: latency("http_req_duration", selector), ttfb_ms: latency("http_req_waiting", selector) }];
                }),
              ),
            }
          : {}),
      });
    }
    // Place each step on the clock, and read the samplers' lines that fall inside it. The first seconds of a step
    // are the transition from the step before, so they are left out.
    const t0 = raw.plan?.scenario_start_ms ? raw.plan.scenario_start_ms / 1000 : null;
    if (t0 != null) {
      const lines = async (path) => {
        const rows = [];
        let header = {};
        for (const line of ((await readFile(path, "utf8").catch(() => "")) || "").split("\n").filter(Boolean)) {
          try {
            const row = JSON.parse(line);
            if (row.type === "header") header = row;
            else rows.push(row);
          } catch {
            // A partial last line of an interrupted sampler.
          }
        }
        return { header, rows };
      };
      const probes = { [meta.resolve_ip || "10.0.0.21"]: await lines(`${dir}/webapp/samples.jsonl`) };
      for (const sub of (await files(dir)).filter((f) => f.startsWith("webapp-")).sort()) probes[sub.slice("webapp-".length)] = await lines(`${dir}/${sub}/samples.jsonl`);
      const hostFiles = [];
      for (const file of (await files(`${dir}/host-metrics`)).filter((f) => f.endsWith(".jsonl")).sort()) hostFiles.push({ file, ...(await lines(`${dir}/host-metrics/${file}`)) });
      const transition = Number(meta.effective_k6_inputs?.RAMP_SECONDS ?? 5);
      summary.load.steps.forEach((step, index) => {
        const plan = raw.plan.steps[index];
        const from = t0 + plan.start_s + (index ? transition : 0),
          to = t0 + Math.min(plan.end_s, meta.k6_exit_code === 99 ? seconds : Infinity);
        const resources = { window_s: Math.max(0, to - from), instances: {}, hosts: {} };
        for (const [host, probe] of Object.entries(probes)) {
          const inside = probe.rows.filter((r) => r.ts >= from && r.ts <= to);
          if (inside.length < 2) continue;
          const a = inside[0],
            b = inside.at(-1),
            dt = b.ts - a.ts,
            tick = probe.header.clk_tck || 100;
          resources.instances[host] = {
            main_thread_pct: (100 * ((b.threads?.main ?? 0) - (a.threads?.main ?? 0))) / tick / dt,
            proxy_pct: (100 * (b.proxy_ticks - a.proxy_ticks)) / tick / dt,
            proxy_accepts_per_s: (b.proxy_accepts - a.proxy_accepts) / dt,
            in_flight_max: Math.max(...inside.map((r) => r.in_flight ?? 0)),
            loop_delay_max_ms: Math.max(...inside.map((r) => (r.loop_delay_max_s ?? 0) * 1000)),
          };
        }
        for (const { file, header, rows } of hostFiles) {
          const inside = rows.filter((r) => r.ts >= from && r.ts <= to);
          if (!inside.length) continue;
          const mean = (get) => inside.reduce((sum, r) => sum + get(r), 0) / inside.length;
          const name = header.host || inside[0].host || file;
          resources.hosts[name] = {
            role: meta.metric_hosts?.find((h) => h.file === file)?.role || "data",
            nproc: header.nproc ?? null,
            cpu_busy_pct: mean((r) => r.cpu_busy_pct),
            cpu_busy_max_pct: Math.max(...inside.map((r) => r.cpu_busy_pct)),
            net_tx_mbps: mean((r) => (r.net_tx_bytes_s * 8) / 1e6),
            net_rx_mbps: mean((r) => (r.net_rx_bytes_s * 8) / 1e6),
            mem_used_pct: mean((r) => (r.mem_total_kb ? 100 * (1 - r.mem_available_kb / r.mem_total_kb) : 0)),
          };
        }
        step.resources = resources;
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
  // Further instances behind the balanced route (BENCH_WEBAPP_PROBE_EXTRA). k6 can't tell which instance answered,
  // so the benchmark's share per instance is unknown here.
  for (const sub of (await files(dir)).filter((f) => f.startsWith("webapp-")).sort()) {
    const extra = raw ? await webappSummary(dir, meta, null, sub) : null;
    if (extra) (summary.webapp_instances ||= {})[sub.slice("webapp-".length)] = extra;
  }
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
  md += `Label: ${fmt(summary.label)}. Time: ${fmt(meta.started_at)}. Target: ${fmt(meta.target_url)}. Path: ${fmt(meta.path)}. ${summary.kind === "load" ? `Cache: ${fmt(meta.cache_mode)}. ` : ""}URL set: ${fmt(meta.url_set)}. Git: ${fmt(meta.git_commit)}${meta.git_dirty ? " (dirty)" : ""}.\n\n${meta.rate_plan || raw?.plan?.steps ? `Rate plan: ${(meta.rate_plan || raw.plan.steps).map((s) => `${s.rate} ${meta.scenario === "page-view" ? "visitors/s" : "req/s"} for ${s.end_s - s.start_s} s`).join(", then ")}.\n\n` : ""}`;
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
  if (summary.load?.page_view) {
    const v = summary.load.page_view;
    md += `\n## Page views\n\nOne visitor is one iteration, on ${v.connections === "new" ? "a new connection with a full TLS handshake" : "a reused connection"}. A page view is the document plus the files and API requests of a real page load, and it fails when any of them fails. Cache identity sent with page requests: ${fmt(v.cache_identity?.join(", ") || "none")}.\n\n`;
    md += `${fmt(v.visits)} visitors; ${fmt(v.page_views)} complete page views; ${fmt(v.page_view_error_rate == null ? null : v.page_view_error_rate * 100)}% failed page views; page view p95 ${fmt(v.page_view_ms.p95)} ms; ${fmt(v.tls_handshakes)} TLS handshakes.\n\n`;
    md += table(
      ["Step", "Visitors/s target", "Visitors/s", "Page views/s", "Failed page views %", "Document p50 ms", "Document p95 ms", "Page view p50 ms", "Page view p95 ms", "Requests/s", "Request errors %", "TLS handshakes/s", "Handshake p50 ms", "Handshake p95 ms"],
      summary.load.steps.map((s) => {
        const first = s.kinds.document.requests ? s.kinds.document : s.kinds.single;
        return [s.name, s.target_rps, s.visits_per_s, s.page_views_per_s, s.page_view_error_rate == null ? null : s.page_view_error_rate * 100, first.latency_ms.p50, first.latency_ms.p95, s.page_view_ms.p50, s.page_view_ms.p95, s.rps, s.error_rate == null ? null : s.error_rate * 100, s.tls_handshakes_per_s, s.tls_handshake_ms.p50, s.tls_handshake_ms.p95];
      }),
    );
    if (v.hosts) {
      md += `\n### By host\n\nFiles: ${fmt(v.files)}. Pages name the ${v.page_names === "static" ? "static hostname" : "site's host"}.${v.static_url ? ` Static hostname: ${fmt(new URL(v.static_url).host)}.` : ""}\n\n`;
      md += "Bytes per visit come from the captured browser load, including skipped requests. k6 discards bodies and has no per-request byte count. Others are captured only and are never requested by k6. Per-visit values are weighted over all visitors, including single requests; their bytes are unknown when no capture exists.\n\n";
      md += table(
        ["Host", "Requests", "Req/s", "Error %", "p50 ms", "p95 ms", "TTFB p50 ms", "TTFB p95 ms", "TLS handshakes", "Requests/visit", "Captured KB/visit", "Connections/visit"],
        [["site", "Site"], ["static", "Static hostname"], ["other", "Others"]].map(([host, label]) => {
          const h = v.hosts[host];
          return [label, h.requests ?? null, h.rps ?? null, h.error_rate == null ? null : h.error_rate * 100, h.latency_ms?.p50 ?? null, h.latency_ms?.p95 ?? null, h.ttfb_ms?.p50 ?? null, h.ttfb_ms?.p95 ?? null, h.tls_handshakes ?? null, h.per_visit.requests, Math.round(h.per_visit.transfer_bytes / 1024), host === "other" ? null : h.per_visit.connections];
        }),
      );
      md += `\nSite share of site and static traffic: ${fmt(v.origin_share.requests * 100)}% of requests and ${fmt(v.origin_share.transfer_bytes * 100)}% of captured bytes.\n`;
    }
    if (v.pages && Object.keys(v.pages).length)
      md +=
        "\nThe last response of each page before the run:\n\n" +
        table(["Page", "Status", "Cache-Control", "Vary", "GW-Page-Cache", "GW-Cache-Identity", "Protocol", "TLS", "Cipher suite"], Object.entries(v.pages).map(([page, h]) => [page, h.status, h.cache_control, h.vary, h.page_cache, h.cache_identity, h.protocol, h.tls_version, h.tls_cipher_suite]));
    if (v.slices?.length)
      md +=
        "\nOver time, per slice of the run. The first request is the document, or the only request of a visitor without a page view:\n\n" +
        table(
          ["From second", "Visitors", "Failed page views %", "First request p50 ms", "First request p95 ms", "First request p99 ms", "First request max ms", "Page view p50 ms", "Page view p95 ms", "Page view p99 ms", "Page view max ms"],
          v.slices.map((x) => [x.start_s, x.visits, x.page_view_error_rate == null ? null : x.page_view_error_rate * 100, x.first_request_ms.p50, x.first_request_ms.p95, x.first_request_ms.p99, x.first_request_ms.max, x.page_view_ms.p50, x.page_view_ms.p95, x.page_view_ms.p99, x.page_view_ms.max]),
        );
    if (v.not_warm?.length) md += `\n**Not answered from the page store before the run:** ${fmt(v.not_warm.join(", "))}.\n`;
  }
  if (summary.load?.steps.some((s) => s.resources)) {
    const instances = [...new Set(summary.load.steps.flatMap((s) => Object.keys(s.resources?.instances || {})))];
    const hosts = [...new Set(summary.load.steps.flatMap((s) => Object.entries(s.resources?.hosts || {}).filter(([, h]) => h.role !== "data").map(([name]) => name)))];
    md +=
      "\n## Resources per step\n\nMain thread and proxy are in percent of one core. Host CPU is in percent of all cores. Each step leaves out its transition seconds.\n\n" +
      table(
        ["Step", "Target", ...instances.flatMap((i) => [`${i} main thread %`, `${i} proxy %`, `${i} proxy accepts/s`, `${i} loop delay max ms`]), ...hosts.flatMap((h) => [`${h} CPU %`, `${h} CPU max %`, `${h} TX Mbps`, `${h} RX Mbps`])],
        summary.load.steps.map((s) => [
          s.name,
          s.target_rps,
          ...instances.flatMap((i) => { const r = s.resources?.instances[i]; return [r?.main_thread_pct ?? null, r?.proxy_pct ?? null, r?.proxy_accepts_per_s ?? null, r?.loop_delay_max_ms ?? null]; }),
          ...hosts.flatMap((h) => { const r = s.resources?.hosts[h]; return [r?.cpu_busy_pct ?? null, r?.cpu_busy_max_pct ?? null, r?.net_tx_mbps ?? null, r?.net_rx_mbps ?? null]; }),
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
  if (webapp && summary.webapp_instances) {
    const all = { [meta.resolve_ip || "resolve address"]: webapp, ...summary.webapp_instances };
    const k6 = webapp.benchmark_rps == null ? null : webapp.benchmark_rps * webapp.window_s;
    const total = Object.values(all).reduce((sum, w) => sum + w.total_rps * w.window_s, 0);
    md += `\n## Webapp instances\n\nThe load spreads over ${Object.keys(all).length} instances, so "from the benchmark" and "background" in the section above are wrong for one instance. All instances together finished ${fmt(total / webapp.window_s)} req/s, of which ${fmt(k6 == null ? null : (total - k6) / webapp.window_s)} are background traffic.\n\n`;
    md += table(
      ["Instance", "Commit", "Req/s", "5xx/s", "Main thread avg %", "Main thread max %", "In flight max", "Loop delay max ms", "Memory MB"],
      Object.entries(all).map(([host, w]) => [host, w.commit, w.total_rps, w.server_error_rps, w.thread_cpu_pct.main?.avg ?? null, w.thread_cpu_pct.main?.max ?? null, w.in_flight.max, w.loop_delay_ms.max, w.resident_memory_mb]),
    );
    const rows = Object.entries(all).flatMap(([host, w]) =>
      Object.entries(w.page_cache || {}).map(([route, c]) => [host, route, c.hit, c.stale, c.joined, c.miss, c.bypass]),
    );
    if (rows.length) md += "\n" + table(["Instance", "Page cache route", "Hit", "Stale", "Joined", "Miss", "Bypass"], rows);
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
