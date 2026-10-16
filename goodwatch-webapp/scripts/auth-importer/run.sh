#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
  export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
compose=(docker compose -f "$PWD/scripts/auth-importer/compose.yaml" -p goodwatch-auth-importer-551)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo 'Refusing to reuse existing importer containers.' >&2
  exit 1
fi
mkdir -p scripts/auth-importer/results
cleanup() {
  "${compose[@]}" logs --no-color > scripts/auth-importer/results/containers.log 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node --version | tee scripts/auth-importer/results/node.log
"${compose[@]}" up -d
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if "${compose[@]}" exec -T source pg_isready -h 127.0.0.1 -U importer -d auth_copy >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo 'Disposable Postgres did not become ready.' >&2; exit 1; fi
node scripts/auth-importer/prepare-fake.ts
npm run typecheck:auth-importer | tee scripts/auth-importer/results/typecheck.log
node --test --test-concurrency=1 scripts/auth-importer/cli.test.ts scripts/auth-importer/production.test.ts app/server/auth/supabase-importer.integration.ts | tee scripts/auth-importer/results/tests.log
node scripts/auth-importer/prepare-fake.ts
export AUTH_IMPORT_COPY_ONLY=yes
export AUTH_IMPORT_SOURCE_URL=postgresql://importer:local-fake-only@127.0.0.1:15651/auth_copy
export AUTH_IMPORT_CRATE_ORIGIN=http://127.0.0.1:15648
export AUTH_IMPORT_CRATE_USERNAME=importer_551
export AUTH_IMPORT_CRATE_PASSWORD=fake-target-551
export AUTH_IMPORT_PAYLOAD_SECRET=disposable-local-importer-encryption-key-551
node scripts/auth-importer/import.ts | tee scripts/auth-importer/results/dry-run.json
node scripts/auth-importer/import.ts --apply | tee scripts/auth-importer/results/import.json
node scripts/auth-importer/import.ts --apply | tee scripts/auth-importer/results/rerun.json
