// CPU cost of the query encoders in onnxruntime-node: cold start, resident memory, warm latency per batch size, and
// throughput with 4 concurrent requests in one process.
//
// Usage: node perf.mjs            driver: every model x precision x {2, 4} threads, each in its own process pinned
//                                 with taskset to as many cores as intra-op threads (a webapp container's CPU budget);
//                                 writes "perf" into results/bench/encoders.json
//        node perf.mjs child <bge|me5s|both> <fp32|int8> <threads>   one configuration, JSON on stdout
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

const RUNS = 200, WARM = 20, BATCHES = [1, 5, 10, 20, 41], CONC = 4, CONC_BATCH = 10, CONC_REQS = 200;
const SHORT_QUERY = "fantasy with dragons";
const OUT = join(import.meta.dirname, "..", "..", "results", "bench", "encoders.json");
const mb = (b) => Math.round(b / 2 ** 20);

async function child(model, precision, threads) {
  const { loadEncoder, phrasePool, pct, r2 } = await import("./lib.mjs");
  const phrases = phrasePool();
  const rss0 = process.memoryUsage().rss;
  const keys = model === "both" ? ["bge", "me5s"] : [model];
  const res = { model, precision, threads, rss_base_mb: mb(rss0) };
  const encs = {};
  for (const k of keys) {
    const rssBefore = process.memoryUsage().rss;
    const t = performance.now();
    encs[k] = await loadEncoder(k, precision, threads);
    const load = performance.now() - t;
    const t1 = performance.now();
    await encs[k].encodeQueries([SHORT_QUERY]);
    const l = encs[k].load;
    res[k] = {
      load_ms: r2(load), tokenizer_ms: r2(l.tokenizer_ms), session_ms: r2(l.session_ms),
      first_encode_ms: r2(performance.now() - t1),
      rss_tokenizer_mb: mb(l.rss_after_tokenizer - rssBefore), rss_session_mb: mb(process.memoryUsage().rss - l.rss_after_tokenizer),
    };
  }
  res.rss_loaded_mb = mb(process.memoryUsage().rss);
  if (model === "both") {
    for (const k of keys) for (const n of BATCHES) for (let i = 0; i < WARM; i++) await encs[k].encodeQueries(phrases.slice(0, n));
    res.rss_warm_mb = mb(process.memoryUsage().rss);
    res.rss_model_mb = res.rss_warm_mb - res.rss_base_mb;
    return res;
  }
  const enc = encs[model];
  const batch = (n, off = 0) => (n === 1 ? [SHORT_QUERY] : Array.from({ length: n }, (_, i) => phrases[(off + i) % phrases.length]));
  for (const n of BATCHES) for (let i = 0; i < WARM; i++) await enc.encodeQueries(batch(n));
  res.rss_warm_mb = mb(process.memoryUsage().rss);
  res.rss_model_mb = res.rss_warm_mb - res.rss_base_mb;
  res.latency = {};
  for (const n of BATCHES) {
    const ms = [];
    for (let i = 0; i < RUNS; i++) {
      const b = batch(n);
      const t = performance.now();
      await enc.encodeQueries(b);
      ms.push(performance.now() - t);
    }
    res.latency[n] = { p50: r2(pct(ms, 0.5)), p95: r2(pct(ms, 0.95)), mean: r2(ms.reduce((a, b) => a + b) / ms.length) };
  }
  // throughput: requests of CONC_BATCH phrases, one after another vs CONC in flight at once (same session)
  const request = async (i) => {
    const t = performance.now();
    await enc.encodeQueries(batch(CONC_BATCH, i * 7));
    return performance.now() - t;
  };
  let t = performance.now();
  const serial = [];
  for (let i = 0; i < CONC_REQS; i++) serial.push(await request(i));
  const serialWall = performance.now() - t;
  t = performance.now();
  const conc = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (next < CONC_REQS) conc.push(await request(next++));
  }));
  const concWall = performance.now() - t;
  res.concurrency = {
    request: `${CONC_BATCH} phrases`, requests: CONC_REQS,
    serial: { rps: r2(CONC_REQS / serialWall * 1000), p50: r2(pct(serial, 0.5)), p95: r2(pct(serial, 0.95)) },
    [`concurrent_${CONC}`]: { rps: r2(CONC_REQS / concWall * 1000), p50: r2(pct(conc, 0.5)), p95: r2(pct(conc, 0.95)) },
  };
  res.rss_peak_mb = mb(process.memoryUsage().rss);
  return res;
}

