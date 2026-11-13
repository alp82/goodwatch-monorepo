#!/usr/bin/env bash
# Proves the yepwatch.com hold in production: zero failed requests while a YepWatch deploy swaps the containers
# (docs/yepwatch-zero-downtime-front.md, Verification). Run it after the owner added yepwatch-front.yaml in Coolify.
#
#   1. Preflight, read-only: yepwatch.com is served by the file router yw-front-https@file (abio's Traefik access
#      log, found by a marker query), the hold on pgnode01 is healthy, and the front's port 10.0.0.21:18480 answers.
#   2. Waits for the next YepWatch deployment to start (Coolify queue, read-only SQL). It never starts one: press
#      Redeploy in Coolify, or push to a watch path, when it says so.
#   3. While the deployment runs: `node run.mjs smoke --origin https://yepwatch.com` back to back (yepwatch-app/e2e),
#      and a GET loop (page + health every 200 ms) from this machine for the whole time.
#   4. Reads the swap window ("Removing old containers." to "New container started.") from the deployment log and
#      passes when no smoke run and no loop request failed, and at least one smoke run covered the swap.
#
# Usage: ./verify-yepwatch-front-deploy.sh [--no-wait]   (--no-wait: a deployment is already running)
# Needs: SSH to root@10.0.0.10 (Coolify DB), 10.0.0.21 (abio) and 10.0.0.11 (pgnode01); yepwatch-app/e2e installed
# (npm ci, Playwright browsers) and its smoke member file, as for any production smoke.
# Output: OUT (default yepwatch-app/e2e/artifacts/front-deploy-<UTC time>): each smoke report.json, loop.json, verdict.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd -- "$here/../.." && pwd)
e2e=$repo/yepwatch-app/e2e
origin=https://yepwatch.com
app=csq2euofkojrcfzyxwrjxwym
out=${OUT:-$e2e/artifacts/front-deploy-$(date -u +%Y%m%dT%H%M%SZ)}
max_runs=${MAX_RUNS:-8}
wait_deploy=1; [[ ${1:-} == --no-wait ]] && wait_deploy=0
mkdir -p "$out"
ssh_q() { local host=$1; shift; ssh -o ConnectTimeout=10 -o BatchMode=yes "root@$host" "$@" 2>/dev/null; }
sql() { ssh_q 10.0.0.10 "docker exec coolify-db psql -U coolify -d coolify -At -F '|' -c \"$1\""; }
deployments() { sql "select id, status from application_deployment_queues where application_id = (select id::text from applications where uuid = '$app') order by id desc limit 1"; }
die() { echo "STOP  $*"; exit 1; }

echo "--- preflight"
marker="front-verify-$(date +%s)-$RANDOM"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 40 "$origin/?$marker")
[[ $status == 200 ]] || die "GET $origin/ answered $status"
sleep 2
router=$(ssh_q 10.0.0.21 "docker logs --since 5m coolify-proxy 2>&1 | grep -F '$marker' | tail -1" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).RouterName??"")}catch{console.log("")}})')
[[ $router == yw-front-https@file ]] || die "yepwatch.com is served by router '${router:-unknown}', not yw-front-https@file: yepwatch-front.yaml isn't active yet"
echo "PASS  router $router"
[[ $(ssh_q 10.0.0.11 "curl -s --max-time 5 http://10.0.0.11:8480/edge-health") == ok ]] || die "hold health check on 10.0.0.11:8480 failed"
echo "PASS  hold healthy on 10.0.0.11:8480"
front=$(ssh_q 10.0.0.11 "curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Host: yepwatch.com' http://10.0.0.21:18480/")
[[ $front == 200 ]] || die "front port 10.0.0.21:18480 answered '$front' (a YepWatch deploy with the published port has to run first)"
echo "PASS  front port 10.0.0.21:18480 answers"

IFS='|' read -r last_id last_status <<<"$(deployments)"
if ((wait_deploy)); then
  echo "--- waiting for the next YepWatch deployment (last: #$last_id $last_status). Start it now: Coolify > YepWatch > Redeploy."
  deadline=$((SECONDS + 1800))
  while :; do
    IFS='|' read -r id state <<<"$(deployments)"
    [[ $id != "$last_id" && $state == in_progress ]] && break
    ((SECONDS < deadline)) || die "no deployment started within 30 minutes"
    sleep 5
  done
else
  id=$last_id; state=$last_status
  [[ $state == in_progress ]] || die "--no-wait, but deployment #$id is $state"
fi
echo "      deployment #$id is running"

