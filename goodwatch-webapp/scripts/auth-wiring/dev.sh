#!/usr/bin/env bash
# A dev server with Better Auth on, against the wiring's disposable Docker services: three-node CrateDB, three-master
# Valkey and the Mailpit catcher (http://127.0.0.1:15980 shows every email). Every production setting is blanked, so
# nothing reaches the site's own Crate, Valkey or Supabase; pages that need title data show their error state.
#   bash scripts/auth-wiring/dev.sh [port]   start the services if needed, then the dev server (default port 3550)
#   bash scripts/auth-wiring/dev.sh down     remove the containers and their data
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
 export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
 export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-wiring/compose.yaml -f scripts/auth-wiring/dev-compose.yaml -p goodwatch-auth-550-dev)
if [[ "${1:-}" == down ]]; then
 "${compose[@]}" down --volumes --remove-orphans
 exit 0
fi
port=${1:-3550}
"${compose[@]}" up -d
if ! "${compose[@]}" exec -T valkey1 valkey-cli cluster info | grep -q 'cluster_state:ok'; then
 "${compose[@]}" exec -T valkey1 valkey-cli --cluster create valkey1:6379 valkey2:6379 valkey3:6379 --cluster-replicas 0 --cluster-yes > /dev/null
fi
node --input-type=module <<'JS'
import { localCrateTransport, migrateAuthTables } from './app/server/auth/crate-adapter.server.ts'
const sql = localCrateTransport(['http://127.0.0.1:15848'], 3000)
const deadline = Date.now() + 180000
let ready = false
while (Date.now() < deadline) {
 try {
  const nodes = await sql('SELECT count(*) FROM sys.nodes')
  if (nodes.rows[0][0] === 3) { ready = true; break }
 } catch {}
 await new Promise(resolve => setTimeout(resolve, 500))
}
if (!ready) throw new Error('Local CrateDB cluster did not become ready')
await migrateAuthTables(localCrateTransport(['http://127.0.0.1:15848'], 15000))
JS
AUTH_LOCAL_VALKEY_NAT=$(node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process'
const map = {}
for (let i = 1; i <= 3; i++) {
 const container = JSON.parse(execFileSync('docker', ['inspect', `goodwatch-auth-550-dev-valkey${i}-1`]))[0]
 const ip = Object.values(container.NetworkSettings.Networks)[0].IPAddress
 map[`${ip}:6379`] = { host: '127.0.0.1', port: 15900 + i }
}
process.stdout.write(JSON.stringify(map))
JS
)
blank=()
for key in $(grep -o '^[A-Z_]*=' .env.example | tr -d =) SUPABASE_URL SUPABASE_ANON_KEY REDIS_HOST2 REDIS_HOST3; do blank+=("$key="); done
exec env "${blank[@]}" \
 BETTER_AUTH_ENABLED=true \
 AUTH_LOCAL_SERVICES=true \
 AUTH_LOCAL_VALKEY_NAT="$AUTH_LOCAL_VALKEY_NAT" \
 BETTER_AUTH_URL="http://localhost:$port" \
 MCP_RESOURCE_URL="http://localhost:$port/mcp" \
 BETTER_AUTH_SECRET=disposable-local-dev-secret-at-least-32-chars \
 AUTH_CRATEDB_ENCRYPTION_SECRET=disposable-local-dev-encryption-secret-32 \
 AUTH_GOOGLE_CLIENT_ID=local-google-client \
 AUTH_GOOGLE_CLIENT_SECRET=local-google-secret \
 npx remix vite:dev --port "$port" --strictPort
