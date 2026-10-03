import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { summarize, fmt } from "./summarize.mjs";

async function read(dir) {
  await access(dir);
  try {
    return JSON.parse(await readFile(`${dir}/summary.json`, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return summarize(dir);
    throw e;
  }
}
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: compare.mjs <run-a> <run-b> [--out file.md] [--json]");
  process.exitCode = 1;
} else
  try {
    const [a, b] = await Promise.all(args.slice(0, 2).map((p) => read(resolve(p))));
    const warnings = ["url_set", "cache_mode", "path", "rate_plan"]
      .filter((key) => JSON.stringify(a.meta[key]) !== JSON.stringify(b.meta[key]))
      .map((key) => `Runs differ in ${key}; they are not directly comparable.`);
    if (a.meta.smoke || b.meta.smoke) warnings.push("Smoke run. Not a baseline.");
    const groups = [];
    const add = (title, specs, left, right) => {
      const get = (o, key) => key.split(".").reduce((v, k) => v?.[k], o);
      groups.push({
        title,
        rows: specs.map((key) => {
          const av = get(left, key) ?? null,
            bv = get(right, key) ?? null;
          const delta = Number.isFinite(av) && Number.isFinite(bv) ? bv - av : null;
          return {
            metric: key,
            A: av,
            B: bv,
            delta,
            delta_pct: delta !== null && av !== 0 ? (delta / Math.abs(av)) * 100 : null,
          };
        }),
      });
    };
    const union = (x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].sort();
    if (a.load || b.load)
      add(
        "Load totals",
        [
          "duration_s",
          "requests",
          "rps",
          "error_rate",
          "latency_ms.p50",
          "latency_ms.p95",
          "latency_ms.p99",
          "ttfb_ms.p95",
          "dropped_iterations",
        ],
        a.load,
        b.load,
      );
    for (const route of union(a.load?.routes, b.load?.routes))
      add(
        `Route: ${route}`,
        ["rps", "error_rate", "latency_ms.p50", "latency_ms.p95", "latency_ms.p99", "ttfb_ms.p95"],
        a.load?.routes[route],
        b.load?.routes[route],
      );
    for (const host of union(a.hosts, b.hosts)) {
      const x = a.hosts[host],
        y = b.hosts[host];
      add(
        `Host: ${host}`,
        ["cpu_busy_pct.avg", "cpu_busy_pct.max", "load1.avg", "load1.max", "mem_used_pct.avg", "mem_used_pct.max"],
        x,
        y,
      );
      for (const name of union(x?.containers, y?.containers))
        add(
          `Container: ${host}/${name}`,
          ["cpu_pct.avg", "cpu_pct.max", "mem_mb.avg", "mem_mb.max"],
          x?.containers[name],
          y?.containers[name],
        );
    }
    for (const label of union(a.lighthouse, b.lighthouse))
      add(
        `Lighthouse: ${label}`,
        ["performance_score", "fcp_ms", "lcp_ms", "tbt_ms", "cls", "total_bytes", "requests"],
        a.lighthouse[label]?.median,
        b.lighthouse[label]?.median,
      );
    let md = `# Comparison: ${fmt(a.run_id)} vs ${fmt(b.run_id)}\n\n${warnings.map((w) => `**Warning:** ${w}\n\n`).join("")}Deltas are B minus A. Error rates are fractions.\n`;
    for (const group of groups)
      md += `\n## ${fmt(group.title)}\n\n| Metric | A | B | Delta | Delta % |\n| --- | --- | --- | --- | --- |\n${group.rows.map((r) => `| ${[r.metric, r.A, r.B, r.delta, r.delta_pct].map(fmt).join(" | ")} |`).join("\n")}\n`;
    const outIndex = args.indexOf("--out");
    if (outIndex >= 0) await writeFile(args[outIndex + 1], md);
    console.log(args.includes("--json") ? JSON.stringify({ A: a.run_id, B: b.run_id, warnings, groups }, null, 2) : md);
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.code === "ENOENT" ? 1 : 0;
  }
