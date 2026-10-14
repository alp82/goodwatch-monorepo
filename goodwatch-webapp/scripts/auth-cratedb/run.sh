#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
  export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
compose=(docker compose -f "$PWD/scripts/auth-cratedb/compose.yaml" -p goodwatch-auth-548)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo 'Refusing to reuse existing goodwatch-auth-548 containers.' >&2
  exit 1
fi
mkdir -p scripts/auth-cratedb/results
cleanup() {
  "${compose[@]}" unpause >/dev/null 2>&1 || true
  "${compose[@]}" logs --no-color > scripts/auth-cratedb/results/containers.log 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"${compose[@]}" up -d
node --input-type=module <<'JS'
import { localCrateTransport, migrateAuthTables } from './app/server/auth/crate-adapter.server.ts'
const sql = localCrateTransport(['http://127.0.0.1:15548'], 5000)
const deadline = Date.now() + 180000
let ready = false
while (Date.now() < deadline) {
  try {
    const nodes = await sql("SELECT name,version['number'] FROM sys.nodes ORDER BY name")
    if (JSON.stringify(nodes.rows) === JSON.stringify([['node1','5.10.12'],['node2','5.10.12'],['node3','5.10.12']])) { ready = true; break }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1000))
}
if (!ready) throw new Error('Pinned three-node local cluster did not become ready')
await migrateAuthTables(sql)
JS
npm run typecheck:auth | tee scripts/auth-cratedb/results/typecheck.log
npm run test:auth:integration | tee scripts/auth-cratedb/results/integration.log
npm --prefix scripts/auth-cratedb/conformance run test | tee scripts/auth-cratedb/results/conformance.log
