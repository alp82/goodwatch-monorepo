#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

task_container="gw-import-resolution-test-$$"
cleanup() { docker stop "$task_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Match the production engine; use a fresh instance and let Docker choose a port.
docker run -d --rm --name "$task_container" -p 127.0.0.1::4200 \
  -e CRATE_HEAP_SIZE=512m crate:5.10.16 \
  -Cdiscovery.type=single-node -Ccluster.name=import-resolution-test \
  -Cnetwork.host=0.0.0.0 >/dev/null
task_address=$(docker port "$task_container" 4200/tcp)
export IMPORTS_TEST_CRATE_URL="http://$task_address"
node --input-type=module <<'JS'
const deadline = Date.now() + 60_000
while (true) {
  try {
    const response = await fetch(`${process.env.IMPORTS_TEST_CRATE_URL}/_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stmt: 'SELECT 1' }),
      signal: AbortSignal.timeout(1000),
    })
    if (response.ok) break
  } catch {}
  if (Date.now() >= deadline) throw Error('Throwaway Crate did not become ready')
  await new Promise(resolve => setTimeout(resolve, 250))
}
JS
node --test app/server/imports/resolution-store.integration.ts
