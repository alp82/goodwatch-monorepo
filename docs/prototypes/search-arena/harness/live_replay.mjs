// Replays the Qdrant batch bodies dumped by live_bench.py (DUMP=...) from Node's fetch (undici, keep-alive), the
// client a production search service would use. Times request + JSON.parse per body.
// Usage: node harness/live_replay.mjs <collection> <dump.jsonl> [reps] [url]   (url must be loopback)
import { readFileSync } from "node:fs";

const [coll, dump, repsArg, urlArg] = process.argv.slice(2);
const url = urlArg ?? "http://127.0.0.1:6533";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("local Qdrant only");
const reps = Number(repsArg ?? 5);
const rows = readFileSync(dump, "utf8").trim().split("\n").map((l) => JSON.parse(l));

async function once(body) {
  const t = performance.now();
  const r = await fetch(`${url}/collections/${coll}/points/query/batch`, {
    method: "POST", headers: { "content-type": "application/json" }, body,
  });
  const text = await r.text();
  const j = JSON.parse(text);
  if (!r.ok) throw new Error(text.slice(0, 200));
  return { ms: performance.now() - t, server: j.time * 1000, bytes: text.length };
}

const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
const med = (v) => pct(v, 0.5);
for (const r of rows.slice(0, 5)) await once(r.body); // warm-up
const by = {};
for (const r of rows) {
  const ms = [], sv = [];
  let bytes = 0;
  for (let i = 0; i < reps; i++) { const o = await once(r.body); ms.push(o.ms); sv.push(o.server); bytes = o.bytes; }
  (by[r.key] ??= []).push({ ms: med(ms), server: med(sv), bytes, n: r.n });
}
for (const [k, v] of Object.entries(by)) {
  const f = (a) => `${med(a).toFixed(1)}/${pct(a, 0.95).toFixed(1)}/${Math.max(...a).toFixed(1)}`;
  console.log(`${k}: n=${v.length} client ms p50/p95/max ${f(v.map((x) => x.ms))}  server ms ${f(v.map((x) => x.server))}  resp KB ${f(v.map((x) => x.bytes / 1024))}`);
}
