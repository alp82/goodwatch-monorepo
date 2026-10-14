#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
unset DOCKER_CONTEXT
compose=(docker compose -f scripts/auth-cratedb/compose.yaml -f scripts/auth-wiring/compose.yaml -p goodwatch-auth-549)
AUTH_TEST_VALKEY_NAT=$(node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process'
const map = {}
for (let i = 1; i <= 3; i++) {
 const container = JSON.parse(execFileSync('docker', ['inspect', `goodwatch-auth-549-valkey${i}-1`]))[0]
 const ip = Object.values(container.NetworkSettings.Networks)[0].IPAddress
 map[`${ip}:6379`] = { host: '127.0.0.1', port: 15600+i }
}
process.stdout.write(JSON.stringify(map))
JS
)
export AUTH_TEST_VALKEY_NAT
node --test --test-concurrency=1 "$@" app/server/auth/wiring.integration.ts
