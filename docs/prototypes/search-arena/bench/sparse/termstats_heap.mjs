// Heap cost of the webapp's term stats: term -> id (Map) plus Float32Array IDF by id, from out/term_stats_eligible.json.
// node --expose-gc bench/sparse/termstats_heap.mjs
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const path = new URL("./out/term_stats_eligible.json", import.meta.url);
const raw = readFileSync(path);
gc(); const h0 = process.memoryUsage().heapUsed; const t0 = performance.now();
const st = JSON.parse(raw.toString());
const terms = new Map();
let maxId = 0;
for (const [t, [id]] of Object.entries(st.terms)) { terms.set(t, id); if (id > maxId) maxId = id; }
const idf = new Float32Array(maxId + 1);
for (const [, [id, df]] of Object.entries(st.terms)) idf[id] = Math.log(1 + (st.N - df + 0.5) / (df + 0.5));
const loadMs = performance.now() - t0;
delete st.terms;
gc(); const h1 = process.memoryUsage().heapUsed;
console.log(JSON.stringify({ terms: terms.size, max_id: maxId, json_bytes: raw.length, json_gzip_bytes: gzipSync(raw).length,
  heap_mib: +((h1 - h0) / 2 ** 20).toFixed(1), idf_array_mib: +(idf.byteLength / 2 ** 20).toFixed(1), load_ms: Math.round(loadMs) }));
