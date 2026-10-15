#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
 export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
 export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
export NODE_ENV=test
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-mcp/compose.yaml -p goodwatch-auth-566)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
 echo 'Refusing to reuse existing goodwatch-auth-566 containers.' >&2
 exit 1
fi
mkdir -p scripts/auth-mcp/results
server_pid=
cleanup() {
 if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" || true; fi
 "${compose[@]}" logs --no-color > scripts/auth-mcp/results/containers.log 2>&1 || true
 "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"${compose[@]}" up -d
"${compose[@]}" exec -T valkey1 valkey-cli --cluster create valkey1:6379 valkey2:6379 valkey3:6379 --cluster-replicas 0 --cluster-yes > scripts/auth-mcp/results/valkey-cluster.log
export AUTH_TEST_VALKEY_NAT
AUTH_TEST_VALKEY_NAT=$(node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process'
const map = {}
for (let i = 1; i <= 3; i++) {
 const container = JSON.parse(execFileSync('docker', ['inspect', `goodwatch-auth-566-valkey${i}-1`]))[0]
 const ip = Object.values(container.NetworkSettings.Networks)[0].IPAddress
 map[`${ip}:6379`] = { host: '127.0.0.1', port: 15600+i }
}
process.stdout.write(JSON.stringify(map))
JS
)
node --input-type=module <<'JS'
import { localCrateTransport, migrateAuthTables } from './app/server/auth/crate-adapter.server.ts'
const sql = localCrateTransport(['http://127.0.0.1:15548'], 3000)
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
await migrateAuthTables(localCrateTransport(['http://127.0.0.1:15548'], 15000))
JS
npm run typecheck:auth | tee scripts/auth-mcp/results/typecheck.log
node --test --test-concurrency=1 app/server/auth/mcp.integration.ts app/server/auth/wiring.integration.ts | tee scripts/auth-mcp/results/integration.log
case "${1:-test}" in
 test) ;;
 serve) node scripts/auth-mcp/serve.mjs ;;
 clients)
  node scripts/auth-mcp/serve.mjs > scripts/auth-mcp/results/server.log 2>&1 &
  server_pid=$!
  node scripts/auth-mcp/clients/check.mjs
  ;;
 *) echo 'Usage: run.sh [test|serve|clients]' >&2; exit 1 ;;
esac
