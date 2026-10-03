#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
docker info >/dev/null 2>&1 || { echo 'Docker is not reachable. No network tests ran.' >&2; exit 1; }
work=$(mktemp -d)
server=''; container="gw-bench-local-$$"
cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
  if [[ -n $server ]]; then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node "$ROOT/scripts/stub-server.mjs" "$work/port" "$work/requests.jsonl" &
server=$!
for ((i=0;i<100;i++)); do [[ ! -s $work/port ]] || break; sleep 0.05; done
[[ -s $work/port ]] || { echo 'Stub did not start' >&2; exit 1; }
port=$(cat "$work/port")
base="$ROOT/results/$(date -u +%Y%m%dT%H%M%SZ)-local-tests"
mkdir -p "$base"
for mode in warm cold fail; do
  out="$base/$mode"; mkdir -p "$out"
  cp "$ROOT/k6/load.js" "$out/load.js"
  printf '{"name":"local","entries":[{"route":"home","path":"/%s","weight":1,"client":"browser"},{"route":"home","path":"/%s","weight":1,"client":"bot"}]}\n' "$mode" "$mode" > "$out/urls.json"
  cache=$mode; [[ $mode != fail ]] || cache=cold
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  set +e
  docker run --rm --name "$container" --network host --ulimit nofile=65535:65535 --user 0:0 -v "$out:/work" \
    -e "TARGET_URL=http://127.0.0.1:$port" -e URLS_FILE=/work/urls.json -e OUT_DIR=/work -e "CACHE_MODE=$cache" \
    -e RATE_START=5 -e RATE_MAX=5 -e STEP_DURATION=10 -e CACHE_BUST_QUERY=1 -e ABORT_DELAY=1s \
    grafana/k6:1.8.1 run /work/load.js > "$out/k6.log" 2>&1
  code=$?
  set -e
  expected=0; [[ $mode != fail ]] || expected=99
  [[ $code == "$expected" ]] || { cat "$out/k6.log"; echo "Expected exit $expected, got $code" >&2; exit 1; }
  node --input-type=module - "$out" "$mode" "$cache" "$code" "$started" "$port" <<'JS'
import { writeFileSync } from 'node:fs';
const [out, label, cache, code, started, port] = process.argv.slice(2);
writeFileSync(`${out}/meta.json`, JSON.stringify({ run_id: label, kind: 'load', label, smoke: true, cache_mode: cache, url_set: 'local', path: 'local', target_url: `http://127.0.0.1:${port}`, k6_exit_code: Number(code), started_at: started, ended_at: new Date().toISOString() }));
JS
  node "$ROOT/scripts/summarize.mjs" "$out"
done
node --input-type=module - "$base" "$work/requests.jsonl" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const [base, requestsFile] = process.argv.slice(2);
const requests = readFileSync(requestsFile, 'utf8').trim().split('\n').map(JSON.parse);
for (const request of requests) {
  assert.equal(request.method, 'GET');
  if (request.headers['user-agent'].startsWith('facebookexternalhit')) {
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers['accept-language'], undefined);
  }
  assert(!request.headers.cookie?.includes('ignored_cookie'));
}
for (const mode of ['warm', 'cold']) {
  const summary = JSON.parse(readFileSync(`${base}/${mode}/summary.json`));
  assert.equal(summary.load.error_rate, 0); assert(summary.load.requests >= 45);
  assert.equal(summary.load.routes.home.status['2xx'], summary.load.requests);
  const browser = requests.filter(r => r.path.startsWith(`/${mode}`) && !r.headers['user-agent'].startsWith('facebookexternalhit'));
  assert(browser.length > 0);
  if (mode === 'warm') assert(browser.every(r => r.headers.cookie === 'gw_browser=1' && !r.path.includes('_cb=')));
  else { assert.equal(new Set(browser.map(r => r.headers.cookie)).size, browser.length); assert(browser.every(r => r.path.includes('_cb='))); }
}
assert.equal(JSON.parse(readFileSync(`${base}/fail/summary.json`)).load.aborted, true);
console.log(`Local k6 tests passed. Results: ${base}`);
JS
