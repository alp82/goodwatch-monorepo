#!/usr/bin/env bash
# Account deletion (#553) against disposable local stores only: three-node CrateDB 5.10.12 with the auth tables and
# the member tables from the repository's schemas, three-master Valkey and Mailpit. Every container, network and
# volume is named del-auth-553-*; every port is loopback-only, within 16200-16299.
#   bash scripts/auth-deletion/run.sh         start the stores, run the unit and integration tests, remove the stores
#   bash scripts/auth-deletion/run.sh up      start the stores and leave them running (for repeated test runs)
#   bash scripts/auth-deletion/run.sh tests   run the tests against stores started with `up`
#   bash scripts/auth-deletion/run.sh down    remove the stores, their volumes and network
set -euo pipefail
cd "$(dirname "$0")/../.."
export COMPOSE_PROGRESS=plain
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
 export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
 export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
export NODE_ENV=test
export AUTH_TEST_SUITE=deletion
project=del-auth-553
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-mcp/compose.yaml -f scripts/auth-deletion/compose.yaml)
if [[ "${AUTH_DELETION_LOOPBACK:-}" == 1 ]]; then compose+=(-f scripts/auth-deletion/compose.loopback.yaml); fi
compose+=(-p "$project")
results=scripts/auth-deletion/results
mode=${1:-all}
mkdir -p "$results"

down() {
 "${compose[@]}" logs --no-color > "$results/containers.log" 2>&1 || true
 "${compose[@]}" down --volumes --remove-orphans
}

up() {
 if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo "Refusing to reuse existing $project containers." >&2
  exit 1
 fi
 "${compose[@]}" up -d node1 node2 node3 valkey1 valkey2 valkey3 smtp
 "${compose[@]}" exec -T valkey1 valkey-cli --cluster create valkey1:6379 valkey2:6379 valkey3:6379 --cluster-replicas 0 --cluster-yes > "$results/valkey-cluster.log"
 node --input-type=module > "$results/valkey-nat.json" <<'JS'
import { execFileSync } from 'node:child_process'
const map = {}
for (let i = 1; i <= 3; i++) {
 const container = JSON.parse(execFileSync('docker', ['inspect', `del-auth-553-valkey${i}-1`]))[0]
 const ip = Object.values(container.NetworkSettings.Networks)[0].IPAddress
 map[`${ip}:6379`] = { host: '127.0.0.1', port: 16200 + i }
}
process.stdout.write(JSON.stringify(map))
JS
 node --input-type=module <<'JS'
import { localCrateTransport, migrateAuthTables } from './app/server/auth/crate-adapter.server.ts'
const sql = localCrateTransport(['http://127.0.0.1:16248'], 3000)
const deadline = Date.now() + 180000
let ready = false
while (Date.now() < deadline) {
 try {
  const nodes = await sql("SELECT name,version['number'] FROM sys.nodes ORDER BY name")
  if (JSON.stringify(nodes.rows) === JSON.stringify([['node1','5.10.12'],['node2','5.10.12'],['node3','5.10.12']])) { ready = true; break }
 } catch {}
 await new Promise(resolve => setTimeout(resolve, 500))
}
if (!ready) throw new Error('Pinned local CrateDB cluster did not become ready')
await migrateAuthTables(localCrateTransport(['http://127.0.0.1:16248'], 15000))
JS
 python3 scripts/auth-deletion/member-tables.py | tee "$results/member-tables.log"
}

tests() {
 export AUTH_TEST_VALKEY_NAT
 AUTH_TEST_VALKEY_NAT=$(cat "$results/valkey-nat.json")
 npm run typecheck:auth | tee "$results/typecheck.log"
 node --test app/server/account-deletion-tables.test.ts app/server/auth/emails.test.ts app/server/share-lists/view.test.ts | tee "$results/unit.log"
 node --test --test-concurrency=1 app/server/account-deletion.integration.ts | tee "$results/integration.log"
}

case "$mode" in
 all)
  trap down EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  up
  tests
  ;;
 up) up ;;
 tests) tests ;;
 down) down ;;
 *) echo 'Usage: run.sh [all|up|tests|down]' >&2; exit 1 ;;
esac
