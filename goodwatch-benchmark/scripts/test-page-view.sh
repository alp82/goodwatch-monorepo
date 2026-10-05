#!/usr/bin/env bash
# Runs the page-view scenario against an HTTP/2 stub with TLS on loopback and checks what arrived: one new,
# unresumed TLS connection per visitor, the whole page view on it, and the cache identity header on pages only.
# Uses local Docker. No SSH, no target traffic.
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
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$work/key.pem" -out "$work/cert.pem" -days 1 -subj '/CN=127.0.0.1' >/dev/null 2>&1
base="$ROOT/results/$(date -u +%Y%m%dT%H%M%SZ)-local-page-view-tests"
for mode in new reuse; do
  : > "$work/requests.jsonl"; rm -f "$work/port"
  node "$ROOT/scripts/stub-tls-server.mjs" "$work/port" "$work/requests.jsonl" "$work/key.pem" "$work/cert.pem" &
  server=$!
  for ((i=0;i<100;i++)); do [[ ! -s $work/port ]] || break; sleep 0.05; done
  [[ -s $work/port ]] || { echo 'Stub did not start' >&2; exit 1; }
  port=$(cat "$work/port")
  out="$base/$mode"; mkdir -p "$out"
  cp "$ROOT/k6/load.js" "$out/load.js"
  # A capture as page-view/capture.mjs writes it: a page with files on its connection, one file on a second
  # connection, a replayed POST, and the error tracking POST that must not be sent.
  cat > "$work/capture.json" <<JSON
{"captured_at":"2026-01-01T00:00:00.000Z","pages":[{"path":"/movie/1","status":200,"requests":[
 {"own":true,"method":"GET","type":"Document","path":"/movie/1","status":200,"connection":1,"protocol":"h2","transfer_bytes":1000},
 {"own":true,"method":"GET","type":"Script","path":"/assets/a.js","status":200,"connection":1,"transfer_bytes":2000},
 {"own":true,"method":"GET","type":"Stylesheet","path":"/assets/b.css","status":200,"connection":1,"transfer_bytes":3000},
 {"own":true,"method":"GET","type":"Manifest","path":"/site.webmanifest","status":200,"connection":2,"transfer_bytes":100},
 {"own":true,"method":"POST","type":"Fetch","path":"/api/living-room/picks?view=pool","status":200,"connection":1,"body":"{\"guest\":{}}","request_body_bytes":12},
 {"own":true,"method":"POST","type":"Fetch","path":"/api/e","status":200,"connection":1,"request_body_bytes":50000},
 {"own":false,"method":"GET","type":"Image","path":"/x.jpg","status":200,"connection":3}]}]}
JSON
  printf '{"name":"local","entries":[{"route":"title_movie","path":"/movie/1","weight":3,"client":"browser"},{"route":"og_title","path":"/og/movie/1.png","weight":1,"client":"bot"}]}\n' > "$work/set.json"
  node "$ROOT/scripts/page-view-set.mjs" "$work/set.json" "$work/capture.json" > "$out/urls.json"
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  docker run --rm --name "$container" --network host --user 0:0 -v "$out:/work" \
    -e "TARGET_URL=https://127.0.0.1:$port" -e INSECURE_TLS=1 -e URLS_FILE=/work/urls.json -e OUT_DIR=/work -e SCENARIO=page-view \
    -e "CONNECTIONS=$mode" -e 'CACHE_IDENTITY=anon;US;en' -e COOKIE= -e RATE_START=4 -e RATE_MAX=4 -e PRE_VUS=4 -e MAX_VUS=8 -e STEP_DURATION=10 -e SLICE_SECONDS=5 -e ABORT_DELAY=1s \
    grafana/k6:1.8.1 run /work/load.js > "$out/k6.log" 2>&1 || { cat "$out/k6.log"; echo 'k6 failed' >&2; exit 1; }
  kill "$server"; wait "$server" 2>/dev/null || true; server=''
  cp "$work/requests.jsonl" "$out/requests.jsonl"
  node --input-type=module - "$out" "$mode" "$started" "$port" <<'JS'