echo "--- smoke runs and GET loop until the deployment has finished"
stop_file=$out/.stop; rm -f "$stop_file"
ORIGIN=$origin KINDS=page,health STOP_FILE=$stop_file node --no-warnings "$here/test-yepwatch-front.mjs" loop 3600 > "$out/loop.json" &
loop_pid=$!
trap 'touch "$stop_file"' EXIT
: > "$out/runs.tsv"
finished_after=0
for ((run = 1; run <= max_runs; run++)); do
  started=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  (cd "$e2e" && node run.mjs smoke --origin "$origin") > "$out/smoke-$run.log" 2>&1 && code=0 || code=$?
  ended=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  cp "$e2e/artifacts/smoke/report.json" "$out/smoke-$run.json" 2>/dev/null || echo '{}' > "$out/smoke-$run.json"
  printf '%s\t%s\t%s\t%s\n' "$run" "$started" "$ended" "$code" >> "$out/runs.tsv"
  echo "      smoke $run: exit $code ($started → $ended)"
  IFS='|' read -r _ state <<<"$(sql "select id, status from application_deployment_queues where id = $id")"
  if [[ $state != in_progress && $state != queued ]]; then
    ((finished_after)) && break # one full run after the deployment ended, then stop
    finished_after=1
  fi
done
touch "$stop_file"; wait "$loop_pid" || true
sql "select logs from application_deployment_queues where id = $id" > "$out/.deploy-log.json"
echo "      deployment #$id: $state"

echo "--- verdict"
node - "$out" "$state" <<'NODE'
const fs = require('fs');
const [out, state] = process.argv.slice(2);
const log = JSON.parse(fs.readFileSync(`${out}/.deploy-log.json`, 'utf8') || '[]');
fs.rmSync(`${out}/.deploy-log.json`); // The log stays in Coolify; only the two timestamps are kept here.
const at = (text) => log.find((e) => (e.output ?? '').includes(text))?.timestamp;
const swapFrom = at('Removing old containers.'), swapTo = at('New container started.');
const runs = fs.readFileSync(`${out}/runs.tsv`, 'utf8').trim().split('\n').filter(Boolean).map((line) => {
  const [run, started, ended, code] = line.split('\t');
  const report = JSON.parse(fs.readFileSync(`${out}/smoke-${run}.json`, 'utf8'));
  const failures = report.failures ?? [];
  const requests = failures.filter((f) => f.gate === 'errors' && /^(request failed|HTTP [45]\d\d)/.test(f.detail));
  const covers = swapFrom && swapTo && Date.parse(started) <= Date.parse(swapFrom) + 1000 && Date.parse(ended) >= Date.parse(swapTo);
  const overlaps = swapFrom && swapTo && Date.parse(started) <= Date.parse(swapTo) && Date.parse(ended) >= Date.parse(swapFrom);
  return { run, started, ended, code, tests: report.tests, failedTests: report.failed, failedRequests: requests.map((f) => `${f.journey}: ${f.detail}`),
    otherGateFailures: failures.filter((f) => !requests.includes(f)).map((f) => `${f.gate}: ${f.detail}`.slice(0, 200)), covers, overlaps };
});
const loop = JSON.parse(fs.readFileSync(`${out}/loop.json`, 'utf8'));
const failedRequests = runs.reduce((n, r) => n + r.failedRequests.length, 0) + loop.failed;
const covered = runs.some((r) => r.covers);
const verdict = { deployment: state, swap: { from: swapFrom ?? null, to: swapTo ?? null }, loop: { requests: loop.requests, failed: loop.failed, maxMs: loop.maxMs, statuses: loop.statuses, failures: loop.failures },
  runs, failedRequests, smokeCoveredSwap: covered, pass: state === 'finished' && failedRequests === 0 && covered };
fs.writeFileSync(`${out}/verdict.json`, JSON.stringify(verdict, null, 1));
console.log(`swap ${swapFrom} → ${swapTo}`);
console.log(`GET loop: ${loop.requests} requests, ${loop.failed} failed, longest ${loop.maxMs} ms ${JSON.stringify(loop.statuses)}`);
for (const r of runs) console.log(`smoke ${r.run}: ${r.tests} tests, ${r.failedTests} failed, ${r.failedRequests.length} failed requests${r.covers ? ', covered the whole swap' : r.overlaps ? ', overlapped part of the swap' : ''}${r.otherGateFailures.length ? `; other gates: ${r.otherGateFailures.length}` : ''}`);
for (const r of runs) for (const f of r.failedRequests) console.log(`  FAILED REQUEST smoke ${r.run}: ${f}`);
if (!covered) console.log('No smoke run covered the whole swap: run again (the GET loop result still counts).');
console.log(verdict.pass ? 'PASS  zero failed requests through the deploy' : 'FAIL  see verdict.json');
process.exit(verdict.pass ? 0 : 1);
NODE
