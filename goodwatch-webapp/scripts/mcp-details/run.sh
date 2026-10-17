#!/usr/bin/env bash
# This suite owns only these three disposable containers and their fixed loopback ports.
set -euo pipefail
cd "$(dirname "$0")/../.."
containers=(gw-mcp-details-crate gw-mcp-details-valkey gw-mcp-details-qdrant)
for container in "${containers[@]}"; do
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "Refusing to reuse existing $container" >&2; exit 1
  fi
done
logs=$(mktemp -d /tmp/goodwatch-mcp-details.XXXXXX)
echo "Integration logs: $logs"
cleanup() { docker rm -f -v "${containers[@]}" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "${containers[0]}" -p 127.0.0.1:15967:4200 -e CRATE_HEAP_SIZE=512m crate:5.10.12 -Cdiscovery.type=single-node -Ccluster.name=gw-mcp-567 -Cnetwork.host=0.0.0.0 >/dev/null
docker run -d --name "${containers[1]}" -p 127.0.0.1:16967:6379 valkey/valkey:8.1.3 >/dev/null
docker run -d --name "${containers[2]}" -p 127.0.0.1:15970:6333 -p 127.0.0.1:15971:6334 qdrant/qdrant:v1.15.3 >/dev/null
python3 - <<'PY'
import time
from urllib.request import build_opener, ProxyHandler
http=build_opener(ProxyHandler({}))
for port,path in [(15967,'/'),(15970,'/readyz')]:
 for attempt in range(120):
  try:
   with http.open(f'http://127.0.0.1:{port}{path}',timeout=1) as response:
    if response.status==200: break
  except OSError: pass
  time.sleep(.5)
 else: raise SystemExit(f'Local service {port} did not become ready')
PY
export MCP_LOCAL_CRATE_PORT=15967
run() {
  local label=$1; shift
  echo "Running $label"
  if ! "$@" > "$logs/$label.log" 2>&1; then tail -60 "$logs/$label.log"; return 1; fi
  rg '^PASS:' "$logs/$label.log" || tail -2 "$logs/$label.log"
}
probe() { node_modules/.bin/vite-node --config scripts/mcp-details/vite.config.mjs "$@"; }
run read-seed python3 scripts/mcp-read/seed-local.py
run read probe scripts/mcp-read/local.integration.ts
run write-seed python3 scripts/mcp-write/seed-local.py
run grants python3 scripts/mcp-write/scoped-grants.py
run write probe scripts/mcp-write/local.integration.ts
run replay probe scripts/mcp-write/local.integration.ts --replay-only
run ranked-seed python3 scripts/mcp-ranked/seed-local.py
run ranked probe scripts/mcp-ranked/local.integration.ts
run native probe scripts/mcp-ranked/native.integration.ts
run personal-seed python3 scripts/mcp-personal/seed-local.py
run personal probe scripts/mcp-personal/local.integration.ts
run details-seed python3 scripts/mcp-details/seed-local.py
docker exec gw-mcp-details-valkey valkey-cli FLUSHALL >/dev/null
run details probe scripts/mcp-details/local.integration.ts