// Busy share per physical core over 700 ms (SMT siblings n and n + half), for pinning to the quietest cores.
function quietCores(n) {
  const snap = () => readFileSync("/proc/stat", "utf8").split("\n").filter((l) => /^cpu\d+ /.test(l)).map((l) => {
    const v = l.split(/\s+/).slice(1).map(Number);
    return { idle: v[3] + v[4], total: v.reduce((a, b) => a + b) };
  });
  const a = snap();
  execFileSync("sleep", ["0.7"]);
  const b = snap();
  const busy = b.map((x, i) => 1 - (x.idle - a[i].idle) / Math.max(1, x.total - a[i].total));
  const half = busy.length / 2;
  const phys = Array.from({ length: half }, (_, i) => ({ i, busy: busy[i] + busy[i + half] }));
  return phys.sort((x, y) => x.busy - y.busy).slice(0, n).map((x) => x.i).sort((x, y) => x - y);
}

function driver() {
  const ROUNDS = Number(process.env.ROUNDS ?? 3);
  const configs = [];
  for (const threads of [2, 4])
    for (const model of ["bge", "me5s"]) for (const precision of ["fp32", "int8"]) configs.push([model, precision, threads]);
  for (const precision of ["fp32", "int8"]) configs.push(["both", precision, 4]);
  const all = [];
  for (let round = 0; round < ROUNDS; round++) for (const [model, precision, threads] of configs) {
    const cores = quietCores(threads).join(","); // distinct physical cores, the least busy right now
    const load0 = readFileSync("/proc/loadavg", "utf8").split(" ")[0];
    const out = execFileSync("taskset", ["-c", cores, process.execPath, import.meta.filename, "child", model, precision, String(threads)],
      { encoding: "utf8", maxBuffer: 1 << 24 });
    const r = JSON.parse(out.trim().split("\n").at(-1));
    r.taskset = cores;
    r.round = round;
    r.loadavg_1m = [Number(load0), Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0])];
    all.push(r);
    console.error(JSON.stringify(r));
  }
  // The workstation is shared: per configuration keep the least disturbed round (lowest batch-10 p50, or lowest
  // warm RSS for the memory-only "both" runs) and list every round's batch-10 p50 for the spread.
  const runs = [];
  for (const [model, precision, threads] of configs) {
    const rs = all.filter((r) => r.model === model && r.precision === precision && r.threads === threads);
    const score = (r) => r.latency?.[10]?.p50 ?? r.rss_warm_mb;
    const best = rs.reduce((x, y) => (score(y) < score(x) ? y : x));
    runs.push({ ...best, rounds_batch10_p50: rs.map((r) => r.latency?.[10]?.p50 ?? null), rounds_loadavg_1m: rs.map((r) => r.loadavg_1m) });
  }
  const lscpu = execFileSync("lscpu", { encoding: "utf8" });
  const field = (k) => lscpu.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1];
  const doc = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  doc.machine = {
    cpu_model: field("Model name"), cores_per_socket: field("Core\\(s\\) per socket"), threads_per_core: field("Thread\\(s\\) per core"),
    max_mhz: field("CPU max MHz"), l3: field("L3 cache"), logical_cpus: cpus().length,
    avx512: /avx512f/.test(lscpu), avx512_vnni: /avx512_vnni/.test(lscpu),
    node: process.version, onnxruntime_node: JSON.parse(readFileSync(join(import.meta.dirname, "node_modules/onnxruntime-node/package.json"), "utf8")).version,
    note: `busy workstation during the run (other sessions were bulk-loading Qdrant and running benchmarks; see loadavg_1m per run); each configuration ran ${ROUNDS} times in its own Node process pinned with taskset to the least busy physical cores, as many as intra-op threads; the least disturbed round is kept`,
  };
  doc.perf = {
    method: {
      models: "Xenova ONNX exports: onnx/model.onnx (fp32), onnx/model_quantized.onnx (int8 dynamic quantization)",
      session: "onnxruntime-node CPU EP, intraOpNumThreads = threads, interOpNumThreads 1, sequential, graph optimization all",
      latency: `tokenize + run + pool + normalize, warm (${WARM} warm-up runs per size), ${RUNS} runs per batch size; batch 1 = "${SHORT_QUERY}", larger batches = facet-like phrases from the harness query caches (3-60 chars), with the query prefix`,
      cold_start: "load_ms = tokenizer + InferenceSession.create from local disk (page cache warm); first_encode_ms = first short query",
      memory: "RSS in MB: base = Node + libraries before any model, loaded = after session create, warm = after warm-up of every batch size, model = warm - base",
      concurrency: `${CONC_REQS} requests of ${CONC_BATCH} phrases on one session: serial, then ${CONC} in flight at once (async session.run)`,
    },
    runs,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify(doc, null, 1));
}

if (process.argv[2] === "child") {
  const [model, precision, threads] = process.argv.slice(3);
  console.log(JSON.stringify(await child(model, precision, Number(threads))));
} else {
  driver();
}
