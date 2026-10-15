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
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-wiring/compose.yaml -p goodwatch-auth-549)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
 echo 'Refusing to reuse existing goodwatch-auth-549 containers.' >&2
 exit 1
fi
mkdir -p scripts/auth-wiring/results
cleanup() {
 "${compose[@]}" logs --no-color > scripts/auth-wiring/results/containers.log 2>&1 || true
 "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"${compose[@]}" up -d
"${compose[@]}" exec -T valkey1 valkey-cli --cluster create valkey1:6379 valkey2:6379 valkey3:6379 --cluster-replicas 0 --cluster-yes > scripts/auth-wiring/results/valkey-cluster.log
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
npm run typecheck:auth | tee scripts/auth-wiring/results/typecheck.log
bash scripts/auth-wiring/test-local.sh "$@" | tee scripts/auth-wiring/results/integration.log