import { writeFileSync } from 'node:fs';
const [out, mode, started, port] = process.argv.slice(2);
writeFileSync(`${out}/meta.json`, JSON.stringify({ run_id: mode, kind: 'load', label: mode, smoke: true, cache_mode: 'warm', scenario: 'page-view', connections: mode, url_set: 'local', path: 'local', target_url: `https://127.0.0.1:${port}`, k6_exit_code: 0, started_at: started, ended_at: new Date().toISOString() }));
JS
  node "$ROOT/scripts/summarize.mjs" "$out"
done
node --input-type=module - "$base" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.argv[2];
for (const mode of ['new', 'reuse']) {
  const rows = readFileSync(`${base}/${mode}/requests.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
  const summary = JSON.parse(readFileSync(`${base}/${mode}/summary.json`));
  const view = summary.load.page_view;
  const connections = rows.filter((r) => r.event === 'connection'), requests = rows.filter((r) => r.event === 'request');
  assert(connections.every((c) => c.alpn === 'h2'), 'every connection negotiates HTTP/2');
  assert(connections.every((c) => !c.resumed), 'no TLS session is resumed');
  assert(requests.every((r) => r.path !== '/api/e'), 'the error tracking POST is never sent');
  assert(view.visits >= 30 && view.page_view_error_rate === 0 && summary.load.error_rate === 0);
  assert(view.slices.length === 2 && view.slices.reduce((sum, x) => sum + x.visits, 0) === view.visits, 'two slices hold every visitor');
  // Pages carry the identity header. Files, images, and API requests don't.
  for (const r of requests) assert.equal(r.headers['gw-cache-identity'], r.path === '/movie/1' ? 'anon;US;en' : undefined, r.path);
  const posts = requests.filter((r) => r.method === 'POST');
  assert(posts.length > 0 && posts.every((r) => r.path === '/api/living-room/picks?view=pool' && r.body_bytes === 12));
  // The proxy's cookie from the document comes back with the page's files, and with nothing else.
  for (const r of requests.filter((r) => r.path.startsWith('/assets/'))) assert.match(r.headers.cookie || '', /gw_instance=a/);
  for (const r of requests.filter((r) => r.path === '/movie/1' || r.path === '/site.webmanifest' || r.path.startsWith('/og/'))) assert.equal(r.headers.cookie, undefined);
  const main = requests.filter((r) => r.headers['user-agent'] && !['prewarm'].includes(r.phase));
  const byConnection = new Map();
  for (const r of main) byConnection.set(r.connection, [...(byConnection.get(r.connection) || []), r.path]);
  if (mode === 'new') {
    // Setup uses one connection. After it, every visitor and every side request has its own.
    const lists = [...byConnection.values()].slice(1);
    assert(lists.length >= view.visits, `${lists.length} connections for ${view.visits} visitors`);
    for (const list of lists) {
      if (list[0] === '/movie/1') assert.deepEqual([...list].sort(), ['/api/living-room/picks?view=pool', '/assets/a.js', '/assets/b.css', '/movie/1']);
      else assert(list.length === 1 && ['/site.webmanifest', '/og/movie/1.png'].includes(list[0]), list.join(' '));
    }
    assert(Math.abs(view.tls_handshakes - (connections.length - 1)) <= 3, `${view.tls_handshakes} handshakes counted, ${connections.length} connections seen`);
  } else {
    // One connection per virtual user that ran, and one for setup.
    assert(connections.length <= 17, `${connections.length} connections for ${view.visits} visitors`);
  }
  console.log(`${mode}: ${view.visits} visitors, ${view.page_views} page views, ${connections.length} connections, ${requests.length} requests, ${view.tls_handshakes} handshakes counted`);
}
console.log(`Page-view tests passed. Results: ${base}`);
JS
