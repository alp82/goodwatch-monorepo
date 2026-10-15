#!/usr/bin/env bash
# A dev server with Better Auth and account deletion on, against the stores of `run.sh up` (CrateDB 16248-16250,
# Valkey 16201-16203, Mailpit 16225 with its inbox at http://127.0.0.1:16280). Every production setting is blanked,
# so nothing reaches the site's own Crate, Valkey or Supabase. The member tables and local catalog fixtures are
# seeded into the same disposable CrateDB.
#   bash scripts/auth-deletion/run.sh up && bash scripts/auth-deletion/dev.sh [port]   (default port 16290)
set -euo pipefail
cd "$(dirname "$0")/../.."
port=${1:-16290}
if (( port < 16200 || port > 16299 )); then echo 'Use a port within 16200-16299.' >&2; exit 1; fi
MCP_LOCAL_CRATE_PORT=16248 python3 scripts/mcp-read/seed-local.py
blank=()
for key in $(grep -o '^[A-Z_]*=' .env.example | tr -d =) SUPABASE_URL SUPABASE_ANON_KEY REDIS_HOST2 REDIS_HOST3; do blank+=("$key="); done
exec env "${blank[@]}" \
 CRATE_HOSTS=127.0.0.1 CRATE_PORT=16248 CRATE_USER=crate CRATE_PASS= \
 WEBAPP_ROLE=page \
 TASTE_REDIS_URL= TITLE_SNAPSHOT_REDIS_URL= TITLE_CARDS_REDIS_URL= \
 BETTER_AUTH_ENABLED=true \
 AUTH_LOCAL_SERVICES=true \
 AUTH_LOCAL_PROFILE=deletion \
 AUTH_LOCAL_VALKEY_NAT="$(cat scripts/auth-deletion/results/valkey-nat.json)" \
 BETTER_AUTH_URL="http://localhost:$port" \
 MCP_RESOURCE_URL="http://localhost:$port/mcp" \
 BETTER_AUTH_SECRET=disposable-local-dev-secret-at-least-32-chars \
 AUTH_CRATEDB_ENCRYPTION_SECRET=disposable-local-dev-encryption-secret-32 \
 AUTH_GOOGLE_CLIENT_ID=local-google-client \
 AUTH_GOOGLE_CLIENT_SECRET=local-google-secret \
 npx remix vite:dev --port "$port" --strictPort
