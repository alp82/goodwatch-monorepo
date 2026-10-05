// Internal helper. Uses only explicitly selected environment values.
import { readFileSync, writeFileSync } from "node:fs";
const e = process.env,
  file = process.argv[3];
if (process.argv[2] === "finish" || process.argv[2] === "start") {
  const meta = JSON.parse(readFileSync(file, "utf8"));
  meta[process.argv[2] === "start" ? "started_at" : "ended_at"] = new Date().toISOString();
  if (process.argv[2] === "finish") meta.k6_exit_code = e.KIND === "load" ? Number(e.RUN_EXIT) : null;
  writeFileSync(file, JSON.stringify(meta, null, 2) + "\n");
} else {
  const steps = [];
  let seconds = 0,
    requests = 0,
    previous = Number(e.RATE_START);
  const rates = e.RATE_LIST ? e.RATE_LIST.split(",").map(Number) : [];
  if (!rates.length)
    for (let rate = previous; ; rate = Math.min(Number(e.RATE_MAX), rate + Number(e.RATE_STEP))) {
      rates.push(rate);
      if (rate === Number(e.RATE_MAX)) break;
    }
  previous = rates[0];
  for (const rate of rates) {
    const transition = steps.length ? Number(e.RAMP_SECONDS) : 0;
    const length = Number(e.STEP_DURATION) + transition;
    steps.push({
      name: `s${String(steps.length + 1).padStart(2, "0")}`,
      rate,
      start_s: seconds,
      end_s: seconds + length,
    });
    seconds += length;
    requests += rate * Number(e.STEP_DURATION) + ((previous + rate) / 2) * transition;
    previous = rate;
  }
  if (process.argv[2] === "plan") {
    console.log(
      `Steps: ${steps.map((s) => `${s.name}: ${s.rate} req/s (${s.end_s - s.start_s}s)`).join(", ")}\nTotal duration: ${seconds}s; planned requests: ${requests}`,
    );
    console.log(seconds);
  } else {
    const safeHost = (host) => (/^10\.\d+\.\d+\.\d+$/.test(host) ? host : "[redacted]");
    const keys = (e.K6_KEYS || "").split(" ").filter(Boolean);
    const inputs = Object.fromEntries(
      keys.map((key) => [key, /COOKIE|SHARE_LIST/.test(key) ? (e[key] ? "[redacted]" : "") : (e[key] ?? "")]),
    );
    const metricHosts = (e.METRIC_SPECS || "")
      .split(",")
      .filter(Boolean)
      .map((spec, index) => {
        const [host, role] = spec.split(":");
        return { host: safeHost(host), role, file: `host-${index}.jsonl` };
      });
    writeFileSync(
      file,
      JSON.stringify(
        {
          run_id: e.RUN_ID,
          kind: e.KIND,
          label: e.LABEL,
          smoke: e.MODE === "smoke" && e.KIND === "load",
          mode: e.MODE,
          cache_mode: e.CACHE_MODE,
          scenario: e.KIND === "load" ? e.SCENARIO || "requests" : null,
          connections: e.KIND === "load" ? e.CONNECTIONS || "reuse" : null,
          cache_identity: e.KIND === "load" ? e.CACHE_IDENTITY || "" : null,
          url_set: e.URL_SET_NAME,
          path: e.PATH_MODE,
          target_url: e.BENCH_TARGET_URL,
          resolve_ip: e.RESOLVE_IP,
          rate_plan: e.KIND === "load" ? steps : null,
          planned_requests: e.KIND === "load" ? requests : null,
          effective_k6_inputs: e.KIND === "load" ? inputs : null,
          git_commit: e.GIT_COMMIT,
          git_dirty: e.GIT_DIRTY === "1",
          generator_host: safeHost(e.BENCH_GENERATOR),
          jump: Boolean(e.BENCH_SSH_JUMP),
          k6_image: e.BENCH_K6_IMAGE,
          metric_hosts: metricHosts,
          started_at: null,
          ended_at: null,
          k6_exit_code: null,
          lighthouse: e.KIND === "lighthouse" ? { runs: Number(e.LH_RUNS), where: e.WHERE } : null,
        },
        null,
        2,
      ) + "\n",
    );
  }
}
