#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
for run in a b; do
  mkdir -p "$work/$run/host-metrics" "$work/$run/lighthouse/home"
  cp "$ROOT/scripts/fixtures/meta.json" "$ROOT/scripts/fixtures/k6-summary.json" "$work/$run/"
  cp "$ROOT/scripts/fixtures/target.jsonl" "$ROOT/scripts/fixtures/generator.jsonl" "$work/$run/host-metrics/"
  cp "$ROOT/scripts/fixtures/lighthouse-1.json" "$work/$run/lighthouse/home/run-1.json"
  cp "$ROOT/scripts/fixtures/lighthouse-2.json" "$work/$run/lighthouse/home/run-2.json"
done
node --input-type=module - "$work" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const meta = JSON.parse(readFileSync(`${dir}/b/meta.json`));
meta.run_id = 'fixture-b'; meta.k6_exit_code = 99; meta.cache_mode = 'cold';
writeFileSync(`${dir}/b/meta.json`, JSON.stringify(meta));
const k6 = JSON.parse(readFileSync(`${dir}/b/k6-summary.json`));
k6.metrics['http_req_duration{phase:main,route:home}'].values['p(95)'] = 120;
k6.metrics['http_req_failed{phase:main,step:s01}'].thresholds['rate<0.02'].ok = false;
writeFileSync(`${dir}/b/k6-summary.json`, JSON.stringify(k6));
JS
node "$ROOT/scripts/summarize.mjs" "$work/a"
node "$ROOT/scripts/summarize.mjs" "$work/b"
node "$ROOT/scripts/compare.mjs" "$work/a" "$work/b" --out "$work/comparison.md" --json > "$work/comparison.json"
node "$ROOT/scripts/build-longtail.mjs" --out "$work/longtail.json" --seed fixture
node "$ROOT/scripts/build-longtail.mjs" --out "$work/longtail-again.json" --seed fixture
node --input-type=module - "$work" "$ROOT" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const [dir, root] = process.argv.slice(2), read = f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
const a = read('a/summary.json'), b = read('b/summary.json');
assert.equal(a.schema, 1); assert.equal(a.load.requests, 50); assert.equal(a.load.steps[0].rps, 5);
assert.equal(a.load.routes.home.latency_ms.p95, 150); assert.equal(a.load.routes.home.status['2xx'], 50);
assert.equal(a.load.routes.home.response_bytes_avg, 1024); assert.equal(a.load.routes.home.ttfb_ms.p95, 130);
assert.equal(b.load.aborted, true); assert.match(b.load.abort_reason, /rate<0.02/);
assert.equal(a.hosts['10.0.0.21'].samples, 1); assert.equal(a.hosts['10.0.0.21'].role, 'target');
assert.equal(a.hosts['10.0.0.21'].cpu_busy_pct.avg, 25); assert.equal(a.hosts['10.0.0.21'].net_rx_mbps.avg, 1);
assert.equal(a.hosts['10.0.0.21'].containers['gk4owk8-fixture'].mem_mb.avg, 100);
assert.equal(a.lighthouse.home.median.performance_score, 85); assert.equal(a.lighthouse.home.median.lcp_ms, 1800);
assert.equal(a.lighthouse.home.median.bytes_by_type.script, 2500); assert.equal(a.lighthouse.home.median.bytes_by_type.image, 500);
const comparison = read('comparison.json');
assert(comparison.warnings.some(w => w.includes('cache_mode')));
const p95 = comparison.groups.find(g => g.title === 'Route: home').rows.find(r => r.metric === 'latency_ms.p95');
assert.equal(p95.delta, -30); assert.equal(p95.delta_pct, -20);
assert.match(readFileSync(`${dir}/a/summary.md`, 'utf8'), /Smoke run\. Not a baseline\./);
const sitemapDir = resolve(root, '../goodwatch-webapp/public/sitemaps');
const locations = new Set();
for (const name of readdirSync(sitemapDir).filter(n => /^sitemap_.*\.xml$/.test(n))) {
  const xml = readFileSync(`${sitemapDir}/${name}`, 'utf8');
  if (!xml.includes('<urlset')) continue;
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/gs)) locations.add(match[1]);
}
const entries = read('longtail.json').entries;
const titleCount = [...locations].filter(s => /\/(movie|show)\//.test(s)).length;
assert.equal(titleCount, 1000);
assert.equal(entries.length, locations.size + Math.floor(titleCount * 0.1));
assert.deepEqual(read('longtail.json'), read('longtail-again.json'));
assert(entries.every(e => e.path.startsWith('/') && !e.path.endsWith('.xml')));
rmSync(`${dir}/a/summary.json`);
assert.equal(spawnSync(process.execPath, [`${root}/scripts/compare.mjs`, `${dir}/a`, `${dir}/b`]).status, 0);
console.log(`Self-test passed: summaries, abort reporting, trimming, medians, deltas, and ${entries.length} long-tail entries.`);
JS
