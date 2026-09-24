// Encodes the parity texts (out/parity-input.json from parity_prep.py) in Node, fp32 and int8, for parity_analyze.py.
// Usage: node parity.mjs   -> out/parity-<model>-<precision>.json ({queries: [[..]], catalog: [[..]]})
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, loadEncoder } from "./lib.mjs";

const input = JSON.parse(readFileSync(join(HERE, "out", "parity-input.json"), "utf8"));
const BATCH = 16;

async function encodeAll(fn, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) out.push(...(await fn(texts.slice(i, i + BATCH))));
  return out.map((v) => Array.from(v, (x) => Math.round(x * 1e6) / 1e6));
}

for (const [key, m] of Object.entries(input.models)) {
  for (const precision of ["fp32", "int8"]) {
    const enc = await loadEncoder(key, precision, 8);
    const t = performance.now();
    const queries = await encodeAll(enc.encodeQueries, m.query_texts.map((q) => q.text));
    const catalog = await encodeAll(enc.encodePassages, m.catalog.texts);
    writeFileSync(join(HERE, "out", `parity-${key}-${precision}.json`), JSON.stringify({ queries, catalog }));
    console.log(key, precision, queries.length, catalog.length, `${((performance.now() - t) / 1000).toFixed(1)}s`);
  }
}
