#!/usr/bin/env bash
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
export AUTH_TEST_SUITE=maintenance
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-mcp/compose.yaml -f scripts/auth-maintenance/compose.yaml -p goodwatch-auth-565)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
 echo 'Refusing to reuse existing goodwatch-auth-565 containers.' >&2
 exit 1
fi
mkdir -p scripts/auth-maintenance/results
cleanup() {
 "${compose[@]}" logs --no-color > scripts/auth-maintenance/results/containers.log 2>&1 || true
 "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"${compose[@]}" up -d
"${compose[@]}" exec -T valkey1 valkey-cli --cluster create valkey1:6379 valkey2:6379 valkey3:6379 --cluster-replicas 0 --cluster-yes > scripts/auth-maintenance/results/valkey-cluster.log
export AUTH_TEST_VALKEY_NAT
AUTH_TEST_VALKEY_NAT=$(node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process'
const map = {}
for (let i = 1; i <= 3; i++) {
 const container = JSON.parse(execFileSync('docker', ['inspect', `goodwatch-auth-565-valkey${i}-1`]))[0]
 const ip = Object.values(container.NetworkSettings.Networks)[0].IPAddress
 map[`${ip}:6379`] = { host: '127.0.0.1', port: 15700+i }
}
process.stdout.write(JSON.stringify(map))
JS
)
node --input-type=module <<'JS'
import { localCrateTransport, migrateAuthTables, authModels } from './app/server/auth/crate-adapter.server.ts'
const sql = localCrateTransport(['http://127.0.0.1:15648'], 3000)
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
await migrateAuthTables(localCrateTransport(['http://127.0.0.1:15648'], 15000))
const copiesDeadline = Date.now() + 90000
let replicated = false
while (Date.now() < copiesDeadline) {
 const copies = await sql("SELECT table_name,count(*) FROM sys.shards WHERE table_name LIKE 'auth_%' AND state='STARTED' GROUP BY table_name")
 if (copies.rows.length === authModels.length + 2 && copies.rows.every(row => row[1] === 3)) { replicated = true; break }
 await new Promise(resolve => setTimeout(resolve, 500))
}
if (!replicated) throw new Error('Auth tables did not acquire three started shard copies')
JS
if [[ "${1:-test}" == dev ]]; then
 bash --noprofile --norc
else
 npm run typecheck:auth | tee scripts/auth-maintenance/results/typecheck.log
 node --test --test-concurrency=1 \
  app/server/auth/maintenance.integration.ts \
  app/server/auth/retention.integration.ts \
  app/server/auth/population.integration.ts \
  app/server/auth/key-lifecycle.integration.ts \
  app/server/auth/revocation.integration.ts \
  app/server/auth/reconciliation.integration.ts \
  app/server/auth/signup-maintenance.integration.ts \
  app/server/auth/verification-maintenance.integration.ts \
  app/server/auth/maintenance-worker.integration.ts \
  app/server/auth/registration.integration.ts \
  app/server/auth/mcp.integration.ts \
  app/server/auth/wiring.integration.ts | tee scripts/auth-maintenance/results/integration.log
fi
